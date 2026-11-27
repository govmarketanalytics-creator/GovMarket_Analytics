import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { MercadoPublicoService } from '../integraciones/mercado-publico/mercado-publico.service';
import { IngestaLicitacionesService } from './ingesta-licitaciones.service';
import type { LicitacionesService } from './licitaciones.service';
import type { ControlConsultasService } from '../integraciones/mercado-publico/control-consultas.service';
import type { ColaDetallesService } from './cola-detalles.service';

function crearPrueba() {
  const listarLicitacionesPorFecha = vi.fn();
  const listarLicitacionesActivas = vi.fn();
  const sincronizarPorCodigo = vi.fn();
  const indexarListadoActivo = vi.fn();
  const seleccionarPendientesDetalle = vi.fn();
  const indexarListadoFecha = vi.fn();
  const obtenerFechasListadoSincronizadas = vi.fn();
  const registrarSincronizacionListadoDia = vi.fn();
  const seleccionarPendientesResultadoPeriodo = vi.fn();
  const actualizarResultadoDesdeDatosGuardados = vi.fn();
  const contarPendientesResultadoPeriodo = vi.fn();

  const configService = {
    getOrThrow: vi.fn((clave: string) => {
      const configuracion: Record<string, number> = {
        MERCADO_PUBLICO_BATCH_LIMIT: 20,
        MERCADO_PUBLICO_DELAY_MS: 0,
      };

      return configuracion[clave];
    }),
  } as unknown as ConfigService;

  const mercadoPublicoService = {
    listarLicitacionesPorFecha,
    listarLicitacionesActivas,
  } as unknown as MercadoPublicoService;

  const licitacionesService = {
    sincronizarPorCodigo,
    indexarListadoActivo,
    seleccionarPendientesDetalle,
    indexarListadoFecha,
    obtenerFechasListadoSincronizadas,
    registrarSincronizacionListadoDia,
    seleccionarPendientesResultadoPeriodo,
    actualizarResultadoDesdeDatosGuardados,
    contarPendientesResultadoPeriodo,
  } as unknown as LicitacionesService;

  const servicio = new IngestaLicitacionesService(
    mercadoPublicoService,
    licitacionesService,
    configService,
    { conBloqueo: vi.fn(async (fn) => fn()) } as unknown as ControlConsultasService,
    { registrarPendientes: vi.fn().mockResolvedValue(undefined), seleccionar: seleccionarPendientesDetalle,
      registrarFallo: vi.fn().mockResolvedValue(undefined), obtenerNuevasParaNotificar: vi.fn().mockResolvedValue([]),
      obtenerCobertura: vi.fn().mockResolvedValue({ total: 3, conDetalle: 2, pendientes: 1 }) } as unknown as ColaDetallesService,
  );

  return {
    servicio,
    listarLicitacionesPorFecha,
    listarLicitacionesActivas,
    sincronizarPorCodigo,
    indexarListadoActivo,
    seleccionarPendientesDetalle,
    indexarListadoFecha,
    obtenerFechasListadoSincronizadas,
    registrarSincronizacionListadoDia,
    seleccionarPendientesResultadoPeriodo,
    actualizarResultadoDesdeDatosGuardados,
    contarPendientesResultadoPeriodo,
  };
}

function crearResumen(codigoExterno: string): Record<string, unknown> {
  return {
    CodigoExterno: codigoExterno,
    Nombre: `Licitación ${codigoExterno}`,
    CodigoEstado: 5,
  };
}

describe('IngestaLicitacionesService', () => {
  it('reanuda la carga mensual y aprovecha detalles guardados', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
    const {
      servicio,
      listarLicitacionesPorFecha,
      sincronizarPorCodigo,
      indexarListadoFecha,
      obtenerFechasListadoSincronizadas,
      registrarSincronizacionListadoDia,
      seleccionarPendientesResultadoPeriodo,
      actualizarResultadoDesdeDatosGuardados,
      contarPendientesResultadoPeriodo,
    } = crearPrueba();
    obtenerFechasListadoSincronizadas.mockResolvedValue(
      new Set(
        Array.from(
          { length: 15 },
          (_, indice) => `2026-10-${String(indice + 1).padStart(2, '0')}`,
        ),
      ),
    );
    listarLicitacionesPorFecha.mockResolvedValue({
      Cantidad: 1,
      FechaCreacion: '2026-10-16T12:00:00Z',
      Version: 'v1',
      Listado: [crearResumen('4000-1-LE26')],
    });
    indexarListadoFecha.mockResolvedValue({
      indexadas: 1,
      creadas: 1,
      actualizadas: 0,
    });
    seleccionarPendientesResultadoPeriodo.mockResolvedValue([
      { codigoExterno: '4000-1-LE26', requiereConsultaApi: false },
      { codigoExterno: '4000-2-LE26', requiereConsultaApi: true },
    ]);
    actualizarResultadoDesdeDatosGuardados.mockResolvedValue(true);
    sincronizarPorCodigo.mockResolvedValue({
      codigoExterno: '4000-2-LE26',
      creada: false,
      itemsGuardados: 3,
      clasificacionResultado: 'adjudicada',
      sincronizadoEn: new Date(),
    });
    contarPendientesResultadoPeriodo.mockResolvedValue(25);

    const resultado = await servicio.sincronizarMes(2026, 10, 250);

    expect(listarLicitacionesPorFecha).toHaveBeenCalledOnce();
    expect(registrarSincronizacionListadoDia).toHaveBeenCalledWith(
      '2026-10-16',
      1,
      1,
    );
    expect(actualizarResultadoDesdeDatosGuardados).toHaveBeenCalledWith(
      '4000-1-LE26',
    );
    expect(sincronizarPorCodigo).toHaveBeenCalledWith('4000-2-LE26');
    expect(resultado).toMatchObject({
      periodo: '2026-10',
      diasConsultados: 1,
      diasOmitidosPorCheckpoint: 15,
      resultadosDesdeBase: 1,
      detallesConsultadosApi: 1,
      resultadosCompletados: 2,
      pendientesSinResultado: 25,
      solicitudesApiAproximadas: 2,
    });
    vi.useRealTimers();
  });

  it('indexa todo el catálogo activo y completa sólo el lote pendiente', async () => {
    const {
      servicio,
      listarLicitacionesActivas,
      indexarListadoActivo,
      seleccionarPendientesDetalle,
      sincronizarPorCodigo,
    } = crearPrueba();
    const listado = [
      crearResumen('3000-1-LE26'),
      crearResumen('3000-2-LP26'),
      crearResumen('3000-3-B226'),
    ];

    listarLicitacionesActivas.mockResolvedValue({
      Cantidad: 3,
      FechaCreacion: '2026-10-13T15:15:36.327Z',
      Version: 'v1',
      Listado: listado,
    });
    indexarListadoActivo.mockResolvedValue({
      indexadas: 3,
      creadas: 3,
      actualizadas: 0,
      conCierreFuturo: 3,
      conCierreVencido: 0,
    });
    seleccionarPendientesDetalle.mockResolvedValue([
      '3000-1-LE26',
      '3000-2-LP26',
    ]);
    sincronizarPorCodigo.mockResolvedValue({
      codigoExterno: '3000-1-LE26',
      creada: false,
      itemsGuardados: 2,
      sincronizadoEn: new Date(),
    });

    const resultado = await servicio.sincronizarActivas(2);

    expect(indexarListadoActivo).toHaveBeenCalledWith(
      listado,
      new Date('2026-10-13T15:15:36.327Z'),
    );
    expect(seleccionarPendientesDetalle).toHaveBeenCalledWith(2);
    expect(sincronizarPorCodigo).toHaveBeenCalledTimes(2);
    expect(resultado.indexadas).toBe(3);
    expect(resultado.detallesProcesados).toBe(2);
    expect(resultado.detallesCompletados).toBe(2);
    expect(resultado.itemsGuardados).toBe(4);
    expect(resultado.codigosDetallesCompletados).toEqual([
      '3000-1-LE26',
      '3000-2-LP26',
    ]);
  });

  it('no desactiva registros locales si el catálogo activo llega incompleto', async () => {
    const { servicio, listarLicitacionesActivas, indexarListadoActivo } =
      crearPrueba();

    listarLicitacionesActivas.mockResolvedValue({
      Cantidad: 2,
      FechaCreacion: '2026-10-13T15:15:36.327Z',
      Version: 'v1',
      Listado: [crearResumen('3000-1-LE26')],
    });

    await expect(servicio.sincronizarActivas(0)).rejects.toThrow(
      'catálogo activo incompleto',
    );
    expect(indexarListadoActivo).not.toHaveBeenCalled();
  });

  it('elimina códigos duplicados y respeta el límite', async () => {
    const { servicio, listarLicitacionesPorFecha, sincronizarPorCodigo } =
      crearPrueba();

    listarLicitacionesPorFecha.mockResolvedValue({
      Cantidad: 4,
      FechaCreacion: '2026-09-10T12:00:00',
      Version: 'v1',
      Listado: [
        crearResumen('1000-1-L126'),
        crearResumen('1000-1-L126'),
        crearResumen('1000-2-L126'),
        crearResumen('1000-3-L126'),
      ],
    });

    sincronizarPorCodigo
      .mockResolvedValueOnce({
        codigoExterno: '1000-1-L126',
        creada: true,
        itemsGuardados: 2,
        sincronizadoEn: new Date(),
      })
      .mockResolvedValueOnce({
        codigoExterno: '1000-2-L126',
        creada: false,
        itemsGuardados: 1,
        sincronizadoEn: new Date(),
      });

    const resultado = await servicio.sincronizarFecha(
      new Date('2026-09-10T12:00:00Z'),
      2,
    );

    expect(resultado.informadasPorApi).toBe(4);
    expect(resultado.codigosUnicosEncontrados).toBe(3);
    expect(resultado.procesadas).toBe(2);
    expect(resultado.creadas).toBe(1);
    expect(resultado.actualizadas).toBe(1);
    expect(resultado.fallidas).toBe(0);
    expect(resultado.itemsGuardados).toBe(3);

    expect(sincronizarPorCodigo).toHaveBeenNthCalledWith(1, '1000-1-L126');
    expect(sincronizarPorCodigo).toHaveBeenNthCalledWith(2, '1000-2-L126');
  });

  it('continúa procesando cuando una licitación falla', async () => {
    const { servicio, listarLicitacionesPorFecha, sincronizarPorCodigo } =
      crearPrueba();

    listarLicitacionesPorFecha.mockResolvedValue({
      Cantidad: 2,
      FechaCreacion: '2026-09-10T12:00:00',
      Version: 'v1',
      Listado: [crearResumen('2000-1-L126'), crearResumen('2000-2-L126')],
    });

    sincronizarPorCodigo
      .mockResolvedValueOnce({
        codigoExterno: '2000-1-L126',
        creada: true,
        itemsGuardados: 4,
        sincronizadoEn: new Date(),
      })
      .mockRejectedValueOnce(new Error('Falla simulada'));

    const resultado = await servicio.sincronizarFecha(
      new Date('2026-09-10T12:00:00Z'),
      2,
    );

    expect(resultado.procesadas).toBe(2);
    expect(resultado.creadas).toBe(1);
    expect(resultado.fallidas).toBe(1);
    expect(resultado.itemsGuardados).toBe(4);
    expect(resultado.errores).toEqual([
      {
        codigoExterno: '2000-2-L126',
        mensaje: 'Falla simulada',
      },
    ]);
  });
});
