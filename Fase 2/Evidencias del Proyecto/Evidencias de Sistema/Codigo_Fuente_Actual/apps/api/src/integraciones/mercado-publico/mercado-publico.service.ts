import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RespuestaLicitacionesMercadoPublico } from './interfaces/licitacion-mercado-publico.interface';
import { ConsultasMercadoPausadas, ControlConsultasService } from './control-consultas.service';

@Injectable()
export class MercadoPublicoService {
  private readonly logger = new Logger(MercadoPublicoService.name);
  private readonly apiUrl: string;
  private readonly ticket: string;
  private readonly timeoutMs: number;
  private readonly maxReintentos: number;
  private readonly esperaBaseReintentoMs: number;

  constructor(configService: ConfigService, private readonly control: ControlConsultasService) {
    this.apiUrl = configService
      .getOrThrow<string>('MERCADO_PUBLICO_API_URL')
      .replace(/\/+$/, '');

    this.ticket = configService.getOrThrow<string>('MERCADO_PUBLICO_TICKET');

    this.timeoutMs = configService.getOrThrow<number>(
      'MERCADO_PUBLICO_TIMEOUT_MS',
    );

    this.maxReintentos = configService.getOrThrow<number>(
      'MERCADO_PUBLICO_MAX_RETRIES',
    );

    this.esperaBaseReintentoMs = configService.getOrThrow<number>(
      'MERCADO_PUBLICO_RETRY_BASE_DELAY_MS',
    );
  }

  listarLicitacionesDelDia(): Promise<RespuestaLicitacionesMercadoPublico> {
    return this.solicitarLicitaciones({});
  }

  listarLicitacionesActivas(): Promise<RespuestaLicitacionesMercadoPublico> {
    return this.solicitarLicitaciones({ estado: 'activas' });
  }

  listarLicitacionesPorFecha(
    fecha: Date,
  ): Promise<RespuestaLicitacionesMercadoPublico> {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha de consulta no es válida');
    }

    return this.solicitarLicitaciones({
      fecha: this.formatearFecha(fecha),
    });
  }

  obtenerLicitacionPorCodigo(
    codigo: string,
  ): Promise<RespuestaLicitacionesMercadoPublico> {
    const codigoNormalizado = codigo.trim().toUpperCase();

    if (!/^[0-9]+-[0-9]+-[A-Z0-9]+$/.test(codigoNormalizado)) {
      throw new BadRequestException(
        'El código de licitación no tiene un formato válido',
      );
    }

    return this.solicitarLicitaciones({
      codigo: codigoNormalizado,
    });
  }

  private async solicitarLicitaciones(
    parametros: Record<string, string>,
  ): Promise<RespuestaLicitacionesMercadoPublico> {
    const url = new URL(`${this.apiUrl}/licitaciones.json`);

    for (const [nombre, valor] of Object.entries(parametros)) {
      url.searchParams.set(nombre, valor);
    }

    url.searchParams.set('ticket', this.ticket);

    const respuesta = await this.obtenerRespuestaConReintentos(url);

    if (!respuesta.ok) {
      this.logger.error(
        `Mercado Público respondió con estado HTTP ${respuesta.status}`,
      );

      throw new BadGatewayException('Mercado Público rechazó la solicitud');
    }

    let datos: unknown;

    try {
      datos = await respuesta.json();
    } catch {
      throw new BadGatewayException(
        'Mercado Público entregó una respuesta JSON inválida',
      );
    }

    if (!this.esRespuestaValida(datos)) {
      throw new BadGatewayException(
        'Mercado Público entregó una estructura inesperada',
      );
    }

    return datos;
  }

  private async obtenerRespuestaConReintentos(url: URL): Promise<Response> {
    for (let intento = 0; intento <= this.maxReintentos; intento += 1) {
      const respuesta = await this.realizarSolicitud(url);

      const permiteReintento =
        respuesta.status === 429 && intento < this.maxReintentos;

      if (respuesta.status === 429 && !permiteReintento) {
        throw new ConsultasMercadoPausadas('limitacion_remota');
      }
      if (!permiteReintento) {
        return respuesta;
      }

      const esperaMs = this.calcularEsperaReintento(
        respuesta.headers.get('retry-after'),
        intento,
      );

      this.logger.warn(
        `Mercado Público limitó la solicitud. Reintento ${
          intento + 1
        }/${this.maxReintentos} en ${esperaMs} ms`,
      );

      await this.esperar(esperaMs);
    }

    throw new ServiceUnavailableException(
      'Mercado Público no está disponible temporalmente',
    );
  }

  private async realizarSolicitud(url: URL): Promise<Response> {
    await this.control.reservarSolicitud();
    const controlador = new AbortController();

    const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        headers: {
          accept: 'application/json',
        },
        signal: controlador.signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException(
          'Mercado Público tardó demasiado en responder',
        );
      }

      this.logger.error(
        'No fue posible establecer conexión con Mercado Público',
      );

      throw new ServiceUnavailableException(
        'Mercado Público no está disponible temporalmente',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  private calcularEsperaReintento(
    retryAfter: string | null,
    intento: number,
  ): number {
    const esperaExponencial = this.esperaBaseReintentoMs * 2 ** intento;

    if (!retryAfter) {
      return Math.min(esperaExponencial, 60000);
    }

    const segundos = Number(retryAfter);

    if (Number.isFinite(segundos) && segundos >= 0) {
      return Math.min(
        Math.max(esperaExponencial, Math.ceil(segundos * 1000)),
        60000,
      );
    }

    const fechaReintento = Date.parse(retryAfter);

    if (!Number.isNaN(fechaReintento)) {
      const esperaIndicada = Math.max(fechaReintento - Date.now(), 0);

      return Math.min(Math.max(esperaExponencial, esperaIndicada), 60000);
    }

    return Math.min(esperaExponencial, 60000);
  }

  private esRespuestaValida(
    datos: unknown,
  ): datos is RespuestaLicitacionesMercadoPublico {
    if (!this.esObjeto(datos)) {
      return false;
    }

    return (
      typeof datos.Cantidad === 'number' &&
      typeof datos.FechaCreacion === 'string' &&
      typeof datos.Version === 'string' &&
      Array.isArray(datos.Listado)
    );
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null;
  }

  private esperar(milisegundos: number): Promise<void> {
    return new Promise((resolver) => {
      setTimeout(resolver, milisegundos);
    });
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

    return `${obtenerParte('day')}${obtenerParte('month')}${obtenerParte(
      'year',
    )}`;
  }
}
