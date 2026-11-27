import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlertasService } from '../alertas/alertas.service';
import type { IngestaLicitacionesService } from '../licitaciones/ingesta-licitaciones.service';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { AutomatizacionService } from './automatizacion.service';

function crearServicio(habilitada: boolean) {
  const configService = {
    getOrThrow: vi.fn((clave: string) => {
      if (clave === 'AUTOMATIZACION_HABILITADA') {
        return habilitada;
      }

      if (clave === 'AUTOMATIZACION_LIMITE_POR_CICLO') {
        return 5;
      }

      throw new Error(`Configuración inesperada: ${clave}`);
    }),
  };

  const ingesta = {
    confirmarNotificacionesNuevas: vi.fn().mockResolvedValue(undefined),
    sincronizarActivas: vi.fn().mockResolvedValue({
      consultadoEn: '2026-09-21T12:00:00.000Z',
      informadasPorApi: 2,
      indexadas: 2,
      creadasEnCatalogo: 2,
      actualizadasEnCatalogo: 0,
      conCierreFuturo: 2,
      conCierreVencido: 0,
      limiteDetalles: 20,
      detallesProcesados: 2,
      detallesCompletados: 2,
      detallesFallidos: 0,
      itemsGuardados: 3,
      codigosDetallesCompletados: ['3000-1-LE26', '3000-2-LP26'],
      codigosNuevosParaNotificar: ['3000-1-LE26', '3000-2-LP26'],
      errores: [],
    }),
  };

  const alertas = {
    generar: vi.fn().mockResolvedValue({ creadas: 1 }),
  };

  const notificaciones = {
    generarParaCodigosNuevos: vi
      .fn()
      .mockResolvedValue({ procesadas: 4, creadas: 2 }),
  };

  const perfiles = {
    find: vi
      .fn()
      .mockResolvedValue([
        { empresaId: 'empresa-a' },
        { empresaId: 'empresa-b' },
      ]),
  };

  const planes = {
    listarEmpresasPremiumVigentes: vi
      .fn()
      .mockResolvedValue(['empresa-a', 'empresa-b']),
  };

  const servicio = new AutomatizacionService(
    configService as unknown as ConfigService,
    ingesta as unknown as IngestaLicitacionesService,
    alertas as unknown as AlertasService,
    notificaciones as unknown as NotificacionesService,
    perfiles as unknown as Repository<PerfilEmpresa>,
    planes as unknown as PlanesEmpresaService,
  );

  return { servicio, ingesta, alertas, notificaciones, perfiles, planes };
}

describe('AutomatizacionService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no consulta Mercado Público cuando está deshabilitada', async () => {
    const { servicio, ingesta, alertas, perfiles } = crearServicio(false);

    await servicio.sincronizarYGenerarAlertas();

    expect(ingesta.sincronizarActivas).not.toHaveBeenCalled();
    expect(perfiles.find).not.toHaveBeenCalled();
    expect(alertas.generar).not.toHaveBeenCalled();
  });

  it('sincroniza con el límite configurado y genera alertas por empresa', async () => {
    const { servicio, ingesta, alertas, notificaciones, perfiles } =
      crearServicio(true);

    await servicio.sincronizarYGenerarAlertas();

    expect(ingesta.sincronizarActivas).toHaveBeenCalledWith(5);
    expect(notificaciones.generarParaCodigosNuevos).toHaveBeenCalledWith([
      '3000-1-LE26',
      '3000-2-LP26',
    ]);
    expect(perfiles.find).toHaveBeenCalledWith({
      select: { empresaId: true },
      where: { activo: true },
    });
    expect(alertas.generar).toHaveBeenNthCalledWith(1, 'empresa-a');
    expect(alertas.generar).toHaveBeenNthCalledWith(2, 'empresa-b');
  });

  it('continúa con las demás empresas si una falla', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { servicio, alertas } = crearServicio(true);
    alertas.generar.mockRejectedValueOnce(new Error('Error de prueba'));

    await servicio.sincronizarYGenerarAlertas();

    expect(alertas.generar).toHaveBeenCalledTimes(2);
    expect(alertas.generar).toHaveBeenNthCalledWith(2, 'empresa-b');
  });

  it('omite la generación de alertas para empresas con plan gratuito', async () => {
    const { servicio, alertas, planes } = crearServicio(true);
    planes.listarEmpresasPremiumVigentes.mockResolvedValue(['empresa-a']);

    await servicio.sincronizarYGenerarAlertas();

    expect(alertas.generar).toHaveBeenCalledTimes(1);
    expect(alertas.generar).toHaveBeenCalledWith('empresa-a');
  });

  it('no genera alertas si falla la ingesta inicial', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { servicio, ingesta, alertas, perfiles } = crearServicio(true);
    ingesta.sincronizarActivas.mockRejectedValueOnce(
      new Error('Error de prueba'),
    );

    await servicio.sincronizarYGenerarAlertas();

    expect(perfiles.find).not.toHaveBeenCalled();
    expect(alertas.generar).not.toHaveBeenCalled();
  });

  it('un error de notificacion conserva la salida pendiente para el siguiente ciclo', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const p = crearServicio(true); p.notificaciones.generarParaCodigosNuevos.mockRejectedValue(new Error('fallo controlado'));
    await p.servicio.sincronizarYGenerarAlertas();
    expect(p.ingesta.confirmarNotificacionesNuevas).not.toHaveBeenCalled();
    expect(p.alertas.generar).toHaveBeenCalled();
  });

  it('confirma la salida solo despues de generar las notificaciones', async () => {
    const p = crearServicio(true); await p.servicio.sincronizarYGenerarAlertas();
    expect(p.ingesta.confirmarNotificacionesNuevas).toHaveBeenCalledWith(['3000-1-LE26', '3000-2-LP26']);
    expect(p.notificaciones.generarParaCodigosNuevos.mock.invocationCallOrder[0]).toBeLessThan(p.ingesta.confirmarNotificacionesNuevas.mock.invocationCallOrder[0]);
  });
});
