export interface RegistroAnalisisEtiquetas {
  codigoExterno: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  categorias: string[];
  nombresItems: string[];
  descripcionesItems: string[];
}

export interface CandidatoEtiqueta {
  texto: string;
  licitaciones: number;
  porcentaje: number;
  aparicionesEnTitulos: number;
}

export interface CategoriaDetectada {
  nombre: string;
  licitaciones: number;
}

export interface ResultadoAnalisisEtiquetas {
  generadoEn: string;
  resumen: {
    licitacionesAnalizadas: number;
    conDescripcion: number;
    conItems: number;
    coberturaDetallePorcentaje: number;
    frecuenciaMinima: number;
  };
  palabrasCandidatas: CandidatoEtiqueta[];
  frasesCandidatas: CandidatoEtiqueta[];
  categoriasMercadoPublico: CategoriaDetectada[];
  tiposLicitacion: CategoriaDetectada[];
}

const PALABRAS_EXCLUIDAS = new Set([
  'a',
  'al',
  'ante',
  'bajo',
  'con',
  'contra',
  'de',
  'del',
  'desde',
  'durante',
  'e',
  'el',
  'ella',
  'en',
  'entre',
  'es',
  'esta',
  'este',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'que',
  'se',
  'segun',
  'sin',
  'sobre',
  'su',
  'sus',
  'un',
  'una',
  'unas',
  'uno',
  'unos',
  'y',
  'adquisicion',
  'adquirir',
  'compra',
  'compras',
  'contratacion',
  'contratar',
  'licitacion',
  'licitaciones',
  'publica',
  'publico',
  'servicio',
  'servicios',
  'suministro',
  'suministros',
  'provision',
  'requerimiento',
  'requerimientos',
  'solicitud',
  'municipalidad',
  'municipal',
  'programa',
  'proyecto',
  'convenio',
  'marco',
  'contrato',
  'periodo',
  'ano',
  'anos',
  'mes',
  'meses',
]);

interface ContadorCandidato {
  licitaciones: number;
  aparicionesEnTitulos: number;
}

export function analizarEtiquetas(
  registros: RegistroAnalisisEtiquetas[],
  maximoResultados = 150,
): ResultadoAnalisisEtiquetas {
  const palabras = new Map<string, ContadorCandidato>();
  const frases = new Map<string, ContadorCandidato>();
  const categorias = new Map<string, number>();
  const tipos = new Map<string, number>();
  let conDescripcion = 0;
  let conItems = 0;

  for (const registro of registros) {
    if (registro.descripcion?.trim()) conDescripcion += 1;
    if (registro.nombresItems.length > 0) conItems += 1;

    const tokensTitulo = tokenizar(registro.nombre);
    const textoCompleto = [
      registro.nombre,
      registro.descripcion ?? '',
      ...registro.categorias,
      ...registro.nombresItems,
      ...registro.descripcionesItems,
    ].join(' ');
    const tokensDocumento = tokenizar(textoCompleto);

    incrementarCandidatos(
      palabras,
      new Set(tokensDocumento),
      new Set(tokensTitulo),
    );

    const frasesTitulo = new Set([
      ...crearNGramas(tokensTitulo, 2),
      ...crearNGramas(tokensTitulo, 3),
    ]);
    const frasesDocumento = new Set([
      ...frasesTitulo,
      ...registro.nombresItems.flatMap((nombre) => {
        const tokens = tokenizar(nombre);
        return [...crearNGramas(tokens, 2), ...crearNGramas(tokens, 3)];
      }),
    ]);

    incrementarCandidatos(frases, frasesDocumento, frasesTitulo);

    for (const categoria of new Set(
      registro.categorias.map(normalizarTexto).filter(Boolean),
    )) {
      categorias.set(categoria, (categorias.get(categoria) ?? 0) + 1);
    }

    const tipo = normalizarTexto(registro.tipo ?? 'sin tipo');
    tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
  }

  const total = registros.length;
  const frecuenciaMinima = Math.max(3, Math.ceil(total * 0.0005));

  return {
    generadoEn: new Date().toISOString(),
    resumen: {
      licitacionesAnalizadas: total,
      conDescripcion,
      conItems,
      coberturaDetallePorcentaje:
        total === 0 ? 0 : redondear((conItems / total) * 100),
      frecuenciaMinima,
    },
    palabrasCandidatas: convertirCandidatos(
      palabras,
      total,
      frecuenciaMinima,
      maximoResultados,
    ),
    frasesCandidatas: convertirCandidatos(
      frases,
      total,
      frecuenciaMinima,
      maximoResultados,
    ),
    categoriasMercadoPublico: convertirCategorias(categorias, maximoResultados),
    tiposLicitacion: convertirCategorias(tipos, maximoResultados),
  };
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter(
      (palabra) =>
        palabra.length >= 3 &&
        !PALABRAS_EXCLUIDAS.has(palabra) &&
        !/^\d+$/.test(palabra),
    );
}

function crearNGramas(tokens: string[], tamanio: number): string[] {
  const frases: string[] = [];

  for (let indice = 0; indice <= tokens.length - tamanio; indice += 1) {
    frases.push(tokens.slice(indice, indice + tamanio).join(' '));
  }

  return frases;
}

function incrementarCandidatos(
  contador: Map<string, ContadorCandidato>,
  candidatosDocumento: Set<string>,
  candidatosTitulo: Set<string>,
): void {
  for (const candidato of candidatosDocumento) {
    const actual = contador.get(candidato) ?? {
      licitaciones: 0,
      aparicionesEnTitulos: 0,
    };

    actual.licitaciones += 1;
    if (candidatosTitulo.has(candidato)) actual.aparicionesEnTitulos += 1;
    contador.set(candidato, actual);
  }
}

function convertirCandidatos(
  contador: Map<string, ContadorCandidato>,
  total: number,
  frecuenciaMinima: number,
  limite: number,
): CandidatoEtiqueta[] {
  return [...contador.entries()]
    .filter(([, valor]) => valor.licitaciones >= frecuenciaMinima)
    .sort(
      ([textoA, valorA], [textoB, valorB]) =>
        valorB.licitaciones - valorA.licitaciones ||
        valorB.aparicionesEnTitulos - valorA.aparicionesEnTitulos ||
        textoA.localeCompare(textoB, 'es'),
    )
    .slice(0, limite)
    .map(([texto, valor]) => ({
      texto,
      licitaciones: valor.licitaciones,
      porcentaje:
        total === 0 ? 0 : redondear((valor.licitaciones / total) * 100),
      aparicionesEnTitulos: valor.aparicionesEnTitulos,
    }));
}

function convertirCategorias(
  contador: Map<string, number>,
  limite: number,
): CategoriaDetectada[] {
  return [...contador.entries()]
    .sort(
      ([nombreA, cantidadA], [nombreB, cantidadB]) =>
        cantidadB - cantidadA || nombreA.localeCompare(nombreB, 'es'),
    )
    .slice(0, limite)
    .map(([nombre, licitaciones]) => ({ nombre, licitaciones }));
}

function redondear(valor: number): number {
  return Number(valor.toFixed(2));
}
