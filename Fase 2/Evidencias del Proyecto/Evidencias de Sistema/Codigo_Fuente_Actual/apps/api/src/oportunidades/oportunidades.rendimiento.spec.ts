import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Licitacion } from '../licitaciones/entities/licitacion.entity';
import type { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { consultarOportunidadesSchema } from './dto/consultar-oportunidades.dto';
import { OportunidadesService } from './oportunidades.service';

describe('Rendimiento de oportunidades sin cambiar los resultados', () => {
  const perfil = { id: 'PERFIL', empresaId: 'EMPRESA', activo: true, palabrasClave: ['software'], etiquetasCapacidades: [], codigosCategoria: [], regiones: [], montoMinimo: null, montoMaximo: null, incluirSinMonto: true, tiposOportunidad: [] };
  let s: OportunidadesService, obtenerPerfil: ReturnType<typeof vi.fn>, getMany: ReturnType<typeof vi.fn>, getRawMany: ReturnType<typeof vi.fn>;
  let version: string, condiciones: Array<[string, Record<string, unknown> | undefined]>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2080-01-01T12:00:00Z'));
    version = 'v1'; condiciones = [];
    obtenerPerfil = vi.fn(async () => ({ ...perfil, palabrasClave: [...perfil.palabrasClave] }));
    getMany = vi.fn(async () => [{ id: 'L1', codigoExterno: '1-1-LE99', nombre: 'Desarrollo de software', descripcion: null, items: [], montoEstimado: null,
      fechaPublicacion: new Date('2080-01-01T11:00:00Z'), fechaCierre: new Date('2080-01-02T12:00:00Z'), sincronizadoEn: new Date('2080-01-01T12:00:00Z') }]);
    getRawMany = vi.fn(async () => [{ id: 'L1' }]);
    const q: Record<string, unknown> = {};
    for (const n of ['select', 'addSelect', 'where', 'leftJoin', 'leftJoinAndSelect', 'innerJoin', 'distinct', 'orderBy', 'addOrderBy', 'offset', 'limit']) q[n] = () => q;
    q.andWhere = (cond: string, param: Record<string, unknown>) => { if (typeof cond === 'string') condiciones.push([cond, param]); return q; };
    q.clone = () => q; q.getMany = getMany; q.getRawMany = getRawMany; q.getCount = async () => 1;
    s = new OportunidadesService({ createQueryBuilder: () => q, query: async () => [{ revision: version, proximo: '2080-01-01T12:00:10Z' }] } as unknown as Repository<Licitacion>,
      { obtener: obtenerPerfil } as unknown as PerfilesEmpresaService, {} as PlanesEmpresaService);
  });
  afterEach(() => vi.useRealTimers());
  const rec = () => consultarOportunidadesSchema.parse({ alcance: 'recomendadas', puntajeMinimo: 1, incluirFiltros: 'false' });
  it('reutiliza matching pero vuelve a revisar perfil en cada solicitud', async () => {
    const a = await s.listar('EMPRESA', rec()), b = await s.listar('EMPRESA', rec());
    expect(a.datos).toEqual(b.datos); expect(a.datos).toHaveLength(1);
    expect(getMany).toHaveBeenCalledTimes(1); expect(obtenerPerfil).toHaveBeenCalledTimes(2);
  });
  it('cambio de catalogo invalida el calculo anterior', async () => {
    await s.listar('EMPRESA', rec()); version = 'v2'; await s.listar('EMPRESA', rec());
    expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('un perfil cambiado no reutiliza puntajes anteriores', async () => {
    await s.listar('EMPRESA', rec()); obtenerPerfil.mockResolvedValueOnce({ ...perfil, palabrasClave: ['alimentos'] });
    expect((await s.listar('EMPRESA', rec())).datos).toHaveLength(0); expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('otra empresa no recibe el calculo cacheado de la primera', async () => {
    await s.listar('EMPRESA', rec()); await s.listar('OTRA', rec()); expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('deja de usar el calculo cuando llega un cierre aunque no cambie la BD', async () => {
    await s.listar('EMPRESA', rec()); vi.setSystemTime(new Date('2080-01-01T12:00:10.001Z'));
    await s.listar('EMPRESA', rec()); expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('un perfil inactivo no obtiene respuestas cacheadas', async () => {
    await s.listar('EMPRESA', rec()); obtenerPerfil.mockResolvedValueOnce({ ...perfil, activo: false });
    await expect(s.listar('EMPRESA', rec())).rejects.toThrow('inactivo'); expect(getMany).toHaveBeenCalledTimes(1);
  });
  it('la busqueda general no espera las listas de filtros', async () => {
    const r = await s.listar('EMPRESA', consultarOportunidadesSchema.parse({ alcance: 'todas', orden: 'fecha_desc', incluirFiltros: 'false' }));
    expect(r.paginacion.total).toBe(1); expect(r.datos).toHaveLength(1);
    expect(getRawMany).toHaveBeenCalledTimes(1); expect(r.filtrosDisponibles).toEqual({ regiones: [], organismos: [], categorias: [] });
  });
  for (const [h, d, hasta] of [['48h', 0, 2], ['2a7', 2, 7], ['7a30', 7, 30], ['30mas', 30, null], ['7mas', 7, null]] as const) {
    it(`enlace ${h}: intervalo preciso y sin superponer limites`, async () => {
      await s.listar('EMPRESA', consultarOportunidadesSchema.parse({ alcance: 'todas', orden: 'fecha_desc', incluirFiltros: 'false', horizonteCierre: h }));
      expect(condiciones.find(([c]) => c.includes('>= :cierreDesde'))?.[1]?.cierreDesde).toEqual(new Date(Date.now() + d * 86_400_000));
      const fin = condiciones.find(([c]) => c.includes('< :cierreHasta'));
      if (hasta !== null) expect(fin?.[1]?.cierreHasta).toEqual(new Date(Date.now() + hasta * 86_400_000)); else expect(fin).toBeUndefined();
    });
  }
  it('rechaza un horizonte arbitrario y mantiene opcion de filtros de clientes anteriores', () => {
    expect(() => consultarOportunidadesSchema.parse({ horizonteCierre: 'infinito' })).toThrow();
    expect(consultarOportunidadesSchema.parse({}).incluirFiltros).toBeUndefined();
  });
  it('el enlace territorial conserva alias de O Higgins y Libertador usados por el mapa', async () => {
    await s.listar('EMPRESA', consultarOportunidadesSchema.parse({ alcance: 'todas', orden: 'fecha_desc', incluirFiltros: 'false', region: "O'Higgins" }));
    expect(condiciones.find(([c]) => c.includes('~ :patronRegion'))?.[1]?.patronRegion).toBe('higgins|libertador');
  });
  it('el enlace de Los Rios usa el mismo patron sin acentos del resumen', async () => {
    await s.listar('EMPRESA', consultarOportunidadesSchema.parse({ alcance: 'todas', orden: 'fecha_desc', incluirFiltros: 'false', region: 'Los Ríos' }));
    expect(condiciones.find(([c]) => c.includes('~ :patronRegion'))?.[1]?.patronRegion).toBe('los rios');
  });
});
