export interface EtiquetaCatalogo {
  id: string;
  nombre: string;
  sinonimos: string[];
}

export interface RubroCatalogo {
  id: string;
  nombre: string;
  sinonimos: string[];
  etiquetas: EtiquetaCatalogo[];
}

export interface FuenteClasificacionEtiquetas {
  nombre: string;
  descripcion?: string | null;
  categorias?: string[];
  nombresItems?: string[];
  descripcionesItems?: string[];
}

export interface ClasificacionEtiquetas {
  rubros: string[];
  etiquetas: string[];
}

export const CATALOGO_ETIQUETAS: RubroCatalogo[] = [
  {
    id: 'construccion-infraestructura',
    nombre: 'Construcción e infraestructura',
    sinonimos: ['construccion', 'infraestructura', 'edificacion'],
    etiquetas: [
      etiqueta('obras-civiles', 'Obras civiles', ['obra civil']),
      etiqueta('obras-menores', 'Obras menores', ['obra menor']),
      etiqueta('pavimentacion', 'Pavimentación', ['pavimento', 'asfalto']),
      etiqueta('cierres-perimetrales', 'Cierres perimetrales', [
        'cierre perimetral',
      ]),
      etiqueta('restauracion', 'Restauración de infraestructura', [
        'restauracion de edificios',
        'reparacion de edificios',
      ]),
    ],
  },
  {
    id: 'mantenimiento-reparacion',
    nombre: 'Mantención y reparación',
    sinonimos: ['mantencion', 'mantenimiento', 'reparacion'],
    etiquetas: [
      etiqueta('mantencion-preventiva', 'Mantención preventiva', [
        'mantenimiento preventivo',
      ]),
      etiqueta('mantencion-correctiva', 'Mantención correctiva', [
        'mantenimiento correctivo',
        'mantencion reparativa',
        'mantenimiento reparativo',
      ]),
      etiqueta('mantencion-equipos', 'Mantención de equipos', [
        'mantenimiento de equipos',
        'reparacion de equipos',
      ]),
      etiqueta('climatizacion', 'Climatización y aire acondicionado', [
        'aire acondicionado',
        'climatizacion',
        'calefaccion',
      ]),
    ],
  },
  {
    id: 'salud',
    nombre: 'Salud y servicios sanitarios',
    sinonimos: ['salud', 'medicina', 'atencion medica', 'servicios sanitarios'],
    etiquetas: [
      etiqueta('especialidades-medicas', 'Especialidades médicas', [
        'especialidad medica',
        'prestaciones medicas',
      ]),
      etiqueta('salud-mental', 'Salud mental', ['psicologia', 'psiquiatria']),
      etiqueta('odontologia', 'Odontología', ['dental', 'odontologico']),
      etiqueta('optica', 'Óptica y lentes', ['lentes opticos', 'oftalmologia']),
    ],
  },
  {
    id: 'insumos-medicos',
    nombre: 'Insumos y equipamiento médico',
    sinonimos: ['insumos medicos', 'insumos clinicos', 'equipamiento medico'],
    etiquetas: [
      etiqueta('insumos-clinicos', 'Insumos clínicos', [
        'insumo medico',
        'suministros clinicos',
      ]),
      etiqueta('equipamiento-clinico', 'Equipamiento clínico', [
        'equipos medicos',
        'equipo medico',
      ]),
      etiqueta('productos-quirurgicos', 'Productos quirúrgicos', [
        'instrumental quirurgico',
        'insumos quirurgicos',
      ]),
      etiqueta('vestuario-clinico', 'Vestuario clínico', [
        'guantes medicos',
        'ropa clinica',
      ]),
    ],
  },
  {
    id: 'laboratorio',
    nombre: 'Laboratorio',
    sinonimos: ['laboratorio', 'laboratorio clinico'],
    etiquetas: [
      etiqueta('reactivos', 'Reactivos de laboratorio', ['reactivos clinicos']),
      etiqueta('equipos-laboratorio', 'Equipos de laboratorio', [
        'equipamiento de laboratorio',
        'analizadores clinicos',
      ]),
      etiqueta('insumos-laboratorio', 'Insumos de laboratorio', [
        'suministros de laboratorio',
      ]),
      etiqueta('examenes-laboratorio', 'Exámenes de laboratorio', [
        'ensayos de laboratorio',
      ]),
    ],
  },
  {
    id: 'tecnologia',
    nombre: 'Tecnología de la información',
    sinonimos: ['tecnologia de la informacion', 'informatica', 'computacion'],
    etiquetas: [
      etiqueta('desarrollo-software', 'Desarrollo de software', [
        'software a medida',
        'desarrollo de sistemas',
      ]),
      etiqueta('licencias-software', 'Licencias de software', [
        'licenciamiento',
        'renovacion de licencias',
      ]),
      etiqueta('equipos-computacionales', 'Equipos computacionales', [
        'computadores',
        'notebooks',
        'equipamiento informatico',
      ]),
      etiqueta('impresion', 'Impresión y arriendo de impresoras', [
        'impresoras',
        'arriendo impresoras',
      ]),
      etiqueta('redes-telecomunicaciones', 'Redes y telecomunicaciones', [
        'redes informaticas',
        'telecomunicaciones',
      ]),
      etiqueta('ciberseguridad', 'Ciberseguridad', [
        'seguridad informatica',
        'seguridad de la informacion',
      ]),
    ],
  },
  {
    id: 'seguridad',
    nombre: 'Seguridad y protección',
    sinonimos: ['seguridad', 'proteccion', 'vigilancia'],
    etiquetas: [
      etiqueta('guardias-seguridad', 'Guardias de seguridad', [
        'servicios de guardias',
      ]),
      etiqueta('televigilancia', 'Televigilancia', [
        'camaras de seguridad',
        'video vigilancia',
      ]),
      etiqueta('control-acceso', 'Control de acceso', ['control de accesos']),
      etiqueta('proteccion-personal', 'Elementos de protección personal', [
        'epp',
        'ropa protectora',
      ]),
      etiqueta('seguridad-vial', 'Seguridad vial', ['senalizacion vial']),
    ],
  },
  {
    id: 'transporte',
    nombre: 'Transporte y vehículos',
    sinonimos: ['transporte', 'vehiculos', 'automotriz'],
    etiquetas: [
      etiqueta('transporte-pasajeros', 'Transporte de pasajeros', [
        'traslado de pasajeros',
      ]),
      etiqueta('arriendo-vehiculos', 'Arriendo de vehículos', [
        'alquiler de vehiculos',
      ]),
      etiqueta('reparacion-vehiculos', 'Reparación de vehículos', [
        'mantencion de vehiculos',
        'mantenimiento vehicular',
      ]),
      etiqueta('repuestos-vehiculos', 'Repuestos para vehículos', [
        'repuestos automotrices',
      ]),
    ],
  },
  {
    id: 'limpieza-medioambiente',
    nombre: 'Limpieza y medioambiente',
    sinonimos: ['limpieza', 'aseo', 'medioambiente'],
    etiquetas: [
      etiqueta('aseo-dependencias', 'Aseo de dependencias', [
        'limpieza de edificios',
        'limpieza de oficinas',
      ]),
      etiqueta('desinfeccion', 'Desinfección', ['sanitizacion']),
      etiqueta('control-plagas', 'Control de plagas', [
        'fumigacion',
        'desratizacion',
      ]),
      etiqueta('gestion-residuos', 'Gestión de residuos', [
        'recoleccion de residuos',
        'eliminacion de desechos',
      ]),
    ],
  },
  {
    id: 'alimentacion',
    nombre: 'Alimentación',
    sinonimos: ['alimentacion', 'alimentos', 'comida'],
    etiquetas: [
      etiqueta('catering', 'Catering y banquetería', [
        'banquetes',
        'cocteleria',
      ]),
      etiqueta('comedores', 'Servicios de comedor', ['casino de alimentacion']),
      etiqueta('abarrotes', 'Alimentos y abarrotes', [
        'productos alimenticios',
      ]),
      etiqueta('bebidas', 'Bebidas', ['bebidas no alcoholicas']),
    ],
  },
  {
    id: 'educacion',
    nombre: 'Educación y capacitación',
    sinonimos: ['educacion', 'capacitacion', 'formacion'],
    etiquetas: [
      etiqueta('cursos-capacitacion', 'Cursos de capacitación', [
        'capacitacion de funcionarios',
      ]),
      etiqueta('servicios-educativos', 'Servicios educativos', [
        'educacion de adultos',
        'programas educativos',
      ]),
      etiqueta('material-educativo', 'Material educativo', [
        'material didactico',
      ]),
    ],
  },
  {
    id: 'consultoria',
    nombre: 'Consultoría y servicios profesionales',
    sinonimos: ['consultoria', 'asesoria', 'servicios profesionales'],
    etiquetas: [
      etiqueta('consultoria-gestion', 'Consultoría de gestión', [
        'asesoria en gestion',
        'gestion empresarial',
      ]),
      etiqueta('gestion-proyectos', 'Gestión de proyectos', [
        'administracion de proyectos',
      ]),
      etiqueta('estudios', 'Estudios y planificación', [
        'estudio de factibilidad',
        'planificacion',
      ]),
      etiqueta('marketing', 'Marketing y comunicaciones', [
        'comercializacion',
        'publicidad',
      ]),
    ],
  },
  {
    id: 'recursos-humanos',
    nombre: 'Recursos humanos',
    sinonimos: ['recursos humanos', 'gestion de personas'],
    etiquetas: [
      etiqueta('contratacion-personal', 'Contratación de personal', [
        'seleccion de personal',
      ]),
      etiqueta('personal-temporal', 'Personal temporal', [
        'servicios transitorios',
      ]),
      etiqueta('desarrollo-organizacional', 'Desarrollo organizacional', [
        'desarrollo de recursos humanos',
      ]),
    ],
  },
  {
    id: 'eventos-audiovisual',
    nombre: 'Eventos y producción audiovisual',
    sinonimos: ['produccion de eventos', 'eventos', 'audiovisual'],
    etiquetas: [
      etiqueta('produccion-eventos', 'Producción de eventos', [
        'produccion integral',
      ]),
      etiqueta('equipos-audiovisuales', 'Equipos audiovisuales', [
        'proyectores',
        'amplificacion',
      ]),
      etiqueta('fotografia-video', 'Fotografía y video', [
        'produccion audiovisual',
      ]),
    ],
  },
  {
    id: 'energia-electricidad',
    nombre: 'Energía y electricidad',
    sinonimos: ['energia', 'electricidad', 'sistema electrico'],
    etiquetas: [
      etiqueta('instalaciones-electricas', 'Instalaciones eléctricas', [
        'servicios electricos',
      ]),
      etiqueta('grupos-electrogenos', 'Grupos electrógenos', [
        'generadores electricos',
      ]),
      etiqueta('cables-baterias', 'Cables y baterías', [
        'cables electricos',
        'pilas',
      ]),
      etiqueta('eficiencia-energetica', 'Eficiencia energética', [
        'energia renovable',
      ]),
    ],
  },
  {
    id: 'mobiliario-oficina',
    nombre: 'Mobiliario y oficina',
    sinonimos: ['mobiliario', 'muebles', 'oficina'],
    etiquetas: [
      etiqueta('muebles-oficina', 'Muebles de oficina', [
        'escritorios',
        'sillas de oficina',
      ]),
      etiqueta('articulos-oficina', 'Artículos de oficina', [
        'utiles de escritorio',
      ]),
      etiqueta('papeleria', 'Papelería', ['productos de papel']),
    ],
  },
  {
    id: 'maquinaria-herramientas',
    nombre: 'Maquinaria y herramientas',
    sinonimos: ['maquinaria', 'herramientas', 'equipos industriales'],
    etiquetas: [
      etiqueta('maquinaria-pesada', 'Maquinaria pesada', [
        'maquinaria de construccion',
      ]),
      etiqueta('herramientas-manuales', 'Herramientas manuales', [
        'juegos de herramientas',
      ]),
      etiqueta('equipos-industriales', 'Equipos industriales', [
        'equipos de fabricacion',
      ]),
    ],
  },
  {
    id: 'agricultura-areas-verdes',
    nombre: 'Agricultura y áreas verdes',
    sinonimos: ['agricultura', 'areas verdes', 'jardineria', 'paisajismo'],
    etiquetas: [
      etiqueta('mantencion-areas-verdes', 'Mantención de áreas verdes', [
        'mantenimiento de areas verdes',
      ]),
      etiqueta('jardineria', 'Jardinería', ['herramientas de jardineria']),
      etiqueta('invernaderos', 'Invernaderos', ['equipo para invernadero']),
      etiqueta('riego', 'Sistemas de riego', ['riego tecnificado']),
    ],
  },
  {
    id: 'vestuario',
    nombre: 'Vestuario y textiles',
    sinonimos: ['vestuario', 'ropa', 'textiles'],
    etiquetas: [
      etiqueta('uniformes', 'Uniformes', ['ropa institucional']),
      etiqueta('ropa-trabajo', 'Ropa de trabajo', ['vestuario laboral']),
      etiqueta('calzado', 'Calzado', ['calzado de seguridad']),
    ],
  },
  {
    id: 'servicios-financieros',
    nombre: 'Seguros y servicios financieros',
    sinonimos: ['seguros', 'servicios financieros', 'finanzas'],
    etiquetas: [
      etiqueta('seguros-personas', 'Seguros de personas', [
        'seguro de vida',
        'seguro de salud',
        'seguro de accidentes',
      ]),
      etiqueta('seguros-bienes', 'Seguros de bienes', [
        'seguro de vehiculos',
        'seguro de incendio',
      ]),
      etiqueta('servicios-bancarios', 'Servicios bancarios', [
        'productos bancarios',
      ]),
    ],
  },
];

// El catalogo es inmutable. Se preparan los patrones una sola vez, no por cada
// item de cada licitacion. Orden y coincidencia por palabras completas intactos.
const patronesCatalogo = CATALOGO_ETIQUETAS.map((rubro) => ({
  nombre: rubro.nombre,
  patrones: unicosNormalizados([rubro.nombre, ...rubro.sinonimos]).map((v) => ` ${v} `),
  etiquetas: rubro.etiquetas.map((e) => ({
    nombre: e.nombre,
    patrones: unicosNormalizados([e.nombre, ...e.sinonimos]).map((v) => ` ${v} `),
  })),
}));
const expansionesPerfil = new Map<string, string[]>();
for (const rubro of CATALOGO_ETIQUETAS) {
  const registrar = (nombre: string, valores: string[]) => {
    const clave = normalizarTexto(nombre);
    if (!expansionesPerfil.has(clave)) expansionesPerfil.set(clave, unicosNormalizados(valores));
  };
  registrar(rubro.nombre, [rubro.nombre, ...rubro.sinonimos,
    ...rubro.etiquetas.flatMap((e) => [e.nombre, ...e.sinonimos])]);
  for (const e of rubro.etiquetas) registrar(e.nombre, [e.nombre, ...e.sinonimos]);
}

// Equivalencias internas del match. No cambian las opciones del formulario.
// La consulta de candidatas y el evaluador usan la misma expansión.
const equivalenciasMatch = [
  ['Desarrollo web', 'desarrollo de aplicaciones web', 'desarrollo de plataformas web', 'desarrollo de portales web'],
  ['Consultoría TI', 'consultoria informatica', 'consultoria tecnologica', 'asesoria informatica'],
  ['Soporte técnico', 'soporte informatico', 'asistencia informatica', 'soporte computacional'],
  ['Cloud computing', 'computacion en la nube', 'servicios cloud'],
  ['Analítica de datos', 'analisis de datos', 'analitica de datos'],
  ['Infraestructura tecnológica', 'infraestructura informatica', 'infraestructura de TI'],
];
const aliasMatch = new Map<string, Set<string>>();
for (const grupo of [
  ...CATALOGO_ETIQUETAS.flatMap((r) => [
    [r.nombre, ...r.sinonimos],
    ...r.etiquetas.map((e) => [e.nombre, ...e.sinonimos]),
  ]),
  ...equivalenciasMatch,
]) {
  const clave = normalizarTexto(grupo[0]);
  if (!expansionesPerfil.has(clave)) expansionesPerfil.set(clave, unicosNormalizados(grupo));
  for (const alias of unicosNormalizados(grupo)) {
    if (!aliasMatch.has(alias)) aliasMatch.set(alias, new Set());
    aliasMatch.get(alias)!.add(clave);
  }
}
// Un alias compartido por conceptos distintos queda literal, sin inferir el rubro.
for (const [alias, conceptos] of aliasMatch) {
  if (!expansionesPerfil.has(alias) && conceptos.size === 1) {
    expansionesPerfil.set(alias, expansionesPerfil.get([...conceptos][0])!);
  }
}

export function obtenerCatalogoPublico() {
  return CATALOGO_ETIQUETAS.map((rubro) => ({
    id: rubro.id,
    nombre: rubro.nombre,
    etiquetas: rubro.etiquetas.map(({ id, nombre }) => ({ id, nombre })),
  }));
}

export function clasificarEtiquetas(
  fuente: FuenteClasificacionEtiquetas,
): ClasificacionEtiquetas {
  const texto = ` ${normalizarTexto(
    [
      fuente.nombre,
      fuente.descripcion ?? '',
      ...(fuente.categorias ?? []),
      ...(fuente.nombresItems ?? []),
      ...(fuente.descripcionesItems ?? []),
    ].join(' '),
  )} `;
  const rubros = new Set<string>();
  const etiquetas = new Set<string>();

  for (const rubro of patronesCatalogo) {
    const coincideRubro = rubro.patrones.some((patron) => texto.includes(patron));
    let coincideEtiqueta = false;

    for (const etiquetaActual of rubro.etiquetas) {
      if (
        etiquetaActual.patrones.some((patron) => texto.includes(patron))
      ) {
        etiquetas.add(etiquetaActual.nombre);
        coincideEtiqueta = true;
      }
    }

    if (coincideRubro || coincideEtiqueta) rubros.add(rubro.nombre);
  }

  return { rubros: [...rubros], etiquetas: [...etiquetas] };
}

export function expandirEtiquetaPerfil(valor: string): string[] {
  const normalizado = normalizarTexto(valor);

  const expansion = expansionesPerfil.get(normalizado);
  return expansion ? [...expansion] : normalizado ? [normalizado] : [];
}

export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function etiqueta(
  id: string,
  nombre: string,
  sinonimos: string[],
): EtiquetaCatalogo {
  return { id, nombre, sinonimos };
}

function unicosNormalizados(valores: string[]): string[] {
  return [...new Set(valores.map(normalizarTexto).filter(Boolean))];
}
