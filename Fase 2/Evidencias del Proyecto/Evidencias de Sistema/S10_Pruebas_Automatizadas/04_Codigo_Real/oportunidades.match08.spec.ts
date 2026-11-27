import { describe, expect, it } from 'vitest';
import { expandirEtiquetaPerfil } from '../licitaciones/catalogo-etiquetas';
import { evaluarRelevanciaCapacidades, type FuenteParaRelevancia } from './relevancia-capacidades';

const terminosSalud = ['Salud y servicios sanitarios'];
const farmacos = {
  nombre: 'SC 13168 Farmacos CESFAM', descripcion: 'Adquisicion de medicamentos',
  items: [{ nombreProducto: 'Farmacos', categoria: 'Salud, medicina y servicios sanitarios' }],
};
const seguros = {
  nombre: 'CONTRATACION DE SEGUROS DE VIDA PARA AUXILIARES DE SERVICIO Y VIGILANCIA',
  descripcion: 'Seguro de vida para funcionarios de la Direccion Comunal de Salud',
  items: [{ nombreProducto: 'Seguro de vida', categoria: 'Seguros de personas y salud' }],
};
const evaluar = (terminos: string[], fuente: FuenteParaRelevancia) => evaluarRelevanciaCapacidades(terminos, expandirEtiquetaPerfil, fuente);

describe('MATCH-08: pertinencia comercial y evidencia explicable', () => {
  it('diferencia farmacia del contexto sanitario de seguros', () => {
    expect(evaluar(terminosSalud, farmacos).porcentaje).toBe(90);
    expect(evaluar(terminosSalud, seguros).porcentaje).toBe(30);
  });
  it('registra el campo real que origina la coincidencia', () => {
    const resultado = evaluar(terminosSalud, seguros);
    expect(resultado.evidencias).toHaveLength(1);
    expect(resultado.evidencias[0].campo).toBe('item_categoria');
    expect(resultado.evidencias[0].nivel).toBe('baja');
  });
  it('premia seguros cuando el perfil si ofrece seguros', () => {
    const resultado = evaluar(['Seguros y servicios financieros'], seguros);
    expect(resultado.porcentaje).toBe(100);
    expect(resultado.evidencias[0].campo).toBe('titulo');
  });
  it('no reduce relevancia al agregar un segundo rubro alternativo', () => {
    const original = evaluar(terminosSalud, farmacos).porcentaje;
    expect(evaluar([...terminosSalud, 'Tecnologia de la informacion'], farmacos).porcentaje).toBe(original);
  });
  it('no inventa coincidencia por una region geografica (BUS-04)', () => {
    expect(evaluar(['Desarrollo de software'], { nombre: 'Seguros de vida', items: [] }).porcentaje).toBe(0);
  });
  it('reconoce terminos con acentos y respeta limites de palabra', () => {
    expect(evaluar(['mantencion'], {nombre: 'Mantención de computadores', items: []}).porcentaje).toBe(55);
    expect(evaluar(['Mantención preventiva'], {nombre: 'Mantención preventiva de computadores', items: []}).porcentaje).toBe(100);
    expect(evaluar(['redes'], {nombre: 'Paredes pintadas', items: []}).porcentaje).toBe(0);
  });
  it('no suma palabras de rubros distintos para penalizar multi-rubro', () => {
    const solo = evaluar(['Seguros y servicios financieros'], seguros).porcentaje;
    const combinado = evaluar(['Seguros y servicios financieros', 'Desarrollo de software'], seguros).porcentaje;
    expect(solo).toBe(combinado);
  });
  it('no genera evidencia si faltan los datos y contenidos', () => {
    expect(evaluar(['Salud y servicios sanitarios'], {nombre: '', descripcion: null, items: []}).porcentaje).toBe(0);
  });
});
