import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFERTAS_NEXUS, catalogoNexusPublico } from './catalogo-nexus';
import { prepararNexus, type FuenteNexus } from './evaluador-nexus';
import { guardarEtiquetasCapacidadesSchema } from '../onboarding/dto/guardar-etiquetas-capacidades.dto';

const psicologia = prepararNexus(['salud.psicologia']);
const mental = prepararNexus(['salud.psicologia', 'salud.psiquiatria']);
const completa = (nombre: string, items: FuenteNexus['items'] = []): FuenteNexus => ({ nombre, items, detalleCompleto: true });
afterEach(() => vi.unstubAllEnvs());

describe('NEXUS reducido: objeto solicitado y oferta específica', () => {
  it.each([
    'CONTRATACIÓN DEL SERVICIO DE MANTENCIÓN PREVENTIVA CORRECTIVA Y REPUESTOS PARA EL PARQUE VEHICULAR DE CARGO DE LA RED DE SALUD',
    'ADQUISICIÓN DE SERVICIOS DE DESRATIZACIÓN Y LIMPIA FOSAS EN CENTROS DE SALUD COMUNAL',
    'CONSTRUC FACULTAD MEDICINA UNIVERSIDAD DE ATACAMA',
    'CONST. CENTRO MÉDICO DENTAL DE LA XII ZONA DE CARABINEROS',
    'Insumos deportivos para programa Más Salud en comunidad',
    'ADQUISICIÓN DE MOBILIARIO PARA CENTROS DE SALUD',
    'SERVICIO INTEGRAL DE CONECTIVIDAD Y COMUNICACIONES PARA CENTROS DE SALUD',
    'SERVICIO DE GUARDIAS DE SEGURIDAD PARA HOSPITAL',
  ])('no recomienda por contexto sanitario: %s', titulo => {
    expect(mental(completa(titulo)).porcentaje).toBe(0);
  });
  it('rechaza la referencia a psiquiatría en un puesto de guardia', () => {
    const r = mental(completa('CONVENIO DE SERVICIOS DE VIGILANCIA Y SEGURIDAD', [
      { descripcion: '15 cubrir un puesto de guardia para psiquiatria de lunes a viernes de 07 a 17 horas' },
    ]));
    expect(r.porcentaje).toBe(0); expect(r.ofertas).toEqual([]);
  });
  it('reconoce una prestación psicológica por el objeto del ítem', () => {
    const r = psicologia(completa('Servicio profesional HC 2027', [
      { correlativo: 2, nombreProducto: 'SERVICIO DE PSICOLOGÍA', descripcion: 'Atención psicológica para usuarios del hospital' },
    ]));
    expect(r.estado).toBe('coincidencia'); expect(r.porcentaje).toBe(100);
    expect(r.ofertas[0]).toMatchObject({ ofertaId: 'salud.psicologia', correlativo: 2, campo: 'item_producto' });
    expect(r.ofertas[0].explicacion).toContain('Atención psicológica');
  });
  it('reconoce la consulta de telepsicología de la ficha real 2332-46-LP26', () => {
    const r = psicologia(completa('CS SERVICIO DE TELEPSICOLOGIA', [
      { correlativo: 1, nombreProducto: 'Consultas de médicos de atención primaria',
        codigoCategoria: '85121500', descripcion: 'CONSULTA DE TELEPSICOLOGIA' },
    ]));
    expect(r.estado).toBe('coincidencia'); expect(r.porcentaje).toBe(80);
    expect(r.ofertas).toHaveLength(1);
    expect(r.ofertas[0]).toMatchObject({ ofertaId: 'salud.psicologia', campo: 'item_descripcion',
      expresion: 'telepsicologia', calidad: 80, correlativo: 1 });
  });
  it.each([
    'Puesto de guardia para telepsicología',
    'Servicio de capacitación en telepsicología',
    'Software para telepsicología',
    'Material didáctico para telepsicología',
    'No incluye telepsicología',
  ])('la modalidad remota no convierte otros objetos en atención psicológica: %s', descripcion => {
    const r = psicologia(completa('Compra general', [{ descripcion }]));
    expect(r.estado).not.toBe('coincidencia'); expect(r.porcentaje).toBe(0);
  });
  it('telepsicología no activa psiquiatría ni lentes si no se eligió atención psicológica', () => {
    const r = prepararNexus(['salud.psiquiatria', 'salud.lentes'])(completa('Servicio profesional', [
      { descripcion: 'Consulta de telepsicología' },
    ]));
    expect(r.estado).toBe('sin_coincidencia'); expect(r.ofertas).toEqual([]);
  });
  it.each([
    completa('Adquisición de Sets de Sistemas de Contención de Pacientes para La Unidad de Hospitalización de Cuidados Intensivos de Psiquiatría Infanto Adolescente Hospital Base Valdivia', [
      { nombreProducto: 'Dispositivos de estabilización o prevención de caídas para pacientes o accesorios',
        codigoCategoria: '42143600', descripcion: 'Set de sistemas de contención de pacientes' },
    ]),
    completa('Adquisición de insumos materiales y equipamiento terapéutico para la atención de usuarios con TEA del servicio de psiquiatría', [
      { nombreProducto: 'Juguetes didácticos', codigoCategoria: '60141000',
        descripcion: 'Adquisición de insumos materiales y equipamiento terapéutico para la atención de usuarios con trastorno del espectro autista TEA' },
    ]),
  ])('los bienes destinados a psiquiatría no acreditan una consulta clínica: $nombre', fuente => {
    const r = mental(fuente);
    expect(r.estado).not.toBe('coincidencia'); expect(r.porcentaje).toBe(0);
  });
  it('el título es provisional cuando la ficha completa no permite identificar sus ítems', () => {
    const r = psicologia(completa('SERVICIO DE PSICOLOGIA HC 2027'));
    expect(r.estado).toBe('coincidencia'); expect(r.porcentaje).toBe(65);
    expect(r.ofertas[0].explicacion).toContain('provisional');
  });
  it('una ficha sin completar queda pendiente y no recibe porcentaje alto', () => {
    const r = psicologia({ nombre: 'SERVICIO DE PSICOLOGIA', detalleCompleto: false });
    expect(r.estado).toBe('pendiente'); expect(r.porcentaje).toBe(0);
  });
  it('no convierte la falta de información en una incompatibilidad demostrada', () => {
    expect(psicologia(completa('Proceso de compra', [{ nombreProducto: 'Servicio por definir' }])).estado).toBe('pendiente');
  });
  it('no habilita automáticamente especialidades hermanas', () => {
    expect(psicologia(completa('Consultas de psiquiatría', [{ nombreProducto: 'Atención psiquiátrica' }])).porcentaje).toBe(0);
  });
  it('vender medicamentos no se deduce de ofrecer consultas psiquiátricas', () => {
    const f = completa('Medicamentos', [{ nombreProducto: 'Paracetamol 500 mg' }]);
    expect(mental(f).porcentaje).toBe(0);
    expect(prepararNexus(['salud.paracetamol'])(f).estado).toBe('coincidencia');
  });
  it('distingue productos dentro de una misma familia', () => {
    expect(prepararNexus(['salud.paracetamol'])(completa('Medicamentos', [{ nombreProducto: 'Ibuprofeno' }])).porcentaje).toBe(0);
  });
  it('usa un código específico verificado cuando el objeto no es explícito', () => {
    const r = psicologia(completa('Prestaciones', [{ nombreProducto: 'Servicios profesionales', codigoCategoria: '85121608' }]));
    expect(r.porcentaje).toBe(90); expect(r.ofertas[0].campo).toBe('item_categoria');
  });
  it('un código de psicología no sustituye un objeto explícito de seguridad', () => {
    const r = psicologia(completa('Hospital', [{ nombreProducto: 'Guardias de seguridad', codigoCategoria: '85121608' }]));
    expect(r.porcentaje).toBe(0);
  });
  it('no usa prefijos de códigos ni categorías superiores como equivalencia', () => {
    expect(psicologia(completa('Compra general', [{ nombreProducto: 'Servicios', codigoCategoria: '8512', categoria: 'Salud / Servicios sanitarios' }])).porcentaje).toBe(0);
  });
  it('un nombre clínico con descripción de capacitación queda pendiente de revisión', () => {
    const r = psicologia(completa('Prestaciones', [{ nombreProducto: 'Servicios de psicologia',
      descripcion: 'Capacitacion en prevencion para funcionarios', codigoCategoria: '85121608' }]));
    expect(r.estado).toBe('pendiente'); expect(r.porcentaje).toBe(0);
  });
  it('un código no anula una exclusión explícita del servicio', () => {
    const r = psicologia(completa('Servicios', [{ nombreProducto: 'No incluye psicologia', codigoCategoria: '85121608' }]));
    expect(r.estado).toBe('pendiente'); expect(r.porcentaje).toBe(0);
  });
  it('las palabras clave refinan únicamente un ítem que ya coincide', () => {
    const evaluar = prepararNexus(['tecnologia.desarrollo-software'], ['React', 'guardias']);
    const r = evaluar(completa('Plataforma', [{ nombreProducto: 'Software a medida en React' }]));
    expect(r.estado).toBe('coincidencia'); expect(r.palabrasClaveCoincidentes).toEqual(['react']);
  });
  it('ignora una palabra clave de TI que intentaría abrir otro rubro', () => {
    const r = prepararNexus(['salud.psicologia'], ['software', 'informatica'])(completa('Desarrollo de software', [{ nombreProducto: 'Desarrollo de software' }]));
    expect(r.porcentaje).toBe(0); expect(r.palabrasClaveCoincidentes).toEqual([]);
  });
  it('no eleva el porcentaje por repetir un ítem o añadir alternativas', () => {
    const item = { nombreProducto: 'Atención psicológica', correlativo: 1 };
    const a = psicologia(completa('Servicios', [item]));
    const b = prepararNexus(['salud.psicologia', 'salud.psicologia', 'salud.paracetamol'])(completa('Servicios', Array(30).fill(item)));
    expect(b.porcentaje).toBe(a.porcentaje); expect(b.ofertas).toHaveLength(1);
  });
  it('conserva coincidencias por lote sin exigir que la empresa cubra todos los ítems', () => {
    const r = psicologia(completa('Servicios de salud', [{ nombreProducto: 'Lentes ópticos', correlativo: 1 },
      { nombreProducto: 'Atención psicológica', correlativo: 2 }]));
    expect(r.estado).toBe('coincidencia'); expect(r.ofertas[0].correlativo).toBe(2);
  });
  it('evalúa los demás rubros con el mismo motor', () => {
    const r = prepararNexus(['tecnologia.desarrollo-software'])(completa('Plataforma municipal', [{ nombreProducto: 'Software a medida para hospital' }]));
    expect(r.estado).toBe('coincidencia'); expect(r.ofertas[0].ofertaId).toBe('tecnologia.desarrollo-software');
  });
  it('respeta negaciones y límites de palabra', () => {
    expect(psicologia(completa('Compra general', [{ nombreProducto: 'No incluye psicologia' }])).porcentaje).toBe(0);
    expect(prepararNexus(['salud.paracetamol'])(completa('Compra', [{ nombreProducto: 'Antiparacetamol' }])).porcentaje).toBe(0);
  });
  it('requiere una selección explícita y no infiere todas las ramas de Salud', () => {
    expect(prepararNexus([])(completa('Psicologia')).estado).toBe('sin_configurar');
    expect(prepararNexus(['Salud'])(completa('Psicologia')).porcentaje).toBe(0);
  });
});

describe('Catálogo y guardado NEXUS', () => {
  it('ofrece identificadores únicos, rutas completas y sólo hojas seleccionables', () => {
    expect(new Set(OFERTAS_NEXUS.map(o => o.id)).size).toBe(OFERTAS_NEXUS.length);
    expect(OFERTAS_NEXUS.every(o => o.rubro && o.linea && o.especialidad && o.nombre)).toBe(true);
    expect(OFERTAS_NEXUS.some(o => o.id === 'salud')).toBe(false);
    expect(new Set(OFERTAS_NEXUS.map(o => o.rubro)).size).toBeGreaterThan(10);
  });
  it('rechaza padres, IDs inexistentes y el contrato antiguo con la opción activa', () => {
    vi.stubEnv('NEXUS_REDUCIDO_HABILITADO','true');
    expect(guardarEtiquetasCapacidadesSchema.safeParse({ etiquetasCapacidades: ['Salud'] }).success).toBe(false);
    expect(guardarEtiquetasCapacidadesSchema.safeParse({ etiquetasCapacidades: ['Salud'], ofertasIds: ['salud'] }).success).toBe(false);
    expect(guardarEtiquetasCapacidadesSchema.parse({ etiquetasCapacidades: ['Atención psicológica'], ofertasIds: ['salud.psicologia','salud.psicologia'] }).ofertasIds).toEqual(['salud.psicologia']);
    expect(catalogoNexusPublico().habilitado).toBe(true);
  });
});
