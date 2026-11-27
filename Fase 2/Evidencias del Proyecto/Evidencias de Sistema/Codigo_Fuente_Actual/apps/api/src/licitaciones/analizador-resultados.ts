import type { LicitacionMercadoPublico } from '../integraciones/mercado-publico/interfaces/licitacion-mercado-publico.interface';

export enum ClasificacionResultadoLicitacion {
  PENDIENTE = 'pendiente',
  ADJUDICADA = 'adjudicada',
  DESIERTA = 'desierta',
  REVOCADA = 'revocada',
  CERRADA_SIN_RESULTADO = 'cerrada_sin_resultado',
  OTRO = 'otro',
}

export interface AdjudicacionAnalizada {
  itemCorrelativo: number | null;
  tipo: string | null;
  fecha: Date | null;
  numero: string | null;
  numeroOferentes: number | null;
  urlActa: string | null;
  nombreProveedor: string | null;
  rutProveedor: string | null;
  cantidad: string | null;
  montoUnitario: string | null;
  montoTotal: string | null;
  datosOrigen: Record<string, unknown>;
}

export interface ResultadoLicitacionAnalizado {
  clasificacion: ClasificacionResultadoLicitacion;
  motivo: string | null;
  fuenteMotivo: string | null;
  numeroOferentes: number | null;
  montoTotalAdjudicado: string;
  adjudicaciones: AdjudicacionAnalizada[];
  datosOrigen: Record<string, unknown>;
}

const CAMPOS_MOTIVO = [
  'Motivo',
  'MotivoDesercion',
  'MotivoDeserción',
  'MotivoRevocacion',
  'MotivoRevocación',
  'Justificacion',
  'Justificación',
  'Observacion',
  'Observación',
  'DescripcionMotivo',
];

export function analizarResultadoLicitacion(
  datos: LicitacionMercadoPublico,
): ResultadoLicitacionAnalizado {
  const codigoEstado = obtenerEntero(datos.CodigoEstado) ?? 0;
  const adjudicaciones = extraerAdjudicaciones(datos);
  const motivoDetectado = buscarMotivo(datos);
  const numeroOferentes = obtenerMayorNumeroOferentes(datos, adjudicaciones);
  const montoTotal = adjudicaciones.reduce(
    (acumulado, adjudicacion) =>
      acumulado + (Number(adjudicacion.montoTotal) || 0),
    0,
  );

  return {
    clasificacion: clasificarResultado(codigoEstado, adjudicaciones.length),
    motivo: motivoDetectado?.valor ?? null,
    fuenteMotivo: motivoDetectado?.campo ?? null,
    numeroOferentes,
    montoTotalAdjudicado: String(montoTotal),
    adjudicaciones,
    datosOrigen: {
      codigoEstado,
      estado: obtenerTexto(datos.Estado),
      motivoDetectado: motivoDetectado?.campo ?? null,
      adjudicacionesDetectadas: adjudicaciones.length,
    },
  };
}

function extraerAdjudicaciones(
  datos: LicitacionMercadoPublico,
): AdjudicacionAnalizada[] {
  const resultados: AdjudicacionAnalizada[] = [];
  const items = obtenerObjeto(datos.Items);
  const listado = Array.isArray(items?.Listado) ? items.Listado : [];

  for (const valorItem of listado) {
    const item = obtenerObjeto(valorItem);
    const adjudicacion = obtenerObjeto(item?.Adjudicacion);

    if (!adjudicacion || !tieneDatosAdjudicacion(adjudicacion)) continue;
    resultados.push(
      mapearAdjudicacion(adjudicacion, obtenerEntero(item?.Correlativo)),
    );
  }

  const adjudicacionGeneral = obtenerObjeto(datos.Adjudicacion);
  if (
    adjudicacionGeneral &&
    tieneDatosAdjudicacion(adjudicacionGeneral) &&
    resultados.length === 0
  ) {
    resultados.push(mapearAdjudicacion(adjudicacionGeneral, null));
  }

  return resultados;
}

function mapearAdjudicacion(
  datos: Record<string, unknown>,
  itemCorrelativo: number | null,
): AdjudicacionAnalizada {
  const cantidad = obtenerDecimal(datos.Cantidad);
  const montoUnitario = obtenerDecimal(datos.MontoUnitario);
  const montoTotalInformado =
    obtenerDecimal(datos.MontoTotal) ?? obtenerDecimal(datos.MontoAdjudicado);
  const montoTotal =
    montoTotalInformado ??
    (cantidad !== null && montoUnitario !== null
      ? String(Number(cantidad) * Number(montoUnitario))
      : null);

  return {
    itemCorrelativo,
    tipo: obtenerTexto(datos.Tipo),
    fecha: obtenerFecha(datos.Fecha),
    numero: obtenerTexto(datos.Numero),
    numeroOferentes: obtenerEntero(datos.NumeroOferentes),
    urlActa: obtenerTexto(datos.UrlActa),
    nombreProveedor: obtenerTexto(datos.NombreProveedor),
    rutProveedor: obtenerTexto(datos.RutProveedor),
    cantidad,
    montoUnitario,
    montoTotal,
    datosOrigen: { ...datos },
  };
}

function clasificarResultado(
  codigoEstado: number,
  cantidadAdjudicaciones: number,
): ClasificacionResultadoLicitacion {
  if (codigoEstado === 8 || cantidadAdjudicaciones > 0) {
    return ClasificacionResultadoLicitacion.ADJUDICADA;
  }
  if (codigoEstado === 7) return ClasificacionResultadoLicitacion.DESIERTA;
  if (codigoEstado === 18) return ClasificacionResultadoLicitacion.REVOCADA;
  if (codigoEstado === 6) {
    return ClasificacionResultadoLicitacion.CERRADA_SIN_RESULTADO;
  }
  if ([5, 19].includes(codigoEstado)) {
    return ClasificacionResultadoLicitacion.PENDIENTE;
  }
  return ClasificacionResultadoLicitacion.OTRO;
}

function buscarMotivo(
  datos: Record<string, unknown>,
): { campo: string; valor: string } | null {
  const contenedores: Array<{
    prefijo: string;
    valor: Record<string, unknown>;
  }> = [{ prefijo: '', valor: datos }];
  const adjudicacion = obtenerObjeto(datos.Adjudicacion);
  if (adjudicacion) {
    contenedores.push({ prefijo: 'Adjudicacion.', valor: adjudicacion });
  }

  for (const contenedor of contenedores) {
    for (const campo of CAMPOS_MOTIVO) {
      const valor = obtenerTexto(contenedor.valor[campo]);
      if (valor) return { campo: `${contenedor.prefijo}${campo}`, valor };
    }
  }
  return null;
}

function obtenerMayorNumeroOferentes(
  datos: Record<string, unknown>,
  adjudicaciones: AdjudicacionAnalizada[],
): number | null {
  const candidatos = [
    obtenerEntero(datos.NumeroOferentes),
    obtenerEntero(datos.CantidadOferentes),
    ...adjudicaciones.map((adjudicacion) => adjudicacion.numeroOferentes),
  ].filter((valor): valor is number => valor !== null);

  return candidatos.length > 0 ? Math.max(...candidatos) : null;
}

function tieneDatosAdjudicacion(datos: Record<string, unknown>): boolean {
  return [
    'NombreProveedor',
    'RutProveedor',
    'Numero',
    'Fecha',
    'MontoUnitario',
    'MontoTotal',
    'MontoAdjudicado',
  ].some((campo) => obtenerTexto(datos[campo]) !== null);
}

function obtenerObjeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null
    ? (valor as Record<string, unknown>)
    : null;
}

function obtenerTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto || null;
}

function obtenerEntero(valor: unknown): number | null {
  const numero = Number(obtenerTexto(valor)?.replace(',', '.'));
  return Number.isFinite(numero) ? Math.trunc(numero) : null;
}

function obtenerDecimal(valor: unknown): string | null {
  const numero = Number(obtenerTexto(valor)?.replace(',', '.'));
  return Number.isFinite(numero) ? String(numero) : null;
}

function obtenerFecha(valor: unknown): Date | null {
  const texto = obtenerTexto(valor);
  if (!texto) return null;
  const fechaDotNet = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(texto);
  const fecha = fechaDotNet
    ? new Date(Number(fechaDotNet[1]))
    : new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
