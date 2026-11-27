import type { ResumenDashboard } from './dashboardVerificado.types';
export interface FiltroInicio { horizonteCierre?: '48h' | '2a7' | '7a30' | '30mas' | '7mas'; codigoOrganismo?: string; codigoCategoria?: string; region?: string }
export const numeroInicio = (n: number) => new Intl.NumberFormat('es-CL').format(n);
export const porcentajeInicio = (n: number, total: number) => total > 0 ?
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(n * 100 / total) + '%' : '—';
export function coberturaInicio(r: ResumenDashboard, campo: number | null) {
  const t = r.metricas.oportunidadesActivas, d = r.calidad.conDetalle;
  return Number.isInteger(t) && t > 0 && d !== null && Number.isInteger(d) && d >= 0 && d <= t && d * 100 >= t * 99 &&
    campo !== null && Number.isInteger(campo) && campo >= 0 && campo <= t && campo * 100 >= t * 90;
}
export function horizontesValidos(r: ResumenDashboard) {
  return r.horizonteCierres.length === 4 && ['48h', '2a7', '7a30', '30mas'].every((k) => r.horizonteCierres.filter((h) => h.clave === k).length === 1) &&
    r.horizonteCierres.every((h) => Number.isInteger(h.cantidad) && h.cantidad >= 0) &&
    r.horizonteCierres.reduce((n, h) => n + h.cantidad, 0) === r.metricas.oportunidadesActivas;
}
export function etiquetaCategoria(nombre: string) {
  return nombre.split('/').map((v) => v.trim()).filter(Boolean).at(-1) || nombre;
}
