import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { OportunidadesService } from './oportunidades.service';

type Perfil = Awaited<ReturnType<PerfilesEmpresaService['obtener']>>;
const empresaId = '11111111-1111-4111-8111-111111111111';

describe('BUS-04 / BUS-05: MATCH comercial sin falsos 100 ni penalizacion multirrubro', () => {
  let licitacion: Licitacion;
  let perfil: Perfil;
  let servicio: OportunidadesService;

  beforeEach(() => {
    const fecha = new Date('2099-01-01T12:00:00Z');
    licitacion = Object.assign(new Licitacion(), {
      id: '22222222-2222-4222-8222-222222222222',
      codigoExterno: '1234-1-LE99',
      nombre: 'Compra de insumos medicos',
      descripcion: 'Suministro de insumos medicos para consultorio',
      codigoEstado: 5, estado: 'Publicada',
      moneda: 'CLP', montoEstimado: '1500000',
      fechaPublicacion: fecha, fechaCierre: fecha,
      fechaAdjudicacion: null, regionUnidad: 'Metropolitana', sincronizadoEn: fecha,
      detalleSincronizadoEn: fecha, datosOrigen: {},
      items: [{ codigoCategoria: 'QA-SALUD', categoria: 'Insumos medicos', nombreProducto: 'Insumos medicos', descripcion: null }],
    });
    perfil = {
      id: '33333333-3333-4333-8333-333333333333', empresaId,
      palabrasClave: ['insumos medicos'], etiquetasCapacidades: [],
      codigosCategoria: ['QA-SALUD'], regiones: ['Metropolitana'],
      montoMinimo: null, montoMaximo: null, incluirSinMonto: true,
      tiposOportunidad: [], frecuenciaAlertas: null, puntajeMinimoAlerta: 60,
      activo: true, creadoEn: fecha.toISOString(), actualizadoEn: fecha.toISOString(),
    };
    const query = {
      select: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(), getOne: vi.fn(async () => licitacion),
    } as unknown as SelectQueryBuilder<Licitacion>;
    servicio = new OportunidadesService(
      { createQueryBuilder: vi.fn(() => query), findOne: vi.fn(async () => licitacion) } as unknown as Repository<Licitacion>,
      { obtener: vi.fn(async () => perfil) } as unknown as PerfilesEmpresaService,
      { esPremiumVigente: vi.fn(async () => false) } as unknown as PlanesEmpresaService,
    );
  });

  async function puntaje() {
    const r = await servicio.evaluarLicitacionParaEmpresa(empresaId, licitacion.codigoExterno);
    expect(r).not.toBeNull();
    return r!.porcentajeCompatibilidad;
  }

  it('BUS-04: compartir solo la region no acredita un 100% comercial', async () => {
    perfil.palabrasClave = []; perfil.codigosCategoria = [];
    expect(await puntaje()).toBe(0);
  });

  it('BUS-04: region y monto no reemplazan coincidencia comercial', async () => {
    perfil.palabrasClave = []; perfil.codigosCategoria = [];
    perfil.montoMinimo = 1000; perfil.montoMaximo = 2000000;
    expect(await puntaje()).toBe(0);
  });

  it('BUS-04: perfil tematico configurado pero sin coincidencia no pasa solo por region', async () => {
    perfil.palabrasClave = ['construccion']; perfil.codigosCategoria = [];
    expect(await puntaje()).toBe(0);
  });

  it('BUS-05: agregar alternativas de TI no reduce compatibilidad de Salud', async () => {
    const original = await puntaje();
    perfil.palabrasClave.push('desarrollo de software');
    perfil.codigosCategoria.push('QA-TI');
    const ampliado = await puntaje();
    expect(original).toBe(100);
    expect(ampliado).toBe(original);
  });

  it('BUS-05: agregar palabras alternativas sin agregar categoria conserva evidencia', async () => {
    perfil.codigosCategoria = [];
    const original = await puntaje();
    perfil.palabrasClave.push('redes informaticas', 'ciberseguridad');
    expect(await puntaje()).toBe(original);
  });

  it('BUS-05: agregar categorias alternativas sin agregar palabras conserva evidencia', async () => {
    perfil.palabrasClave = [];
    const original = await puntaje();
    perfil.codigosCategoria.push('QA-TI', 'QA-OBRAS');
    expect(await puntaje()).toBe(original);
  });
});
