import { PlanPagoEmpresa } from '../planes-empresa/entities/suscripcion-empresa.entity';

export interface PlanComercial {
  id: PlanPagoEmpresa;
  nombre: string;
  monto: number;
  moneda: 'CLP';
  mesesVigencia: number;
  administradores: number;
  usuariosAdicionales: number;
}

export const CATALOGO_PLANES: Readonly<Record<PlanPagoEmpresa, PlanComercial>> =
  Object.freeze({
    [PlanPagoEmpresa.INDIVIDUAL]: Object.freeze({
      id: PlanPagoEmpresa.INDIVIDUAL,
      nombre: 'Premium Individual',
      monto: 9_990,
      moneda: 'CLP',
      mesesVigencia: 1,
      administradores: 1,
      usuariosAdicionales: 0,
    }),
    [PlanPagoEmpresa.EMPRESA]: Object.freeze({
      id: PlanPagoEmpresa.EMPRESA,
      nombre: 'Premium Empresa',
      monto: 59_990,
      moneda: 'CLP',
      mesesVigencia: 3,
      administradores: 1,
      usuariosAdicionales: 4,
    }),
  });

export function obtenerPlanComercial(plan: PlanPagoEmpresa): PlanComercial {
  return CATALOGO_PLANES[plan];
}

export function listarPlanesComerciales(): PlanComercial[] {
  return Object.values(CATALOGO_PLANES);
}
