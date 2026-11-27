import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Licitacion } from '../licitaciones/entities/licitacion.entity';
import type { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { OportunidadesService } from './oportunidades.service';
import { consultarOportunidadesSchema } from './dto/consultar-oportunidades.dto';

describe('Matching en lotes sin bloquear otras tareas', () => {
  afterEach(() => vi.restoreAllMocks());
  it('atiende el event loop y conserva candidatas, total y paginación', async () => {
    let reloj = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (reloj += 20));
    const fecha = new Date('2080-01-01T12:00:00Z');
    const fichas = Array.from({ length: 100 }, (_, i) => ({ id: `L${i}`,
      codigoExterno: `${i + 1}-1-LE80`, nombre: 'Desarrollo de software', descripcion: null,
      items: [], montoEstimado: null, fechaPublicacion: fecha, fechaCierre: fecha, sincronizadoEn: fecha,
    }));
    const q: Record<string, unknown> = {};
    for (const nombre of ['select', 'addSelect', 'where', 'andWhere', 'leftJoin', 'distinct']) q[nombre] = () => q;
    q.getRawMany = async () => fichas.map(({ id }) => ({ id }));
    q.getMany = async () => fichas;
    const perfil = { activo: true, palabrasClave: ['Desarrollo de software'], etiquetasCapacidades: [],
      codigosCategoria: [], regiones: [], montoMinimo: null, montoMaximo: null, incluirSinMonto: true };
    const servicio = new OportunidadesService({ createQueryBuilder: () => q, query: async () => [] } as unknown as Repository<Licitacion>,
      { obtener: async () => perfil } as unknown as PerfilesEmpresaService, {} as PlanesEmpresaService);
    let atendida = false;
    setImmediate(() => { atendida = true; });
    const r = await servicio.listar('EMPRESA', consultarOportunidadesSchema.parse({
      alcance: 'recomendadas', puntajeMinimo: 1, incluirFiltros: 'false', pagina: 2, limite: 20,
    }));
    expect(atendida).toBe(true);
    expect(r.paginacion).toMatchObject({ total: 100, totalPaginas: 5, pagina: 2 });
    expect(r.datos).toHaveLength(20); expect(r.datos[0].id).toBe('L20');
    expect(r.datos.every((d) => d.porcentajeCompatibilidad === 100)).toBe(true);
  });
});
