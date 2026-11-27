import { PlanPagoEmpresa } from '../planes-empresa/entities/suscripcion-empresa.entity';
import {
  listarPlanesComerciales,
  obtenerPlanComercial,
} from './catalogo-planes';

describe('Catálogo comercial de planes', () => {
  it('define el plan Individual por un mes y $9.990', () => {
    expect(obtenerPlanComercial(PlanPagoEmpresa.INDIVIDUAL)).toMatchObject({
      monto: 9_990,
      moneda: 'CLP',
      mesesVigencia: 1,
      administradores: 1,
      usuariosAdicionales: 0,
    });
  });

  it('define el plan Empresa por tres meses y hasta cuatro usuarios', () => {
    expect(obtenerPlanComercial(PlanPagoEmpresa.EMPRESA)).toMatchObject({
      monto: 59_990,
      moneda: 'CLP',
      mesesVigencia: 3,
      administradores: 1,
      usuariosAdicionales: 4,
    });
    expect(listarPlanesComerciales()).toHaveLength(2);
  });
});
