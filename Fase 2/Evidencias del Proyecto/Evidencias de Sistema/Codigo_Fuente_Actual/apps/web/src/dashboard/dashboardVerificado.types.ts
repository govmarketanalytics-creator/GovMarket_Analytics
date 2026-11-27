import type { MontoPorMonedaDashboard } from './montosDashboard';

export interface ResumenDashboard {
  versionContrato: 3;
  generadoEn: string;
  acceso: { premium: boolean };
  calidad: {
    catalogoConsultadoEn: string | null;
    ultimoDetalleEn: string | null;
    conDetalle: number | null;
    baseCategorias: number | null;
    baseCompradores: number | null;
    baseRegiones: number | null;
    representatividad: 'muestra_disponible_no_representativa';
  };
  metricas: {
    oportunidadesActivas: number;
    montoTotalDisponible: null;
    montosPorMoneda: MontoPorMonedaDashboard[];
    oportunidadesConMonto: number | null;
    oportunidadesSinMonto: number | null;
    nuevasSemana: number | null;
    cierran48Horas: number;
    cierranSemana: number;
    organismosCompradores: number | null;
  };
  distribucionCategorias: Array<{ codigo: string; categoria: string; cantidad: number }>;
  organismos: Array<{ codigo: string; nombre: string; cantidad: number }>;
  regiones: Array<{ codigo: string; nombre: string; cantidad: number }>;
  horizonteCierres: Array<{ clave: string; etiqueta: string; cantidad: number }>;
  agendaCierres: Array<{ codigoExterno: string; nombre: string; nombreOrganismo: string | null; fechaCierre: string }>;
  actividadReciente: Array<{ codigoExterno: string; nombre: string; nombreOrganismo: string | null; fechaPublicacion: string }>;
  etiquetasRelevantes: string[];
}

export interface FavoritoDashboard {
  id: string;
  creadoEn: string;
  licitacion: {
    codigoExterno: string;
    nombre: string;
    codigoEstado: number;
    activaEnListado: boolean;
    esPrueba: boolean;
    nombreOrganismo: string | null;
    fechaCierre: string | null;
  };
}

export function favoritosVigentesDashboard(favoritos: FavoritoDashboard[], ahora: string) {
  const corte = Date.parse(ahora);
  return favoritos.filter(({ licitacion: l }) => l.activaEnListado === true && l.codigoEstado === 5 &&
    l.esPrueba === false && l.fechaCierre !== null && Date.parse(l.fechaCierre) >= corte)
    .sort((a, b) => Date.parse(a.licitacion.fechaCierre!) - Date.parse(b.licitacion.fechaCierre!) ||
      a.licitacion.codigoExterno.localeCompare(b.licitacion.codigoExterno));
}

// El contador de guardadas comparte el mismo corte que el resumen. No es una
// confirmacion de admisibilidad ni evidencia de haber enviado una postulacion.
