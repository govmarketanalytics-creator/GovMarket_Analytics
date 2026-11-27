import { describe, expect, it } from 'vitest';
import { expandirEtiquetaPerfil } from '../licitaciones/catalogo-etiquetas';
import { evaluarRelevanciaCapacidades, type FuenteParaRelevancia } from './relevancia-capacidades';

// Casos controlados, no una certificación de precisión sobre licitaciones reales.
const casos: Array<[string, string, number]> = [
  ['Desarrollo de software', 'Desarrollo de software municipal', 100],
  ['Desarrollo de software', 'Software a medida para atención ciudadana', 100],
  ['software a medida', 'Desarrollo de sistemas municipales', 100],
  ['Ciberseguridad', 'Auditoría de seguridad informática', 100],
  ['seguridad informática', 'Servicio de ciberseguridad institucional', 100],
  ['Ciberseguridad', 'Gestión de seguridad de la información', 100],
  ['Desarrollo web', 'Desarrollo de aplicaciones web', 100],
  ['desarrollo de aplicaciones web', 'Desarrollo de portales web', 100],
  ['Consultoría TI', 'Consultoría informática especializada', 100],
  ['asesoría informática', 'Contratación de consultoría tecnológica', 100],
  ['Soporte técnico', 'Asistencia informática a usuarios', 100],
  ['soporte informático', 'Soporte computacional institucional', 100],
  ['Cloud computing', 'Servicios cloud para el municipio', 100],
  ['computación en la nube', 'Cloud computing para educación', 100],
  ['Analítica de datos', 'Análisis de datos de atención ciudadana', 100],
  ['análisis de datos', 'Analítica de datos institucionales', 100],
  ['Infraestructura tecnológica', 'Infraestructura informática de la institución', 100],
  ['infraestructura de TI', 'Infraestructura tecnológica institucional', 100],
  ['Redes y telecomunicaciones', 'Redes informáticas para escuelas', 100],
  ['Mantención preventiva', 'Mantenimiento preventivo de equipos', 100],
  ['Desarrollo de software', 'Renovación de licencias Microsoft Office', 0],
  ['Ciberseguridad', 'Servicio de guardias de seguridad para piscina municipal', 0],
  ['Ciberseguridad', 'Compra de elementos de protección personal', 0],
  ['Cloud computing', 'Suministro de almohadas y ropa de cama', 0],
  ['React', 'Reactivos para laboratorio clínico', 0],
  ['API', 'Capital provincial y desarrollo comunitario', 0],
  ['SQL', 'Suministro de plataforma NoSQL', 0],
  ['redes', 'Administración de redes sociales', 0],
  ['redes', 'Mantenimiento de redes de agua potable', 0],
  ['soporte', 'Adquisición de soporte metálico', 0],
  ['Desarrollo web', 'Mantención de jardines municipales', 0],
  ['Analítica de datos', 'Compra de papel y archivadores', 0],
  ['seguridad', 'Seguridad para recinto municipal', 35],
  ['tecnología', 'Tecnología para la institución', 35],
  ['servicios', 'Servicios para la comunidad', 35],
  ['software', 'Renovación de software institucional', 55],
  ['salud', 'Departamento de salud comunal', 55],
  ['mantención', 'Mantención de computadores', 55],
  ['desarrollo', 'Programa de desarrollo comunal', 35],
  ['insumos', 'Insumos para oficinas', 35],
  ['Desarrollo de software', 'No incluye desarrollo de software', 0],
  ['Desarrollo de software', 'Sin desarrollo de software', 0],
  ['Desarrollo de software', 'Excepto desarrollo de software', 0],
  ['Desarrollo de software', 'No se requiere desarrollo de software', 0],
  ['Desarrollo de software', 'Sin desarrollo de software previo. Se solicita desarrollo de software nuevo.', 100],
  ['Ciberseguridad', 'No incluye seguridad informática', 0],
  ['Desarrollo de software', 'Desarrollo de software y software a medida', 100],
  ['Ciberseguridad', 'CIBERSEGURIDAD Y SEGURIDAD INFORMÁTICA', 100],
  ['API', 'Integración mediante API REST', 100],
  ['React', 'Desarrollo de interfaz en React', 100],
];

describe('50 casos controlados del match local', () => {
  it.each(casos)('perfil %s frente a %s: evidencia %s', (termino, nombre, esperado) => {
    expect(evaluarRelevanciaCapacidades([termino], expandirEtiquetaPerfil, { nombre }).porcentaje).toBe(esperado);
  });
  it('no penaliza otra línea de negocio y no cuenta dos veces un concepto equivalente', () => {
    const fuente = { nombre: 'Desarrollo de sistemas' };
    const a = evaluarRelevanciaCapacidades(['Desarrollo de software'], expandirEtiquetaPerfil, fuente);
    const b = evaluarRelevanciaCapacidades(['Desarrollo de software', 'software a medida', 'Jardinería'], expandirEtiquetaPerfil, fuente);
    expect(b.porcentaje).toBe(a.porcentaje); expect(b.evidencias).toHaveLength(1);
  });
  it.each([
    [{ descripcion: 'Se requiere desarrollo de software' }, 25, 'descripcion'],
    [{ items: [{ descripcion: 'Desarrollo de software' }] }, 75, 'item_descripcion'],
    [{ items: [{ nombreProducto: 'Software a medida' }] }, 100, 'item_producto'],
    [{ items: [{ categoria: 'Servicios / Desarrollo de software' }] }, 90, 'item_categoria'],
  ] as const)('conserva la fuerza y el origen de la evidencia: %j', (fuente, esperado, campo) => {
    const r = evaluarRelevanciaCapacidades(['Desarrollo de software'], expandirEtiquetaPerfil, fuente as FuenteParaRelevancia);
    expect(r.porcentaje).toBe(esperado); expect(r.evidencias[0].campo).toBe(campo);
  });
  it('una ficha sin información no obtiene puntuación ni evidencia', () => {
    expect(evaluarRelevanciaCapacidades(['Ciberseguridad'], expandirEtiquetaPerfil, {}))
      .toEqual({ porcentaje: 0, coincidencias: [], evidencias: [] });
  });
  it('muchas repeticiones no elevan el límite de una palabra genérica', () => {
    expect(evaluarRelevanciaCapacidades(['seguridad'], expandirEtiquetaPerfil,
      { nombre: 'Seguridad '.repeat(100) }).porcentaje).toBe(35);
  });
  it('ítems repetidos mantienen la misma evidencia, sin sumar ni cambiar el campo ganador', () => {
    const item = { nombreProducto: 'Software a medida', descripcion: 'Desarrollo de software', categoria: 'Desarrollo de sistemas' };
    const uno = evaluarRelevanciaCapacidades(['Desarrollo de software'], expandirEtiquetaPerfil, { items: [item] });
    const muchos = evaluarRelevanciaCapacidades(['Desarrollo de software'], expandirEtiquetaPerfil, { items: Array(100).fill(item) });
    expect(muchos).toEqual(uno); expect(muchos.evidencias[0].campo).toBe('item_producto');
  });
});
