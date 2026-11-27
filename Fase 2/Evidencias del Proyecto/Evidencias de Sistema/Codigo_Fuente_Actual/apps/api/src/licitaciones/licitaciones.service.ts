import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type DeepPartial, type EntityManager, In } from 'typeorm';
import type { LicitacionMercadoPublico } from '../integraciones/mercado-publico/interfaces/licitacion-mercado-publico.interface';
import { MercadoPublicoService } from '../integraciones/mercado-publico/mercado-publico.service';
import { analizarResultadoLicitacion } from './analizador-resultados';
import { ClasificacionResultadoLicitacion } from './analizador-resultados';
import { LicitacionAdjudicacion } from './entities/licitacion-adjudicacion.entity';
import { LicitacionListadoDia } from './entities/licitacion-listado-dia.entity';
import { LicitacionItem } from './entities/licitacion-item.entity';
import { LicitacionResultado } from './entities/licitacion-resultado.entity';
import { Licitacion } from './entities/licitacion.entity';
import { SincronizacionListadoDia } from './entities/sincronizacion-listado-dia.entity';
import { REGISTRAR_PENDIENTES_SQL } from './cola-detalles.service';

export interface ResultadoSincronizacionLicitacion {
  codigoExterno: string;
  creada: boolean;
  itemsGuardados: number;
  clasificacionResultado: ClasificacionResultadoLicitacion;
  sincronizadoEn: Date;
}

export interface ResultadoIndexacionFecha {
  indexadas: number;
  creadas: number;
  actualizadas: number;
}

export interface PendienteResultadoPeriodo {
  codigoExterno: string;
  requiereConsultaApi: boolean;
}

export interface ResultadoIndexacionActivas {
  codigosNuevos: string[];
  indexadas: number;
  creadas: number;
  actualizadas: number;
  conCierreFuturo: number;
  conCierreVencido: number;
}

interface ResumenLicitacionActiva {
  codigoExterno: string;
  nombre: string;
  codigoEstado: number;
  estado: string;
  tipo: string | null;
  fechaCierre: Date | null;
  datosOrigen: Record<string, unknown>;
}

const TAMANIO_LOTE_INDEXACION = 500;

@Injectable()
export class LicitacionesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mercadoPublicoService: MercadoPublicoService,
  ) {}

  async indexarListadoActivo(
    listado: LicitacionMercadoPublico[],
    consultadoEn = new Date(),
  ): Promise<ResultadoIndexacionActivas> {
    if (
      !(consultadoEn instanceof Date) ||
      Number.isNaN(consultadoEn.getTime())
    ) {
      throw new BadGatewayException(
        'No fue posible determinar la fecha del catálogo activo',
      );
    }

    const resumenes = this.normalizarListadoActivo(listado);
    const ahora = consultadoEn.getTime();
    const conCierreFuturo = resumenes.filter(
      (resumen) =>
        resumen.fechaCierre !== null && resumen.fechaCierre.getTime() >= ahora,
    ).length;

    return this.dataSource.transaction(async (administrador) => {
      const repository = administrador.getRepository(Licitacion);
      const totalAnterior = await repository.count();
      const codigosNuevos: string[] = [];
      let actualizadas = 0;

      await repository
        .createQueryBuilder()
        .update(Licitacion)
        .set({ activaEnListado: false })
        .where('activa_en_listado = :activa', { activa: true })
        .andWhere('NOT (codigo_externo = ANY(CAST(:codigos AS text[])))', {
          codigos: resumenes.map((r) => r.codigoExterno),
        })
        .execute();

      for (
        let inicio = 0;
        inicio < resumenes.length;
        inicio += TAMANIO_LOTE_INDEXACION
      ) {
        const lote = resumenes.slice(inicio, inicio + TAMANIO_LOTE_INDEXACION);
        const existentes = await repository.findBy({
          codigoExterno: In(lote.map((resumen) => resumen.codigoExterno)),
        });
        const existentesPorCodigo = new Map(
          existentes.map((licitacion) => [
            licitacion.codigoExterno,
            licitacion,
          ]),
        );
        const entidades = lote.flatMap((resumen) => {
          const existente = existentesPorCodigo.get(resumen.codigoExterno);
          const valoresComunes: DeepPartial<Licitacion> = {
            codigoExterno: resumen.codigoExterno,
            nombre: resumen.nombre,
            codigoEstado: resumen.codigoEstado,
            estado: resumen.estado,
            tipo: resumen.tipo,
            fechaCierre: resumen.fechaCierre,
            sincronizadoEn: consultadoEn,
            activaEnListado: true,
            vistoActivoEn: consultadoEn,
          };

          if (existente) {
            const mismaFecha = (existente.fechaCierre?.getTime() ?? null) === (resumen.fechaCierre?.getTime() ?? null);
            if (existente.activaEnListado && existente.nombre === resumen.nombre &&
              existente.codigoEstado === resumen.codigoEstado && existente.estado === resumen.estado &&
              existente.tipo === resumen.tipo && mismaFecha) return [];
            actualizadas += 1;
            return [repository.merge(existente, valoresComunes)];
          }

          codigosNuevos.push(resumen.codigoExterno);

          return [repository.create({
            ...valoresComunes,
            datosOrigen: resumen.datosOrigen,
            detalleSincronizadoEn: null,
          })];
        });

        await repository.save(entidades, { chunk: 100 });
      }

      const totalActual = await repository.count();
      const creadas = Math.max(0, totalActual - totalAnterior);
      if (resumenes.length) {
        // Solo metadata de observacion en una operacion masiva. No reemplaza
        // fichas completas ni hace otra llamada HTTP por licitacion conocida.
        await repository.update({ codigoExterno: In(resumenes.map((r) => r.codigoExterno)) }, { vistoActivoEn: consultadoEn });
      }

      // El alta en catalogo y el derecho a notificar se confirman juntos.
      // Una interrupcion posterior no convierte una publicacion nueva en fondo.
      await administrador.query(REGISTRAR_PENDIENTES_SQL, [codigosNuevos]);

      return {
        codigosNuevos,
        indexadas: resumenes.length,
        creadas,
        actualizadas,
        conCierreFuturo,
        conCierreVencido: resumenes.length - conCierreFuturo,
      };
    });
  }

  async seleccionarPendientesDetalle(limite: number): Promise<string[]> {
    if (!Number.isInteger(limite) || limite < 0 || limite > 1000) {
      throw new BadGatewayException(
        'El límite de detalles debe ser un entero entre 0 y 1000',
      );
    }

    if (limite === 0) {
      return [];
    }

    const registros = await this.dataSource
      .getRepository(Licitacion)
      .createQueryBuilder('licitacion')
      .select('licitacion.codigoExterno', 'codigoExterno')
      .where('licitacion.activaEnListado = true')
      .andWhere('licitacion.codigoEstado = :codigoEstado', {
        codigoEstado: 5,
      })
      .andWhere('licitacion.fechaCierre >= :ahora', { ahora: new Date() })
      .andWhere('licitacion.detalleSincronizadoEn IS NULL')
      .orderBy('licitacion.fechaCierre', 'ASC')
      .limit(limite)
      .getRawMany<{ codigoExterno: string }>();

    return registros.map((registro) => registro.codigoExterno);
  }

  async indexarListadoFecha(
    listado: LicitacionMercadoPublico[],
    fechaPublicacion: Date,
    consultadoEn = new Date(),
  ): Promise<ResultadoIndexacionFecha> {
    const resumenes = this.normalizarListadoActivo(listado);
    const fechaListado = fechaPublicacion.toISOString().slice(0, 10);

    return this.dataSource.transaction(async (administrador) => {
      const repository = administrador.getRepository(Licitacion);
      const listadoRepository =
        administrador.getRepository(LicitacionListadoDia);
      let creadas = 0;

      await listadoRepository.delete({ fecha: fechaListado });

      for (
        let inicio = 0;
        inicio < resumenes.length;
        inicio += TAMANIO_LOTE_INDEXACION
      ) {
        const lote = resumenes.slice(inicio, inicio + TAMANIO_LOTE_INDEXACION);
        const existentes = await repository.findBy({
          codigoExterno: In(lote.map((resumen) => resumen.codigoExterno)),
        });
        const existentesPorCodigo = new Map(
          existentes.map((licitacion) => [
            licitacion.codigoExterno,
            licitacion,
          ]),
        );
        const entidades = lote.map((resumen) => {
          const existente = existentesPorCodigo.get(resumen.codigoExterno);
          const valores: DeepPartial<Licitacion> = {
            codigoExterno: resumen.codigoExterno,
            nombre: resumen.nombre,
            codigoEstado: resumen.codigoEstado,
            estado: resumen.estado,
            tipo: resumen.tipo,
            fechaCierre: resumen.fechaCierre,
            fechaPublicacion: existente?.fechaPublicacion ?? fechaPublicacion,
            sincronizadoEn: consultadoEn,
          };

          if (existente) return repository.merge(existente, valores);
          creadas += 1;
          return repository.create({
            ...valores,
            activaEnListado: false,
            vistoActivoEn: null,
            detalleSincronizadoEn: null,
            datosOrigen: resumen.datosOrigen,
          });
        });

        const guardadas = await repository.save(entidades, { chunk: 100 });
        const guardadasPorCodigo = new Map(
          guardadas.map((licitacion) => [licitacion.codigoExterno, licitacion]),
        );
        const asociaciones = lote.map((resumen) =>
          listadoRepository.create({
            fecha: fechaListado,
            licitacionId: guardadasPorCodigo.get(resumen.codigoExterno)!.id,
            codigoEstado: resumen.codigoEstado,
            estado: resumen.estado,
            fechaCierre: resumen.fechaCierre,
            sincronizadoEn: consultadoEn,
          }),
        );
        await listadoRepository.save(asociaciones, { chunk: 100 });
      }

      return {
        indexadas: resumenes.length,
        creadas,
        actualizadas: Math.max(0, resumenes.length - creadas),
      };
    });
  }

  async obtenerFechasListadoSincronizadas(
    fechaInicio: string,
    fechaFin: string,
  ): Promise<Set<string>> {
    const registros = (await this.dataSource.query(
      `SELECT sincronizacion.fecha::text AS fecha
       FROM "sincronizaciones_listado_dia" sincronizacion
       WHERE sincronizacion.fecha BETWEEN CAST($1 AS date) AND CAST($2 AS date)
         AND (
           SELECT COUNT(*)::integer
           FROM "licitaciones_listado_dia" listado
           WHERE listado.fecha = sincronizacion.fecha
         ) = sincronizacion.codigos_indexados`,
      [fechaInicio, fechaFin],
    )) as Array<{ fecha: string }>;
    return new Set(registros.map((registro) => registro.fecha));
  }

  async registrarSincronizacionListadoDia(
    fecha: string,
    cantidadInformada: number,
    codigosIndexados: number,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(SincronizacionListadoDia);
    const existente = await repository.findOne({ where: { fecha } });
    await repository.save(
      existente
        ? repository.merge(existente, { cantidadInformada, codigosIndexados })
        : repository.create({ fecha, cantidadInformada, codigosIndexados }),
    );
  }

  async seleccionarPendientesResultadoPeriodo(
    fechaInicio: string,
    fechaFin: string,
    limite: number,
  ): Promise<PendienteResultadoPeriodo[]> {
    if (limite === 0) return [];
    const corteReintento = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const registros = await this.dataSource
      .getRepository(Licitacion)
      .createQueryBuilder('licitacion')
      .leftJoin('licitacion.resultado', 'resultado')
      .select('licitacion.codigoExterno', 'codigoExterno')
      .addSelect('licitacion.detalleSincronizadoEn', 'detalleSincronizadoEn')
      .addSelect('resultado.id', 'resultadoId')
      .where(
        `EXISTS (
          SELECT 1
          FROM "licitaciones_listado_dia" "listado_periodo"
          WHERE "listado_periodo"."licitacion_id" = "licitacion"."id"
            AND "listado_periodo"."fecha"
              BETWEEN CAST(:fechaInicio AS date) AND CAST(:fechaFin AS date)
        )`,
        { fechaInicio, fechaFin },
      )
      .andWhere(
        `(resultado.id IS NULL OR (
          resultado.clasificacion IN (:...clasificacionesPendientes)
          AND resultado.resultadoSincronizadoEn < :corteReintento
        ))`,
        {
          clasificacionesPendientes: [
            ClasificacionResultadoLicitacion.PENDIENTE,
            ClasificacionResultadoLicitacion.CERRADA_SIN_RESULTADO,
          ],
          corteReintento,
        },
      )
      .orderBy('resultado.id', 'ASC', 'NULLS FIRST')
      .addOrderBy('licitacion.fechaPublicacion', 'ASC')
      .addOrderBy('licitacion.codigoExterno', 'ASC')
      .limit(limite)
      .getRawMany<{
        codigoExterno: string;
        detalleSincronizadoEn: Date | null;
        resultadoId: string | null;
      }>();

    return registros.map((registro) => ({
      codigoExterno: registro.codigoExterno,
      requiereConsultaApi:
        registro.resultadoId !== null ||
        registro.detalleSincronizadoEn === null,
    }));
  }

  async contarPendientesResultadoPeriodo(
    fechaInicio: string,
    fechaFin: string,
  ): Promise<number> {
    return this.dataSource
      .getRepository(Licitacion)
      .createQueryBuilder('licitacion')
      .leftJoin('licitacion.resultado', 'resultado')
      .where(
        `EXISTS (
          SELECT 1
          FROM "licitaciones_listado_dia" "listado_periodo"
          WHERE "listado_periodo"."licitacion_id" = "licitacion"."id"
            AND "listado_periodo"."fecha"
              BETWEEN CAST(:fechaInicio AS date) AND CAST(:fechaFin AS date)
        )`,
        { fechaInicio, fechaFin },
      )
      .andWhere('resultado.id IS NULL')
      .getCount();
  }

  async actualizarResultadoDesdeDatosGuardados(
    codigoExterno: string,
  ): Promise<boolean> {
    const licitacion = await this.dataSource.getRepository(Licitacion).findOne({
      where: { codigoExterno },
    });

    if (!licitacion?.detalleSincronizadoEn) return false;
    await this.dataSource.transaction((administrador) =>
      this.guardarResultado(
        administrador,
        licitacion.id,
        licitacion.datosOrigen as LicitacionMercadoPublico,
      ),
    );
    return true;
  }

  async sincronizarPorCodigo(
    codigo: string,
  ): Promise<ResultadoSincronizacionLicitacion> {
    const respuesta =
      await this.mercadoPublicoService.obtenerLicitacionPorCodigo(codigo);

    const datos = respuesta.Listado[0];

    if (!datos) {
      throw new NotFoundException('La licitación no existe en Mercado Público');
    }
    if (respuesta.Cantidad !== 1 || respuesta.Listado.length !== 1 ||
      datos.CodigoExterno?.trim().toUpperCase() !== codigo.trim().toUpperCase() ||
      !['Comprador', 'Fechas', 'Items'].every((campo) => Object.hasOwn(datos, campo))) {
      throw new BadGatewayException('La respuesta no corresponde a una ficha detallada del código solicitado');
    }

    return this.dataSource.transaction(async (administrador) => {
      const licitacionesRepository = administrador.getRepository(Licitacion);

      const itemsRepository = administrador.getRepository(LicitacionItem);

      const valoresLicitacion = this.mapearLicitacion(datos);

      const existente = await licitacionesRepository.findOne({
        where: {
          codigoExterno: valoresLicitacion.codigoExterno as string,
        },
      });

      const licitacion = existente
        ? licitacionesRepository.merge(existente, valoresLicitacion)
        : licitacionesRepository.create(valoresLicitacion);

      const licitacionGuardada = await licitacionesRepository.save(licitacion);

      await itemsRepository.delete({
        licitacionId: licitacionGuardada.id,
      });

      const items = this.extraerItems(datos).map((item) =>
        itemsRepository.create({
          licitacionId: licitacionGuardada.id,
          correlativo: this.obtenerEnteroRequerido(item, 'Correlativo'),
          codigoProducto: this.obtenerTexto(item, 'CodigoProducto', 100),
          codigoCategoria: this.obtenerTexto(item, 'CodigoCategoria', 100),
          categoria: this.obtenerTexto(item, 'Categoria', 500),
          nombreProducto: this.obtenerTexto(item, 'NombreProducto', 500),
          descripcion: this.obtenerTexto(item, 'Descripcion'),
          unidadMedida: this.obtenerTexto(item, 'UnidadMedida', 100),
          cantidad: this.obtenerDecimalComoTexto(item, 'Cantidad'),
        }),
      );

      if (items.length > 0) {
        await itemsRepository.save(items);
      }

      const resultado = await this.guardarResultado(
        administrador,
        licitacionGuardada.id,
        datos,
      );

      return {
        codigoExterno: licitacionGuardada.codigoExterno,
        creada: !existente,
        itemsGuardados: items.length,
        clasificacionResultado: resultado.clasificacion,
        sincronizadoEn: licitacionGuardada.sincronizadoEn,
      };
    });
  }

  private async guardarResultado(
    administrador: EntityManager,
    licitacionId: string,
    datos: LicitacionMercadoPublico,
  ): Promise<LicitacionResultado> {
    const analisis = analizarResultadoLicitacion(datos);
    const resultadosRepository =
      administrador.getRepository(LicitacionResultado);
    const adjudicacionesRepository = administrador.getRepository(
      LicitacionAdjudicacion,
    );
    const existente = await resultadosRepository.findOne({
      where: { licitacionId },
    });
    const valores: DeepPartial<LicitacionResultado> = {
      licitacionId,
      clasificacion: analisis.clasificacion,
      motivo: analisis.motivo,
      fuenteMotivo: analisis.fuenteMotivo,
      numeroOferentes: analisis.numeroOferentes,
      montoTotalAdjudicado: analisis.montoTotalAdjudicado,
      cantidadAdjudicaciones: analisis.adjudicaciones.length,
      datosOrigen: analisis.datosOrigen,
      resultadoSincronizadoEn: new Date(),
    };
    const resultado = await resultadosRepository.save(
      existente
        ? resultadosRepository.merge(existente, valores)
        : resultadosRepository.create(valores),
    );

    await adjudicacionesRepository.delete({ resultadoId: resultado.id });
    if (analisis.adjudicaciones.length > 0) {
      await adjudicacionesRepository.save(
        analisis.adjudicaciones.map((adjudicacion) =>
          adjudicacionesRepository.create({
            resultadoId: resultado.id,
            ...adjudicacion,
          }),
        ),
      );
    }
    return resultado;
  }

  private mapearLicitacion(
    datos: LicitacionMercadoPublico,
  ): DeepPartial<Licitacion> {
    const comprador = this.obtenerObjeto(datos, 'Comprador');
    const fechas = this.obtenerObjeto(datos, 'Fechas');

    const codigoExterno = this.obtenerTexto(datos, 'CodigoExterno', 50);

    const nombre = this.obtenerTexto(datos, 'Nombre', 500);
    const codigoEstado = this.obtenerNumero(datos, 'CodigoEstado');

    if (!codigoExterno || !nombre || codigoEstado === null) {
      throw new BadGatewayException(
        'Mercado Público entregó una licitación incompleta',
      );
    }

    const fechaCierre =
      this.obtenerFecha(datos, 'FechaCierre') ??
      this.obtenerFecha(fechas, 'FechaCierre');

    return {
      codigoExterno,
      nombre,
      descripcion: this.obtenerTexto(datos, 'Descripcion'),
      codigoEstado: Math.trunc(codigoEstado),
      estado:
        this.obtenerTexto(datos, 'Estado', 100) ??
        `Código ${Math.trunc(codigoEstado)}`,
      codigoTipo: this.obtenerTexto(datos, 'CodigoTipo', 20),
      tipo: this.obtenerTexto(datos, 'Tipo', 250),
      moneda: this.obtenerTexto(datos, 'Moneda', 10),
      montoEstimado: this.obtenerDecimalComoTexto(datos, 'MontoEstimado'),
      fechaPublicacion: this.obtenerFecha(fechas, 'FechaPublicacion'),
      fechaCierre,
      fechaAdjudicacion: this.obtenerFecha(fechas, 'FechaAdjudicacion'),
      codigoOrganismo: this.obtenerTexto(comprador, 'CodigoOrganismo', 50),
      nombreOrganismo: this.obtenerTexto(comprador, 'NombreOrganismo', 300),
      codigoUnidad: this.obtenerTexto(comprador, 'CodigoUnidad', 50),
      nombreUnidad: this.obtenerTexto(comprador, 'NombreUnidad', 300),
      comunaUnidad: this.obtenerTexto(comprador, 'ComunaUnidad', 120),
      regionUnidad: this.obtenerTexto(comprador, 'RegionUnidad', 120),
      cantidadReclamos: this.obtenerEnteroOpcional(datos, 'CantidadReclamos'),
      datosOrigen: { ...datos },
      sincronizadoEn: new Date(),
      detalleSincronizadoEn: new Date(),
    };
  }

  private normalizarListadoActivo(
    listado: LicitacionMercadoPublico[],
  ): ResumenLicitacionActiva[] {
    const unicas = new Map<string, ResumenLicitacionActiva>();

    for (const datos of listado) {
      const codigoExterno = this.obtenerTexto(datos, 'CodigoExterno', 50)
        ?.trim()
        .toUpperCase();
      const nombre = this.obtenerTexto(datos, 'Nombre', 500);
      const codigoEstado = this.obtenerNumero(datos, 'CodigoEstado');

      if (!codigoExterno || !nombre || codigoEstado === null) {
        throw new BadGatewayException(
          'Mercado Público entregó un registro activo incompleto',
        );
      }

      if (!/^[0-9]+-[0-9]+-[A-Z0-9]+$/.test(codigoExterno)) {
        throw new BadGatewayException(
          'Mercado Público entregó un código activo inválido',
        );
      }

      const codigoEstadoEntero = Math.trunc(codigoEstado);

      unicas.set(codigoExterno, {
        codigoExterno,
        nombre,
        codigoEstado: codigoEstadoEntero,
        estado: this.obtenerNombreEstado(codigoEstadoEntero),
        tipo: this.inferirTipoDesdeCodigo(codigoExterno),
        fechaCierre: this.obtenerFecha(datos, 'FechaCierre'),
        datosOrigen: { ...datos },
      });
    }

    return [...unicas.values()];
  }

  private obtenerNombreEstado(codigoEstado: number): string {
    const estados: Record<number, string> = {
      5: 'Publicada',
      6: 'Cerrada',
      7: 'Desierta',
      8: 'Adjudicada',
      18: 'Revocada',
      19: 'Suspendida',
    };

    return estados[codigoEstado] ?? `Código ${codigoEstado}`;
  }

  private inferirTipoDesdeCodigo(codigoExterno: string): string | null {
    const segmento = codigoExterno.split('-').at(-1);
    const coincidencia = segmento
      ? /^([A-Z][A-Z0-9]*?)\d{2}$/.exec(segmento)
      : null;

    if (!coincidencia) {
      return null;
    }

    return coincidencia[1].slice(0, 20);
  }

  private extraerItems(
    datos: LicitacionMercadoPublico,
  ): Record<string, unknown>[] {
    const contenedorItems = this.obtenerObjeto(datos, 'Items');
    const listado = contenedorItems.Listado;

    if (!Array.isArray(listado)) {
      return [];
    }

    return listado.filter((item): item is Record<string, unknown> =>
      this.esObjeto(item),
    );
  }

  private obtenerObjeto(
    origen: Record<string, unknown>,
    campo: string,
  ): Record<string, unknown> {
    const valor = origen[campo];

    return this.esObjeto(valor) ? valor : {};
  }

  private obtenerTexto(
    origen: Record<string, unknown>,
    campo: string,
    longitudMaxima?: number,
  ): string | null {
    const valor = origen[campo];

    if (valor === null || valor === undefined) {
      return null;
    }

    const texto = String(valor).trim();

    if (!texto) {
      return null;
    }

    return longitudMaxima ? texto.slice(0, longitudMaxima) : texto;
  }

  private obtenerNumero(
    origen: Record<string, unknown>,
    campo: string,
  ): number | null {
    const valor = origen[campo];

    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : null;
    }

    if (typeof valor !== 'string' || !valor.trim()) {
      return null;
    }

    const numero = Number(valor.trim().replace(',', '.'));

    return Number.isFinite(numero) ? numero : null;
  }

  private obtenerEnteroOpcional(
    origen: Record<string, unknown>,
    campo: string,
  ): number | null {
    const numero = this.obtenerNumero(origen, campo);

    return numero === null ? null : Math.trunc(numero);
  }

  private obtenerEnteroRequerido(
    origen: Record<string, unknown>,
    campo: string,
  ): number {
    const numero = this.obtenerNumero(origen, campo);

    if (numero === null) {
      throw new BadGatewayException(
        `Mercado Público omitió el campo requerido ${campo}`,
      );
    }

    return Math.trunc(numero);
  }

  private obtenerDecimalComoTexto(
    origen: Record<string, unknown>,
    campo: string,
  ): string | null {
    const valor = origen[campo];

    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return String(valor);
    }

    if (typeof valor !== 'string') {
      return null;
    }

    const texto = valor.trim().replace(',', '.');

    if (!texto || !Number.isFinite(Number(texto))) {
      return null;
    }

    return texto;
  }

  private obtenerFecha(
    origen: Record<string, unknown>,
    campo: string,
  ): Date | null {
    const texto = this.obtenerTexto(origen, campo);

    if (!texto) {
      return null;
    }

    const fechaDotNet = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(texto);

    const fecha = fechaDotNet
      ? new Date(Number(fechaDotNet[1]))
      : new Date(texto);

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null;
  }
}
