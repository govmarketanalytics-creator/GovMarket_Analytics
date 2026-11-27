import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Licitacion } from '../licitaciones/entities/licitacion.entity';
import type { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { FavoritosService } from '../favoritos/favoritos.service';
import type { LicitacionFavorita } from '../favoritos/entities/licitacion-favorita.entity';
import { agruparOrganismosDashboard } from './montos-dashboard';
import { OportunidadesService } from './oportunidades.service';
import { mapearResumenVerificado, RESUMEN_DASHBOARD_SQL, type ResumenDashboardRaw } from './resumen-dashboard-verificado';

const vacio = (): ResumenDashboardRaw => ({
  generadoEn: new Date('2026-11-17T23:00:00Z'), catalogoConsultadoEn: null, ultimoDetalleEn: null,
  oportunidadesActivas: 0, conDetalle: 0, oportunidadesConMonto: 0, oportunidadesSinMonto: 0,
  nuevasSemana: 0, cierran48Horas: 0, cierranSemana: 0, baseCompradores: 0, organismosCompradores: 0,
  baseRegiones: 0, baseCategorias: 0, cierran2a7Dias: 0, cierran7a30Dias: 0, cierran30DiasMas: 0,
  montos: [], meses: [], compradores: [], categorias: [], regiones: [], agenda: [], publicaciones: [],
});

describe('Inicio verificado: base, decision y acceso', () => {
  it('retira las recomendaciones debiles y no inventa actividad comercial', () => {
    const r = mapearResumenVerificado(vacio(), true, []);
    expect(r).not.toHaveProperty('oportunidadesDestacadas');
    expect(r.metricas).not.toHaveProperty('altaCompatibilidad');
    expect(r).not.toHaveProperty('postulacionesEnviadas');
    expect(r).not.toHaveProperty('tasaExito');
    expect(r.calidad.representatividad).toBe('muestra_disponible_no_representativa');
  });
  it('un catalogo sin detalle no genera un total monetario cero ni categorias ficticias', () => {
    const raw = vacio(); raw.oportunidadesActivas = 100; raw.oportunidadesSinMonto = 100;
    raw.montos = [{ moneda: null, monto: null, cantidad: '100', conMonto: '0' }];
    const r = mapearResumenVerificado(raw, true, []);
    expect(r.metricas.montosPorMoneda[0].montoTotal).toBeNull();
    expect(r.metricas.montoTotalDisponible).toBeNull();
    expect(r.distribucionCategorias).toEqual([]); expect(r.organismos).toEqual([]);
    expect(r.calidad.conDetalle).toBe(0);
  });
  it('conserva bases propias aunque la muestra sea muy pequena', () => {
    const raw = vacio(); Object.assign(raw, { oportunidadesActivas: 4933, conDetalle: 21,
      baseCategorias: 19, baseCompradores: 21, organismosCompradores: 18, baseRegiones: 20 });
    const r = mapearResumenVerificado(raw, true, []);
    expect(r.calidad).toMatchObject({ conDetalle: 21, baseCategorias: 19, baseCompradores: 21, baseRegiones: 20 });
    expect(r.metricas.oportunidadesActivas).toBe(4933);
  });
  it('preserva cero explicitamente informado y decimales de gran precision', () => {
    const raw = vacio(); raw.montos = [{ moneda: 'CLP', monto: '0.00', cantidad: '1', conMonto: '1' },
      { moneda: 'USD', monto: '999999999999999999.99', cantidad: '1', conMonto: '1' }];
    expect(mapearResumenVerificado(raw, true, []).metricas.montosPorMoneda.map((g) => g.montoTotal))
      .toEqual(['0.00', '999999999999999999.99']);
  });
  it('mantiene todos los grupos de categorias, sin redondear grupos pequenos a 0%', () => {
    const raw = vacio(); raw.categorias = [{ codigo: 'A', categoria: 'Salud', cantidad: 1 }, { codigo: 'B', categoria: 'Informatica', cantidad: 999 }];
    const r = mapearResumenVerificado(raw, true, []);
    expect(r.distribucionCategorias).toEqual(raw.categorias);
    expect(r.distribucionCategorias[0]).not.toHaveProperty('porcentaje');
  });
  it('no fusiona compradores distintos que comparten nombre', () => {
    const g = { moneda: 'CLP', monto: '10.00', cantidad: '1', conMonto: '1' };
    const r = agruparOrganismosDashboard([{ ...g, codigo: 'A', nombre: 'Mismo nombre' }, { ...g, codigo: 'B', nombre: 'Mismo nombre' }]);
    expect(r).toHaveLength(2); expect(r.map((x) => x.codigo)).toEqual(['A', 'B']);
  });
  it('consolida distintas denominaciones de un mismo comprador por codigo', () => {
    const g = { moneda: 'CLP', monto: '10.00', cantidad: '1', conMonto: '1' };
    const r = agruparOrganismosDashboard([{ ...g, codigo: 'A', nombre: 'Nombre 1' }, { ...g, moneda: 'USD', codigo: 'A', nombre: 'Nombre 2' }]);
    expect(r).toHaveLength(1); expect(r[0].cantidad).toBe(2); expect(r[0].montosPorMoneda).toHaveLength(2);
  });
  it('los tramos de cierre suman el catalogo sin duplicar el contador de 48 horas', () => {
    const raw = vacio(); Object.assign(raw, { oportunidadesActivas: 13, cierran48Horas: 2,
      cierran2a7Dias: 3, cierran7a30Dias: 4, cierran30DiasMas: 4, cierranSemana: 5 });
    const r = mapearResumenVerificado(raw, true, []);
    expect(r.horizonteCierres.reduce((s, f) => s + f.cantidad, 0)).toBe(13);
    expect(r.metricas.cierranSemana).toBe(5);
  });
  it('el servidor retira las series Premium para una suscripcion no vigente', () => {
    const raw = vacio(); raw.categorias = [{ codigo: 'A', categoria: 'Tecnologia', cantidad: 1 }];
    raw.montos = [{ moneda: 'CLP', monto: '10.00', cantidad: '1', conMonto: '1' }];
    const r = mapearResumenVerificado(raw, false, ['Software']);
    expect(r.acceso.premium).toBe(false); expect(r.metricas.montosPorMoneda).toEqual([]);
    for (const campo of ['agendaCierres', 'horizonteCierres', 'distribucionCategorias', 'organismos', 'regiones', 'actividadReciente', 'etiquetasRelevantes', 'evolucionMontos'] as const) expect(r[campo]).toEqual([]);
    expect(r.calidad.baseCompradores).toBeNull(); expect(r.metricas.oportunidadesConMonto).toBeNull();
    expect(r.metricas.oportunidadesActivas).toBe(0);
  });
  it('resuelve perfil y plan de la empresa sin invocar el motor aun pendiente', async () => {
    const query = vi.fn().mockResolvedValue([vacio()]); const obtener = vi.fn().mockResolvedValue({ activo: true, palabrasClave: ['Software'], etiquetasCapacidades: [] });
    const plan = vi.fn().mockResolvedValue(true);
    const s = new OportunidadesService({ query } as unknown as Repository<Licitacion>,
      { obtener } as unknown as PerfilesEmpresaService, { esPremiumVigente: plan } as unknown as PlanesEmpresaService);
    const matching = vi.spyOn(s, 'listar').mockRejectedValue(new Error('No debe ejecutarse'));
    const r = await s.obtenerResumenDashboard('empresa-A');
    expect(plan).toHaveBeenCalledWith('empresa-A'); expect(obtener).toHaveBeenCalledWith('empresa-A');
    expect(query).toHaveBeenCalledExactlyOnceWith(RESUMEN_DASHBOARD_SQL, [5]);
    expect(matching).not.toHaveBeenCalled(); expect(r.etiquetasRelevantes).toEqual(['Software']);
  });
});

describe('Reglas SQL auditables del resumen', () => {
  it('no fabrica etiquetas para completar graficos', () => {
    expect(RESUMEN_DASHBOARD_SQL).not.toMatch(/COALESCE\([^\n]*(?:No informado|Sin categor)/i);
    expect(RESUMEN_DASHBOARD_SQL).toContain('NULLIF(BTRIM(licitacion.codigo_organismo)');
    expect(RESUMEN_DASHBOARD_SQL).toContain("'no informado'");
    expect(RESUMEN_DASHBOARD_SQL).toContain('WHERE v."compradorIdentificado"');
  });
  it('categoriza todas las lineas sin multiplicar procesos por numero de items', () => {
    expect(RESUMEN_DASHBOARD_SQL).toContain('SELECT DISTINCT v.id');
    expect(RESUMEN_DASHBOARD_SQL).toContain('COUNT(DISTINCT id)::int AS cantidad');
    expect(RESUMEN_DASHBOARD_SQL).toContain('COUNT(DISTINCT id)::int FROM categorias_proceso');
  });
  it('solo agrega regiones reconocidas y no usa ubicacion como sinonimo de lugar de entrega', () => {
    expect(RESUMEN_DASHBOARD_SQL).toContain('WHERE "regionCodigo" IS NOT NULL');
    expect(RESUMEN_DASHBOARD_SQL).toContain('licitacion.region_unidad');
    expect(RESUMEN_DASHBOARD_SQL).not.toContain('region_entrega');
  });
  it('confirma nuevas con fecha de publicacion de ficha, no con fecha de descarga', () => {
    expect(RESUMEN_DASHBOARD_SQL).toContain("fecha_publicacion >= now() - INTERVAL '7 days'");
    expect(RESUMEN_DASHBOARD_SQL).toContain('AND fecha_publicacion <= now()');
    expect(RESUMEN_DASHBOARD_SQL).toContain('WHERE detalle_sincronizado_en IS NOT NULL');
    expect(RESUMEN_DASHBOARD_SQL).not.toContain("visto_activo_en >= now() - INTERVAL '7 days'");
  });
  it('agenda ordenada, acotada y tramos de cierre con fronteras excluyentes', () => {
    expect(RESUMEN_DASHBOARD_SQL).toContain('ORDER BY fecha_cierre, codigo_externo LIMIT 6');
    for (const limite of ['48 hours', '7 days', '30 days']) {
      expect(RESUMEN_DASHBOARD_SQL).toContain(`fecha_cierre < now() + INTERVAL '${limite}'`);
      expect(RESUMEN_DASHBOARD_SQL).toContain(`fecha_cierre >= now() + INTERVAL '${limite}'`);
    }
  });
});

describe('Metadata de guardadas: no confundir guardar con vigencia', () => {
  for (const [marca, esperado] of [[true, true], ['true', true], [false, false]] as const) {
    it(`expone estado de catalogo y marca explicita ${String(marca)} sin filtrar por titulo`, async () => {
      const fecha = new Date('2026-11-17T23:00:00Z');
      const registro = { id: 'fav', creadoEn: fecha, empresaId: 'empresa-A', licitacion: {
        codigoExterno: '1-2-LE26', nombre: 'Pruebas de laboratorio', codigoEstado: 5,
        activaEnListado: false, datosOrigen: { esPrueba: marca }, sincronizadoEn: fecha,
      } } as unknown as LicitacionFavorita;
      const find = vi.fn().mockResolvedValue([registro]);
      const servicio = new FavoritosService({ find } as unknown as Repository<LicitacionFavorita>, {} as Repository<Licitacion>);
      const r = await servicio.listar('empresa-A');
      expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { empresaId: 'empresa-A' } }));
      expect(r.datos[0].licitacion).toMatchObject({ activaEnListado: false, codigoEstado: 5, esPrueba: esperado });
    });
  }
});
