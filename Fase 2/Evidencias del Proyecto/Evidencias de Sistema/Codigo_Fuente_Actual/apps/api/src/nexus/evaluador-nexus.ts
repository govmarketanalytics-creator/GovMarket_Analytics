import { normalizarTexto } from '../licitaciones/catalogo-etiquetas';
import type { CampoEvidencia, ResultadoRelevanciaCapacidades } from '../oportunidades/relevancia-capacidades';
import { OFERTAS_NEXUS, ofertasPorIds, VERSION_NEXUS, type OfertaNexus } from './catalogo-nexus';

export interface ItemNexus { nombreProducto?: string | null; descripcion?: string | null;
  categoria?: string | null; codigoCategoria?: string | null; correlativo?: number; }
export interface FuenteNexus { nombre?: string | null; items?: ItemNexus[] | null; detalleCompleto: boolean; }
export interface EvidenciaOferta {
  ofertaId: string; oferta: string; item: string; correlativo: number | null;
  campo: CampoEvidencia; expresion: string; calidad: number; explicacion: string;
}
export interface ResultadoNexus extends ResultadoRelevanciaCapacidades {
  version: string; estado: 'coincidencia' | 'sin_coincidencia' | 'pendiente' | 'sin_configurar';
  motivo: string; ofertas: EvidenciaOferta[]; palabrasClaveCoincidentes: string[];
}
const patrones = OFERTAS_NEXUS.flatMap(o => [...new Set([o.nombre, ...o.sinonimos].map(normalizarTexto))]
  .map(texto => ({ oferta: o, texto, patron: ` ${texto} ` })));
const indice = new Map<string, typeof patrones>();
for (const patron of patrones) {
  const palabra = patron.texto.split(' ')[0];
  const grupo = indice.get(palabra) ?? []; grupo.push(patron); indice.set(palabra, grupo);
}
const destino = /\b(?:para|en|destinad[oa]s? a|propiedad de|a cargo de|de cargo de|de la red de|del departamento de|del servicio de salud|de los centros de)\b/;
const negacion = /(?:\bsin|\bexcepto|\bexcluye|\bno incluye|\bno requiere|\bno se requiere)\s+(?:(?:el|la|los|las|de|un|una|servicio|servicios)\s+)*$/;
function objeto(valor: string | null | undefined): string {
  const texto = normalizarTexto(valor ?? '');
  const corte = texto.search(destino);
  return ` ${corte >= 0 ? texto.slice(0, corte).trim() : texto} `;
}
function clasificar(texto: string) {
  const encontrados = new Map<string, { oferta: OfertaNexus; texto: string }>();
  for (const palabra of new Set(texto.trim().split(' '))) {
    for (const patron of indice.get(palabra) ?? []) {
      let desde = 0;
      for (;;) {
        const i = texto.indexOf(patron.patron, desde);
        if (i < 0) break;
        if (!negacion.test(texto.slice(Math.max(0, i - 70), i + 1))) {
          const anterior = encontrados.get(patron.oferta.id);
          if (!anterior || anterior.texto.length < patron.texto.length) encontrados.set(patron.oferta.id, patron);
          break;
        }
        desde = i + 1;
      }
    }
  }
  return [...encontrados.values()];
}
export function prepararNexus(ids: readonly string[], palabras: readonly string[] = []) {
  const seleccionadas = ofertasPorIds(ids);
  const seleccion = new Set(seleccionadas.map(o => o.id));
  const claves = [...new Set(palabras.map(normalizarTexto).filter(Boolean))];
  return (fuente: FuenteNexus): ResultadoNexus => {
    const vacio: ResultadoNexus = { version: VERSION_NEXUS, estado: 'sin_coincidencia',
      motivo: 'No se identificó una oferta seleccionada en el objeto de los ítems.',
      porcentaje: 0, coincidencias: [], evidencias: [], ofertas: [], palabrasClaveCoincidentes: [] };
    if (!seleccion.size) return { ...vacio, estado: 'sin_configurar', motivo: 'Selecciona tus servicios o productos específicos en el perfil.' };
    if (!fuente.detalleCompleto) return { ...vacio, estado: 'pendiente', motivo: 'Falta completar la ficha antes de evaluar su pertinencia.' };
    const evidencias: EvidenciaOferta[] = [];
    const objetosConfirmados: string[] = [];
    let clasificada = false;
    let contradictoria = false;
    for (const item of fuente.items ?? []) {
      const producto = objeto(item.nombreProducto), descripcion = objeto(item.descripcion);
      const porProducto = clasificar(producto);
      const porDescripcion = clasificar(descripcion);
      if (porProducto.length && porDescripcion.length
          && !porProducto.some(p => porDescripcion.some(d => d.oferta.id === p.oferta.id))) {
        contradictoria = true;
        continue;
      }
      const literales = porProducto.length ? porProducto : porDescripcion;
      const campo: CampoEvidencia = porProducto.length ? 'item_producto' : 'item_descripcion';
      const calidad = porProducto.length ? 100 : 80;
      const guardar = (o: OfertaNexus, expresion: string, origen: CampoEvidencia, fuerza: number) => {
        if (!seleccion.has(o.id)) return;
        objetosConfirmados.push(` ${normalizarTexto(item.nombreProducto ?? '')} `,
          ` ${normalizarTexto(item.descripcion ?? '')} `);
        evidencias.push({ ofertaId: o.id, oferta: o.nombre, item: item.nombreProducto || item.descripcion || 'Ítem sin nombre',
          correlativo: item.correlativo ?? null, campo: origen, expresion, calidad: fuerza,
          explicacion: `Ofreces ${o.nombre}; el objeto de este ítem coincide con esa oferta (${expresion}).` });
      };
      if (literales.length) {
        clasificada = true;
        for (const p of literales) guardar(p.oferta, p.texto, campo, calidad);
        // Un código genérico o incorrecto no reemplaza un objeto explícito de otro servicio.
        continue;
      }
      const codigo = item.codigoCategoria?.trim();
      if (/\b(?:sin|excepto|excluye|no incluye|no requiere)\b/.test(producto + descripcion)) {
        contradictoria = true;
        continue;
      }
      const porCodigo = codigo ? OFERTAS_NEXUS.filter(o => o.codigosCategoria.includes(codigo)) : [];
      if (porCodigo.length) {
        clasificada = true;
        for (const o of porCodigo) guardar(o, codigo!, 'item_categoria', 90);
      }
    }
    // Sólo una ficha completa sin objeto identificable en sus ítems permite
    // usar el título como evidencia provisional, con menor calidad.
    if (!clasificada && !contradictoria) {
      const titulo = objeto(fuente.nombre);
      for (const p of clasificar(titulo)) {
        clasificada = true;
        if (!seleccion.has(p.oferta.id)) continue;
        objetosConfirmados.push(titulo);
        evidencias.push({ ofertaId: p.oferta.id, oferta: p.oferta.nombre, item: fuente.nombre || 'Título',
          correlativo: null, campo: 'titulo', expresion: p.texto, calidad: 65,
          explicacion: `Ofreces ${p.oferta.nombre}; el título describe esa oferta. La evidencia por título es provisional.` });
      }
    }
    if (!evidencias.length) return { ...vacio, estado: contradictoria || !clasificada ? 'pendiente' : 'sin_coincidencia',
      motivo: contradictoria ? 'Hay información contradictoria entre el producto, su descripción o su clasificación. Revisa la ficha.'
        : clasificada ? vacio.motivo : 'La información disponible no permite identificar el producto o servicio concreto.' };
    const mejores = new Map<string, EvidenciaOferta>();
    for (const e of evidencias) if (!mejores.has(e.ofertaId) || mejores.get(e.ofertaId)!.calidad < e.calidad) mejores.set(e.ofertaId, e);
    const ofertas = [...mejores.values()];
    return { ...vacio, estado: 'coincidencia', motivo: 'Coincide una oferta específica con el objeto solicitado; no acredita cumplir todas las bases.',
      porcentaje: Math.max(...ofertas.map(e => e.calidad)), coincidencias: ofertas.map(e => e.oferta), ofertas,
      evidencias: ofertas.map(e => ({ terminoPerfil: e.oferta, expresionCoincidente: e.expresion,
        campo: e.campo, calidad: e.calidad, nivel: e.calidad >= 90 ? 'alta' : 'media' })),
      palabrasClaveCoincidentes: claves.filter(p => objetosConfirmados.some(t => t.includes(` ${p} `))) };
  };
}
