import {
  agruparEvolucionDashboard,
  agruparOrganismosDashboard,
  mapearMontosDashboard,
  MONEDA_DASHBOARD_SQL,
  MONEDAS_DASHBOARD_SQL,
  type MontoDashboardRaw,
} from './montos-dashboard';

// Una sola sentencia: indicadores, bases y listas leen la misma instantanea.
// Los vacios no se convierten en compradores, categorias ni regiones.
const etiquetaValida = (campo: string) => `NULLIF(BTRIM(${campo}), '') IS NOT NULL
  AND LOWER(BTRIM(${campo})) NOT IN
    ('no informado', 'no informada', 'sin categoria', 'sin categoría',
     'sin region informada', 'sin región informada', 'sin informacion',
     'sin información', 'desconocido', 'desconocida', 'n/a', 's/i')`;

const regiones = [
  ['arica', 'Arica y Parinacota', 'arica'],
  ['tarapaca', 'Tarapacá', 'tarapac'],
  ['antofagasta', 'Antofagasta', 'antofagasta'],
  ['atacama', 'Atacama', 'atacama'],
  ['coquimbo', 'Coquimbo', 'coquimbo'],
  ['valparaiso', 'Valparaíso', 'valparai'],
  ['metropolitana', 'Metropolitana', 'metropolitan|santiago'],
  ['ohiggins', "O'Higgins", 'higgins|libertador'],
  ['maule', 'Maule', 'maule'],
  ['nuble', 'Ñuble', 'nuble'],
  ['biobio', 'Biobío', 'biob'],
  ['araucania', 'La Araucanía', 'araucan'],
  ['los-rios', 'Los Ríos', 'los rios'],
  ['los-lagos', 'Los Lagos', 'los lagos'],
  ['aysen', 'Aysén', 'aysen'],
  ['magallanes', 'Magallanes', 'magallanes|antartica'],
] as const;
// Los accesos del mapa usan la misma agrupacion territorial que el resumen,
// evitando perder O'Higgins/Libertador o variantes con/sin acento al navegar.
export function patronRegionDashboard(nombre: string): string | null {
  return regiones.find(([, etiqueta]) => etiqueta === nombre)?.[2] ?? null;
}
const regionNormalizada = "TRANSLATE(LOWER(BTRIM(licitacion.region_unidad)), 'áéíóúñ', 'aeioun')";
const regionCase = `CASE ${regiones.map(([codigo, , patron]) =>
  `WHEN ${regionNormalizada} ~ '${patron}' THEN '${codigo}'`).join(' ')} END`;
const nombreRegionCase = `CASE "regionCodigo" ${regiones.map(([codigo, nombre]) =>
  `WHEN '${codigo}' THEN '${nombre.replaceAll("'", "''")}'`).join(' ')} END`;

export const RESUMEN_DASHBOARD_SQL = `
WITH vigentes AS MATERIALIZED (
  SELECT licitacion.*,
    ${MONEDA_DASHBOARD_SQL} AS "monedaCanonica",
    (${etiquetaValida('licitacion.nombre_organismo')}
      AND NULLIF(BTRIM(licitacion.codigo_organismo), '') IS NOT NULL) AS "compradorIdentificado",
    ${regionCase} AS "regionCodigo"
  FROM licitaciones licitacion
  WHERE licitacion.activa_en_listado = true
    AND licitacion.codigo_estado = $1
    AND licitacion.fecha_cierre IS NOT NULL
    AND licitacion.fecha_cierre >= now()
    AND COALESCE(licitacion.datos_origen ->> 'esPrueba', 'false') <> 'true'
), montos AS (
  SELECT "monedaCanonica" AS moneda,
    CASE WHEN "monedaCanonica" IN (${MONEDAS_DASHBOARD_SQL})
      THEN SUM(licitacion.monto_estimado)::text ELSE NULL END AS monto,
    COUNT(*)::text AS cantidad, COUNT(monto_estimado)::text AS "conMonto"
  FROM vigentes licitacion GROUP BY "monedaCanonica"
), meses AS (
  SELECT to_char(fecha_publicacion AT TIME ZONE 'America/Santiago', 'YYYY-MM') AS periodo,
    "monedaCanonica" AS moneda,
    CASE WHEN "monedaCanonica" IN (${MONEDAS_DASHBOARD_SQL})
      THEN SUM(monto_estimado)::text ELSE NULL END AS monto,
    COUNT(*)::text AS cantidad, COUNT(monto_estimado)::text AS "conMonto"
  FROM vigentes
  WHERE fecha_publicacion >= (date_trunc('month', now() AT TIME ZONE 'America/Santiago')
    - INTERVAL '5 months') AT TIME ZONE 'America/Santiago'
    AND fecha_publicacion < (date_trunc('month', now() AT TIME ZONE 'America/Santiago')
      + INTERVAL '1 month') AT TIME ZONE 'America/Santiago'
  GROUP BY periodo, "monedaCanonica"
), nombres_compradores AS (
  SELECT BTRIM(codigo_organismo) AS codigo, MAX(BTRIM(nombre_organismo)) AS nombre
  FROM vigentes WHERE "compradorIdentificado" GROUP BY BTRIM(codigo_organismo)
), compradores AS (
  SELECT n.codigo, n.nombre, v."monedaCanonica" AS moneda,
    CASE WHEN v."monedaCanonica" IN (${MONEDAS_DASHBOARD_SQL})
      THEN SUM(v.monto_estimado)::text ELSE NULL END AS monto,
    COUNT(*)::text AS cantidad, COUNT(v.monto_estimado)::text AS "conMonto"
  FROM vigentes v JOIN nombres_compradores n ON n.codigo = BTRIM(v.codigo_organismo)
  WHERE v."compradorIdentificado" GROUP BY n.codigo, n.nombre, v."monedaCanonica"
), categorias_proceso AS (
  SELECT DISTINCT v.id, BTRIM(i.codigo_categoria) AS codigo, BTRIM(i.categoria) AS nombre
  FROM vigentes v JOIN licitacion_items i ON i.licitacion_id = v.id
  WHERE NULLIF(BTRIM(i.codigo_categoria), '') IS NOT NULL AND ${etiquetaValida('i.categoria')}
), categorias AS (
  SELECT codigo, MAX(nombre) AS categoria, COUNT(DISTINCT id)::int AS cantidad
  FROM categorias_proceso GROUP BY codigo
), regiones AS (
  SELECT "regionCodigo" AS codigo, ${nombreRegionCase} AS nombre, COUNT(*)::int AS cantidad
  FROM vigentes WHERE "regionCodigo" IS NOT NULL GROUP BY "regionCodigo"
), agenda AS (
  SELECT codigo_externo AS "codigoExterno", nombre,
    CASE WHEN "compradorIdentificado" THEN BTRIM(nombre_organismo) END AS "nombreOrganismo",
    fecha_cierre AS "fechaCierre"
  FROM vigentes ORDER BY fecha_cierre, codigo_externo LIMIT 6
), publicaciones AS (
  SELECT codigo_externo AS "codigoExterno", nombre,
    CASE WHEN "compradorIdentificado" THEN BTRIM(nombre_organismo) END AS "nombreOrganismo",
    fecha_publicacion AS "fechaPublicacion"
  FROM vigentes WHERE detalle_sincronizado_en IS NOT NULL
    AND fecha_publicacion IS NOT NULL AND fecha_publicacion <= now()
  ORDER BY fecha_publicacion DESC, codigo_externo LIMIT 4
)
SELECT now() AS "generadoEn",
  MAX(visto_activo_en) AS "catalogoConsultadoEn",
  MAX(detalle_sincronizado_en) AS "ultimoDetalleEn",
  COUNT(*)::int AS "oportunidadesActivas",
  COUNT(detalle_sincronizado_en)::int AS "conDetalle",
  COUNT(monto_estimado)::int AS "oportunidadesConMonto",
  COUNT(*) FILTER (WHERE monto_estimado IS NULL)::int AS "oportunidadesSinMonto",
  COUNT(*) FILTER (WHERE detalle_sincronizado_en IS NOT NULL
    AND fecha_publicacion >= now() - INTERVAL '7 days'
    AND fecha_publicacion <= now())::int AS "nuevasSemana",
  COUNT(*) FILTER (WHERE fecha_cierre < now() + INTERVAL '48 hours')::int AS "cierran48Horas",
  COUNT(*) FILTER (WHERE fecha_cierre < now() + INTERVAL '7 days')::int AS "cierranSemana",
  COUNT(*) FILTER (WHERE "compradorIdentificado")::int AS "baseCompradores",
  COUNT(DISTINCT BTRIM(codigo_organismo)) FILTER (WHERE "compradorIdentificado")::int AS "organismosCompradores",
  COUNT(*) FILTER (WHERE "regionCodigo" IS NOT NULL)::int AS "baseRegiones",
  (SELECT COUNT(DISTINCT id)::int FROM categorias_proceso) AS "baseCategorias",
  COUNT(*) FILTER (WHERE fecha_cierre >= now() + INTERVAL '48 hours'
    AND fecha_cierre < now() + INTERVAL '7 days')::int AS "cierran2a7Dias",
  COUNT(*) FILTER (WHERE fecha_cierre >= now() + INTERVAL '7 days'
    AND fecha_cierre < now() + INTERVAL '30 days')::int AS "cierran7a30Dias",
  COUNT(*) FILTER (WHERE fecha_cierre >= now() + INTERVAL '30 days')::int AS "cierran30DiasMas",
  COALESCE((SELECT json_agg(m) FROM montos m), '[]'::json) AS montos,
  COALESCE((SELECT json_agg(m) FROM meses m), '[]'::json) AS meses,
  COALESCE((SELECT json_agg(c) FROM compradores c), '[]'::json) AS compradores,
  COALESCE((SELECT json_agg(c ORDER BY cantidad DESC, codigo) FROM categorias c), '[]'::json) AS categorias,
  COALESCE((SELECT json_agg(r ORDER BY cantidad DESC, codigo) FROM regiones r), '[]'::json) AS regiones,
  COALESCE((SELECT json_agg(a ORDER BY "fechaCierre", "codigoExterno") FROM agenda a), '[]'::json) AS agenda,
  COALESCE((SELECT json_agg(p ORDER BY "fechaPublicacion" DESC, "codigoExterno") FROM publicaciones p), '[]'::json) AS publicaciones
FROM vigentes`;

export interface ResumenDashboardRaw {
  generadoEn: Date | string;
  catalogoConsultadoEn: Date | string | null;
  ultimoDetalleEn: Date | string | null;
  oportunidadesActivas: number;
  conDetalle: number;
  oportunidadesConMonto: number;
  oportunidadesSinMonto: number;
  nuevasSemana: number;
  cierran48Horas: number;
  cierranSemana: number;
  baseCompradores: number;
  organismosCompradores: number;
  baseRegiones: number;
  baseCategorias: number;
  cierran2a7Dias: number;
  cierran7a30Dias: number;
  cierran30DiasMas: number;
  montos: MontoDashboardRaw[];
  meses: Array<MontoDashboardRaw & { periodo: string }>;
  compradores: Array<MontoDashboardRaw & { codigo: string; nombre: string }>;
  categorias: Array<{ codigo: string; categoria: string; cantidad: number }>;
  regiones: Array<{ codigo: string; nombre: string; cantidad: number }>;
  agenda: Array<{ codigoExterno: string; nombre: string; nombreOrganismo: string | null; fechaCierre: string }>;
  publicaciones: Array<{ codigoExterno: string; nombre: string; nombreOrganismo: string | null; fechaPublicacion: string }>;
}

export function mapearResumenVerificado(raw: ResumenDashboardRaw, premium: boolean, etiquetas: string[]) {
  const iso = (fecha: Date | string | null) => fecha === null ? null : new Date(fecha).toISOString();
  return {
    versionContrato: 3 as const,
    generadoEn: iso(raw.generadoEn),
    acceso: { premium },
    calidad: {
      catalogoConsultadoEn: iso(raw.catalogoConsultadoEn),
      ultimoDetalleEn: premium ? iso(raw.ultimoDetalleEn) : null,
      conDetalle: premium ? raw.conDetalle : null,
      baseCategorias: premium ? raw.baseCategorias : null,
      baseCompradores: premium ? raw.baseCompradores : null,
      baseRegiones: premium ? raw.baseRegiones : null,
      representatividad: 'muestra_disponible_no_representativa' as const,
    },
    tratamientoMonetario: {
      conversionAPesos: false,
      fuente: 'montos_estimados_guardados',
      alcance: 'catalogo_vigente_no_historico_completo',
      rankingOrganismos: 'cantidad_oportunidades',
      zonaHoraria: 'America/Santiago',
    },
    metricas: {
      oportunidadesActivas: raw.oportunidadesActivas,
      montoTotalDisponible: null,
      montosPorMoneda: premium ? mapearMontosDashboard(raw.montos) : [],
      oportunidadesConMonto: premium ? raw.oportunidadesConMonto : null,
      oportunidadesSinMonto: premium ? raw.oportunidadesSinMonto : null,
      nuevasSemana: premium ? raw.nuevasSemana : null,
      cierran48Horas: raw.cierran48Horas,
      cierranSemana: raw.cierranSemana,
      organismosCompradores: premium ? raw.organismosCompradores : null,
    },
    distribucionCategorias: premium ? raw.categorias : [],
    // Se conserva para trazabilidad del contrato monetario, no como tendencia de mercado.
    evolucionMontos: premium ? agruparEvolucionDashboard(raw.meses) : [],
    organismos: premium ? agruparOrganismosDashboard(raw.compradores) : [],
    regiones: premium ? raw.regiones : [],
    agendaCierres: premium ? raw.agenda : [],
    horizonteCierres: premium ? [
      { clave: '48h', etiqueta: 'Próximas 48 horas', cantidad: raw.cierran48Horas },
      { clave: '2a7', etiqueta: 'De 48 horas a 7 días', cantidad: raw.cierran2a7Dias },
      { clave: '7a30', etiqueta: 'De 7 a 30 días', cantidad: raw.cierran7a30Dias },
      { clave: '30mas', etiqueta: '30 días o más', cantidad: raw.cierran30DiasMas },
    ] : [],
    actividadReciente: premium ? raw.publicaciones : [],
    etiquetasRelevantes: premium ? [...new Set(etiquetas)].slice(0, 8) : [],
  };
}
