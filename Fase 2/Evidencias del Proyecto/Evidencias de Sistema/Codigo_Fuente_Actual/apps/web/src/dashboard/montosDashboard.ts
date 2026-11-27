export interface MontoPorMonedaDashboard {
  moneda: string | null;
  monedaReconocida: boolean;
  montoTotal: string | null;
  cantidad: number;
  conMonto: number;
  sinMonto: number;
}

export interface MesMonetarioDashboard {
  periodo: string;
  monto: null;
  cantidad: number;
  montosPorMoneda: MontoPorMonedaDashboard[];
}

export function nombreMonedaDashboard(moneda: string | null): string {
  return moneda === "CLF" || moneda === "UF" ? "UF" : moneda || "Sin moneda";
}

export function formatearMontoOriginalDashboard(
  monto: string | number | null,
  moneda: string | null,
): string {
  if (monto === null) return "Monto no informado";
  const partes = String(monto).match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!partes) return "Monto no interpretable";
  const entero = new Intl.NumberFormat("es-CL").format(BigInt(partes[2]));
  const fraccion = partes[3] ?? "";
  const decimal = fraccion && /[1-9]/.test(fraccion) ? `,${fraccion}` : "";
  const numero = `${partes[1]}${entero}${decimal}`;
  if (!moneda) return `${numero} · moneda no informada`;
  const codigo = moneda.trim().toUpperCase();
  if (!codigo) return `${numero} · moneda no informada`;
  if (codigo === "CLP") return `$${numero} CLP`;
  const unidad = nombreMonedaDashboard(codigo);
  const conocida = ["CLF", "UF", "UTM", "USD", "EUR"].includes(codigo);
  return `${numero} ${unidad}${conocida ? "" : " · unidad sin validar"}`;
}

export function serieMonetariaDashboard(meses: MesMonetarioDashboard[], moneda: string | null) {
  return meses.map((mes) => ({
    periodo: mes.periodo,
    monto: mes.montosPorMoneda.find((grupo) => grupo.moneda === moneda && grupo.monedaReconocida)?.montoTotal ?? null,
  }));
}

// Number se usa solo para coordenadas aproximadas; las etiquetas conservan
// el decimal original. Nunca se suman importes con aritmetica de JavaScript.
export function tramosGraficoMontos(serie: Array<{ periodo: string; monto: string | null }>) {
  type Punto = { x: number; y: number; periodo: string; monto: string };
  const valores = serie.map((p) => p.monto === null ? null : Number(p.monto));
  const maximo = Math.max(...valores.filter((n): n is number => n !== null && Number.isFinite(n)), 1);
  const tramos: Punto[][] = [];
  let tramo: Punto[] = [];
  let ultimoMes: number | null = null;
  serie.forEach((punto, indice) => {
    const valor = valores[indice];
    const [ano, mes] = punto.periodo.split("-").map(Number);
    const numeroMes = ano * 12 + mes;
    if (valor === null || !Number.isFinite(valor) || punto.monto === null) {
      tramo = []; ultimoMes = null; return;
    }
    if (!tramo.length || ultimoMes === null || numeroMes !== ultimoMes + 1) {
      tramo = []; tramos.push(tramo);
    }
    tramo.push({ x: serie.length === 1 ? 50 : 4 + (indice * 92) / (serie.length - 1),
      y: 88 - (valor / maximo) * 70, periodo: punto.periodo, monto: punto.monto });
    ultimoMes = numeroMes;
  });
  return tramos;
}
