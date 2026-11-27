import { describe, expect, it } from 'vitest';
import { CATALOGO_ETIQUETAS, clasificarEtiquetas, expandirEtiquetaPerfil, normalizarTexto } from './catalogo-etiquetas';

// Oraculo independiente: algoritmo anterior, sin patrones precompilados.
function clasificarAnterior(nombre: string) {
  const texto = normalizarTexto(nombre), rubros = new Set<string>(), etiquetas = new Set<string>();
  const contiene = (v: string) => { const t = normalizarTexto(v); return Boolean(t) && ` ${texto} `.includes(` ${t} `); };
  for (const r of CATALOGO_ETIQUETAS) {
    let coincide = [r.nombre, ...r.sinonimos].some(contiene);
    for (const e of r.etiquetas) if ([e.nombre, ...e.sinonimos].some(contiene)) { etiquetas.add(e.nombre); coincide = true; }
    if (coincide) rubros.add(r.nombre);
  }
  return { rubros: [...rubros], etiquetas: [...etiquetas] };
}
function expandirAnterior(valor: string) {
  const n = normalizarTexto(valor), unicos = (v: string[]) => [...new Set(v.map(normalizarTexto).filter(Boolean))];
  for (const r of CATALOGO_ETIQUETAS) {
    if (normalizarTexto(r.nombre) === n) return unicos([r.nombre, ...r.sinonimos, ...r.etiquetas.flatMap((e) => [e.nombre, ...e.sinonimos])]);
    for (const e of r.etiquetas) if (normalizarTexto(e.nombre) === n) return unicos([e.nombre, ...e.sinonimos]);
  }
  return n ? [n] : [];
}
const terminos = CATALOGO_ETIQUETAS.flatMap((r) => [r.nombre, ...r.sinonimos, ...r.etiquetas.flatMap((e) => [e.nombre, ...e.sinonimos])]);
describe('Catalogo precompilado: equivalencia exacta con algoritmo anterior', () => {
  it('conserva etiquetas, rubros y orden en todos los terminos y sus variantes', () => {
    for (const t of [...terminos, '', 'texto totalmente ajeno', 'construccionx']) {
      for (const nombre of [t, `Adquisición: ${t.toUpperCase()} / ${t}…`, `z${t}z`]) {
        expect(clasificarEtiquetas({ nombre })).toEqual(clasificarAnterior(nombre));
      }
    }
  });
  it('conserva expansiones de los nombres canónicos y admite sus sinónimos', () => {
    for (const r of CATALOGO_ETIQUETAS) {
      expect(expandirEtiquetaPerfil(r.nombre)).toEqual(expandirAnterior(r.nombre));
      for (const e of r.etiquetas) expect(expandirEtiquetaPerfil(e.nombre)).toEqual(expandirAnterior(e.nombre));
    }
    expect(expandirEtiquetaPerfil('software a medida')).toEqual(expandirEtiquetaPerfil('Desarrollo de software'));
    expect(expandirEtiquetaPerfil('seguridad informática')).toEqual(expandirEtiquetaPerfil('Ciberseguridad'));
    expect(expandirEtiquetaPerfil('texto ajeno')).toEqual(['texto ajeno']);
  });
  it('conserva concatenacion de campos y deduplicacion', () => {
    const f = { nombre: 'software', descripcion: 'mantención', categorias: ['seguridad'], nombresItems: ['alimentos'], descripcionesItems: ['laboratorio'] };
    expect(clasificarEtiquetas(f)).toEqual(clasificarAnterior('software mantención seguridad alimentos laboratorio'));
  });
  it('el llamador no puede contaminar una expansion compartida', () => {
    const antes = expandirEtiquetaPerfil('Desarrollo de software');
    expandirEtiquetaPerfil('Desarrollo de software').push('NO-INYECTAR');
    expect(expandirEtiquetaPerfil('Desarrollo de software')).toEqual(antes);
  });
});
