import { describe, expect, it } from 'vitest';
import {
  clasificarEtiquetas,
  expandirEtiquetaPerfil,
  obtenerCatalogoPublico,
} from './catalogo-etiquetas';

describe('catálogo multisectorial de etiquetas', () => {
  it('clasifica una oportunidad usando título, categorías e ítems', () => {
    const resultado = clasificarEtiquetas({
      nombre: 'Mantención preventiva de computadores',
      descripcion: 'Servicio para equipos de una institución pública',
      categorias: [
        'Tecnologías de la información equipos informáticos y accesorios computadores',
      ],
      nombresItems: ['Notebook profesional'],
    });

    expect(resultado.rubros).toContain('Mantención y reparación');
    expect(resultado.rubros).toContain('Tecnología de la información');
    expect(resultado.etiquetas).toContain('Mantención preventiva');
    expect(resultado.etiquetas).toContain('Equipos computacionales');
  });

  it('no transforma ubicaciones o expresiones administrativas en rubros', () => {
    expect(
      clasificarEtiquetas({
        nombre: 'Segundo llamado comuna de San José código BIP',
      }),
    ).toEqual({ rubros: [], etiquetas: [] });
  });

  it('expande una etiqueta canónica con sus sinónimos', () => {
    expect(expandirEtiquetaPerfil('Mantención preventiva')).toEqual(
      expect.arrayContaining([
        'mantencion preventiva',
        'mantenimiento preventivo',
      ]),
    );
  });

  it('expande un rubro con los términos de sus especialidades', () => {
    expect(expandirEtiquetaPerfil('Tecnología de la información')).toEqual(
      expect.arrayContaining([
        'desarrollo de software',
        'computadores',
        'ciberseguridad',
      ]),
    );
  });

  it('publica el catálogo sin exponer los sinónimos internos', () => {
    const catalogo = obtenerCatalogoPublico();

    expect(catalogo.length).toBeGreaterThanOrEqual(15);
    expect(catalogo[0]).toHaveProperty('etiquetas');
    expect(catalogo[0]).not.toHaveProperty('sinonimos');
  });
});
