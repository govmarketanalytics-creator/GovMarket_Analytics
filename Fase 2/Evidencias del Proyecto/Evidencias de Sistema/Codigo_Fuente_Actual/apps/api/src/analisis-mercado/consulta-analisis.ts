import type { ConsultarAnalisisMercadoDto } from "./dto/consultar-analisis-mercado.dto";
import { identificarRegion } from "./modelo-analisis";

export function periodoComparacion(desde: string, hasta: string) {
  const inicio = Date.parse(desde + "T00:00:00Z");
  const dias =
    Math.round((Date.parse(hasta + "T00:00:00Z") - inicio) / 86_400_000) + 1;
  return {
    fechaDesde: new Date(inicio - dias * 86_400_000).toISOString().slice(0, 10),
    fechaHasta: new Date(inicio - 86_400_000).toISOString().slice(0, 10),
    dias,
    diasPorTramo: Math.max(1, Math.ceil(dias / 10)),
  };
}
const normalizar = (s: string) =>
  "translate(lower(COALESCE(" + s + ", '')), 'áéíóúüñ', 'aeiouun')";
export function consultaAnalisis(
  empresaId: string,
  f: ConsultarAnalisisMercadoDto,
) {
  const anterior = periodoComparacion(f.fechaDesde, f.fechaHasta);
  const parametros: unknown[] = [
    anterior.fechaDesde,
    f.fechaHasta,
    f.fechaDesde,
    f.moneda,
    empresaId,
    anterior.diasPorTramo,
  ];
  const condiciones = [
    "COALESCE(l.datos_origen ->> 'esPrueba', 'false') <> 'true'",
    "l.fecha_publicacion >= ($1::date::timestamp AT TIME ZONE 'America/Santiago')",
    "l.fecha_publicacion < (($2::date + 1)::timestamp AT TIME ZONE 'America/Santiago')",
  ];
  if (f.region) {
    const region = identificarRegion(f.region);
    if (region) {
      parametros.push(region.patrones);
      condiciones.push(
        "EXISTS (SELECT 1 FROM unnest($" +
          parametros.length +
          "::text[]) p WHERE strpos(" +
          normalizar("l.region_unidad") +
          ", p) > 0)",
      );
    } else {
      parametros.push(f.region);
      condiciones.push(
        normalizar("l.region_unidad") +
          " = " +
          normalizar("$" + parametros.length + "::text"),
      );
    }
  }
  if (f.categoria) {
    parametros.push(f.categoria);
    condiciones.push(
      "EXISTS (SELECT 1 FROM licitacion_items fi WHERE fi.licitacion_id = l.id AND fi.categoria = $" +
        parametros.length +
        ")",
    );
  }
  if (f.organismo) {
    parametros.push(f.organismo);
    condiciones.push("l.nombre_organismo = $" + parametros.length);
  }
  if (f.alcance === "empresa")
    condiciones.push(`EXISTS (
    SELECT 1 FROM perfil p WHERE
      EXISTS (SELECT 1 FROM licitacion_items pi WHERE pi.licitacion_id = l.id
        AND (pi.codigo_categoria = ANY(p.codigos_categoria) OR pi.codigo_producto = ANY(p.codigos_categoria)))
      OR EXISTS (SELECT 1 FROM unnest(p.palabras_clave || p.etiquetas_capacidades) AS t(termino)
        WHERE length(btrim(t.termino)) >= 2
        AND strpos(${normalizar("l.nombre || ' ' || COALESCE(l.descripcion, '')")}, ${normalizar("btrim(t.termino)")}) > 0)
  )`);
  const sql = `
WITH perfil AS (
  SELECT * FROM perfiles_empresa WHERE empresa_id = $5::uuid AND activo = true
), base AS (
  SELECT l.*, r.id AS resultado_id, r.resultado_sincronizado_en,
    (l.fecha_publicacion AT TIME ZONE 'America/Santiago')::date AS dia,
    l.fecha_publicacion >= ($3::date::timestamp AT TIME ZONE 'America/Santiago') AS actual,
    CASE WHEN upper(btrim(l.moneda)) = 'UF' THEN 'CLF'
      ELSE nullif(upper(btrim(l.moneda)), '') END AS unidad,
    CASE l.codigo_estado WHEN 8 THEN 'adjudicada' WHEN 7 THEN 'desierta'
      WHEN 6 THEN 'cerrada_sin_resultado' WHEN 18 THEN 'revocada'
      WHEN 5 THEN 'pendiente' WHEN 19 THEN 'suspendida' ELSE 'otro' END AS clasificacion,
    -- No confundir el máximo por ítem del analizador previo con el total del proceso.
    CASE
      WHEN l.datos_origen ->> 'NumeroOferentes' ~ '^\\d{1,7}$'
        THEN (l.datos_origen ->> 'NumeroOferentes')::integer
      WHEN l.datos_origen ->> 'CantidadOferentes' ~ '^\\d{1,7}$'
        THEN (l.datos_origen ->> 'CantidadOferentes')::integer
      WHEN l.datos_origen #>> '{Adjudicacion,NumeroOferentes}' ~ '^\\d{1,7}$'
        THEN (l.datos_origen #>> '{Adjudicacion,NumeroOferentes}')::integer
      ELSE NULL END AS oferentes
  FROM licitaciones l LEFT JOIN licitacion_resultados r ON r.licitacion_id = l.id
  WHERE ${condiciones.join(" AND ")}
), importes AS (
  SELECT b.id, count(a.id) AS filas,
    count(a.id) FILTER (WHERE a.monto_total IS NOT NULL AND a.monto_total >= 0) AS completas,
    sum(a.monto_total) FILTER (WHERE a.monto_total >= 0) AS monto
  FROM base b LEFT JOIN licitacion_adjudicaciones a ON a.resultado_id = b.resultado_id
  GROUP BY b.id
), datos AS (
  SELECT b.*, CASE WHEN b.codigo_estado = 8 AND i.filas > 0
      AND i.filas = i.completas AND b.unidad = $4 THEN i.monto ELSE NULL END AS monto,
    floor((b.dia - CASE WHEN b.actual THEN $3::date ELSE $1::date END)::numeric / $6)::int AS tramo,
    CASE WHEN b.codigo_estado IN (6,7,8,18) AND b.fecha_cierre IS NOT NULL
      AND b.fecha_cierre <= CURRENT_TIMESTAMP THEN b.oferentes ELSE NULL END AS oferentes_cerrados
  FROM base b JOIN importes i ON i.id = b.id
), totales AS (
  SELECT actual, count(*)::int AS publicadas,
    count(*) FILTER (WHERE codigo_estado = 8)::int AS adjudicadas,
    count(*) FILTER (WHERE codigo_estado = 7)::int AS desiertas,
    count(*) FILTER (WHERE codigo_estado = 6)::int AS "cerradasSinResultado",
    count(*) FILTER (WHERE codigo_estado IN (5,19))::int AS pendientes,
    count(*) FILTER (WHERE detalle_sincronizado_en IS NOT NULL)::int AS "conDetalle",
    count(*) FILTER (WHERE resultado_id IS NOT NULL)::int AS "conResultado",
    count(*) FILTER (WHERE nullif(btrim(region_unidad), '') IS NULL)::int AS "sinRegion",
    count(monto)::int AS "conMonto", sum(monto)::text AS "montoAdjudicado",
    count(oferentes_cerrados)::int AS "conOferentes",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY oferentes_cerrados) AS "medianaOferentes",
    count(*) FILTER (WHERE oferentes_cerrados BETWEEN 0 AND 2)::int AS "bajaParticipacion",
    max(detalle_sincronizado_en) AS "ultimaSincronizacion",
    min(dia)::text AS "primeraPublicacion", max(dia)::text AS "ultimaPublicacion"
  FROM datos GROUP BY actual
), evolucion AS (
  SELECT actual, tramo, count(*)::int AS cantidad,
    sum(monto)::text AS monto, count(monto)::int AS "conMonto"
  FROM datos GROUP BY actual, tramo
), compradores AS (
  SELECT codigo_organismo AS codigo,
    COALESCE(nullif(btrim(nombre_organismo), ''), 'Comprador no informado') AS nombre,
    count(*)::int AS cantidad, count(*) FILTER (WHERE codigo_estado = 8)::int AS adjudicadas,
    sum(monto)::text AS monto, max(dia)::text AS "ultimaPublicacion",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY oferentes_cerrados) AS "medianaOferentes",
    count(oferentes_cerrados)::int AS "baseOferentes"
  FROM datos WHERE actual GROUP BY 1,2
), regiones AS (
  SELECT COALESCE(nullif(btrim(region_unidad), ''), 'Sin región informada') AS nombre,
    count(*)::int AS cantidad, sum(monto)::text AS monto
  FROM datos WHERE actual GROUP BY 1
), categorias AS (
  SELECT i.codigo_categoria AS codigo, i.categoria AS nombre, count(DISTINCT d.id)::int AS cantidad
  FROM datos d JOIN licitacion_items i ON i.licitacion_id = d.id
  WHERE d.actual AND nullif(btrim(i.categoria), '') IS NOT NULL GROUP BY 1,2
), proveedores AS (
  SELECT regexp_replace(upper(btrim(a.rut_proveedor)), '[.[:space:]-]', '', 'g') AS clave,
    max(btrim(a.nombre_proveedor)) AS nombre, max(btrim(a.rut_proveedor)) AS rut,
    sum(a.monto_total) AS monto, count(DISTINCT d.id)::int AS adjudicaciones
  FROM datos d JOIN licitacion_adjudicaciones a ON a.resultado_id = d.resultado_id
  WHERE d.actual AND d.monto IS NOT NULL
    AND nullif(btrim(a.rut_proveedor), '') IS NOT NULL
    AND nullif(btrim(a.nombre_proveedor), '') IS NOT NULL GROUP BY 1
), ranking AS (
  SELECT nombre, rut, monto::text AS monto, adjudicaciones,
    round(monto * 100 / nullif(sum(monto) OVER (), 0), 1) AS participacion
  FROM proveedores ORDER BY proveedores.monto DESC, rut LIMIT 10
)
SELECT jsonb_build_object(
  'totales', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM totales t), '[]'::jsonb),
  'evolucion', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY actual DESC, tramo) FROM evolucion e), '[]'::jsonb),
  'organismos', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT * FROM compradores ORDER BY cantidad DESC, nombre, codigo LIMIT 30) c), '[]'::jsonb),
  'regiones', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM regiones g), '[]'::jsonb),
  'categorias', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT * FROM categorias ORDER BY cantidad DESC, nombre LIMIT 10) c), '[]'::jsonb),
  'proveedores', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM ranking r), '[]'::jsonb),
  'proveedoresBase', (SELECT jsonb_build_object('cantidad', count(*)::int, 'monto', sum(monto)::text) FROM proveedores),
  'resultados', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (
    SELECT clasificacion, count(*)::int AS cantidad FROM datos WHERE actual GROUP BY 1 ORDER BY count(*) DESC) r), '[]'::jsonb),
  'tipos', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT COALESCE(nullif(btrim(tipo), ''), nullif(btrim(codigo_tipo), ''), 'No informado') AS tipo,
      count(*)::int AS cantidad FROM datos WHERE actual GROUP BY 1 ORDER BY count(*) DESC) t), '[]'::jsonb),
  'perfil', (SELECT jsonb_build_object(
    'configurado', EXISTS(SELECT 1 FROM perfil WHERE cardinality(codigos_categoria) > 0
      OR EXISTS(SELECT 1 FROM unnest(palabras_clave || etiquetas_capacidades) t WHERE length(btrim(t)) >= 2)),
    'categorias', COALESCE((SELECT cardinality(codigos_categoria) FROM perfil),0),
    'terminos', COALESCE((SELECT cardinality(palabras_clave || etiquetas_capacidades) FROM perfil),0))),
  'opciones', jsonb_build_object(
    'regiones', COALESCE((SELECT jsonb_agg(nombre ORDER BY nombre) FROM regiones WHERE nombre <> 'Sin región informada'), '[]'::jsonb),
    'categorias', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
      SELECT DISTINCT codigo, nombre FROM categorias ORDER BY nombre LIMIT 500) c), '[]'::jsonb),
    'organismos', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
      SELECT codigo, nombre FROM compradores WHERE codigo IS NOT NULL ORDER BY nombre LIMIT 500) c), '[]'::jsonb)
  )
) AS datos
`;
  return { sql, parametros, anterior };
}
