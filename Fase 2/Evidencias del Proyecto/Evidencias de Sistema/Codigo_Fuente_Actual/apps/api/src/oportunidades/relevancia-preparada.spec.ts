import { describe, expect, it, vi } from 'vitest';
import { prepararRelevanciaCapacidades } from './relevancia-capacidades';

describe('Reglas de matching preparadas: reutilización y especificidad', () => {
  it('expande una vez por término y reutiliza las reglas entre fichas', () => {
    const expandir = vi.fn(() => ['software', 'desarrollo web']);
    const evaluar = prepararRelevanciaCapacidades(['Desarrollo web', 'desarróllo web', ''], expandir);
    expect(evaluar({ nombre: 'Desarrollo web municipal' })).toMatchObject({ porcentaje: 100,
      coincidencias: ['Desarrollo web'], evidencias: [{ campo: 'titulo', expresionCoincidente: 'desarrollo web' }] });
    expect(evaluar({ descripcion: 'Se requiere software' })).toMatchObject({ porcentaje: 25 });
    expect(expandir).toHaveBeenCalledTimes(1);
  });

  it('conserva el primer campo ganador en empates y reúne todos los rubros coincidentes', () => {
    const evaluar = prepararRelevanciaCapacidades(['software', 'seguridad'], (v) => [v]);
    const r = evaluar({ nombre: 'Software de seguridad', items: [{ nombreProducto: 'Software de seguridad' }] });
    expect(r.porcentaje).toBe(55); expect(r.coincidencias).toEqual(['software', 'seguridad']);
    expect(r.evidencias.map((e) => e.campo)).toEqual(['titulo', 'titulo']);
  });

  it('dos alias genéricos no convierten una categoría amplia en evidencia fuerte', () => {
    const evaluar = prepararRelevanciaCapacidades(['Tecnología'], () => ['software', 'sistemas']);
    expect(evaluar({ items: [{ descripcion: 'Software', categoria: 'Software y sistemas' }] }))
      .toMatchObject({ porcentaje: 35, evidencias: [{ campo: 'item_descripcion', expresionCoincidente: 'software' }] });
  });

  it('una categoría genérica conserva calidad baja y no acredita palabras parciales', () => {
    const evaluar = prepararRelevanciaCapacidades(['Ciberseguridad'], () => ['seguridad']);
    expect(evaluar({ items: [{ categoria: 'Equipos de seguridad' }] }).porcentaje).toBe(30);
    const api = prepararRelevanciaCapacidades(['api'], (v) => [v]);
    expect(api({ nombre: 'Capital provincial' })).toEqual({ porcentaje: 0, coincidencias: [], evidencias: [] });
  });

  it('conserva el orden original en expresiones de igual longitud', () => {
    const evaluar = prepararRelevanciaCapacidades(['web'], () => ['web api', 'api web']);
    expect(evaluar({ nombre: 'Web API web' }).evidencias[0].expresionCoincidente).toBe('web api');
  });

  it('admite un perfil vacío y la expresión de respaldo cuando no hay alias', () => {
    const expandir = vi.fn(() => []);
    expect(prepararRelevanciaCapacidades([], expandir)({ nombre: 'Software' }).porcentaje).toBe(0);
    expect(expandir).not.toHaveBeenCalled();
    expect(prepararRelevanciaCapacidades(['SOFTWARE'], expandir)({ nombre: 'Software' }).porcentaje).toBe(55);
  });
});
