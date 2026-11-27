export type NivelConcentracion = "alta" | "baja" | "sin_datos";
export type MonedaAnalisis = "CLP" | "CLF" | "UTM" | "USD" | "EUR";
export interface FiltrosAnalisisMercado {
  fechaDesde: string;
  fechaHasta: string;
  alcance: "empresa" | "mercado";
  moneda: MonedaAnalisis;
  region?: string;
  categoria?: string;
  organismo?: string;
}
export interface TotalesMercado {
  publicadas: number;
  adjudicadas: number;
  desiertas: number;
  cerradasSinResultado: number;
  pendientes: number;
  montoAdjudicado: string | null;
  medianaOferentes: number | null;
  conOferentes: number;
  conMonto: number;
  bajaParticipacion: number;
  porcentajeBajaParticipacion: number | null;
  tasaDesiertas: number | null;
  proveedoresAdjudicados: number;
}
export interface RespuestaAnalisisMercado {
  versionContrato: 2;
  generadoEn: string;
  fuente: string;
  zonaHoraria: string;
  filtrosAplicados: FiltrosAnalisisMercado;
  periodoAnterior: {
    fechaDesde: string;
    fechaHasta: string;
    dias: number;
    diasPorTramo: number;
  };
  perfil: { configurado: boolean; categorias: number; terminos: number };
  metricas: TotalesMercado;
  comparacion: {
    publicadas: { anterior: number; variacion: number | null };
    monto: {
      anterior: string | null;
      conMonto: number;
      variacion: number | null;
    };
  };
  cobertura: {
    licitaciones: number;
    conDetalle: number;
    conResultado: number;
    porcentajeResultados: number | null;
    conOferentes: number;
    conMonto: number;
    sinRegion: number;
    ultimaSincronizacion: string | null;
    primeraPublicacion: string | null;
    ultimaPublicacion: string | null;
  };
  evolucion: Array<{
    periodo: string;
    cantidad: number;
    anteriorCantidad: number;
    monto: string | null;
    anteriorMonto: string | null;
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
  regiones: {
    datos: Array<{
      codigo: string;
      nombre: string;
      cantidad: number;
      nivel: NivelConcentracion;
      monto: string | null;
      porcentaje: number | null;
    }>;
    sinRegion: number;
  };
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
  distribucionTipos: Array<{ tipo: string; cantidad: number }>;
  opciones: {
    regiones: Array<{ codigo: string; nombre: string }>;
    categorias: Array<{ codigo: string | null; nombre: string }>;
    organismos: Array<{ codigo: string; nombre: string }>;
  };
  metodologia: string[];
}
export interface RespuestaNoticiasMercado {
  estado: "disponible" | "desactualizado" | "no_disponible" | "deshabilitado";
  fuente: string;
  actualizadoEn: string | null;
  proximaActualizacion: string | null;
  mensaje: string;
  noticias: Array<{
    id: number;
    titulo: string;
    url: string;
    publicadoEn: string;
    fuente: string;
    tema:
      | "Tecnología"
      | "Oportunidades"
      | "Normativa"
      | "Capacitación"
      | "Compras públicas";
  }>;
}
export interface LicitacionesAnalisis {
  total: number;
  pagina: number;
  limite: number;
  datos: Array<{
    codigo: string;
    nombre: string;
    estado: string;
    fechaPublicacion: string;
    fechaCierre: string | null;
  }>;
}
