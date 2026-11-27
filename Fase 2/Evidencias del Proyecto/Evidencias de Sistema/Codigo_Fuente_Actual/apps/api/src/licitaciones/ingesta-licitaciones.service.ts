import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPublicoService } from '../integraciones/mercado-publico/mercado-publico.service';
import { LicitacionesService } from './licitaciones.service';
import { ConsultasMercadoPausadas, ControlConsultasService } from '../integraciones/mercado-publico/control-consultas.service';
import { ColaDetallesService } from './cola-detalles.service';

export interface ErrorIngestaLicitacion {
  codigoExterno: string;
  mensaje: string;
}

export interface ResultadoIngestaLicitaciones {
  fechaConsulta: string;
  informadasPorApi: number;
  codigosUnicosEncontrados: number;
  limiteAplicado: number;
  procesadas: number;
  creadas: number;
  actualizadas: number;
  fallidas: number;
  itemsGuardados: number;
  errores: ErrorIngestaLicitacion[];
}

export interface ResultadoIngestaActivas {
  codigosNuevosParaNotificar: string[];
  cobertura: { total: number; conDetalle: number; pendientes: number };
  pausa: string | null;
  consultadoEn: string;
  informadasPorApi: number;
  indexadas: number;
  creadasEnCatalogo: number;
  actualizadasEnCatalogo: number;
  conCierreFuturo: number;
  conCierreVencido: number;
  limiteDetalles: number;
  detallesProcesados: number;
  detallesCompletados: number;
  detallesFallidos: number;
  itemsGuardados: number;
  codigosDetallesCompletados: string[];
  errores: ErrorIngestaLicitacion[];
}

export interface ResultadoIngestaMes {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  diasConsultados: number;
  diasOmitidosPorCheckpoint: number;
  informadasPorApi: number;
  codigosIndexados: number;
  creadasEnCatalogo: number;
  actualizadasEnCatalogo: number;
  limiteDetalles: number;
  resultadosProcesados: number;
  resultadosDesdeBase: number;
  detallesConsultadosApi: number;
  resultadosCompletados: number;
  resultadosFallidos: number;
  pendientesSinResultado: number;
  itemsGuardados: number;
  solicitudesApiAproximadas: number;
  errores: ErrorIngestaLicitacion[];
}

@Injectable()
export class IngestaLicitacionesService {
  private readonly limitePredeterminado: number;
  private readonly pausaEntreSolicitudesMs: number;

  constructor(
    private readonly mercadoPublicoService: MercadoPublicoService,
    private readonly licitacionesService: LicitacionesService,
    configService: ConfigService,
    private readonly control: ControlConsultasService,
    private readonly cola: ColaDetallesService,
  ) {
    this.limitePredeterminado = configService.getOrThrow<number>(
      'MERCADO_PUBLICO_BATCH_LIMIT',
    );

    this.pausaEntreSolicitudesMs = configService.getOrThrow<number>(
      'MERCADO_PUBLICO_DELAY_MS',
    );
  }

  async sincronizarFecha(
    fecha: Date,
    limite?: number,
  ): Promise<ResultadoIngestaLicitaciones> {
    return this.control.conBloqueo(() => this.sincronizarFechaInterna(fecha, limite));
  }

  private async sincronizarFechaInterna(fecha: Date, limite?: number): Promise<ResultadoIngestaLicitaciones> {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha de ingesta no es válida');
    }

    const limiteAplicado = limite ?? this.limitePredeterminado;

    if (
      !Number.isInteger(limiteAplicado) ||
      limiteAplicado <= 0 ||
      limiteAplicado > 1000
    ) {
      throw new BadRequestException(
        'El límite debe ser un número entero entre 1 y 1000',
      );
    }

    const respuesta =
      await this.mercadoPublicoService.listarLicitacionesPorFecha(fecha);

    const codigosUnicos = [
      ...new Set(
        respuesta.Listado.map((licitacion) =>
          licitacion.CodigoExterno?.trim().toUpperCase(),
        ).filter(
          (codigo): codigo is string =>
            typeof codigo === 'string' && codigo.length > 0,
        ),
      ),
    ];

    const codigosSeleccionados = codigosUnicos.slice(0, limiteAplicado);

    const resultado: ResultadoIngestaLicitaciones = {
      fechaConsulta: this.formatearFecha(fecha),
      informadasPorApi: respuesta.Cantidad,
      codigosUnicosEncontrados: codigosUnicos.length,
      limiteAplicado,
      procesadas: codigosSeleccionados.length,
      creadas: 0,
      actualizadas: 0,
      fallidas: 0,
      itemsGuardados: 0,
      errores: [],
    };

    for (let indice = 0; indice < codigosSeleccionados.length; indice += 1) {
      const codigoExterno = codigosSeleccionados[indice];

      if (this.pausaEntreSolicitudesMs > 0) {
        await this.esperar(this.pausaEntreSolicitudesMs);
      }

      try {
        const sincronizacion =
          await this.licitacionesService.sincronizarPorCodigo(codigoExterno);

        if (sincronizacion.creada) {
          resultado.creadas += 1;
        } else {
          resultado.actualizadas += 1;
        }

        resultado.itemsGuardados += sincronizacion.itemsGuardados;
      } catch (error: unknown) {
        resultado.fallidas += 1;
        resultado.errores.push({
          codigoExterno,
          mensaje: this.obtenerMensajeSeguro(error),
        });
      }
    }

    return resultado;
  }

  async sincronizarActivas(
    limiteDetalles?: number,
    informarProgreso?: (completadas: number, total: number) => void,
  ): Promise<ResultadoIngestaActivas> {
    return this.control.conBloqueo(() => this.sincronizarActivasInterna(limiteDetalles, informarProgreso));
  }

  async confirmarNotificacionesNuevas(codigos: string[]): Promise<void> {
    await this.cola.confirmarNotificaciones(codigos);
  }

  private async sincronizarActivasInterna(limiteDetalles?: number, informarProgreso?: (completadas: number, total: number) => void): Promise<ResultadoIngestaActivas> {
    const limiteAplicado = limiteDetalles ?? this.limitePredeterminado;

    if (
      !Number.isInteger(limiteAplicado) ||
      limiteAplicado < 0 ||
      limiteAplicado > 1000
    ) {
      throw new BadRequestException(
        'El límite de detalles debe ser un número entero entre 0 y 1000',
      );
    }

    const respuesta =
      await this.mercadoPublicoService.listarLicitacionesActivas();

    if (respuesta.Cantidad !== respuesta.Listado.length) {
      throw new BadGatewayException(
        'Mercado Público entregó un catálogo activo incompleto; no se modificó la base local',
      );
    }

    const fechaRespuesta = new Date(respuesta.FechaCreacion);
    const consultadoEn = Number.isNaN(fechaRespuesta.getTime())
      ? new Date()
      : fechaRespuesta;
    const indexacion = await this.licitacionesService.indexarListadoActivo(
      respuesta.Listado,
      consultadoEn,
    );
    await this.cola.registrarPendientes(indexacion.codigosNuevos ?? []);
    const codigosPendientes = await this.cola.seleccionar(limiteAplicado);

    const resultado: ResultadoIngestaActivas = {
      codigosNuevosParaNotificar: [],
      cobertura: { total: 0, conDetalle: 0, pendientes: 0 },
      pausa: null,
      consultadoEn: consultadoEn.toISOString(),
      informadasPorApi: respuesta.Cantidad,
      indexadas: indexacion.indexadas,
      creadasEnCatalogo: indexacion.creadas,
      actualizadasEnCatalogo: indexacion.actualizadas,
      conCierreFuturo: indexacion.conCierreFuturo,
      conCierreVencido: indexacion.conCierreVencido,
      limiteDetalles: limiteAplicado,
      detallesProcesados: 0,
      detallesCompletados: 0,
      detallesFallidos: 0,
      itemsGuardados: 0,
      codigosDetallesCompletados: [],
      errores: [],
    };

    let fallosConsecutivos = 0;
    for (const codigoExterno of codigosPendientes) {
      if (this.pausaEntreSolicitudesMs > 0) {
        await this.esperar(this.pausaEntreSolicitudesMs);
      }

      try {
        resultado.detallesProcesados += 1;
        const sincronizacion =
          await this.licitacionesService.sincronizarPorCodigo(codigoExterno);

        resultado.detallesCompletados += 1;
        fallosConsecutivos = 0;
        resultado.itemsGuardados += sincronizacion.itemsGuardados;
        resultado.codigosDetallesCompletados.push(codigoExterno);
      } catch (error: unknown) {
        if (error instanceof ConsultasMercadoPausadas) {
          resultado.pausa = error.motivo;
          break;
        }
        await this.cola.registrarFallo(codigoExterno);
        fallosConsecutivos += 1;
        resultado.detallesFallidos += 1;
        resultado.errores.push({
          codigoExterno,
          mensaje: this.obtenerMensajeSeguro(error),
        });
      }
      const tratadas = resultado.detallesCompletados + resultado.detallesFallidos;
      if (tratadas % 25 === 0 || tratadas === codigosPendientes.length) informarProgreso?.(tratadas, codigosPendientes.length);
      if (fallosConsecutivos >= 3) {
        resultado.pausa = 'fallos_consecutivos';
        break;
      }
    }

    resultado.codigosNuevosParaNotificar = await this.cola.obtenerNuevasParaNotificar();
    resultado.cobertura = await this.cola.obtenerCobertura();

    return resultado;
  }

  async sincronizarMes(
    anio: number,
    mes: number,
    limiteDetalles = this.limitePredeterminado,
  ): Promise<ResultadoIngestaMes> {
    return this.control.conBloqueo(() => this.sincronizarMesInterno(anio, mes, limiteDetalles));
  }

  private async sincronizarMesInterno(anio: number, mes: number, limiteDetalles: number): Promise<ResultadoIngestaMes> {
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      throw new BadRequestException('El año indicado no es válido');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('El mes indicado no es válido');
    }
    if (
      !Number.isInteger(limiteDetalles) ||
      limiteDetalles < 0 ||
      limiteDetalles > 1000
    ) {
      throw new BadRequestException(
        'El límite mensual debe ser un entero entre 0 y 1000',
      );
    }

    const hoyChile = this.obtenerFechaActualChile();
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
    const periodoActual = `${hoyChile.anio}-${String(hoyChile.mes).padStart(2, '0')}`;

    if (periodo > periodoActual) {
      throw new BadRequestException('No es posible sincronizar un mes futuro');
    }

    const ultimoDiaMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const ultimoDia = periodo === periodoActual ? hoyChile.dia : ultimoDiaMes;
    const fechaInicio = `${periodo}-01`;
    const fechaFin = `${periodo}-${String(ultimoDia).padStart(2, '0')}`;
    const checkpoints =
      await this.licitacionesService.obtenerFechasListadoSincronizadas(
        fechaInicio,
        fechaFin,
      );
    const resultado: ResultadoIngestaMes = {
      periodo,
      fechaInicio,
      fechaFin,
      diasConsultados: 0,
      diasOmitidosPorCheckpoint: 0,
      informadasPorApi: 0,
      codigosIndexados: 0,
      creadasEnCatalogo: 0,
      actualizadasEnCatalogo: 0,
      limiteDetalles,
      resultadosProcesados: 0,
      resultadosDesdeBase: 0,
      detallesConsultadosApi: 0,
      resultadosCompletados: 0,
      resultadosFallidos: 0,
      pendientesSinResultado: 0,
      itemsGuardados: 0,
      solicitudesApiAproximadas: 0,
      errores: [],
    };

    for (let dia = 1; dia <= ultimoDia; dia += 1) {
      const fechaTexto = `${periodo}-${String(dia).padStart(2, '0')}`;
      const esHoy = periodo === periodoActual && dia === hoyChile.dia;

      if (checkpoints.has(fechaTexto) && !esHoy) {
        resultado.diasOmitidosPorCheckpoint += 1;
        continue;
      }

      if (
        resultado.solicitudesApiAproximadas > 0 &&
        this.pausaEntreSolicitudesMs > 0
      ) {
        await this.esperar(this.pausaEntreSolicitudesMs);
      }

      const fechaConsulta = new Date(Date.UTC(anio, mes - 1, dia, 15));
      const respuesta =
        await this.mercadoPublicoService.listarLicitacionesPorFecha(
          fechaConsulta,
        );
      resultado.solicitudesApiAproximadas += 1;

      if (respuesta.Cantidad !== respuesta.Listado.length) {
        throw new BadGatewayException(
          `Mercado Público entregó un listado incompleto para ${fechaTexto}`,
        );
      }

      const indexacion = await this.licitacionesService.indexarListadoFecha(
        respuesta.Listado,
        fechaConsulta,
        new Date(respuesta.FechaCreacion),
      );
      await this.licitacionesService.registrarSincronizacionListadoDia(
        fechaTexto,
        respuesta.Cantidad,
        indexacion.indexadas,
      );

      resultado.diasConsultados += 1;
      resultado.informadasPorApi += respuesta.Cantidad;
      resultado.codigosIndexados += indexacion.indexadas;
      resultado.creadasEnCatalogo += indexacion.creadas;
      resultado.actualizadasEnCatalogo += indexacion.actualizadas;
    }

    const pendientes =
      await this.licitacionesService.seleccionarPendientesResultadoPeriodo(
        fechaInicio,
        fechaFin,
        limiteDetalles,
      );
    resultado.resultadosProcesados = pendientes.length;

    for (const pendiente of pendientes) {
      try {
        if (!pendiente.requiereConsultaApi) {
          const reconstruida =
            await this.licitacionesService.actualizarResultadoDesdeDatosGuardados(
              pendiente.codigoExterno,
            );
          if (reconstruida) {
            resultado.resultadosDesdeBase += 1;
            resultado.resultadosCompletados += 1;
            continue;
          }
        }

        if (this.pausaEntreSolicitudesMs > 0) {
          await this.esperar(this.pausaEntreSolicitudesMs);
        }
        const sincronizacion =
          await this.licitacionesService.sincronizarPorCodigo(
            pendiente.codigoExterno,
          );
        resultado.detallesConsultadosApi += 1;
        resultado.solicitudesApiAproximadas += 1;
        resultado.resultadosCompletados += 1;
        resultado.itemsGuardados += sincronizacion.itemsGuardados;
      } catch (error: unknown) {
        resultado.resultadosFallidos += 1;
        resultado.errores.push({
          codigoExterno: pendiente.codigoExterno,
          mensaje: this.obtenerMensajeSeguro(error),
        });
      }
    }

    resultado.pendientesSinResultado =
      await this.licitacionesService.contarPendientesResultadoPeriodo(
        fechaInicio,
        fechaFin,
      );
    return resultado;
  }

  private formatearFecha(fecha: Date): string {
    const partes = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(fecha);

    const obtenerParte = (tipo: Intl.DateTimeFormatPartTypes): string =>
      partes.find((parte) => parte.type === tipo)?.value ?? '';

    return `${obtenerParte('year')}-${obtenerParte(
      'month',
    )}-${obtenerParte('day')}`;
  }

  private obtenerFechaActualChile(): {
    anio: number;
    mes: number;
    dia: number;
  } {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(partes.find((parte) => parte.type === tipo)?.value);

    return { anio: valor('year'), mes: valor('month'), dia: valor('day') };
  }

  private obtenerMensajeSeguro(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Error desconocido durante la sincronización';
    }

    return error.message.slice(0, 300);
  }

  private esperar(milisegundos: number): Promise<void> {
    return new Promise((resolver) => {
      setTimeout(resolver, milisegundos);
    });
  }
}
