export interface LicitacionMercadoPublico {
  CodigoExterno: string;
  Nombre: string;
  CodigoEstado: number;
  FechaCierre?: string;
  [campo: string]: unknown;
}

export interface RespuestaLicitacionesMercadoPublico {
  Cantidad: number;
  FechaCreacion: string;
  Version: string;
  Listado: LicitacionMercadoPublico[];
}
