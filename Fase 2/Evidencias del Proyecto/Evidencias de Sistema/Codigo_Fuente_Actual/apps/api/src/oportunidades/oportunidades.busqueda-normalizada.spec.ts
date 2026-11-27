import { describe, expect, it, vi } from 'vitest';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { Licitacion } from '../licitaciones/entities/licitacion.entity';
import type { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { consultarOportunidadesSchema } from './dto/consultar-oportunidades.dto';
import { OportunidadesService } from './oportunidades.service';

describe('BUS-02: buscador normalizado y sinonimos de rubro', () => {
  const servicio = new OportunidadesService(
    {} as Repository<Licitacion>,
    {} as PerfilesEmpresaService,
    {} as PlanesEmpresaService,
  );
  const filtros = (texto: string) => {
    const andWhere = vi.fn().mockReturnThis();
    const qb = { andWhere } as unknown as SelectQueryBuilder<Licitacion>;
    (servicio as any).aplicarFiltros(qb, consultarOportunidadesSchema.parse({ texto, soloVigentes: 'false' }));
    const [sql, args] = andWhere.mock.calls.at(-1) as [string, { patronesTexto?: string[]; textoCodigo?: string }];
    return {sql, args};
  };
  it('BUS-02 tildes: mantencion y mantención generan la misma búsqueda', () => {
    const a = filtros('mantencion');
    const b = filtros('mantención');
    expect(a.args.patronesTexto).toEqual(b.args.patronesTexto);
    expect(a.sql).toContain('translate(');
    expect(a.sql).toContain('LIKE ANY(:patronesTexto)');
  });
  it('BUS-02 tildes: Ñ, Ú y Ü se normalizan en patrones SQL', () => {
    expect(filtros('Ñuñoa').args.patronesTexto).toContain('%nunoa%');
    expect(filtros('Computación').args.patronesTexto).toContain('%computacion%');
    expect(filtros('Lingüística').args.patronesTexto).toContain('%linguistica%');
  });
  it('BUS-02 sinónimos: mantención encuentra mantenimiento', () => {
    const patrones = filtros('mantención').args.patronesTexto ?? [];
    expect(patrones).toContain('%mantencion%');
    expect(patrones).toContain('%mantenimiento%');
  });
  it('BUS-02 sinónimos: mantenimiento encuentra mantención', () => {
    const patrones = filtros('mantenimiento').args.patronesTexto ?? [];
    expect(patrones).toContain('%mantencion%');
    expect(patrones).toContain('%mantenimiento%');
  });
  it('BUS-02 sinónimos: ambos alias utilizan el mismo conjunto', () => {
    expect(new Set(filtros('mantencion').args.patronesTexto))
      .toEqual(new Set(filtros('mantenimiento').args.patronesTexto));
  });
  it('BUS-02: conserva el filtro por código externo usando parámetros', () => {
    expect(filtros('1234-5-LE26').args.textoCodigo).toBe('%1234-5-LE26%');
    expect(filtros('1234-5-LE26').sql).toContain('licitacion.codigoExterno ILIKE :textoCodigo');
  });
  it('BUS-02: no expande términos desconocidos a otros rubros', () => {
    expect(filtros('software extraordinario').args.patronesTexto).toEqual(['%software%extraordinario%']);
  });
  it('BUS-02: búsqueda solo de signos no recupera todo el catálogo', () => {
    expect(filtros('??').sql).toBe('1 = 0');
  });
});
