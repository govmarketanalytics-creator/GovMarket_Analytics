import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import {
  CATALOGO_ETIQUETAS,
  clasificarEtiquetas,
  expandirEtiquetaPerfil,
  normalizarTexto,
} from '../licitaciones/catalogo-etiquetas';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { nexusHabilitado, VERSION_NEXUS, terminosDeOfertas, codigosDeOfertas } from '../nexus/catalogo-nexus';
import { prepararNexus } from '../nexus/evaluador-nexus';
import type { ConsultarOportunidadesDto } from './dto/consultar-oportunidades.dto';
import { mapearResumenVerificado, patronRegionDashboard, RESUMEN_DASHBOARD_SQL, type ResumenDashboardRaw } from './resumen-dashboard-verificado';
import { CacheConsultas, MedicionOportunidades } from './cache-consultas';
import { evaluarRelevanciaCapacidades, prepararRelevanciaCapacidades, type EvaluadorRelevanciaCapacidades } from './relevancia-capacidades';

type PerfilOportunidades = Awaited<
  ReturnType<PerfilesEmpresaService['obtener']>
>;

const PESO_PALABRAS_CLAVE = 40;
const PESO_CATEGORIAS = 30;
const PESO_REGION = 15;
const PESO_MONTO = 15;
const CODIGO_ESTADO_PUBLICADA = 5;
const CODIGO_LICITACION_PATTERN = /^\d+-\d+-[a-zA-Z0-9]+$/;
// La marca explicita distingue las simulaciones de publicaciones reales.
// No se filtra por palabras del nombre, por ejemplo "pruebas de laboratorio".
const EXCLUIR_LICITACIONES_DE_PRUEBA =
  "COALESCE(licitacion.datos_origen ->> 'esPrueba', 'false') <> 'true'";

@Injectable()
export class OportunidadesService {
  private recomendacionesCache = new CacheConsultas<Array<ReturnType<OportunidadesService['evaluarLicitacion']>>>(4);

  private filtrosCatalogoCache = new CacheConsultas<ReturnType<OportunidadesService['mapearFiltrosRaw']>>(4);

  constructor(
    @InjectRepository(Licitacion)
    private readonly licitacionesRepository: Repository<Licitacion>,
    private readonly perfilesEmpresaService: PerfilesEmpresaService,
    private readonly planesEmpresaService: PlanesEmpresaService,
  ) {}

  async listar(empresaId: string, filtros: ConsultarOportunidadesDto, tiempos = new MedicionOportunidades()) {
    const esBusquedaGeneral = filtros.alcance === 'todas';
    const perfil = await tiempos.medir('perfil', async () => esBusquedaGeneral
      ? await this.obtenerPerfilOpcional(empresaId)
      : await this.obtenerPerfilValido(empresaId));

    if (esBusquedaGeneral && filtros.orden !== 'compatibilidad_desc') {
      return this.listarBusquedaGeneralPaginada(filtros, perfil, tiempos);
    }

    if (!esBusquedaGeneral && perfil && filtros.puntajeMinimo > 0) {
      return this.listarRecomendadasOptimizadas(empresaId, filtros, perfil, tiempos);
    }

    const query = this.crearConsultaBase(!esBusquedaGeneral);

    this.aplicarFiltros(query, filtros);

    const licitaciones = await tiempos.medir('sql', () => query.getMany());
    const oportunidades = await tiempos.medir('matching', async () => (await this.evaluarLote(licitaciones, perfil))
      .filter(
        (oportunidad) =>
          esBusquedaGeneral ||
          oportunidad.porcentajeCompatibilidad >= filtros.puntajeMinimo,
      ));

    this.ordenarOportunidades(oportunidades, filtros.orden);

    const total = oportunidades.length;
    const inicio = (filtros.pagina - 1) * filtros.limite;

    return {
      datos: oportunidades.slice(inicio, inicio + filtros.limite),
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
      resumen: this.construirResumen(oportunidades),
      filtrosDisponibles: filtros.incluirFiltros === false ? this.mapearFiltrosRaw() : this.construirFiltrosDisponibles(licitaciones),
      alcance: filtros.alcance,
      perfil: perfil
        ? {
            ...this.contextoNexus(perfil),
            id: perfil.id,
            palabrasClave: perfil.palabrasClave,
            etiquetasCapacidades: perfil.etiquetasCapacidades,
            codigosCategoria: perfil.codigosCategoria,
            regiones: perfil.regiones,
            montoMinimo: perfil.montoMinimo,
            montoMaximo: perfil.montoMaximo,
            incluirSinMonto: perfil.incluirSinMonto,
            tiposOportunidad: perfil.tiposOportunidad,
          }
        : null,
    };
  }

  async obtenerResumenDashboard(empresaId: string) {
    const [[raw], perfil, premium] = await Promise.all([
      this.licitacionesRepository.query<ResumenDashboardRaw[]>(
        RESUMEN_DASHBOARD_SQL, [CODIGO_ESTADO_PUBLICADA],
      ),
      this.obtenerPerfilOpcional(empresaId),
      this.planesEmpresaService.esPremiumVigente(empresaId),
    ]);
    return mapearResumenVerificado(raw, premium, [
      ...(perfil?.etiquetasCapacidades ?? []),
      ...(perfil?.palabrasClave ?? []),
    ]);
  }

  private async listarRecomendadasOptimizadas(
    empresaId: string,
    filtros: ConsultarOportunidadesDto,
    perfil: PerfilOportunidades,
    tiempos: MedicionOportunidades,
  ) {
    const revision = await tiempos.medir('revision', () => this.obtenerRevisionCatalogo());
    const cargar = async () => {
      if (nexusHabilitado() && !perfil.ofertasIds?.length) return [];
      const consultaCandidatas = this.crearConsultaCandidatas(filtros, perfil);
      const filasCandidatas = await tiempos.medir('candidatas', () => consultaCandidatas.getRawMany<{
        id: string;
      }>());
      const ids = filasCandidatas.map((fila) => fila.id);
      const licitaciones = await tiempos.medir('fichas', () => this.cargarLicitacionesPorIds(ids));

      const oportunidades = await tiempos.medir('matching', async () => (await this.evaluarLote(licitaciones, perfil))
        .filter(
          (oportunidad) =>
            oportunidad.porcentajeCompatibilidad >= filtros.puntajeMinimo,
        ));
      this.ordenarOportunidades(oportunidades, filtros.orden);
      return oportunidades;
    };
    // Identidad de empresa, criterios completos, version del catalogo y limite
    // temporal. No se reutiliza una autorizacion ni se recortan candidatas.
    const claveCache = JSON.stringify([empresaId, revision?.clave, this.crearClaveRecomendaciones(filtros, perfil)]);
    const oportunidades = revision ? await this.recomendacionesCache.obtener(
      claveCache, revision.vence, cargar, (v) => v.length,
    ) : await cargar();

    const total = oportunidades.length;
    const inicio = (filtros.pagina - 1) * filtros.limite;
    const filtrosDisponibles = filtros.incluirFiltros === false ? this.mapearFiltrosRaw() :
      await tiempos.medir('filtros', () => this.obtenerFiltrosCatalogo(filtros.soloVigentes));

    return {
      datos: oportunidades.slice(inicio, inicio + filtros.limite),
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
      resumen: this.construirResumen(oportunidades),
      filtrosDisponibles,
      alcance: filtros.alcance,
      perfil: {
        ...this.contextoNexus(perfil),
        id: perfil.id,
        palabrasClave: perfil.palabrasClave,
        etiquetasCapacidades: perfil.etiquetasCapacidades,
        codigosCategoria: perfil.codigosCategoria,
        regiones: perfil.regiones,
        montoMinimo: perfil.montoMinimo,
        montoMaximo: perfil.montoMaximo,
        incluirSinMonto: perfil.incluirSinMonto,
        tiposOportunidad: perfil.tiposOportunidad,
      },
    };
  }

  private async listarBusquedaGeneralPaginada(
    filtros: ConsultarOportunidadesDto,
    perfil: PerfilOportunidades | null,
    tiempos: MedicionOportunidades,
  ) {
    const consultaIds = this.crearConsultaIds(filtros);
    this.aplicarFiltros(consultaIds, filtros);

    const consultaConteo = consultaIds.clone();
    this.aplicarOrdenSql(consultaIds, filtros.orden);

    const inicio = (filtros.pagina - 1) * filtros.limite;
    const [total, filasPagina, filtrosDisponibles] = await Promise.all([
      tiempos.medir('conteo', () => consultaConteo.getCount()),
      tiempos.medir('pagina', () => consultaIds
        .offset(inicio)
        .limit(filtros.limite)
        .getRawMany<{ id: string }>()),
      filtros.incluirFiltros === false ? this.mapearFiltrosRaw() :
        tiempos.medir('filtros', () => this.obtenerFiltrosCatalogo(filtros.soloVigentes)),
    ]);
    const ids = filasPagina.map((fila) => fila.id);
    const licitaciones = await tiempos.medir('fichas', () => this.cargarLicitacionesPorIds(ids));
    const oportunidades = await tiempos.medir('matching', async () => licitaciones.map((licitacion) =>
      this.evaluarLicitacion(licitacion, perfil),
    ));
    const resumenPagina = this.construirResumen(oportunidades);

    return {
      datos: oportunidades,
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
      resumen: {
        ...resumenPagina,
        oportunidadesActivas: total,
      },
      filtrosDisponibles,
      alcance: filtros.alcance,
      perfil: perfil
        ? {
            ...this.contextoNexus(perfil),
            id: perfil.id,
            palabrasClave: perfil.palabrasClave,
            etiquetasCapacidades: perfil.etiquetasCapacidades,
            codigosCategoria: perfil.codigosCategoria,
            regiones: perfil.regiones,
            montoMinimo: perfil.montoMinimo,
            montoMaximo: perfil.montoMaximo,
            incluirSinMonto: perfil.incluirSinMonto,
            tiposOportunidad: perfil.tiposOportunidad,
          }
        : null,
    };
  }

  async obtenerDetalle(
    empresaId: string,
    codigoExterno: string,
    esSuperadministrador = false,
  ) {
    const codigoNormalizado = codigoExterno.trim().toUpperCase();

    if (!CODIGO_LICITACION_PATTERN.test(codigoNormalizado)) {
      throw new BadRequestException(
        'El código de licitación no tiene un formato válido',
      );
    }

    const [perfil, licitacion, premiumVigente] = await Promise.all([
      this.obtenerPerfilOpcional(empresaId),
      this.licitacionesRepository.findOne({
        where: { codigoExterno: codigoNormalizado },
        relations: { items: true },
        order: { items: { correlativo: 'ASC' } },
      }),
      esSuperadministrador
        ? Promise.resolve(true)
        : this.planesEmpresaService.esPremiumVigente(empresaId),
    ]);

    if (!licitacion) {
      throw new NotFoundException('La oportunidad solicitada no existe');
    }

    const oportunidad = this.evaluarLicitacion(licitacion, perfil);
    const fechasImportantes = this.extraerFechasImportantes(licitacion);
    const acceso = {
      completo: premiumVigente,
      planRequerido: premiumVigente ? null : 'premium',
      mensaje: premiumVigente
        ? null
        : 'Suscríbete a Premium para revisar requisitos, documentos, cronograma completo y recomendaciones.',
    };

    if (!premiumVigente) {
      return {
        ...oportunidad,
        descripcion:
          oportunidad.descripcion === null
            ? null
            : this.resumirTexto(oportunidad.descripcion, 240),
        fechasImportantes: fechasImportantes.filter((fecha) =>
          ['publicacion', 'cierre'].includes(fecha.id),
        ),
        items: [],
        documentos: [],
        informacionClave: {
          fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
          fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
          duracionContrato: null,
          modalidad: null,
          moneda: licitacion.moneda,
          region: licitacion.regionUnidad,
        },
        recomendaciones: [],
        acceso,
        urlMercadoPublico: null,
      };
    }

    return {
      ...oportunidad,
      items: (licitacion.items ?? []).map((item) => ({
        id: item.id,
        correlativo: item.correlativo,
        codigoProducto: item.codigoProducto,
        codigoCategoria: item.codigoCategoria,
        categoria: item.categoria,
        nombreProducto: item.nombreProducto,
        descripcion: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: item.cantidad === null ? null : Number(item.cantidad),
      })),
      fechasImportantes,
      documentos: this.extraerDocumentos(licitacion.datosOrigen),
      informacionClave: this.extraerInformacionClave(licitacion),
      recomendaciones: this.construirRecomendaciones(oportunidad),
      acceso,
      urlMercadoPublico: this.construirUrlMercadoPublico(codigoNormalizado),
    };
  }

  private construirUrlMercadoPublico(codigoExterno: string): string {
    const url = new URL(
      'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx',
    );
    url.searchParams.set('idlicitacion', codigoExterno);
    return url.toString();
  }

  async evaluarLicitacionParaEmpresa(empresaId: string, codigoExterno: string) {
    const perfil = await this.obtenerPerfilValido(empresaId);
    const licitacion = await this.crearConsultaBase(false)
      .andWhere('licitacion.codigoExterno = :codigoExterno', {
        codigoExterno: codigoExterno.trim().toUpperCase(),
      })
      .getOne();

    return licitacion ? this.evaluarLicitacion(licitacion, perfil) : null;
  }

  private crearConsultaBase(
    soloPublicadas: boolean,
  ): SelectQueryBuilder<Licitacion> {
    const query = this.licitacionesRepository
      .createQueryBuilder('licitacion')
      .select([
        'licitacion.id',
        'licitacion.codigoExterno',
        'licitacion.nombre',
        'licitacion.descripcion',
        'licitacion.codigoEstado',
        'licitacion.estado',
        'licitacion.codigoTipo',
        'licitacion.tipo',
        'licitacion.moneda',
        'licitacion.montoEstimado',
        'licitacion.fechaPublicacion',
        'licitacion.fechaCierre',
        'licitacion.fechaAdjudicacion',
        'licitacion.codigoOrganismo',
        'licitacion.nombreOrganismo',
        'licitacion.codigoUnidad',
        'licitacion.nombreUnidad',
        'licitacion.comunaUnidad',
        'licitacion.regionUnidad',
        'licitacion.cantidadReclamos',
        'licitacion.sincronizadoEn',
        'licitacion.detalleSincronizadoEn',
      ])
      .leftJoin('licitacion.items', 'item')
      .addSelect([
        'item.id',
        'item.licitacionId',
        'item.correlativo',
        'item.codigoProducto',
        'item.codigoCategoria',
        'item.categoria',
        'item.nombreProducto',
        'item.descripcion',
        'item.unidadMedida',
        'item.cantidad',
      ])
      .distinct(true);

    if (soloPublicadas) {
      query.where('licitacion.codigoEstado = :codigoEstado', {
        codigoEstado: CODIGO_ESTADO_PUBLICADA,
      });
    }

    return query.andWhere(EXCLUIR_LICITACIONES_DE_PRUEBA);
  }

  private crearConsultaIds(
    filtros: ConsultarOportunidadesDto,
  ): SelectQueryBuilder<Licitacion> {
    const query = this.licitacionesRepository
      .createQueryBuilder('licitacion')
      .select('licitacion.id', 'id')
      .addSelect('licitacion.fechaPublicacion', 'fechaPublicacion')
      .addSelect('licitacion.fechaCierre', 'fechaCierre')
      .addSelect('licitacion.montoEstimado', 'montoEstimado')
      .distinct(true);

    if (filtros.texto || filtros.codigoCategoria) {
      query.leftJoin('licitacion.items', 'item');
    }

    return query.andWhere(EXCLUIR_LICITACIONES_DE_PRUEBA);
  }

  private crearConsultaCandidatas(
    filtros: ConsultarOportunidadesDto,
    perfil: PerfilOportunidades,
  ): SelectQueryBuilder<Licitacion> {
    const query = this.licitacionesRepository
      .createQueryBuilder('licitacion')
      .select('licitacion.id', 'id')
      .where('licitacion.codigoEstado = :codigoEstado', {
        codigoEstado: CODIGO_ESTADO_PUBLICADA,
      })
      .distinct(true)
      .andWhere(EXCLUIR_LICITACIONES_DE_PRUEBA);

    if (filtros.texto || filtros.codigoCategoria) {
      query.leftJoin('licitacion.items', 'item');
    }

    this.aplicarFiltros(query, filtros);

    const terminosExpandidos = [
      ...new Set(
        this.obtenerTerminosBusqueda(perfil).flatMap((termino) =>
          nexusHabilitado() ? [termino] : expandirEtiquetaPerfil(termino),
        ),
      ),
    ];
    const codigosCategoria = [
      ...new Set(
        (nexusHabilitado() ? codigosDeOfertas(perfil.ofertasIds ?? []) : perfil.codigosCategoria)
          .map((codigo) => codigo.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    const regiones = [
      ...new Set(
        perfil.regiones
          .map((region) => this.normalizarTexto(region))
          .filter(Boolean),
      ),
    ];
    const tieneRangoMonto =
      perfil.montoMinimo !== null || perfil.montoMaximo !== null;

    query.andWhere(
      new Brackets((criterios) => {
        criterios.where('1 = 0');

        if (terminosExpandidos.length > 0) {
          criterios.orWhere(
            `(
              ${this.expresionTextoNormalizado(
                "concat_ws(' ', licitacion.nombre, licitacion.descripcion)",
              )} LIKE ANY(:patronesPerfil)
              OR EXISTS (
                SELECT 1
                FROM licitacion_items item_perfil
                WHERE item_perfil.licitacion_id = licitacion.id
                  AND ${this.expresionTextoNormalizado(
                    "concat_ws(' ', item_perfil.nombre_producto, item_perfil.descripcion, item_perfil.categoria)",
                  )} LIKE ANY(:patronesPerfil)
              )
            )`,
            {
              patronesPerfil: terminosExpandidos.map((termino) =>
                this.crearPatronSql(termino),
              ),
            },
          );
        }

        if (codigosCategoria.length > 0) {
          criterios.orWhere(
            `EXISTS (
              SELECT 1
              FROM licitacion_items item_categoria
              WHERE item_categoria.licitacion_id = licitacion.id
                AND UPPER(TRIM(item_categoria.codigo_categoria))
                  IN (:...categoriasPerfil)
            )`,
            { categoriasPerfil: codigosCategoria },
          );
        }

        if (!nexusHabilitado() && regiones.length > 0) {
          criterios.orWhere(
            `${this.expresionTextoNormalizado(
              'licitacion.regionUnidad',
            )} LIKE ANY(:regionesPerfil)`,
            {
              regionesPerfil: regiones.map((region) => `%${region}%`),
            },
          );
        }

        if (!nexusHabilitado() && tieneRangoMonto) {
          criterios.orWhere(
            new Brackets((monto) => {
              monto.where(
                new Brackets((rango) => {
                  rango.where('licitacion.montoEstimado IS NOT NULL');

                  if (perfil.montoMinimo !== null) {
                    rango.andWhere(
                      'licitacion.montoEstimado >= :montoMinimoPerfil',
                      { montoMinimoPerfil: perfil.montoMinimo },
                    );
                  }

                  if (perfil.montoMaximo !== null) {
                    rango.andWhere(
                      'licitacion.montoEstimado <= :montoMaximoPerfil',
                      { montoMaximoPerfil: perfil.montoMaximo },
                    );
                  }
                }),
              );

              if (perfil.incluirSinMonto) {
                monto.orWhere('licitacion.montoEstimado IS NULL');
              }
            }),
          );
        }
      }),
    );

    return query;
  }

  private expresionTextoNormalizado(campo: string): string {
    return `translate(
      lower(COALESCE(${campo}, '')),
      'áéíóúüñ',
      'aeiouun'
    )`;
  }

  private crearPatronSql(termino: string): string {
    const palabras = this.normalizarTexto(termino).split(' ').filter(Boolean);
    return `%${palabras.join('%')}%`;
  }

  private expandirPatronesBusquedaGeneral(entrada: string): string[] {
    const consulta = normalizarTexto(entrada);
    if (!consulta) return [];
    const equivalencias = new Set<string>([consulta]);
    // Solamente se expanden alias completos de rubros o etiquetas reconocidas.
    // Asi una busqueda compuesta o ajena al catalogo conserva su precision.
    for (const rubro of CATALOGO_ETIQUETAS) {
      const terminosRubro = [rubro.nombre, ...rubro.sinonimos]
        .map(normalizarTexto).filter(Boolean);
      if (terminosRubro.includes(consulta)) {
        for (const termino of terminosRubro) equivalencias.add(termino);
      }
      for (const etiqueta of rubro.etiquetas) {
        const terminosEtiqueta = [etiqueta.nombre, ...etiqueta.sinonimos]
          .map(normalizarTexto).filter(Boolean);
        if (terminosEtiqueta.includes(consulta)) {
          for (const termino of terminosEtiqueta) equivalencias.add(termino);
        }
      }
    }
    return [...equivalencias].map((termino) => this.crearPatronSql(termino));
  }

  private crearClaveRecomendaciones(
    filtros: ConsultarOportunidadesDto,
    perfil: PerfilOportunidades,
  ): string {
    return JSON.stringify({
      nexus: [nexusHabilitado(), VERSION_NEXUS],
      perfil: {
        ...this.contextoNexus(perfil),
        id: perfil.id,
        palabrasClave: perfil.palabrasClave,
        etiquetasCapacidades: perfil.etiquetasCapacidades,
        codigosCategoria: perfil.codigosCategoria,
        regiones: perfil.regiones,
        montoMinimo: perfil.montoMinimo,
        montoMaximo: perfil.montoMaximo,
        incluirSinMonto: perfil.incluirSinMonto,
        tiposOportunidad: perfil.tiposOportunidad,
      },
      filtros: {
        texto: filtros.texto,
        codigoOrganismo: filtros.codigoOrganismo,
        region: filtros.region,
        codigoCategoria: filtros.codigoCategoria,
        montoMinimo: filtros.montoMinimo,
        montoMaximo: filtros.montoMaximo,
        publicadaDesde: filtros.publicadaDesde,
        publicadaHasta: filtros.publicadaHasta,
        puntajeMinimo: filtros.puntajeMinimo,
        soloVigentes: filtros.soloVigentes,
        orden: filtros.orden,
        horizonteCierre: filtros.horizonteCierre,
      },
    });
  }

  private aplicarOrdenSql(
    query: SelectQueryBuilder<Licitacion>,
    orden: ConsultarOportunidadesDto['orden'],
  ): void {
    if (orden === 'cierre_asc') {
      query.orderBy('licitacion.fechaCierre', 'ASC', 'NULLS LAST');
    } else if (orden === 'monto_desc') {
      query.orderBy('licitacion.montoEstimado', 'DESC', 'NULLS LAST');
    } else if (orden === 'monto_asc') {
      query.orderBy('licitacion.montoEstimado', 'ASC', 'NULLS LAST');
    } else {
      query.orderBy('licitacion.fechaPublicacion', 'DESC', 'NULLS LAST');
    }

    query.addOrderBy('licitacion.id', 'ASC');
  }

  private async cargarLicitacionesPorIds(ids: string[]): Promise<Licitacion[]> {
    if (ids.length === 0) return [];

    const licitaciones = await this.crearConsultaBase(false)
      .andWhere('licitacion.id IN (:...ids)', { ids })
      .getMany();
    const porId = new Map(
      licitaciones.map((licitacion) => [licitacion.id, licitacion]),
    );

    return ids
      .map((id) => porId.get(id))
      .filter((licitacion): licitacion is Licitacion => Boolean(licitacion));
  }

  // Solo metadata de invalidacion; no es un total de oportunidades publicable.
  // No lee datos_origen ni items. Un cambio de ficha o una baja cambia la clave.
  private async obtenerRevisionCatalogo() {
    const [fila] = await this.licitacionesRepository.query<Array<{ revision: string; proximo: string | null }>>(`
      /* gma_revision_catalogo */
      SELECT concat(count(*), ':', max(actualizado_en)::text) AS revision,
        min(fecha_cierre) FILTER (WHERE activa_en_listado = true AND codigo_estado = 5
          AND fecha_cierre >= now()) AS proximo
      FROM licitaciones`);
    if (!fila?.revision) return null;
    const proximo = fila.proximo ? Date.parse(fila.proximo) + 1 : Infinity;
    return { clave: fila.revision, vence: Math.min(Date.now() + 60_000, Number.isFinite(proximo) ? proximo : Infinity) };
  }

  async listarFiltros(soloVigentes: boolean) {
    return this.obtenerFiltrosCatalogo(soloVigentes);
  }

  private async obtenerFiltrosCatalogo(soloVigentes: boolean) {
    const revision = await this.obtenerRevisionCatalogo();
    const cargar = () => this.cargarFiltrosCatalogo(soloVigentes);
    if (!revision) return cargar();
    return this.filtrosCatalogoCache.obtener(`${soloVigentes}:${revision.clave}`, revision.vence, cargar);
  }

  private async cargarFiltrosCatalogo(soloVigentes: boolean) {

    const aplicarVigencia = <T extends SelectQueryBuilder<Licitacion>>(
      query: T,
    ): T => {
      query.andWhere(EXCLUIR_LICITACIONES_DE_PRUEBA);
      if (!soloVigentes) return query;

      return query
        .andWhere('licitacion.activaEnListado = true')
        .andWhere('licitacion.codigoEstado = :codigoEstado', {
          codigoEstado: CODIGO_ESTADO_PUBLICADA,
        })
        .andWhere('licitacion.fechaCierre IS NOT NULL')
        .andWhere('licitacion.fechaCierre >= :ahora', { ahora: new Date() });
    };

    const consultaRegiones = aplicarVigencia(
      this.licitacionesRepository
        .createQueryBuilder('licitacion')
        .select('licitacion.regionUnidad', 'region')
        .where('licitacion.regionUnidad IS NOT NULL'),
    )
      .distinct(true)
      .orderBy('licitacion.regionUnidad', 'ASC');
    const consultaOrganismos = aplicarVigencia(
      this.licitacionesRepository
        .createQueryBuilder('licitacion')
        .select('licitacion.codigoOrganismo', 'codigo')
        .addSelect('licitacion.nombreOrganismo', 'nombre')
        .where('licitacion.codigoOrganismo IS NOT NULL')
        .andWhere('licitacion.nombreOrganismo IS NOT NULL'),
    )
      .distinct(true)
      .orderBy('licitacion.nombreOrganismo', 'ASC');
    const consultaCategorias = aplicarVigencia(
      this.licitacionesRepository
        .createQueryBuilder('licitacion')
        .innerJoin('licitacion.items', 'item')
        .select('item.codigoCategoria', 'codigo')
        .addSelect('item.categoria', 'nombre')
        .where('item.codigoCategoria IS NOT NULL')
        .andWhere('item.categoria IS NOT NULL'),
    )
      .distinct(true)
      .orderBy('item.categoria', 'ASC');

    const [regiones, organismos, categorias] = await Promise.all([
      consultaRegiones.getRawMany<{ region: string }>(),
      consultaOrganismos.getRawMany<{ codigo: string; nombre: string }>(),
      consultaCategorias.getRawMany<{ codigo: string; nombre: string }>(),
    ]);
    const valor = this.mapearFiltrosRaw(regiones, organismos, categorias);

    return valor;
  }

  private mapearFiltrosRaw(
    regiones: Array<{ region: string }> = [],
    organismos: Array<{ codigo: string; nombre: string }> = [],
    categorias: Array<{ codigo: string; nombre: string }> = [],
  ) {
    return {
      regiones: regiones.map(({ region }) => region),
      organismos,
      categorias,
    };
  }

  private aplicarFiltros(
    query: SelectQueryBuilder<Licitacion>,
    filtros: ConsultarOportunidadesDto,
  ): void {
    if (filtros.horizonteCierre) {
      const dias: Record<string, [number, number | null]> = {
        '48h': [0, 2], '2a7': [2, 7], '7a30': [7, 30], '30mas': [30, null], '7mas': [7, null],
      };
      const [desde, hasta] = dias[filtros.horizonteCierre];
      const corte = Date.now();
      query.andWhere('licitacion.fechaCierre >= :cierreDesde', { cierreDesde: new Date(corte + desde * 86_400_000) });
      if (hasta !== null) query.andWhere('licitacion.fechaCierre < :cierreHasta', { cierreHasta: new Date(corte + hasta * 86_400_000) });
    }
    if (filtros.soloVigentes) {
      query
        .andWhere('licitacion.activaEnListado = true')
        .andWhere('licitacion.codigoEstado = :estadoVigente', {
          estadoVigente: CODIGO_ESTADO_PUBLICADA,
        })
        .andWhere('licitacion.fechaCierre IS NOT NULL')
        .andWhere('licitacion.fechaCierre >= :ahora', { ahora: new Date() });
    }

    if (filtros.texto) {
      // Los alias existentes se usan solo para el buscador, no se altera MATCH.
      // Parametros SQL y texto normalizado: sin extension unaccent en PostgreSQL.
      const patronesTexto = this.expandirPatronesBusquedaGeneral(filtros.texto);
      if (!patronesTexto.length) {
        // Una busqueda compuesta solo por signos no debe devolver todo el catalogo.
        query.andWhere('1 = 0');
      } else {
        query.andWhere(
          `(
            licitacion.codigoExterno ILIKE :textoCodigo
            OR ${this.expresionTextoNormalizado('licitacion.nombre')} LIKE ANY(:patronesTexto)
            OR ${this.expresionTextoNormalizado('licitacion.descripcion')} LIKE ANY(:patronesTexto)
            OR ${this.expresionTextoNormalizado('licitacion.nombreOrganismo')} LIKE ANY(:patronesTexto)
            OR ${this.expresionTextoNormalizado('item.nombreProducto')} LIKE ANY(:patronesTexto)
            OR ${this.expresionTextoNormalizado('item.descripcion')} LIKE ANY(:patronesTexto)
            OR ${this.expresionTextoNormalizado('item.categoria')} LIKE ANY(:patronesTexto)
          )`,
          { textoCodigo: `%${filtros.texto}%`, patronesTexto },
        );
      }
    }

    if (filtros.codigoOrganismo) {
      query.andWhere('licitacion.codigoOrganismo = :codigoOrganismo', {
        codigoOrganismo: filtros.codigoOrganismo,
      });
    }

    if (filtros.region) {
      const patron = patronRegionDashboard(filtros.region);
      if (patron) query.andWhere("TRANSLATE(LOWER(BTRIM(licitacion.regionUnidad)), 'áéíóúñ', 'aeioun') ~ :patronRegion", { patronRegion: patron });
      else query.andWhere('licitacion.regionUnidad ILIKE :region', { region: `%${filtros.region}%` });
    }

    if (filtros.codigoCategoria) {
      query.andWhere(
        '(item.codigoCategoria = :codigoCategoria OR item.categoria ILIKE :categoria)',
        {
          codigoCategoria: filtros.codigoCategoria,
          categoria: `%${filtros.codigoCategoria}%`,
        },
      );
    }

    if (filtros.montoMinimo !== undefined) {
      query.andWhere('licitacion.montoEstimado >= :montoMinimo', {
        montoMinimo: filtros.montoMinimo,
      });
    }

    if (filtros.montoMaximo !== undefined) {
      query.andWhere('licitacion.montoEstimado <= :montoMaximo', {
        montoMaximo: filtros.montoMaximo,
      });
    }

    if (filtros.publicadaDesde) {
      query.andWhere(
        `licitacion.fechaPublicacion >= (
          CAST(:publicadaDesde AS date) AT TIME ZONE 'America/Santiago'
        )`,
        { publicadaDesde: filtros.publicadaDesde },
      );
    }

    if (filtros.publicadaHasta) {
      query.andWhere(
        `licitacion.fechaPublicacion < (
          (CAST(:publicadaHasta AS date) + INTERVAL '1 day')
          AT TIME ZONE 'America/Santiago'
        )`,
        { publicadaHasta: filtros.publicadaHasta },
      );
    }
  }

  private async obtenerPerfilValido(
    empresaId: string,
  ): Promise<PerfilOportunidades> {
    const perfil = await this.perfilesEmpresaService.obtener(empresaId);

    if (!perfil.activo) {
      throw new BadRequestException(
        'El perfil de oportunidades de la empresa está inactivo',
      );
    }

    this.validarCriteriosPerfil(perfil);
    return perfil;
  }

  private async obtenerPerfilOpcional(
    empresaId: string,
  ): Promise<PerfilOportunidades | null> {
    try {
      const perfil = await this.perfilesEmpresaService.obtener(empresaId);
      return perfil.activo ? perfil : null;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private validarCriteriosPerfil(perfil: PerfilOportunidades): void {
    if (nexusHabilitado()) return;
    const tienePalabrasClave = this.obtenerTerminosBusqueda(perfil).length > 0;
    const tieneCategorias = perfil.codigosCategoria.length > 0;
    const tieneRegiones = perfil.regiones.length > 0;
    const tieneRangoMonto =
      perfil.montoMinimo !== null || perfil.montoMaximo !== null;

    if (
      !tienePalabrasClave &&
      !tieneCategorias &&
      !tieneRegiones &&
      !tieneRangoMonto
    ) {
      throw new BadRequestException(
        'El perfil no tiene criterios suficientes para calcular oportunidades',
      );
    }
  }

  private async evaluarLote(licitaciones: Licitacion[], perfil: PerfilOportunidades | null) {
    const evaluar = prepararRelevanciaCapacidades(perfil ? this.obtenerTerminosBusqueda(perfil) : [], expandirEtiquetaPerfil);
    const evaluarNexus = nexusHabilitado() ? prepararNexus(perfil?.ofertasIds ?? [], this.terminosComplementarios(perfil)) : undefined;
    const oportunidades: Array<ReturnType<OportunidadesService['evaluarLicitacion']>> = [];
    let cederDesde = performance.now() + 8;
    for (let i = 0; i < licitaciones.length; i += 1) {
      oportunidades.push(this.evaluarLicitacion(licitaciones[i], perfil, evaluar, evaluarNexus));
      if (i + 1 < licitaciones.length && performance.now() >= cederDesde) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        cederDesde = performance.now() + 8;
      }
    }
    return oportunidades;
  }

  private evaluarLicitacion(
    licitacion: Licitacion,
    perfil: PerfilOportunidades | null,
    evaluarPreparada?: EvaluadorRelevanciaCapacidades,
    evaluarNexus?: ReturnType<typeof prepararNexus>,
  ) {
    let pesoDisponible = 0;
    let puntajeObtenido = 0;
    const terminosBusqueda = perfil ? this.obtenerTerminosBusqueda(perfil) : [];
    // MATCH-08: la posicion y fuerza de la evidencia importan. Una sola
    // palabra generica en una descripcion no acredita 100% de capacidad.
    const fuenteRelevancia = {
      nombre: licitacion.nombre,
      descripcion: licitacion.descripcion,
      items: licitacion.items ?? [],
    };
    const nexus = nexusHabilitado() ? (evaluarNexus ?? prepararNexus(perfil?.ofertasIds ?? [], this.terminosComplementarios(perfil)))({
      nombre: licitacion.nombre, items: licitacion.items, detalleCompleto: Boolean(licitacion.detalleSincronizadoEn),
    }) : null;
    const relevancia = nexus ?? (evaluarPreparada ? evaluarPreparada(fuenteRelevancia)
      : evaluarRelevanciaCapacidades(terminosBusqueda, expandirEtiquetaPerfil, fuenteRelevancia));
    // Conserva BUS-05: las capacidades son alternativas; no se divide por
    // el numero de rubros configurados en el perfil.
    const coincidenciasPalabrasClave = relevancia.coincidencias;
    const porcentajePalabras = relevancia.porcentaje;

    if (terminosBusqueda.length > 0) {
      pesoDisponible += PESO_PALABRAS_CLAVE;
      puntajeObtenido += PESO_PALABRAS_CLAVE * (porcentajePalabras / 100);
    }

    const codigosItems = new Set(
      (licitacion.items ?? [])
        .map((item) => item.codigoCategoria?.trim().toUpperCase())
        .filter((codigo): codigo is string => Boolean(codigo)),
    );
    const categoriasPerfil = nexusHabilitado() ? codigosDeOfertas(perfil?.ofertasIds ?? []) : perfil?.codigosCategoria ?? [];
    const coincidenciasCategorias = categoriasPerfil.filter((codigoCategoria) =>
      codigosItems.has(codigoCategoria.trim().toUpperCase()),
    );
    // Los codigos de categoria tambien representan alternativas, no requisitos acumulativos.
    const porcentajeCategorias = coincidenciasCategorias.length > 0 ? 100 : 0;

    if (categoriasPerfil.length > 0) {
      pesoDisponible += PESO_CATEGORIAS;
      puntajeObtenido += PESO_CATEGORIAS * (porcentajeCategorias / 100);
    }

    let coincideRegion: boolean | null = null;

    const regionesPerfil = perfil?.regiones ?? [];

    if (regionesPerfil.length > 0) {
      // Se conserva el peso configurado: la ausencia de datos no debe
      // aumentar artificialmente el puntaje. Null no significa incumplimiento.
      pesoDisponible += PESO_REGION;
      const regionLicitacion = this.normalizarTexto(licitacion.regionUnidad);

      if (regionLicitacion.length > 0) {
        coincideRegion = regionesPerfil.some((regionConfigurada) => {
          const regionNormalizada = this.normalizarTexto(regionConfigurada);
          return (
            regionLicitacion === regionNormalizada ||
            regionLicitacion.includes(regionNormalizada) ||
            regionNormalizada.includes(regionLicitacion)
          );
        });
      }

      if (coincideRegion) puntajeObtenido += PESO_REGION;
    }

    const evaluarMonto =
      perfil !== null &&
      (perfil.montoMinimo !== null || perfil.montoMaximo !== null);
    let coincideMonto: boolean | null = null;

    if (evaluarMonto && perfil) {
      pesoDisponible += PESO_MONTO;
      coincideMonto = this.evaluarMonto(licitacion, perfil);
      if (coincideMonto) puntajeObtenido += PESO_MONTO;
    }

    // Ubicacion y presupuesto delimitan factibilidad, pero por si solos
    // no acreditan que una compra sea pertinente al giro de la empresa.
    const existeCoincidenciaComercial = nexus ? nexus.estado === 'coincidencia'
      : coincidenciasPalabrasClave.length > 0 || coincidenciasCategorias.length > 0;
    const porcentajeCompatibilidad =
      pesoDisponible === 0 || !existeCoincidenciaComercial
        ? 0
        : Number(((puntajeObtenido / pesoDisponible) * 100).toFixed(2));
    const categorias = [
      ...new Set(
        (licitacion.items ?? [])
          .map((item) => item.categoria?.trim())
          .filter((categoria): categoria is string => Boolean(categoria)),
      ),
    ].slice(0, 4);
    const clasificacion = clasificarEtiquetas({
      nombre: licitacion.nombre,
      descripcion: licitacion.descripcion,
      categorias: (licitacion.items ?? [])
        .map((item) => item.categoria)
        .filter((categoria): categoria is string => Boolean(categoria)),
      nombresItems: (licitacion.items ?? [])
        .map((item) => item.nombreProducto)
        .filter((nombre): nombre is string => Boolean(nombre)),
      descripcionesItems: (licitacion.items ?? [])
        .map((item) => item.descripcion)
        .filter((descripcion): descripcion is string => Boolean(descripcion)),
    });

    return {
      id: licitacion.id,
      codigoExterno: licitacion.codigoExterno,
      nombre: licitacion.nombre,
      descripcion: licitacion.descripcion,
      codigoEstado: licitacion.codigoEstado,
      estado: licitacion.estado,
      codigoTipo: licitacion.codigoTipo,
      tipo: licitacion.tipo,
      moneda: licitacion.moneda,
      montoEstimado:
        licitacion.montoEstimado === null
          ? null
          : Number(licitacion.montoEstimado),
      fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
      fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
      fechaAdjudicacion: licitacion.fechaAdjudicacion?.toISOString() ?? null,
      codigoOrganismo: licitacion.codigoOrganismo,
      nombreOrganismo: licitacion.nombreOrganismo,
      codigoUnidad: licitacion.codigoUnidad,
      nombreUnidad: licitacion.nombreUnidad,
      comunaUnidad: licitacion.comunaUnidad,
      regionUnidad: licitacion.regionUnidad,
      cantidadReclamos: licitacion.cantidadReclamos,
      cantidadItems: licitacion.items?.length ?? 0,
      categorias,
      clasificacion,
      porcentajeCompatibilidad,
      nivelCompatibilidad: this.obtenerNivelCompatibilidad(
        porcentajeCompatibilidad,
      ),
      coincidencias: {
        palabrasClave: coincidenciasPalabrasClave,
        codigosCategoria: coincidenciasCategorias,
        region: coincideRegion,
        monto: coincideMonto,
      },
      // Evidencia trazable para explicar el porcentaje y detectar falsos positivos.
      evidenciasCapacidades: relevancia.evidencias,
      nexus,
      desgloseCompatibilidad: [
        {
          criterio: 'Capacidades y palabras clave',
          porcentaje: porcentajePalabras,
          evaluado: terminosBusqueda.length > 0,
        },
        {
          criterio: 'Categorías de interés',
          porcentaje: porcentajeCategorias,
          evaluado: categoriasPerfil.length > 0,
        },
        {
          criterio: 'Cobertura geográfica',
          porcentaje: coincideRegion === null ? null : coincideRegion ? 100 : 0,
          evaluado: coincideRegion !== null,
          motivoNoEvaluado:
            regionesPerfil.length === 0
              ? ('no_configurado' as const)
              : coincideRegion === null
                ? ('dato_no_informado' as const)
                : null,
        },
        {
          criterio: 'Rango de monto',
          porcentaje: coincideMonto === null ? null : coincideMonto ? 100 : 0,
          evaluado: coincideMonto !== null,
        },
      ],
      sincronizadoEn: licitacion.sincronizadoEn.toISOString(),
    };
  }

  private ordenarOportunidades(
    oportunidades: Array<ReturnType<OportunidadesService['evaluarLicitacion']>>,
    orden: ConsultarOportunidadesDto['orden'],
  ): void {
    oportunidades.sort((a, b) => {
      if (orden === 'fecha_desc') {
        return (
          this.valorFecha(b.fechaPublicacion, 0) -
          this.valorFecha(a.fechaPublicacion, 0)
        );
      }
      if (orden === 'cierre_asc') {
        return (
          this.valorFecha(a.fechaCierre, Number.MAX_SAFE_INTEGER) -
          this.valorFecha(b.fechaCierre, Number.MAX_SAFE_INTEGER)
        );
      }
      if (orden === 'monto_desc') {
        return (b.montoEstimado ?? -1) - (a.montoEstimado ?? -1);
      }
      if (orden === 'monto_asc') {
        return (
          (a.montoEstimado ?? Number.MAX_SAFE_INTEGER) -
          (b.montoEstimado ?? Number.MAX_SAFE_INTEGER)
        );
      }

      const diferencia =
        b.porcentajeCompatibilidad - a.porcentajeCompatibilidad;
      if (diferencia !== 0) return diferencia;
      const diferenciaPalabras = (b.nexus?.palabrasClaveCoincidentes.length ?? 0) - (a.nexus?.palabrasClaveCoincidentes.length ?? 0);
      if (diferenciaPalabras !== 0) return diferenciaPalabras;
      return (
        this.valorFecha(a.fechaCierre, Number.MAX_SAFE_INTEGER) -
        this.valorFecha(b.fechaCierre, Number.MAX_SAFE_INTEGER)
      );
    });
  }

  private construirResumen(
    oportunidades: Array<ReturnType<OportunidadesService['evaluarLicitacion']>>,
  ) {
    const promedio = oportunidades.length
      ? Math.round(
          oportunidades.reduce(
            (suma, oportunidad) => suma + oportunidad.porcentajeCompatibilidad,
            0,
          ) / oportunidades.length,
        )
      : 0;
    const haceSieteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const nuevasSemana = oportunidades.filter(
      (oportunidad) =>
        oportunidad.fechaPublicacion !== null &&
        new Date(oportunidad.fechaPublicacion).getTime() >= haceSieteDias,
    ).length;
    const categorias = new Map<string, number>();

    for (const oportunidad of oportunidades) {
      const categoria = oportunidad.categorias[0] ?? 'Sin categoría';
      categorias.set(categoria, (categorias.get(categoria) ?? 0) + 1);
    }

    const distribucionCategorias = [...categorias.entries()]
      .map(([categoria, cantidad]) => ({
        categoria,
        cantidad,
        porcentaje: oportunidades.length
          ? Math.round((cantidad / oportunidades.length) * 100)
          : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
    const ultimaActualizacion =
      oportunidades
        .map((oportunidad) => oportunidad.sincronizadoEn)
        .sort()
        .at(-1) ?? null;

    return {
      compatibilidadPromedio: promedio,
      oportunidadesActivas: oportunidades.length,
      altaCompatibilidad: oportunidades.filter(
        (oportunidad) => oportunidad.porcentajeCompatibilidad >= 60,
      ).length,
      nuevasSemana,
      ultimaActualizacion,
      distribucionCategorias,
    };
  }

  private construirFiltrosDisponibles(licitaciones: Licitacion[]) {
    const regiones = new Set<string>();
    const organismos = new Map<string, string>();
    const categorias = new Map<string, string>();

    for (const licitacion of licitaciones) {
      if (licitacion.regionUnidad) regiones.add(licitacion.regionUnidad);
      if (licitacion.codigoOrganismo && licitacion.nombreOrganismo) {
        organismos.set(licitacion.codigoOrganismo, licitacion.nombreOrganismo);
      }
      for (const item of licitacion.items ?? []) {
        if (item.codigoCategoria && item.categoria) {
          categorias.set(item.codigoCategoria, item.categoria);
        }
      }
    }

    return {
      regiones: [...regiones].sort((a, b) => a.localeCompare(b, 'es')),
      organismos: [...organismos.entries()]
        .map(([codigo, nombre]) => ({ codigo, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      categorias: [...categorias.entries()]
        .map(([codigo, nombre]) => ({ codigo, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    };
  }

  private extraerFechasImportantes(licitacion: Licitacion) {
    const fechas = this.obtenerObjeto(licitacion.datosOrigen ?? {}, 'Fechas');
    const candidatas = [
      {
        id: 'publicacion',
        etiqueta: 'Publicación de bases',
        valor: licitacion.fechaPublicacion,
      },
      {
        id: 'preguntas',
        etiqueta: 'Cierre de preguntas',
        valor: fechas.FechaFinalPreguntas ?? fechas.FechaCierrePreguntas,
      },
      {
        id: 'respuestas',
        etiqueta: 'Publicación de respuestas',
        valor: fechas.FechaPublicacionRespuestas,
      },
      {
        id: 'cierre',
        etiqueta: 'Cierre de postulaciones',
        valor: licitacion.fechaCierre,
      },
      {
        id: 'apertura',
        etiqueta: 'Apertura técnica',
        valor: fechas.FechaAperturaTecnica,
      },
      {
        id: 'adjudicacion',
        etiqueta: 'Adjudicación estimada',
        valor: licitacion.fechaAdjudicacion,
      },
    ];

    return candidatas
      .map((fecha) => ({
        id: fecha.id,
        etiqueta: fecha.etiqueta,
        fecha: this.normalizarFechaOrigen(fecha.valor),
      }))
      .filter((fecha) => fecha.fecha !== null);
  }

  private extraerDocumentos(origen: Record<string, unknown>) {
    const contenedor = origen.Documentos;
    const listado = Array.isArray(contenedor)
      ? contenedor
      : this.obtenerObjeto(origen, 'Documentos').Listado;

    if (!Array.isArray(listado)) return [];

    return listado
      .filter((documento): documento is Record<string, unknown> =>
        this.esObjeto(documento),
      )
      .map((documento, indice) => {
        const nombre = this.obtenerPrimerTexto(documento, [
          'Nombre',
          'NombreArchivo',
          'Descripcion',
        ]);
        const url = this.obtenerPrimerTexto(documento, [
          'Url',
          'URL',
          'Direccion',
        ]);

        return {
          id: String(documento.Id ?? documento.ID ?? indice + 1),
          nombre: nombre ?? `Documento ${indice + 1}`,
          tipo: this.obtenerPrimerTexto(documento, ['Tipo', 'Extension']),
          url: url && /^https?:\/\//i.test(url) ? url : null,
        };
      })
      .slice(0, 10);
  }

  private extraerInformacionClave(licitacion: Licitacion) {
    const origen = licitacion.datosOrigen ?? {};
    const duracion = this.obtenerPrimerTexto(origen, [
      'TiempoDuracionContrato',
      'DuracionContrato',
    ]);
    const unidadDuracion = this.obtenerPrimerTexto(origen, [
      'UnidadTiempoDuracionContrato',
      'UnidadDuracionContrato',
    ]);

    return {
      fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
      fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
      duracionContrato:
        [duracion, unidadDuracion].filter(Boolean).join(' ') || null,
      modalidad:
        this.obtenerPrimerTexto(origen, ['Modalidad', 'TipoConvocatoria']) ??
        licitacion.tipo,
      moneda: licitacion.moneda,
      region: licitacion.regionUnidad,
    };
  }

  private construirRecomendaciones(
    oportunidad: ReturnType<OportunidadesService['evaluarLicitacion']>,
  ) {
    const recomendaciones: Array<{
      tipo: string;
      titulo: string;
      descripcion: string;
    }> = [];

    if (oportunidad.coincidencias.palabrasClave.length > 0) {
      recomendaciones.push({
        tipo: 'fortaleza',
        titulo: 'Destaca tus capacidades relacionadas',
        descripcion: `Incluye evidencia de experiencia en ${oportunidad.coincidencias.palabrasClave.slice(0, 3).join(', ')}.`,
      });
    }

    if (oportunidad.coincidencias.codigosCategoria.length === 0) {
      recomendaciones.push({
        tipo: 'revision',
        titulo: 'Revisa el alcance técnico',
        descripcion:
          'La categoría no coincide directamente con las configuradas en tu perfil.',
      });
    }

    if (oportunidad.coincidencias.region === false) {
      recomendaciones.push({
        tipo: 'revision',
        titulo: 'Confirma tu cobertura geográfica',
        descripcion:
          'Verifica que tu empresa pueda prestar el servicio en la región solicitada.',
      });
    }

    const diasRestantes = oportunidad.fechaCierre
      ? Math.max(
          0,
          Math.ceil(
            (new Date(oportunidad.fechaCierre).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

    recomendaciones.push({
      tipo: 'plazo',
      titulo: 'Prepara tu propuesta con anticipación',
      descripcion:
        diasRestantes === null
          ? 'Confirma el plazo directamente en Mercado Público.'
          : `Quedan ${diasRestantes} días para el cierre de postulaciones.`,
    });

    return recomendaciones.slice(0, 3);
  }

  private construirTextoLicitacion(licitacion: Licitacion): string {
    return this.normalizarTexto(
      [
        licitacion.nombre,
        licitacion.descripcion,
        ...(licitacion.items ?? []).flatMap((item) => [
          item.nombreProducto,
          item.descripcion,
          item.categoria,
        ]),
      ]
        .filter((valor): valor is string => typeof valor === 'string')
        .join(' '),
    );
  }

  private contextoNexus(perfil: PerfilOportunidades) {
    return { ofertasIds: perfil.ofertasIds ?? [], nexusHabilitado: nexusHabilitado(),
      necesitaOfertasNexus: nexusHabilitado() && !perfil.ofertasIds?.length,
      versionTaxonomia: VERSION_NEXUS, actualizadoEn: perfil.actualizadoEn };
  }

  private obtenerTerminosBusqueda(perfil: PerfilOportunidades): string[] {
    if (nexusHabilitado()) return terminosDeOfertas(perfil.ofertasIds ?? []);
    const terminos = [...perfil.etiquetasCapacidades, ...perfil.palabrasClave];
    const encontrados = new Set<string>();

    return terminos.filter((termino) => {
      const normalizado = this.normalizarTexto(termino);
      if (!normalizado || encontrados.has(normalizado)) return false;
      encontrados.add(normalizado);
      return true;
    });
  }

  private terminosComplementarios(perfil: PerfilOportunidades | null): string[] {
    // NEXUS elimina duplicados y comprueba estas señales sólo dentro de
    // un objeto que ya coincide con una oferta específica seleccionada.
    return [...(perfil?.etiquetasCapacidades ?? []), ...(perfil?.palabrasClave ?? [])];
  }

  private evaluarMonto(
    licitacion: Licitacion,
    perfil: PerfilOportunidades,
  ): boolean {
    if (licitacion.montoEstimado === null) return perfil.incluirSinMonto;
    const monto = Number(licitacion.montoEstimado);

    if (!Number.isFinite(monto)) return false;
    if (perfil.montoMinimo !== null && monto < perfil.montoMinimo) return false;
    if (perfil.montoMaximo !== null && monto > perfil.montoMaximo) return false;
    return true;
  }

  private calcularPorcentajeCoincidencia(
    coincidencias: number,
    total: number,
  ): number {
    return total === 0 ? 0 : Math.round((coincidencias / total) * 100);
  }

  private obtenerNivelCompatibilidad(porcentaje: number): string {
    if (porcentaje >= 80) return 'muy_alta';
    if (porcentaje >= 60) return 'alta';
    if (porcentaje >= 40) return 'media';
    return 'baja';
  }

  private valorFecha(
    fecha: string | null,
    valorPredeterminado: number,
  ): number {
    return fecha ? new Date(fecha).getTime() : valorPredeterminado;
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private contieneExpresion(texto: string, termino: string): boolean {
    const expresion = this.normalizarTexto(termino);
    return Boolean(expresion) && ` ${texto} `.includes(` ${expresion} `);
  }

  private resumirTexto(valor: string, limite: number): string {
    const texto = valor.trim();
    return texto.length <= limite
      ? texto
      : `${texto.slice(0, limite).trimEnd()}…`;
  }

  private obtenerObjeto(
    origen: Record<string, unknown>,
    campo: string,
  ): Record<string, unknown> {
    const valor = origen[campo];
    return this.esObjeto(valor) ? valor : {};
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private obtenerPrimerTexto(
    origen: Record<string, unknown>,
    campos: string[],
  ): string | null {
    for (const campo of campos) {
      const valor = origen[campo];
      if (valor !== null && valor !== undefined && String(valor).trim()) {
        return String(valor).trim();
      }
    }
    return null;
  }

  private normalizarFechaOrigen(valor: unknown): string | null {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      return valor.toISOString();
    }
    if (typeof valor !== 'string' || !valor.trim()) return null;

    const fechaDotNet = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(valor);
    const fecha = fechaDotNet
      ? new Date(Number(fechaDotNet[1]))
      : new Date(valor);

    return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
  }
}
