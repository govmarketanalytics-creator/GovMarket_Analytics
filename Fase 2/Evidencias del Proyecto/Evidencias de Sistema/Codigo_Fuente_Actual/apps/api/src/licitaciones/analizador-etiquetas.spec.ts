import { describe, expect, it } from 'vitest';
import {
  analizarEtiquetas,
  normalizarTexto,
  type RegistroAnalisisEtiquetas,
} from './analizador-etiquetas';

function crearRegistro(
  codigoExterno: string,
  nombre: string,
  categoria = 'Equipos computacionales',
): RegistroAnalisisEtiquetas {
  return {
    codigoExterno,
    nombre,
    descripcion: 'Compra pública para organismo de prueba',
    tipo: 'LE',
    categorias: [categoria],
    nombresItems: ['Notebook profesional'],
    descripcionesItems: ['Equipo portátil con accesorios'],
  };
}

describe('analizador de etiquetas', () => {
  it('normaliza mayúsculas, acentos y signos', () => {
    expect(normalizarTexto('Mantención, MÉDICA y Ñandú')).toBe(
      'mantencion medica y nandu',
    );
  });

  it('propone palabras y frases por cantidad de licitaciones', () => {
    const registros = [
      crearRegistro('1000-1-LE26', 'Adquisición de notebook profesional'),
      crearRegistro('1000-2-LE26', 'Notebook profesional para oficina'),
      crearRegistro('1000-3-LE26', 'Notebook profesional y monitor'),
    ];

    const resultado = analizarEtiquetas(registros, 20);

    expect(resultado.resumen).toMatchObject({
      licitacionesAnalizadas: 3,
      conDescripcion: 3,
      conItems: 3,
      frecuenciaMinima: 3,
    });
    expect(resultado.palabrasCandidatas[0]).toMatchObject({
      texto: 'notebook',
      licitaciones: 3,
      aparicionesEnTitulos: 3,
    });
    expect(resultado.frasesCandidatas).toContainEqual(
      expect.objectContaining({
        texto: 'notebook profesional',
        licitaciones: 3,
      }),
    );
    expect(resultado.categoriasMercadoPublico).toEqual([
      { nombre: 'equipos computacionales', licitaciones: 3 },
    ]);
  });

  it('excluye términos genéricos de contratación pública', () => {
    const registros = [
      crearRegistro('2000-1-LE26', 'Adquisición servicio licitación limpieza'),
      crearRegistro('2000-2-LE26', 'Contratación servicios de limpieza'),
      crearRegistro('2000-3-LE26', 'Suministro para limpieza'),
    ];

    const resultado = analizarEtiquetas(registros, 20);
    const palabras = resultado.palabrasCandidatas.map(({ texto }) => texto);

    expect(palabras).toContain('limpieza');
    expect(palabras).not.toContain('adquisicion');
    expect(palabras).not.toContain('servicio');
    expect(palabras).not.toContain('licitacion');
  });
});
