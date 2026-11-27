import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { OportunidadesService } from './oportunidades.service';

const empresaId = '11111111-1111-4111-8111-111111111111';
type Perfil = Awaited<ReturnType<PerfilesEmpresaService['obtener']>>;

describe('Region desconocida: ausencia de evidencia no es una coincidencia falsa', () => {
  let licitacion: Licitacion;
  let perfil: Perfil;
  let servicio: OportunidadesService;

  beforeEach(() => {
    const fecha = new Date('2099-01-01T12:00:00Z');
    licitacion = Object.assign(new Licitacion(), {
      id: '22222222-2222-4222-8222-222222222222',
      codigoExterno: '1234-1-LE99', nombre: 'Desarrollo de software',
      descripcion: null, codigoEstado: 5, estado: 'Publicada', moneda: null,
      montoEstimado: null, fechaPublicacion: fecha, fechaCierre: fecha,
      fechaAdjudicacion: null, regionUnidad: null, sincronizadoEn: fecha,
      detalleSincronizadoEn: null, datosOrigen: {}, items: [],
    });
    perfil = {
      id: '33333333-3333-4333-8333-333333333333', empresaId,
      palabrasClave: ['Desarrollo de software'], etiquetasCapacidades: [], codigosCategoria: [],
      regiones: ['Metropolitana'], montoMinimo: null, montoMaximo: null,
      incluirSinMonto: true, tiposOportunidad: [], frecuenciaAlertas: null,
      puntajeMinimoAlerta: 60, activo: true, creadoEn: fecha.toISOString(),
      actualizadoEn: fecha.toISOString(),
    };
    const query = {
      select: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      getOne: vi.fn(async () => licitacion),
    } as unknown as SelectQueryBuilder<Licitacion>;
    servicio = new OportunidadesService({
      createQueryBuilder: vi.fn(() => query), findOne: vi.fn(async () => licitacion),
    } as unknown as Repository<Licitacion>,
    { obtener: vi.fn(async () => perfil) } as unknown as PerfilesEmpresaService,
    { esPremiumVigente: vi.fn(async () => false) } as unknown as PlanesEmpresaService);
  });

  const geo = (r: NonNullable<Awaited<ReturnType<OportunidadesService['evaluarLicitacionParaEmpresa']>>>) =>
    r.desgloseCompatibilidad.find((c) => c.criterio === 'Cobertura geográfica');
  async function evaluar() {
    const resultado = await servicio.evaluarLicitacionParaEmpresa(empresaId, licitacion.codigoExterno);
    expect(resultado).not.toBeNull();
    return resultado!;
  }

  for (const region of [null, '', '   ', '\t\n']) {
    it(`no confunde region ausente ${JSON.stringify(region)} con incumplimiento`, async () => {
      licitacion.regionUnidad = region;
      const r = await evaluar();
      expect(r.coincidencias.region).toBeNull();
      expect(geo(r)).toEqual({ criterio: 'Cobertura geográfica', porcentaje: null,
        evaluado: false, motivoNoEvaluado: 'dato_no_informado' });
      expect(r.porcentajeCompatibilidad).toBe(72.73);
      expect(licitacion.regionUnidad).toBe(region);
    });
  }
  it('distingue una region conocida diferente de un dato desconocido', async () => {
    licitacion.regionUnidad = 'Valparaíso';
    const r = await evaluar();
    expect(r.coincidencias.region).toBe(false);
    expect(geo(r)).toEqual({ criterio: 'Cobertura geográfica', porcentaje: 0,
      evaluado: true, motivoNoEvaluado: null });
    expect(r.porcentajeCompatibilidad).toBe(72.73);
  });
  for (const region of ['Metropolitana', 'REGIÓN METROPOLITANA']) {
    it(`conserva coincidencia regional conocida: ${region}`, async () => {
      licitacion.regionUnidad = region;
      const r = await evaluar();
      expect(r.coincidencias.region).toBe(true);
      expect(geo(r)).toEqual({ criterio: 'Cobertura geográfica', porcentaje: 100,
        evaluado: true, motivoNoEvaluado: null });
      expect(r.porcentajeCompatibilidad).toBe(100);
    });
  }
  for (const region of [null, 'Metropolitana']) {
    it(`no atribuye datos pendientes a un criterio no configurado (${region})`, async () => {
      perfil.regiones = []; licitacion.regionUnidad = region;
      const r = await evaluar();
      expect(r.coincidencias.region).toBeNull();
      expect(geo(r)).toEqual({ criterio: 'Cobertura geográfica', porcentaje: null,
        evaluado: false, motivoNoEvaluado: 'no_configurado' });
      expect(r.porcentajeCompatibilidad).toBe(100);
    });
  }
  it('no inventa descripcion, monto, moneda o fecha de publicacion en un detalle pendiente', async () => {
    licitacion.fechaPublicacion = null;
    const r = await evaluar();
    expect(r.descripcion).toBeNull(); expect(r.montoEstimado).toBeNull();
    expect(r.moneda).toBeNull(); expect(r.fechaPublicacion).toBeNull();
    expect(r.coincidencias.region).toBeNull();
  });
  it('tambien deja sin evaluar una region omitida en un detalle ya descargado', async () => {
    licitacion.detalleSincronizadoEn = new Date('2099-01-01T12:00:00Z');
    expect(geo(await evaluar())?.motivoNoEvaluado).toBe('dato_no_informado');
  });
  it('conserva el cero explicito y la unidad original sin confundirlos con datos ausentes', async () => {
    licitacion.montoEstimado = '0.00'; licitacion.moneda = 'CLF';
    const r = await evaluar();
    expect(r.montoEstimado).toBe(0); expect(r.moneda).toBe('CLF');
    expect(r.coincidencias.region).toBeNull();
  });
  it('no obtiene puntos ni 100% solo por desconocer la region', async () => {
    perfil.palabrasClave = [];
    const r = await evaluar();
    expect(r.porcentajeCompatibilidad).toBe(0);
    expect(r.coincidencias.region).toBeNull();
  });
  it('el detalle gratuito conserva restricciones y comunica region no evaluable', async () => {
    const r = await servicio.obtenerDetalle(empresaId, licitacion.codigoExterno);
    expect(r.coincidencias.region).toBeNull();
    expect(geo(r)?.motivoNoEvaluado).toBe('dato_no_informado');
    expect(r.acceso.completo).toBe(false); expect(r.items).toEqual([]);
    expect(r.informacionClave.region).toBeNull();
  });
});
