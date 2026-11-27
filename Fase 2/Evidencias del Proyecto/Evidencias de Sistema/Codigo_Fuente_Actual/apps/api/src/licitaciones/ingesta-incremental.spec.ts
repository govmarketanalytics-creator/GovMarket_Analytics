import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { ConsultasMercadoPausadas, type ControlConsultasService } from '../integraciones/mercado-publico/control-consultas.service';
import type { MercadoPublicoService } from '../integraciones/mercado-publico/mercado-publico.service';
import { ColaDetallesService, REGISTRAR_PENDIENTES_SQL } from './cola-detalles.service';
import { IngestaLicitacionesService } from './ingesta-licitaciones.service';
import { LicitacionesService } from './licitaciones.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

function preparar(codigos = ['1-1-LE26', '2-2-LE26']) {
  const mercado = { listarLicitacionesActivas: vi.fn().mockResolvedValue({ Cantidad: 0, FechaCreacion: '2026-11-18T12:00:00Z', Listado: [] }) };
  const licitaciones = { indexarListadoActivo: vi.fn().mockResolvedValue({ indexadas: 2, creadas: 0, actualizadas: 0,
    conCierreFuturo: 2, conCierreVencido: 0, codigosNuevos: [] }), sincronizarPorCodigo: vi.fn().mockResolvedValue({ itemsGuardados: 2 }) };
  const cola = { registrarPendientes: vi.fn(), seleccionar: vi.fn().mockResolvedValue(codigos), registrarFallo: vi.fn(),
    obtenerCobertura: vi.fn().mockResolvedValue({ total: 5000, conDetalle: 23, pendientes: 4977 }),
    obtenerNuevasParaNotificar: vi.fn().mockResolvedValue([]), confirmarNotificaciones: vi.fn() };
  const control = { conBloqueo: vi.fn(async (fn) => fn()) };
  const config = { getOrThrow: (k: string) => k === 'MERCADO_PUBLICO_DELAY_MS' ? 0 : 100 } as ConfigService;
  const servicio = new IngestaLicitacionesService(mercado as unknown as MercadoPublicoService,
    licitaciones as unknown as LicitacionesService, config, control as unknown as ControlConsultasService, cola as unknown as ColaDetallesService);
  return { servicio, mercado, licitaciones, cola, control };
}

describe('Extraccion incremental: nuevo y pendiente, no recarga de fichas completas', () => {
  it('completar fondo antiguo no lo notifica como una publicacion nueva', async () => {
    const p = preparar(); const r = await p.servicio.sincronizarActivas(100);
    expect(r.codigosDetallesCompletados).toHaveLength(2); expect(r.codigosNuevosParaNotificar).toEqual([]);
    expect(p.cola.registrarPendientes).toHaveBeenCalledWith([]); expect(r.cobertura.total).toBe(5000);
  });
  it('las novedades conservan una salida pendiente de notificar hasta ser confirmada', async () => {
    const p = preparar(); p.licitaciones.indexarListadoActivo.mockResolvedValue({ indexadas: 2, creadas: 1, actualizadas: 0,
      conCierreFuturo: 2, conCierreVencido: 0, codigosNuevos: ['1-1-LE26'] });
    p.cola.obtenerNuevasParaNotificar.mockResolvedValue(['1-1-LE26']);
    const r = await p.servicio.sincronizarActivas(2);
    expect(p.cola.registrarPendientes).toHaveBeenCalledWith(['1-1-LE26']);
    expect(r.codigosNuevosParaNotificar).toEqual(['1-1-LE26']);
    expect(p.cola.confirmarNotificaciones).not.toHaveBeenCalled();
    await p.servicio.confirmarNotificacionesNuevas(r.codigosNuevosParaNotificar);
    expect(p.cola.confirmarNotificaciones).toHaveBeenCalledWith(['1-1-LE26']);
  });
  it('si no hay pendientes solo consulta el listado, sin solicitudes por codigo', async () => {
    const p = preparar([]); const r = await p.servicio.sincronizarActivas(100);
    expect(p.mercado.listarLicitacionesActivas).toHaveBeenCalledOnce();
    expect(p.licitaciones.sincronizarPorCodigo).not.toHaveBeenCalled(); expect(r.detallesProcesados).toBe(0);
  });
  it('la cuota agotada pausa el lote sin etiquetar el resto como fallido', async () => {
    const p = preparar(); p.licitaciones.sincronizarPorCodigo.mockRejectedValue(new ConsultasMercadoPausadas('presupuesto'));
    const r = await p.servicio.sincronizarActivas(100);
    expect(r.pausa).toBe('presupuesto'); expect(p.licitaciones.sincronizarPorCodigo).toHaveBeenCalledOnce();
    expect(p.cola.registrarFallo).not.toHaveBeenCalled(); expect(r.detallesFallidos).toBe(0);
  });
  it('tres fallos consecutivos tambien pausan despues de haber tenido exito', async () => {
    const p = preparar(['A', 'B', 'C', 'D', 'E']);
    p.licitaciones.sincronizarPorCodigo.mockReset().mockResolvedValueOnce({ itemsGuardados: 1 }).mockRejectedValue(new Error('fallo seguro'));
    const r = await p.servicio.sincronizarActivas(5);
    expect(r.pausa).toBe('fallos_consecutivos'); expect(p.licitaciones.sincronizarPorCodigo).toHaveBeenCalledTimes(4);
    expect(p.cola.registrarFallo).toHaveBeenCalledTimes(3);
  });
  it('un listado truncado no cambia catalogo ni cola', async () => {
    const p = preparar(); p.mercado.listarLicitacionesActivas.mockResolvedValue({ Cantidad: 5, FechaCreacion: '', Listado: [] });
    await expect(p.servicio.sincronizarActivas(100)).rejects.toThrow('incompleto');
    expect(p.licitaciones.indexarListadoActivo).not.toHaveBeenCalled(); expect(p.cola.registrarPendientes).not.toHaveBeenCalled();
  });
  it('rechaza un resumen o un codigo ajeno antes de abrir una transaccion de detalle', async () => {
    const transaction = vi.fn(); const cliente = { obtenerLicitacionPorCodigo: vi.fn().mockResolvedValue({ Cantidad: 1,
      Listado: [{ CodigoExterno: '1-1-LE26', Nombre: 'Resumen', CodigoEstado: 5 }] }) };
    const s = new LicitacionesService({ transaction } as unknown as DataSource, cliente as unknown as MercadoPublicoService);
    await expect(s.sincronizarPorCodigo('1-1-LE26')).rejects.toThrow('ficha detallada');
    cliente.obtenerLicitacionPorCodigo.mockResolvedValue({ Cantidad: 1, Listado: [{ CodigoExterno: 'OTRO', Comprador: {}, Fechas: {}, Items: {} }] } as never);
    await expect(s.sincronizarPorCodigo('1-1-LE26')).rejects.toThrow('código solicitado'); expect(transaction).not.toHaveBeenCalled();
  });
});

describe('Cola persistente de pendientes', () => {
  it('registra ausentes sin duplicar tareas ni incluir pruebas, vencidas o fichas completas', async () => {
    const query = vi.fn().mockResolvedValue([]); const c = new ColaDetallesService({ query } as unknown as DataSource);
    await c.registrarPendientes(['1-1-LE26']);
    expect(query).toHaveBeenCalledWith(REGISTRAR_PENDIENTES_SQL, [['1-1-LE26']]);
    for (const texto of ['ON CONFLICT', 'detalle_sincronizado_en IS NULL', "->> 'esPrueba'", 'fecha_cierre >= now()']) expect(REGISTRAR_PENDIENTES_SQL).toContain(texto);
  });
  it('selecciona con turno entre novedades y fondo, y respeta el proximo reintento', async () => {
    const query = vi.fn().mockResolvedValue([{ codigo: '1-1-LE26' }]); const c = new ColaDetallesService({ query } as unknown as DataSource);
    expect(await c.seleccionar(100)).toEqual(['1-1-LE26']);
    const sql = query.mock.calls[0][0]; expect(sql).toContain('PARTITION BY c.notificar_al_completar');
    expect(sql).toContain('c.proximo_intento_en <= now()'); expect(sql).toContain('l.detalle_sincronizado_en IS NULL');
    expect(sql).not.toContain('ORDER BY l.fecha_cierre');
  });
  it('la cola vacia de limite no genera SQL', async () => {
    const query = vi.fn(); const c = new ColaDetallesService({ query } as unknown as DataSource);
    expect(await c.seleccionar(0)).toEqual([]); expect(query).not.toHaveBeenCalled();
  });
  it('los errores tienen espera persistente y no guardan excepciones con credenciales', async () => {
    const query = vi.fn(); const c = new ColaDetallesService({ query } as unknown as DataSource);
    await c.registrarFallo('1-1-LE26'); expect(query.mock.calls[0][0]).toContain('LEAST(360');
    expect(query.mock.calls[0][0]).toContain("'DETALLE_NO_COMPLETADO'");
    expect(query.mock.calls[0][1]).toEqual(['1-1-LE26']);
  });
  it('no confirma notificaciones si no hay codigos', async () => {
    const query = vi.fn(); const c = new ColaDetallesService({ query } as unknown as DataSource);
    await c.confirmarNotificaciones([]); expect(query).not.toHaveBeenCalled();
  });
});

describe('Arquitectura de lectura desde la base', () => {
  for (const archivo of ['oportunidades/oportunidades.service.ts', 'favoritos/favoritos.service.ts',
    'licitaciones/consulta-licitaciones/consulta-licitaciones.service.ts', 'analisis-mercado/analisis-mercado.service.ts', 'notificaciones/notificaciones.service.ts']) {
    it(`${archivo} no llama al cliente de Mercado Publico ni hace fetch`, () => {
      const s = readFileSync(join(__dirname, '..', archivo), 'utf8');
      expect(s).not.toContain('MercadoPublicoService'); expect(s).not.toMatch(/\bfetch\s*\(/);
    });
  }
});

describe('Indexacion diferencial del listado', () => {
  it('una ficha sin cambios conserva su detalle y no vuelve a guardarse como contenido', async () => {
    const fecha = new Date('2099-01-20T12:00:00Z');
    const existente = { id: 'ID', codigoExterno: '1-1-LE99', nombre: 'Oferta', codigoEstado: 5,
      estado: 'Publicada', tipo: 'LE', fechaCierre: fecha, activaEnListado: true,
      detalleSincronizadoEn: fecha, descripcion: 'Conservar detalle', datosOrigen: { Comprador: { NombreOrganismo: 'Original' } } };
    const qb = { update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(), execute: vi.fn() };
    const repo = { count: vi.fn().mockResolvedValue(1), createQueryBuilder: () => qb,
      findBy: vi.fn().mockResolvedValue([existente]), merge: vi.fn(), create: vi.fn(), save: vi.fn(), update: vi.fn() };
    const query = vi.fn(); const ds = { transaction: async (fn) => fn({ getRepository: () => repo, query }) };
    const servicio = new LicitacionesService(ds as unknown as DataSource, {} as MercadoPublicoService);
    const r = await servicio.indexarListadoActivo([{ CodigoExterno: '1-1-LE99', Nombre: 'Oferta', CodigoEstado: 5, FechaCierre: fecha.toISOString() }], fecha);
    expect(r.creadas).toBe(0); expect(r.actualizadas).toBe(0); expect(r.codigosNuevos).toEqual([]);
    expect(repo.merge).not.toHaveBeenCalled(); expect(repo.save).toHaveBeenCalledWith([], { chunk: 100 });
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), { vistoActivoEn: fecha });
    expect(existente.descripcion).toBe('Conservar detalle'); expect(existente.datosOrigen.Comprador.NombreOrganismo).toBe('Original');
    expect(qb.andWhere.mock.calls[0][0]).toContain('NOT (codigo_externo = ANY');
    expect(query).toHaveBeenCalledWith(REGISTRAR_PENDIENTES_SQL, [[]]);
  });
  it('la configuracion conserva consultas y automatizacion apagadas por defecto', async () => {
    const s = readFileSync(join(__dirname, '../config/environment.schema.ts'), 'utf8');
    expect(s).toContain('MERCADO_PUBLICO_CONSULTAS_HABILITADAS');
    expect(s).toContain(".default('false').transform");
    const cron = readFileSync(join(__dirname, '../automatizacion/automatizacion.service.ts'), 'utf8');
    expect(cron).toContain("@Cron('0 */30 * * * *'"); expect(cron).toContain('waitForCompletion: true');
  });
});

describe('Buzon: una coincidencia solo regional no se anuncia como afinidad comercial', () => {
  for (const palabras of [[], ['software']]) it(`palabras coincidentes: ${palabras.length}`, async () => {
    const s = new NotificacionesService({} as never, { find: vi.fn().mockResolvedValue([{ empresaId: 'QA', puntajeMinimoAlerta: 60 }]) } as never,
      {} as never, {} as never, { evaluarLicitacionParaEmpresa: vi.fn().mockResolvedValue({ id: 'LIC', porcentajeCompatibilidad: 100,
        coincidencias: { palabrasClave: palabras, codigosCategoria: [], region: true } }) } as never);
    const crear = vi.spyOn(s as unknown as { crearParaEmpresa: (e: unknown) => Promise<{ creada: boolean }> }, 'crearParaEmpresa').mockResolvedValue({ creada: true });
    const r = await s.generarParaCodigosNuevos(['1-1-LE26']);
    expect(r.creadas).toBe(palabras.length ? 1 : 0); expect(crear).toHaveBeenCalledTimes(palabras.length ? 1 : 0);
  });
});
