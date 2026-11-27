// Se agregan importes solo dentro de la misma unidad. Nunca se convierten a CLP.
export const MONEDA_DASHBOARD_SQL = `CASE
  WHEN UPPER(BTRIM(licitacion.moneda)) = 'UF' THEN 'CLF'
  ELSE NULLIF(UPPER(BTRIM(licitacion.moneda)), '')
END`;
export const MONEDAS_DASHBOARD_SQL = "'CLP', 'CLF', 'UTM', 'USD', 'EUR'";
const ordenMonedas = ['CLP', 'CLF', 'UTM', 'USD', 'EUR'];

export interface MontoDashboardRaw {
  moneda: string | null;
  monto: string | null;
  cantidad: string;
  conMonto: string;
}

export interface MontoPorMonedaDashboard {
  moneda: string | null;
  monedaReconocida: boolean;
  // Texto decimal exacto de PostgreSQL; null no significa cero.
  montoTotal: string | null;
  cantidad: number;
  conMonto: number;
  sinMonto: number;
}

export function mapearMontosDashboard(filas: MontoDashboardRaw[]): MontoPorMonedaDashboard[] {
  return filas.map((fila) => {
    const cantidad = Number(fila.cantidad);
    const conMonto = Number(fila.conMonto);
    const monedaReconocida = fila.moneda !== null && ordenMonedas.includes(fila.moneda);
    const montoValido = typeof fila.monto === 'string' && /^-?\d+(?:\.\d+)?$/.test(fila.monto);
    return {
      moneda: fila.moneda,
      monedaReconocida,
      montoTotal: monedaReconocida && conMonto > 0 && montoValido ? fila.monto : null,
      cantidad,
      conMonto,
      sinMonto: cantidad - conMonto,
    };
  }).sort((a, b) => {
    const posicion = (m: string | null) => m !== null && ordenMonedas.includes(m) ? ordenMonedas.indexOf(m) : ordenMonedas.length;
    return posicion(a.moneda) - posicion(b.moneda) || (a.moneda ?? '').localeCompare(b.moneda ?? '');
  });
}

export function agruparEvolucionDashboard(filas: Array<MontoDashboardRaw & { periodo: string }>) {
  const meses = new Map<string, MontoDashboardRaw[]>();
  for (const fila of filas) meses.set(fila.periodo, [...(meses.get(fila.periodo) ?? []), fila]);
  return [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, valores]) => ({
    periodo,
    monto: null,
    cantidad: valores.reduce((n, fila) => n + Number(fila.cantidad), 0),
    montosPorMoneda: mapearMontosDashboard(valores),
  }));
}

export function agruparOrganismosDashboard(filas: Array<MontoDashboardRaw & { nombre: string; codigo?: string }>) {
  const organismos = new Map<string, Array<MontoDashboardRaw & { nombre: string; codigo?: string }>>();
  for (const fila of filas) {
    const clave = fila.codigo ?? fila.nombre;
    organismos.set(clave, [...(organismos.get(clave) ?? []), fila]);
  }
  return [...organismos].map(([, valores]) => ({
    codigo: valores[0].codigo,
    nombre: valores[0].nombre,
    monto: null,
    cantidad: valores.reduce((n, fila) => n + Number(fila.cantidad), 0),
    montosPorMoneda: mapearMontosDashboard(valores),
  })).sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es') || (a.codigo ?? '').localeCompare(b.codigo ?? '')).slice(0, 5);
}
