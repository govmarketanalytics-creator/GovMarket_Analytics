import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Empresa } from '../empresas/entities/empresa.entity';
import { LicitacionAdjudicacion } from '../licitaciones/entities/licitacion-adjudicacion.entity';
import { LicitacionItem } from '../licitaciones/entities/licitacion-item.entity';
import { LicitacionResultado } from '../licitaciones/entities/licitacion-resultado.entity';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { MembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionUsuario } from '../notificaciones/entities/notificacion-usuario.entity';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { SuscripcionEmpresa } from '../planes-empresa/entities/suscripcion-empresa.entity';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { consultarOportunidadesSchema } from './dto/consultar-oportunidades.dto';
import { OportunidadesService } from './oportunidades.service';

class MetadatosSinConexion extends DataSource {
  preparar() { return this.buildMetadatas(); }
}

const empresaId = '11111111-1111-4111-8111-111111111111';
const fecha = new Date('2099-01-01T12:00:00Z');
const licitacion = {
  id: '22222222-2222-4222-8222-222222222222', codigoExterno: '1234-1-LE99',
  nombre: 'Pruebas de laboratorio y desarrollo de software', descripcion: null,
  codigoEstado: 5, estado: 'Publicada', codigoTipo: '1', tipo: 'LE', moneda: 'CLP',
  montoEstimado: null, fechaPublicacion: fecha, fechaCierre: fecha, fechaAdjudicacion: null,
  codigoOrganismo: 'COMPRADOR-REAL', nombreOrganismo: 'Organismo de ejemplo',
  regionUnidad: 'Metropolitana', sincronizadoEn: fecha, activaEnListado: true,
  datosOrigen: {}, items: [],
} as unknown as Licitacion;
const perfil = {
  id: '33333333-3333-4333-8333-333333333333', empresaId, palabrasClave: ['software'],
  etiquetasCapacidades: [], codigosCategoria: [], regiones: ['Metropolitana'],
  montoMinimo: null, montoMaximo: null, incluirSinMonto: true, tiposOportunidad: [], activo: true,
};

describe('Oportunidades: exclusion de registros marcados como prueba', () => {
  let ds: MetadatosSinConexion;
  let servicio: OportunidadesService;
  let repository: Repository<Licitacion>;
  let consultas: string[];
  beforeAll(async () => {
    ds = new MetadatosSinConexion({ type: 'postgres', synchronize: false, migrationsRun: false,
      installExtensions: false, entities: [Empresa, PerfilEmpresa, Licitacion, LicitacionItem,
        LicitacionResultado, LicitacionAdjudicacion, SuscripcionEmpresa] });
    await ds.preparar();
  });
  beforeEach(() => {
    consultas = [];
    repository = ds.getRepository(Licitacion);
    vi.spyOn(SelectQueryBuilder.prototype, 'getMany').mockImplementation(async function (this: SelectQueryBuilder<Licitacion>) {
      consultas.push(this.getQuery()); return [licitacion];
    });
    vi.spyOn(SelectQueryBuilder.prototype, 'getOne').mockImplementation(async function (this: SelectQueryBuilder<Licitacion>) {
      consultas.push(this.getQuery()); return licitacion;
    });
    vi.spyOn(SelectQueryBuilder.prototype, 'getCount').mockImplementation(async function (this: SelectQueryBuilder<Licitacion>) {
      consultas.push(this.getQuery()); return 1;
    });
    vi.spyOn(SelectQueryBuilder.prototype, 'getRawMany').mockImplementation(async function <T>(this: SelectQueryBuilder<Licitacion>): Promise<T[]> {
      consultas.push(this.getQuery());
      const filas: unknown[] = this.expressionMap.selects.some((s) => s.aliasName === 'id') ? [{ id: licitacion.id }] : [];
      return filas as T[];
    });
    vi.spyOn(repository, 'query').mockImplementation(async (sql: string) => {
      consultas.push(sql);
      return sql.includes('AS "oportunidadesActivas"') ? [{ generadoEn: fecha,
        catalogoConsultadoEn: fecha, ultimoDetalleEn: null, oportunidadesActivas: 1,
        cierran48Horas: 0, cierranSemana: 1 }] : [];
    });
    servicio = new OportunidadesService(repository,
      { obtener: vi.fn().mockResolvedValue(perfil) } as unknown as PerfilesEmpresaService,
      { esPremiumVigente: vi.fn().mockResolvedValue(false) } as unknown as PlanesEmpresaService);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  function comprobarConsultas() {
    expect(consultas.length).toBeGreaterThan(0);
    for (const sql of consultas) {
      if (sql.includes('/* gma_revision_catalogo */')) {
        // No carga oportunidades: solo invalida trabajo cacheado. No toca JSON.
        expect(sql).not.toContain('datos_origen');
        expect(sql).toContain('max(actualizado_en)');
        continue;
      }
      const where = sql.slice(sql.indexOf('WHERE'));
      expect(where).toContain("->> 'esPrueba'");
      expect(where).toContain("'false') <> 'true'");
    }
    expect(ds.isInitialized).toBe(false);
  }

  for (const alcance of ['todas', 'recomendadas'] as const) {
    for (const soloVigentes of ['true', 'false'] as const) {
      for (const orden of ['fecha_desc', 'compatibilidad_desc'] as const) {
        it(`conserva exclusion en ${alcance}, vigentes=${soloVigentes}, orden=${orden}`, async () => {
          await servicio.listar(empresaId, consultarOportunidadesSchema.parse({ alcance, soloVigentes, orden, puntajeMinimo: alcance === 'recomendadas' ? 1 : 0 }));
          comprobarConsultas();
        });
      }
    }
  }
  it('conserva exclusion al filtrar por texto y categoria, incluidos los IDs de pagina', async () => {
    const r = await servicio.listar(empresaId, consultarOportunidadesSchema.parse({ alcance: 'todas', orden: 'fecha_desc', texto: 'software', codigoCategoria: 'QA-TI', soloVigentes: 'false' }));
    expect(r.datos[0].codigoExterno).toBe(licitacion.codigoExterno);
    expect(r.datos[0].nombre).toContain('Pruebas de laboratorio');
    expect(consultas.some((sql) => sql.includes(' IN ('))).toBe(true);
    comprobarConsultas();
  });
  it('excluye las simulaciones de la evaluacion automatica para empresas', async () => {
    await servicio.evaluarLicitacionParaEmpresa(empresaId, licitacion.codigoExterno);
    comprobarConsultas();
  });
  it('aplica la misma condicion a los agregados del dashboard', async () => {
    await servicio.obtenerResumenDashboard(empresaId);
    expect(consultas.some((sql) => sql.includes('SUM(licitacion.monto_estimado)'))).toBe(true);
    comprobarConsultas();
  });
});

describe('Compatibilidad con la notificacion explicita de prueba', () => {
  it('crearPrueba conserva sus marcas y no usa el evaluador normal de oportunidades', async () => {
    const create = vi.fn((datos) => datos);
    const save = vi.fn(async (datos) => ({ ...datos, id: 'licitacion-ficticia' }));
    const getRepository = vi.fn((entidad) => {
      if (entidad === Usuario) return { findOne: vi.fn().mockResolvedValue({ id: 'usuario-ficticio', email: 'qa@example.invalid' }) };
      if (entidad === MembresiaEmpresa) return { find: vi.fn().mockResolvedValue([{ empresaId,
        empresa: { nombreFantasia: 'Empresa QA', comuna: 'Santiago', regionPrincipal: 'Metropolitana' } }]) };
      if (entidad === Licitacion) return { create, save };
      throw new Error('Repositorio no previsto en prueba');
    });
    const evaluar = vi.fn();
    const servicio = new NotificacionesService({} as Repository<NotificacionUsuario>, {} as Repository<PerfilEmpresa>,
      { getRepository } as unknown as DataSource, {} as PlanesEmpresaService,
      { evaluarLicitacionParaEmpresa: evaluar } as unknown as OportunidadesService);
    const crearAviso = vi.spyOn(servicio as unknown as { crearParaEmpresa: (entrada: unknown) => Promise<{ creada: boolean; notificacionId: string }> }, 'crearParaEmpresa')
      .mockResolvedValue({ creada: true, notificacionId: 'aviso-ficticio' });
    const resultado = await servicio.crearPrueba('qa@example.invalid', 87);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ datosOrigen: { esPrueba: true, generadoPor: 'GovMarket Analytics' }, activaEnListado: false }));
    expect(crearAviso).toHaveBeenCalledWith(expect.objectContaining({ empresaId, esPrueba: true, porcentajeCompatibilidad: 87 }));
    expect(evaluar).not.toHaveBeenCalled();
    expect(resultado.notificacionId).toBe('aviso-ficticio');
    vi.restoreAllMocks();
  });
});
