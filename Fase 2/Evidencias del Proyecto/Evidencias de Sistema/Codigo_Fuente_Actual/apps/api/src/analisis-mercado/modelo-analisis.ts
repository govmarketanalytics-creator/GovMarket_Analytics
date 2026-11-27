export const REGIONES_ANALISIS = [
  { codigo: "arica", nombre: "Arica y Parinacota", patrones: ["arica"] },
  { codigo: "tarapaca", nombre: "Tarapacá", patrones: ["tarapac"] },
  { codigo: "antofagasta", nombre: "Antofagasta", patrones: ["antofagasta"] },
  { codigo: "atacama", nombre: "Atacama", patrones: ["atacama"] },
  { codigo: "coquimbo", nombre: "Coquimbo", patrones: ["coquimbo"] },
  { codigo: "valparaiso", nombre: "Valparaíso", patrones: ["valparai"] },
  {
    codigo: "metropolitana",
    nombre: "Metropolitana de Santiago",
    patrones: ["metropolitan", "santiago"],
  },
  {
    codigo: "ohiggins",
    nombre: "Libertador General Bernardo O'Higgins",
    patrones: ["higgins", "libertador"],
  },
  { codigo: "maule", nombre: "Maule", patrones: ["maule"] },
  { codigo: "nuble", nombre: "Ñuble", patrones: ["nuble"] },
  { codigo: "biobio", nombre: "Biobío", patrones: ["biob", "bio bio"] },
  { codigo: "araucania", nombre: "La Araucanía", patrones: ["araucan"] },
  { codigo: "los-rios", nombre: "Los Ríos", patrones: ["los rios"] },
  { codigo: "los-lagos", nombre: "Los Lagos", patrones: ["los lagos"] },
  { codigo: "aysen", nombre: "Aysén", patrones: ["aysen"] },
  {
    codigo: "magallanes",
    nombre: "Magallanes y de la Antártica Chilena",
    patrones: ["magallanes", "antartica"],
  },
];
export const normalizarTexto = (v: string) =>
  v
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export const identificarRegion = (nombre: string) => {
  const texto = normalizarTexto(nombre);
  return REGIONES_ANALISIS.find(
    (r) => r.codigo === nombre || r.patrones.some((p) => texto.includes(p)),
  );
};
export function porcentaje(n: number, total: number): number | null {
  return total > 0 ? Math.round((n * 1000) / total) / 10 : null;
}
export function centavos(v: string): bigint {
  const [entero, decimal = ""] = v.split(".");
  return BigInt(entero) * 100n + BigInt(decimal.padEnd(2, "0").slice(0, 2));
}
export function sumarMontos(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  const total = centavos(a) + centavos(b);
  return (
    (total / 100n).toString() + "." + (total % 100n).toString().padStart(2, "0")
  );
}
export function variacion(
  actual: string | number | null,
  anterior: string | number | null,
): number | null {
  if (actual === null || anterior === null) return null;
  const a = typeof actual === "string" ? centavos(actual) : BigInt(actual);
  const b =
    typeof anterior === "string" ? centavos(anterior) : BigInt(anterior);
  if (b <= 0n) return null;
  const diferencia = a - b;
  const magnitud = diferencia < 0n ? -diferencia : diferencia;
  return (
    (Number((magnitud * 1000n + b / 2n) / b) / 10) * (diferencia < 0n ? -1 : 1)
  );
}
export interface TotalesAnalisis {
  actual: boolean;
  publicadas: number;
  adjudicadas: number;
  desiertas: number;
  cerradasSinResultado: number;
  pendientes: number;
  conDetalle: number;
  conResultado: number;
  sinRegion: number;
  conMonto: number;
  montoAdjudicado: string | null;
  conOferentes: number;
  medianaOferentes: number | null;
  bajaParticipacion: number;
  ultimaSincronizacion: string | null;
  primeraPublicacion: string | null;
  ultimaPublicacion: string | null;
}
export const totalesVacios: TotalesAnalisis = {
  actual: true,
  publicadas: 0,
  adjudicadas: 0,
  desiertas: 0,
  cerradasSinResultado: 0,
  pendientes: 0,
  conDetalle: 0,
  conResultado: 0,
  sinRegion: 0,
  conMonto: 0,
  montoAdjudicado: null,
  conOferentes: 0,
  medianaOferentes: null,
  bajaParticipacion: 0,
  ultimaSincronizacion: null,
  primeraPublicacion: null,
  ultimaPublicacion: null,
};
export interface DatosAnalisisRaw {
  totales: TotalesAnalisis[];
  evolucion: Array<{
    actual: boolean;
    tramo: number;
    cantidad: number;
    monto: string | null;
    conMonto: number;
  }>;
  organismos: Array<{
    codigo: string | null;
    nombre: string;
    cantidad: number;
    adjudicadas: number;
    monto: string | null;
    ultimaPublicacion: string;
    medianaOferentes: number | null;
    baseOferentes: number;
  }>;
  regiones: Array<{ nombre: string; cantidad: number; monto: string | null }>;
  categorias: Array<{
    codigo: string | null;
    nombre: string;
    cantidad: number;
  }>;
  proveedores: Array<{
    nombre: string;
    rut: string;
    monto: string;
    adjudicaciones: number;
    participacion: number | null;
  }>;
  proveedoresBase: { cantidad: number; monto: string | null };
  resultados: Array<{ clasificacion: string; cantidad: number }>;
  tipos: Array<{ tipo: string; cantidad: number }>;
  perfil: { configurado: boolean; categorias: number; terminos: number };
  opciones: {
    regiones: string[];
    categorias: Array<{ codigo: string | null; nombre: string }>;
    organismos: Array<{ codigo: string; nombre: string }>;
  };
}
