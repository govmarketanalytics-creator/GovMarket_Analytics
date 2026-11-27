import { describe, expect, it } from 'vitest';
import type { LicitacionMercadoPublico } from '../integraciones/mercado-publico/interfaces/licitacion-mercado-publico.interface';
import {
  analizarResultadoLicitacion,
  ClasificacionResultadoLicitacion,
} from './analizador-resultados';

describe('analizarResultadoLicitacion', () => {
  it('extrae adjudicatario, oferentes y monto total por ítem', () => {
    const resultado = analizarResultadoLicitacion({
      CodigoExterno: '1000-1-LE26',
      Nombre: 'Compra de equipamiento',
      CodigoEstado: 8,
      Estado: 'Adjudicada',
      Items: {
        Listado: [
          {
            Correlativo: 1,
            Adjudicacion: {
              Numero: '1234',
              Fecha: '2026-10-15T12:00:00',
              NumeroOferentes: 4,
              NombreProveedor: 'Proveedor Ejemplo Ltda.',
              RutProveedor: '76.123.456-7',
              Cantidad: 2,
              MontoUnitario: 150000,
            },
          },
        ],
      },
    } as LicitacionMercadoPublico);

    expect(resultado.clasificacion).toBe(
      ClasificacionResultadoLicitacion.ADJUDICADA,
    );
    expect(resultado.numeroOferentes).toBe(4);
    expect(resultado.montoTotalAdjudicado).toBe('300000');
    expect(resultado.adjudicaciones[0]).toMatchObject({
      itemCorrelativo: 1,
      nombreProveedor: 'Proveedor Ejemplo Ltda.',
      rutProveedor: '76.123.456-7',
      montoTotal: '300000',
    });
  });

  it('registra un proceso desierto sin inventar un motivo', () => {
    const resultado = analizarResultadoLicitacion({
      CodigoExterno: '1000-2-LE26',
      Nombre: 'Proceso desierto',
      CodigoEstado: 7,
      Estado: 'Desierta',
    });

    expect(resultado.clasificacion).toBe(
      ClasificacionResultadoLicitacion.DESIERTA,
    );
    expect(resultado.motivo).toBeNull();
    expect(resultado.fuenteMotivo).toBeNull();
  });

  it('conserva el motivo y su campo de origen cuando está informado', () => {
    const resultado = analizarResultadoLicitacion({
      CodigoExterno: '1000-3-LE26',
      Nombre: 'Proceso desierto con motivo',
      CodigoEstado: 7,
      Estado: 'Desierta',
      MotivoDesercion: 'Las ofertas recibidas fueron inadmisibles',
    });

    expect(resultado.motivo).toBe('Las ofertas recibidas fueron inadmisibles');
    expect(resultado.fuenteMotivo).toBe('MotivoDesercion');
  });
});
