export interface DesgloseCompatibilidad {
  criterio: string;
  porcentaje: number | null;
  evaluado: boolean;
  motivoNoEvaluado?: "dato_no_informado" | "no_configurado" | null;
}

export interface Oportunidad {
  id: string;
  codigoExterno: string;
  nombre: string;
  descripcion: string | null;
  codigoEstado: number;
  estado: string;
  codigoTipo: string | null;
  tipo: string | null;
  moneda: string | null;
  montoEstimado: number | null;
  fechaPublicacion: string | null;
  fechaCierre: string | null;
  fechaAdjudicacion: string | null;
  codigoOrganismo: string | null;
  nombreOrganismo: string | null;
  codigoUnidad: string | null;
  nombreUnidad: string | null;
  comunaUnidad: string | null;
  regionUnidad: string | null;
  cantidadReclamos: number | null;
  cantidadItems: number;
  categorias: string[];
  clasificacion: {
    rubros: string[];
    etiquetas: string[];
  };
  nexus?: {
    estado: 'coincidencia' | 'sin_coincidencia' | 'pendiente' | 'sin_configurar';
    motivo: string; palabrasClaveCoincidentes: string[];
    ofertas: Array<{ ofertaId: string; oferta: string; item: string; correlativo: number | null;
      campo: string; expresion: string; calidad: number; explicacion: string }>;
  } | null;
  porcentajeCompatibilidad: number;
  nivelCompatibilidad: "muy_alta" | "alta" | "media" | "baja";
  coincidencias: {
    palabrasClave: string[];
    codigosCategoria: string[];
    region: boolean | null;
    monto: boolean | null;
  };
  desgloseCompatibilidad: DesgloseCompatibilidad[];
  sincronizadoEn: string;
}

export interface RespuestaOportunidades {
  perfil?: { ofertasIds?: string[]; nexusHabilitado?: boolean; necesitaOfertasNexus?: boolean; actualizadoEn?: string } | null;
  alcance?: "recomendadas" | "todas";
  datos: Oportunidad[];
  paginacion: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
  resumen: {
    compatibilidadPromedio: number;
    oportunidadesActivas: number;
    altaCompatibilidad?: number;
    nuevasSemana: number;
    ultimaActualizacion: string | null;
    distribucionCategorias: Array<{
      categoria: string;
      cantidad: number;
      porcentaje: number;
    }>;
  };
  filtrosDisponibles: {
    regiones: string[];
    organismos: Array<{ codigo: string; nombre: string }>;
    categorias: Array<{ codigo: string; nombre: string }>;
  };
}

export interface DetalleOportunidad extends Oportunidad {
  acceso: {
    completo: boolean;
    planRequerido: "premium" | null;
    mensaje: string | null;
  };
  items: Array<{
    id: string;
    correlativo: number;
    codigoProducto: string | null;
    codigoCategoria: string | null;
    categoria: string | null;
    nombreProducto: string | null;
    descripcion: string | null;
    unidadMedida: string | null;
    cantidad: number | null;
  }>;
  fechasImportantes: Array<{
    id: string;
    etiqueta: string;
    fecha: string;
  }>;
  documentos: Array<{
    id: string;
    nombre: string;
    tipo: string | null;
    url: string | null;
  }>;
  informacionClave: {
    fechaPublicacion: string | null;
    fechaCierre: string | null;
    duracionContrato: string | null;
    modalidad: string | null;
    moneda: string | null;
    region: string | null;
  };
  recomendaciones: Array<{
    tipo: string;
    titulo: string;
    descripcion: string;
  }>;
  urlMercadoPublico: string | null;
}

export function formatearMonto(monto: number | null): string {
  if (monto === null) return "Monto no informado";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(monto);
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "No informada";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(fecha));
}

export function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;

  return Math.max(
    0,
    Math.ceil((new Date(fecha).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}
