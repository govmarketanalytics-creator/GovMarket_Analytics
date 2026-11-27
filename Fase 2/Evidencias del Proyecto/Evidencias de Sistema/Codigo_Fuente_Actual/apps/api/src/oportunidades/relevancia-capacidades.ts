/**
 * GovMarket Analytics / match local por especificidad y contexto.
 * Relevancia comercial explicable (reglas deterministas, no IA predictiva).
 *
 * El porcentaje de este componente mide SOLO calidad de evidencias de
 * capacidades; no mide cumplimiento de bases ni probabilidad de adjudicacion.
 */
export type CampoEvidencia =
  | 'titulo'
  | 'item_producto'
  | 'item_descripcion'
  | 'item_categoria'
  | 'descripcion';

export interface ItemParaRelevancia {
  nombreProducto?: string | null;
  descripcion?: string | null;
  categoria?: string | null;
}

export interface FuenteParaRelevancia {
  nombre?: string | null;
  descripcion?: string | null;
  items?: ItemParaRelevancia[] | null;
}

export interface EvidenciaCapacidad {
  terminoPerfil: string;
  expresionCoincidente: string;
  campo: CampoEvidencia;
  calidad: number;
  nivel: 'alta' | 'media' | 'baja';
}

export interface ResultadoRelevanciaCapacidades {
  porcentaje: number;
  coincidencias: string[];
  evidencias: EvidenciaCapacidad[];
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function nivel(calidad: number): EvidenciaCapacidad['nivel'] {
  if (calidad >= 90) return 'alta';
  if (calidad >= 60) return 'media';
  return 'baja';
}

/**
 * Devuelve la MEJOR evidencia entre rubros alternativos: ampliar el perfil no
 * penaliza las coincidencias anteriores (regresion BUS-05).
 *
 * Titulo/producto pesan mas que descripcion. Una categoria extensa con solo
 * una palabra generica NO acredita capacidad plena. Las equivalencias de
 * un mismo concepto no suman puntos por repetirse.
 */
export function evaluarRelevanciaCapacidades(
  terminosPerfil: string[],
  expandir: (termino: string) => string[],
  fuente: FuenteParaRelevancia,
): ResultadoRelevanciaCapacidades {
  return prepararRelevanciaCapacidades(terminosPerfil, expandir)(fuente);
}

export type EvaluadorRelevanciaCapacidades = (fuente: FuenteParaRelevancia) => ResultadoRelevanciaCapacidades;

// Pesos de revisión local. Una palabra amplia no acredita una especialidad.
// Los códigos oficiales, región y monto siguen en el evaluador de negocio.
const limitesGenericos = new Map([
  ...['servicio', 'servicios', 'tecnologia', 'seguridad', 'proteccion',
    'gestion', 'administracion', 'desarrollo', 'sistemas', 'insumos',
    'equipamiento', 'consultoria'].map((v) => [v, 35] as const),
  ...['software', 'informatica', 'computacion', 'redes', 'soporte',
    'mantencion', 'mantenimiento', 'reparacion', 'medicina', 'salud']
    .map((v) => [v, 55] as const),
]);
const negacionPrevia = /(?:\bsin|\bexcepto|\bexcluye|\bexcluyendo|\bno se requiere|\bno incluye|\bno requiere)\s+(?:(?:el|la|los|las|un|una|servicio|servicios|de)\s+)*$/;
const contextosAjenos: Record<string, RegExp> = {
  redes: /^redes (?:sociales|de agua|de gas|de alcantarillado|electricas)\b/,
  soporte: /^soporte(?:s)? (?:metalico|mecanico|de acero|para repisa|para television)\b/,
};
const especificidad = (valor: string) => limitesGenericos.get(valor) ?? 100;

function contieneEvidencia(texto: string, expresion: string, patron: string): boolean {
  let desde = 0;
  for (;;) {
    const posicion = texto.indexOf(patron, desde);
    if (posicion < 0) return false;
    const antes = texto.slice(Math.max(0, posicion - 60), posicion + 1);
    const despues = texto.slice(posicion + 1, posicion + 90);
    if (!negacionPrevia.test(antes) && !contextosAjenos[expresion]?.test(despues)) return true;
    desde = posicion + 1;
  }
}

interface ReglaPreparada {
  terminoPerfil: string;
  limitePerfil: number;
  expresiones: Array<{ texto: string; patron: string; limite: number }>;
}

/** Las reglas del perfil se preparan una vez para todas las fichas del lote.
 * Conserva alternativas, límites de palabra y campos trazables. */
export function prepararRelevanciaCapacidades(
  terminosPerfil: string[],
  expandir: (termino: string) => string[],
): EvaluadorRelevanciaCapacidades {
  const reglas = new Map<string, ReglaPreparada>();
  const terminosVistos = new Set<string>();
  for (const terminoPerfil of terminosPerfil) {
    const clave = normalizar(terminoPerfil);
    if (!clave || terminosVistos.has(clave)) continue;
    terminosVistos.add(clave);
    const expresiones = [...new Set(expandir(terminoPerfil).map(normalizar).filter(Boolean))];
    if (!expresiones.length) expresiones.push(clave);
    const concepto = [...expresiones].sort().join('\u0000');
    const previa = reglas.get(concepto);
    if (previa) {
      previa.limitePerfil = Math.max(previa.limitePerfil, especificidad(clave));
      continue;
    }
    reglas.set(concepto, { terminoPerfil, limitePerfil: especificidad(clave),
      expresiones: expresiones
        .sort((a, b) => especificidad(b) - especificidad(a) || b.length - a.length)
        .map((texto) => ({ texto, patron: ` ${texto} `, limite: especificidad(texto) })),
    });
  }
  const preparadas = [...reglas.values()];
  return (fuente) => evaluarPreparada(preparadas, fuente);
}

function evaluarPreparada(
  reglas: ReglaPreparada[],
  fuente: FuenteParaRelevancia,
): ResultadoRelevanciaCapacidades {
  // Cada campo se normaliza y delimita una vez, en lugar de reconstruirlo
  // para cada alias de cada capacidad del perfil.
  const normalizados = new Map<string, string>();
  const campoNormalizado = (valor: string | null | undefined) => {
    if (!valor) return '';
    const previo = normalizados.get(valor);
    if (previo !== undefined) return previo;
    const texto = normalizar(valor);
    const resultado = texto ? ` ${texto} ` : '';
    normalizados.set(valor, resultado);
    return resultado;
  };
  const items = fuente.items ?? [];
  const camposVistos = new Set<string>();
  const campos: Array<{campo: CampoEvidencia; texto: string; base: number}> = [
    { campo: 'titulo' as const, texto: campoNormalizado(fuente.nombre), base: 100 },
    ...items.map((i) => ({ campo: 'item_producto' as const, texto: campoNormalizado(i.nombreProducto), base: 100 })),
    ...items.map((i) => ({ campo: 'item_descripcion' as const, texto: campoNormalizado(i.descripcion), base: 75 })),
    ...items.map((i) => ({ campo: 'item_categoria' as const, texto: campoNormalizado(i.categoria), base: 30 })),
    { campo: 'descripcion' as const, texto: campoNormalizado(fuente.descripcion), base: 25 },
  ].filter((v) => {
    // Repetir un texto en varios ítems no añade evidencia a una regla basada
    // en la mejor coincidencia. Se conserva el primer campo y sus empates.
    const clave = v.campo + '\u0000' + v.texto;
    if (!v.texto || camposVistos.has(clave)) return false;
    camposVistos.add(clave);
    return true;
  });

  const evidencias: EvidenciaCapacidad[] = [];
  const coincidencias: string[] = [];
  for (const { terminoPerfil, limitePerfil, expresiones } of reglas) {
    let mejor: EvidenciaCapacidad | null = null;
    for (const item of campos) {
      if (!item.texto) continue;
      let primera: typeof expresiones[number] | null = null;
      for (const expresion of expresiones) {
        if (!contieneEvidencia(item.texto, expresion.texto, expresion.patron)) continue;
        primera = expresion;
        break;
      }
      if (primera === null) continue;

      // Varios sinónimos del mismo concepto no suman evidencia independiente.
      const calidadCampo = item.campo === 'item_categoria'
        ? (primera.limite === 100 ? 90 : 30) : item.base;
      const calidad = Math.min(calidadCampo, limitePerfil, primera.limite);
      const actual: EvidenciaCapacidad = {
        terminoPerfil,
        expresionCoincidente: primera.texto,
        campo: item.campo,
        calidad,
        nivel: nivel(calidad),
      };
      if (!mejor || actual.calidad > mejor.calidad) mejor = actual;
      if (mejor.calidad === Math.min(limitePerfil, expresiones[0].limite)) break;
    }
    if (mejor) {
      coincidencias.push(terminoPerfil);
      evidencias.push(mejor);
    }
  }

  return {
    porcentaje: evidencias.reduce((maximo, evidencia) => Math.max(maximo, evidencia.calidad), 0),
    coincidencias,
    evidencias,
  };
}
