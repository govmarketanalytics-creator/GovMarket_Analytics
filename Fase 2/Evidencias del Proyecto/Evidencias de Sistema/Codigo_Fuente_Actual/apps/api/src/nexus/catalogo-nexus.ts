import { CATALOGO_ETIQUETAS, normalizarTexto } from '../licitaciones/catalogo-etiquetas';

export const VERSION_NEXUS = 'reducido-1.1';
export type TipoOferta = 'servicio' | 'producto' | 'obra';
export interface OfertaNexus {
  id: string; rubro: string; linea: string; especialidad: string;
  nombre: string; tipo: TipoOferta; sinonimos: string[]; codigosCategoria: string[];
}
export function nexusHabilitado(): boolean {
  return process.env.NEXUS_REDUCIDO_HABILITADO === 'true';
}
const oferta = (id: string, rubro: string, linea: string, especialidad: string,
  nombre: string, tipo: TipoOferta, sinonimos: string[], codigosCategoria: string[] = []): OfertaNexus =>
  ({ id, rubro, linea, especialidad, nombre, tipo, sinonimos, codigosCategoria });

const salud = [
  oferta('salud.psiquiatria', 'Salud', 'Servicios clínicos', 'Salud mental',
    'Consultas de psiquiatría', 'servicio', ['psiquiatria', 'atencion psiquiatrica', 'consulta psiquiatrica', 'consultas psiquiatricas']),
  oferta('salud.psicologia', 'Salud', 'Servicios clínicos', 'Salud mental',
    'Atención psicológica', 'servicio', ['psicologia', 'servicios psicologicos', 'consulta psicologica', 'consultas psicologicas', 'telepsicologia'], ['85121608']),
  oferta('salud.oftalmologia', 'Salud', 'Servicios clínicos', 'Oftalmología',
    'Consultas de oftalmología', 'servicio', ['oftalmologia', 'atencion oftalmologica', 'consulta oftalmologica', 'consultas oftalmologicas']),
  oferta('salud.odontologia', 'Salud', 'Servicios clínicos', 'Odontología',
    'Atención odontológica', 'servicio', ['odontologia', 'consulta dental', 'consultas dentales', 'prestaciones odontologicas', 'prestaciones dentales']),
  oferta('salud.lentes', 'Salud', 'Productos ópticos', 'Óptica',
    'Lentes ópticos', 'producto', ['lentes opticos', 'lentes oftalmicos']),
  oferta('salud.paracetamol', 'Salud', 'Medicamentos', 'Productos específicos',
    'Paracetamol', 'producto', ['paracetamol']),
  oferta('salud.ibuprofeno', 'Salud', 'Medicamentos', 'Productos específicos',
    'Ibuprofeno', 'producto', ['ibuprofeno']),
  oferta('salud.guantes-examen', 'Salud', 'Insumos hospitalarios', 'Material desechable',
    'Guantes médicos de examen', 'producto', ['guantes de examen', 'guantes medicos de examen', 'guantes de procedimiento'], ['42132203']),
  oferta('salud.jeringas', 'Salud', 'Insumos hospitalarios', 'Material desechable',
    'Jeringas desechables', 'producto', ['jeringas desechables', 'jeringas descartables']),
  oferta('salud.apositos', 'Salud', 'Insumos hospitalarios', 'Material de curación',
    'Apósitos', 'producto', ['apositos', 'aposito']),
];

const productos = new Set(['insumos-medicos', 'mobiliario-oficina', 'maquinaria-herramientas', 'vestuario', 'alimentacion']);
const tipoProducto = /equipos|equipamiento|material|licencias|repuestos|herramientas|productos|insumos|bebidas|abarrotes|uniformes|calzado|ropa|cables|baterias|muebles|papeleria|articulos|reactivos/;
const adicionales: Record<string, string[]> = {
  'guardias-seguridad': ['guardias de seguridad', 'servicios de vigilancia', 'vigilancia y seguridad', 'puesto de guardia'],
  'control-plagas': ['desratizacion', 'control de plagas', 'fumigacion'],
  'reparacion-vehiculos': ['reparacion de vehiculos', 'mantencion vehicular', 'mantenimiento vehicular', 'parque vehicular'],
  'cursos-capacitacion': ['capacitacion', 'cursos de capacitacion', 'talleres de capacitacion'],
  'desarrollo-software': ['desarrollo de aplicaciones web', 'desarrollo web', 'desarrollo de plataformas web'],
};

// Se reutilizan ofertas concretas del catálogo existente, nunca sus rubros como
// comodines. Salud se desglosa en servicios, productos e insumos independientes.
const otras = CATALOGO_ETIQUETAS.filter(r => r.id !== 'salud').flatMap(r => r.etiquetas.map(e => {
  const tipo: TipoOferta = r.id === 'construccion-infraestructura' ? 'obra'
    : productos.has(r.id) || tipoProducto.test(normalizarTexto(e.nombre)) ? 'producto' : 'servicio';
  return oferta(`${r.id}.${e.id}`, r.nombre, tipo === 'producto' ? 'Productos' : tipo === 'obra' ? 'Obras' : 'Servicios',
    e.nombre, e.nombre, tipo, [e.nombre, ...e.sinonimos, ...(adicionales[e.id] ?? [])]);
}));
export const OFERTAS_NEXUS: readonly OfertaNexus[] = [...salud, ...otras];
export const OFERTAS_POR_ID = new Map(OFERTAS_NEXUS.map(o => [o.id, o]));
// Códigos específicos contrastados con fichas públicas de Mercado Público:
// 85121608: servicios de psicología; 42132203: guantes médicos de examen.
// No se infieren equivalencias a partir de prefijos o categorías superiores.
export const FUENTES_CATEGORIAS_NEXUS = [
  'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=M6kXVPTHHUVFsJC9axhVKw%3D%3D',
  'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=U26OhS+mIPiI1cVFEcdi8oqBGtdIoRJekGiy21l%2F6iBctN%2FAyfKNaMlEmUKvtIxY',
];
export function ofertasPorIds(ids: readonly string[]): OfertaNexus[] {
  return [...new Set(ids)].flatMap(id => { const o = OFERTAS_POR_ID.get(id); return o ? [o] : []; });
}
export function terminosDeOfertas(ids: readonly string[]): string[] {
  return [...new Set(ofertasPorIds(ids).flatMap(o => [o.nombre, ...o.sinonimos]).map(normalizarTexto))];
}
export function codigosDeOfertas(ids: readonly string[]): string[] {
  return [...new Set(ofertasPorIds(ids).flatMap(o => o.codigosCategoria))];
}
export function catalogoNexusPublico() {
  return { habilitado: nexusHabilitado(), version: VERSION_NEXUS,
    ofertas: OFERTAS_NEXUS.map(({ sinonimos: _sinonimos, ...o }) => o) };
}
