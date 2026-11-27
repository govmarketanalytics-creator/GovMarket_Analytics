import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheConsultas, MedicionOportunidades } from './cache-consultas';
describe('Cache de consultas acotada, sin permisos', () => {
  afterEach(() => vi.useRealTimers());
  it('une solicitudes simultaneas identicas', async () => {
    const c = new CacheConsultas<number>(), f = vi.fn(async () => 3);
    expect(await Promise.all([c.obtener('A', Date.now() + 1000, f), c.obtener('A', Date.now() + 1000, f)])).toEqual([3, 3]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('no mezcla empresa, version o perfil en claves diferentes', async () => {
    const c = new CacheConsultas<number>();
    for (const k of ['empresa1:perfilA:version1', 'empresa2:perfilA:version1', 'empresa1:perfilB:version1', 'empresa1:perfilA:version2']) {
      expect(await c.obtener(k, Date.now() + 1000, async () => k.length)).toBe(k.length);
    }
  });
  it('vence exactamente al siguiente cierre y no sirve un cache caducado', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    const c = new CacheConsultas<number>(), f = vi.fn(async () => 1);
    await c.obtener('A', 1010, f); await c.obtener('A', 1010, f);
    vi.setSystemTime(1010); await c.obtener('A', 1020, f);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('no guarda errores ni bloquea el reintento', async () => {
    const c = new CacheConsultas<number>();
    await expect(c.obtener('A', Date.now() + 1000, async () => { throw Error('fallo'); })).rejects.toThrow('fallo');
    expect(await c.obtener('A', Date.now() + 1000, async () => 7)).toBe(7);
  });
  it('evicta entradas antiguas cuando excede el maximo', async () => {
    const c = new CacheConsultas<number>(1), f = vi.fn(async () => 1);
    await c.obtener('A', Date.now() + 1000, f); await c.obtener('B', Date.now() + 1000, f); await c.obtener('A', Date.now() + 1000, f);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('un resultado grande se devuelve completo sin almacenarlo ni cortarlo', async () => {
    const c = new CacheConsultas<number[]>(2, 3), f = vi.fn(async () => [1, 2, 3, 4]);
    expect(await c.obtener('A', Date.now() + 1000, f, (v) => v.length)).toHaveLength(4);
    await c.obtener('A', Date.now() + 1000, f, (v) => v.length);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('expone solo nombres de fases y duraciones, no datos de la empresa', async () => {
    const m = new MedicionOportunidades(); await m.medir('matching', async () => 1);
    expect(m.cabecera()).toMatch(/^matching;dur=\d+\.\d$/);
  });
});
