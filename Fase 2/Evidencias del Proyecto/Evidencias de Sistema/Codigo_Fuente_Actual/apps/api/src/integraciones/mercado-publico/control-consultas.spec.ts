import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsultasMercadoPausadas, ControlConsultasService } from './control-consultas.service';
import { MercadoPublicoService } from './mercado-publico.service';

function preparar(habilitada = true, limite = 2) {
  const rows: string[] = [], consultas: string[] = [];
  let cola = Promise.resolve();
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push(sql);
    if (sql.includes('COUNT(*)')) return [{ usadas: rows.length }];
    if (sql.startsWith('INSERT')) rows.push(String(params?.[0]));
    return [];
  });
  const qr = { connect: vi.fn(), release: vi.fn(), query: vi.fn(async (sql: string) => {
    consultas.push(sql); return [{ obtenido: true }];
  }) };
  const ds = { query, createQueryRunner: () => qr,
    transaction: vi.fn((fn) => { const p = cola.then(() => fn({ query })); cola = p.catch(() => undefined); return p; }) };
  const valores = { MERCADO_PUBLICO_CONSULTAS_HABILITADAS: habilitada,
    MERCADO_PUBLICO_MAX_SOLICITUDES_24H: limite, MERCADO_PUBLICO_TICKET: 'ticket-sintetico-no-real',
    MERCADO_PUBLICO_API_URL: 'https://api.mercadopublico.cl/servicios/v1/publico', MERCADO_PUBLICO_TIMEOUT_MS: 5000,
    MERCADO_PUBLICO_MAX_RETRIES: 1, MERCADO_PUBLICO_RETRY_BASE_DELAY_MS: 0 };
  const config = { getOrThrow: (key: string) => valores[key as keyof typeof valores] } as ConfigService;
  const control = new ControlConsultasService(ds as unknown as DataSource, config);
  return { control, ds, qr, rows, consultas, config };
}

describe('Consumo controlado, sin HTTP real ni PostgreSQL real', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('deshabilitada no reserva cuota, abre bloqueo ni envia HTTP', async () => {
    const p = preparar(false); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas()).rejects.toMatchObject({ motivo: 'deshabilitado' });
    await expect(p.control.conBloqueo(async () => 1)).rejects.toMatchObject({ motivo: 'deshabilitado' });
    expect(p.ds.transaction).not.toHaveBeenCalled(); expect(p.qr.connect).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('reserva antes de enviar y nunca almacena el ticket en claro', async () => {
    const p = preparar();
    await p.control.reservarSolicitud();
    expect(p.rows).toHaveLength(1); expect(p.rows[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(p.rows[0]).not.toContain('ticket-sintetico');
    expect(p.consultas[0]).toContain('pg_advisory_xact_lock');
    expect(p.consultas[1]).toContain("INTERVAL '24 hours'"); expect(p.consultas[2]).toContain('INSERT');
  });
  it('impide nuevas solicitudes al agotarse el presupuesto incluso con llamadas concurrentes', async () => {
    const p = preparar(true, 2);
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => p.control.reservarSolicitud()));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(2); expect(p.rows).toHaveLength(2);
    expect(p.consultas.filter((x) => x.includes('pg_advisory_xact_lock'))).toHaveLength(5);
    // La serializacion del adaptador modela el bloqueo transaccional PostgreSQL;
    // no se presenta como una prueba de concurrencia contra el motor real.
  });
  it('el presupuesto no puede producir disponibilidad negativa', async () => {
    const p = preparar(true, 1); p.rows.push('A', 'B');
    expect(await p.control.consultarPresupuesto()).toEqual({ limite: 1, utilizadas: 2, disponibles: 0 });
  });
  it('cada reintento HTTP 429 tambien consume una reserva', async () => {
    const p = preparar(true, 4); const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ Cantidad: 0, FechaCreacion: '2026-11-18T12:00:00Z', Version: 'v1', Listado: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas();
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(p.rows).toHaveLength(2);
  });
  it('no envia el segundo intento si la primera solicitud agoto el presupuesto', async () => {
    const p = preparar(true, 1); const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '0' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas()).rejects.toMatchObject({ motivo: 'presupuesto' });
    expect(fetchMock).toHaveBeenCalledOnce(); expect(p.rows).toHaveLength(1);
  });
  it('429 persistente pausa la extraccion en lugar de seguir con todos los codigos', async () => {
    const p = preparar(true, 5); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '0' } })));
    await expect(new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas()).rejects.toMatchObject({ motivo: 'limitacion_remota' });
    expect(p.rows).toHaveLength(2);
  });
  it('un error de red no devuelve una reserva ya consumida', async () => {
    const p = preparar(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red-no-disponible')));
    await expect(new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas()).rejects.toThrow();
    expect(p.rows).toHaveLength(1);
  });
  it('un fallo del contador detiene la solicitud antes de acceder a la API', async () => {
    const p = preparar(); p.ds.transaction.mockRejectedValue(new Error('contador no disponible'));
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoPublicoService(p.config, p.control).listarLicitacionesActivas()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('libera el bloqueo y la conexion si el trabajo termina con error', async () => {
    const p = preparar(); await expect(p.control.conBloqueo(async () => { throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect(p.qr.query.mock.calls.at(-1)?.[0]).toContain('pg_advisory_unlock'); expect(p.qr.release).toHaveBeenCalledOnce();
  });
  it('un proceso ocupado no ejecuta otro trabajo ni libera el bloqueo de otro proceso', async () => {
    const p = preparar(); p.qr.query.mockResolvedValue([{ obtenido: false }]); const fn = vi.fn();
    await expect(p.control.conBloqueo(fn)).rejects.toBeInstanceOf(ConsultasMercadoPausadas);
    expect(fn).not.toHaveBeenCalled(); expect(p.qr.query).toHaveBeenCalledOnce(); expect(p.qr.release).toHaveBeenCalledOnce();
  });
});
