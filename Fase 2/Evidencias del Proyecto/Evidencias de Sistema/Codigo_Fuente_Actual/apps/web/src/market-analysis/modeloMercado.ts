import type {
  FiltrosAnalisisMercado,
  MonedaAnalisis,
  RespuestaAnalisisMercado,
} from "./types";

export const numeroMercado = (v: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(v);
export const porcentajeMercado = (v: number | null) =>
  v === null ? "Sin datos" : numeroMercado(v) + "%";
export function montoMercado(v: string | null, moneda: MonedaAnalisis): string {
  if (v === null) return "Sin datos";
  const [entero, decimal = ""] = v.split(".");
  const n =
    BigInt(entero).toLocaleString("es-CL") +
    (decimal && Number(decimal) !== 0
      ? "," + decimal.slice(0, 2).padEnd(2, "0")
      : "");
  return (
    { CLP: "$", CLF: "UF ", UTM: "UTM ", USD: "US$ ", EUR: "€ " }[moneda] + n
  );
}
export function fechaChile(v: string | null, hora = false): string {
  if (!v) return "Sin fecha informada";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(hora ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(v.length === 10 ? v + "T12:00:00Z" : v));
}
export function diaChile(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parte = (t: string) => partes.find((p) => p.type === t)?.value;
  return parte("year") + "-" + parte("month") + "-" + parte("day");
}
export function rangoMercado(
  dias: number,
): Pick<FiltrosAnalisisMercado, "fechaDesde" | "fechaHasta"> {
  const fechaHasta = diaChile();
  const fechaDesde = new Date(
    Date.parse(fechaHasta + "T00:00:00Z") - (dias - 1) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  return { fechaDesde, fechaHasta };
}
export const filtrosMercadoIniciales = (): FiltrosAnalisisMercado => ({
  ...rangoMercado(90),
  alcance: "empresa",
  moneda: "CLP",
});
export function parametrosMercado(f: FiltrosAnalisisMercado) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}
export function resumenMercado(r: RespuestaAnalisisMercado): string {
  if (!r.metricas.publicadas)
    return r.filtrosAplicados.alcance === "empresa" && !r.perfil.configurado
      ? "Configura categorías o capacidades en tu perfil para analizar tu sector."
      : "No hay licitaciones guardadas para esta selección. Amplía el período o revisa los filtros.";
  const partes = [
    numeroMercado(r.metricas.publicadas) +
      " licitaciones publicadas en la selección.",
  ];
  const cambio = r.comparacion.publicadas.variacion;
  if (cambio !== null)
    partes.push(
      "La actividad registrada " +
        (cambio >= 0 ? "aumenta " : "disminuye ") +
        numeroMercado(Math.abs(cambio)) +
        "% frente al período anterior.",
    );
  else partes.push("Sin base anterior suficiente para calcular crecimiento.");
  if (r.metricas.conOferentes > 0)
    partes.push(
      "La participación mediana informada es de " +
        numeroMercado(r.metricas.medianaOferentes!) +
        " oferentes en " +
        numeroMercado(r.metricas.conOferentes) +
        " procesos cerrados.",
    );
  return partes.join(" ");
}
export function celdaCsv(valor: string | number | null): string {
  let s = valor === null ? "" : String(valor);
  if (typeof valor === "string" && /^[\s\uFEFF]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function csvMercado(r: RespuestaAnalisisMercado): string {
  const f = r.filtrosAplicados,
    m = r.metricas;
  const filas: Array<Array<string | number | null>> = [
    ["Sección", "Indicador o entidad", "Valor", "Unidad", "Base o contexto"],
    [
      "Selección",
      "Desde",
      f.fechaDesde,
      "",
      "Fecha de publicación · America/Santiago",
    ],
    ["Selección", "Hasta", f.fechaHasta, "", f.alcance],
    [
      "Selección",
      "Región",
      f.region ?? "Todas",
      "",
      f.categoria ?? "Todas las categorías",
    ],
    ["Selección", "Comprador", f.organismo ?? "Todos", "", f.moneda],
    ["Corte", "Generado", r.generadoEn, "", r.fuente],
    [
      "Corte",
      "Última sincronización",
      r.cobertura.ultimaSincronizacion,
      "",
      "Fecha real disponible",
    ],
    [
      "Indicadores",
      "Publicadas",
      m.publicadas,
      "procesos",
      "Todas las monedas",
    ],
    [
      "Indicadores",
      "Monto adjudicado",
      m.montoAdjudicado,
      f.moneda,
      m.conMonto + " procesos con importes completos",
    ],
    [
      "Indicadores",
      "Mediana de oferentes",
      m.medianaOferentes,
      "oferentes",
      m.conOferentes + " procesos cerrados con número informado",
    ],
    [
      "Indicadores",
      "Con 2 o menos oferentes",
      m.porcentajeBajaParticipacion,
      "%",
      m.conOferentes + " procesos",
    ],
    [
      "Indicadores",
      "Tasa de desiertas",
      m.tasaDesiertas,
      "%",
      m.adjudicadas + m.desiertas + " procesos adjudicados o desiertos",
    ],
    [
      "Comparación",
      "Período anterior desde",
      r.periodoAnterior.fechaDesde,
      "",
      r.periodoAnterior.fechaHasta,
    ],
    [
      "Comparación",
      "Publicadas anteriores",
      r.comparacion.publicadas.anterior,
      "procesos",
      "Igual duración",
    ],
    [
      "Comparación",
      "Variación publicaciones",
      r.comparacion.publicadas.variacion,
      "%",
      "Vacío si la base anterior es cero",
    ],
    ...r.evolucion.map((e) => [
      "Evolución",
      e.periodo,
      e.cantidad,
      "procesos",
      e.monto === null ? "Sin monto informado" : e.monto + " " + f.moneda,
    ]),
    ...r.regiones.datos.map((e) => [
      "Región del comprador",
      e.nombre,
      e.cantidad,
      "procesos",
      e.monto === null ? "Sin monto informado" : e.monto + " " + f.moneda,
    ]),
    ...r.organismos.map((e) => [
      "Comprador",
      e.nombre,
      e.cantidad,
      "procesos",
      e.monto === null ? "Sin monto informado" : e.monto + " " + f.moneda,
    ]),
    ...r.proveedores.map((e) => [
      "Proveedor",
      e.nombre + " · " + e.rut,
      e.monto,
      f.moneda,
      e.adjudicaciones + " procesos · " + porcentajeMercado(e.participacion),
    ]),
    ...r.categorias.map((e) => [
      "Categoría",
      e.nombre,
      e.cantidad,
      "procesos",
      "Un proceso puede aparecer en varias categorías",
    ]),
    ...r.resultados.map((e) => [
      "Resultado",
      e.clasificacion,
      e.cantidad,
      "procesos",
      "Estado guardado",
    ]),
    ...r.distribucionTipos.map((e) => [
      "Tipo",
      e.tipo,
      e.cantidad,
      "procesos",
      "Tipo informado",
    ]),
    ...r.metodologia.map((e) => ["Metodología", e, "", "", ""]),
  ];
  return (
    "\uFEFF" + filas.map((fila) => fila.map(celdaCsv).join(";")).join("\r\n")
  );
}
