import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import {
  EstadoSuscripcionEmpresa,
  PlanPagoEmpresa,
  SuscripcionEmpresa,
} from '../planes-empresa/entities/suscripcion-empresa.entity';
import {
  listarPlanesComerciales,
  obtenerPlanComercial,
} from './catalogo-planes';
import {
  EstadoPagoTransbank,
  PagoTransbank,
} from './entities/pago-transbank.entity';
import {
  type RespuestaCommitWebpay,
  TransbankWebpayService,
} from './transbank-webpay.service';

interface ParametrosRetorno {
  [key: string]: unknown;
}

function textoParametro(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  if (Array.isArray(valor) && typeof valor[0] === 'string') {
    return valor[0].trim() || null;
  }
  return null;
}

function textoSeguro(valor: unknown, maximo: number): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, maximo) : null;
}

function numeroSeguro(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function fechaSegura(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

@Injectable()
export class PagosService {
  private readonly publicAppUrl: string;

  constructor(
    @InjectRepository(PagoTransbank)
    private readonly pagosRepository: Repository<PagoTransbank>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly transbankWebpayService: TransbankWebpayService,
  ) {
    this.publicAppUrl = this.configService
      .getOrThrow<string>('PUBLIC_APP_URL')
      .replace(/\/$/, '');
  }

  listarPlanes() {
    return {
      ambiente: 'integracion',
      pagoReal: false,
      planes: listarPlanesComerciales(),
    };
  }

  async iniciarPago(
    empresaId: string,
    usuarioId: string,
    plan: PlanPagoEmpresa,
  ) {
    const planComercial = obtenerPlanComercial(plan);
    const pago = this.pagosRepository.create({
      empresaId,
      usuarioId,
      plan,
      buyOrder: this.generarBuyOrder(),
      sessionId: this.generarSessionId(usuarioId),
      tokenWs: null,
      monto: planComercial.monto,
      moneda: 'CLP',
      estado: EstadoPagoTransbank.INICIADA,
      estadoTransbank: null,
      codigoRespuesta: null,
      codigoAutorizacion: null,
      tipoPago: null,
      numeroCuotas: null,
      ultimosCuatroTarjeta: null,
      fechaTransaccion: null,
      motivoFallo: null,
      autorizadoEn: null,
      suscripcionActivadaEn: null,
      vigenciaDesdeAplicada: null,
      vigenciaHastaAplicada: null,
    });
    await this.pagosRepository.save(pago);

    try {
      const respuesta = await this.transbankWebpayService.crear(
        pago.buyOrder,
        pago.sessionId,
        pago.monto,
        `${this.publicAppUrl}/api/v1/pagos/transbank/webpay-plus/retorno`,
      );
      if (!respuesta.token || !respuesta.url) {
        throw new Error('Transbank no entregó token o URL de pago');
      }

      pago.tokenWs = respuesta.token;
      await this.pagosRepository.save(pago);

      return {
        pagoId: pago.id,
        ambiente: 'integracion',
        pagoReal: false,
        plan: planComercial,
        formulario: {
          metodo: 'POST',
          url: respuesta.url,
          tokenWs: respuesta.token,
        },
      };
    } catch (error: unknown) {
      pago.estado = EstadoPagoTransbank.ERROR;
      pago.motivoFallo = this.mensajeError(error);
      await this.pagosRepository.save(pago);
      throw new BadGatewayException(
        'No fue posible iniciar el pago de prueba con Transbank',
      );
    }
  }

  async procesarRetorno(parametros: ParametrosRetorno): Promise<string> {
    const token = textoParametro(parametros.token_ws);
    if (!token) return this.procesarAnulacion(parametros);

    const pago = await this.pagosRepository.findOne({
      where: { tokenWs: token },
    });
    if (!pago) return this.urlResultado(null, 'error');

    if (this.esEstadoFinal(pago.estado)) {
      await this.reintentarActivacionSiCorresponde(pago);
      return this.urlResultado(pago.id, pago.estado);
    }

    const reclamado = await this.pagosRepository
      .createQueryBuilder()
      .update(PagoTransbank)
      .set({ estado: EstadoPagoTransbank.CONFIRMANDO })
      .where('id = :id AND estado = :estado', {
        id: pago.id,
        estado: EstadoPagoTransbank.INICIADA,
      })
      .execute();

    if (reclamado.affected !== 1) {
      return this.urlResultado(pago.id, EstadoPagoTransbank.CONFIRMANDO);
    }

    try {
      const respuesta = await this.transbankWebpayService.confirmar(token);
      await this.guardarConfirmacion(pago, respuesta);
      return this.urlResultado(pago.id, pago.estado);
    } catch (error: unknown) {
      pago.estado = EstadoPagoTransbank.ERROR;
      pago.motivoFallo = this.mensajeError(error);
      await this.pagosRepository.save(pago);
      return this.urlResultado(pago.id, pago.estado);
    }
  }

  async obtenerPago(empresaId: string, pagoId: string) {
    let pago = await this.pagosRepository.findOne({
      where: { id: pagoId, empresaId },
    });
    if (!pago) throw new NotFoundException('El pago solicitado no existe');

    pago = await this.reintentarActivacionSiCorresponde(pago);
    return this.mapearPago(pago);
  }

  private async guardarConfirmacion(
    pago: PagoTransbank,
    respuesta: RespuestaCommitWebpay,
  ): Promise<void> {
    const montoRespuesta = numeroSeguro(respuesta.amount);
    const ordenValida = respuesta.buy_order === pago.buyOrder;
    const sesionValida = respuesta.session_id === pago.sessionId;
    const montoValido = montoRespuesta === pago.monto;

    const datosConfirmacion = {
      estadoTransbank: textoSeguro(respuesta.status, 40),
      codigoRespuesta: numeroSeguro(respuesta.response_code),
      codigoAutorizacion: textoSeguro(respuesta.authorization_code, 40),
      tipoPago: textoSeguro(respuesta.payment_type_code, 10),
      numeroCuotas: numeroSeguro(respuesta.installments_number),
      ultimosCuatroTarjeta: textoSeguro(respuesta.card_detail?.card_number, 4),
      fechaTransaccion: fechaSegura(respuesta.transaction_date),
    };

    if (!ordenValida || !sesionValida || !montoValido) {
      Object.assign(pago, datosConfirmacion, {
        estado: EstadoPagoTransbank.ERROR,
        motivoFallo:
          'La respuesta de Transbank no coincide con la orden registrada',
      });
      await this.pagosRepository.save(pago);
      return;
    }

    const autorizada =
      respuesta.response_code === 0 && respuesta.status === 'AUTHORIZED';

    Object.assign(pago, datosConfirmacion, {
      estado: autorizada
        ? EstadoPagoTransbank.AUTORIZADA
        : EstadoPagoTransbank.RECHAZADA,
      autorizadoEn: autorizada ? new Date() : null,
      motivoFallo: autorizada
        ? null
        : `Transacción no autorizada (${respuesta.response_code})`,
    });
    await this.pagosRepository.save(pago);

    if (autorizada) {
      const pagoActivado = await this.reintentarActivacionSiCorresponde(pago);
      Object.assign(pago, pagoActivado);
    }
  }

  private async reintentarActivacionSiCorresponde(
    pago: PagoTransbank,
  ): Promise<PagoTransbank> {
    if (
      pago.estado !== EstadoPagoTransbank.AUTORIZADA ||
      pago.suscripcionActivadaEn
    ) {
      return pago;
    }

    try {
      return await this.activarSuscripcionAutorizada(pago.id);
    } catch (error: unknown) {
      pago.motivoFallo =
        `Pago autorizado; activación Premium pendiente: ${this.mensajeError(error)}`.slice(
          0,
          300,
        );
      await this.pagosRepository.save(pago);
      return pago;
    }
  }

  private async activarSuscripcionAutorizada(
    pagoId: string,
  ): Promise<PagoTransbank> {
    return this.dataSource.transaction(async (manager) => {
      const pagosRepository = manager.getRepository(PagoTransbank);
      const pago = await pagosRepository.findOne({
        where: { id: pagoId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!pago) throw new Error('El pago autorizado ya no existe');
      if (pago.estado !== EstadoPagoTransbank.AUTORIZADA) return pago;
      if (pago.suscripcionActivadaEn) return pago;

      await manager.query('SELECT id FROM empresas WHERE id = $1 FOR UPDATE', [
        pago.empresaId,
      ]);

      const suscripcionesRepository = manager.getRepository(SuscripcionEmpresa);
      const suscripcion = await suscripcionesRepository.findOne({
        where: { empresaId: pago.empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      const ahora = new Date();
      const estaVigente =
        suscripcion?.estado === EstadoSuscripcionEmpresa.ACTIVA &&
        suscripcion.vigenteHasta.getTime() > ahora.getTime();
      const baseVigencia = estaVigente ? suscripcion.vigenteHasta : ahora;
      const planComercial = obtenerPlanComercial(pago.plan);
      const vigenteHasta = this.sumarMeses(
        baseVigencia,
        planComercial.mesesVigencia,
      );
      const vigenteDesde = estaVigente ? suscripcion.vigenteDesde : ahora;

      if (suscripcion) {
        suscripcion.plan = pago.plan;
        suscripcion.estado = EstadoSuscripcionEmpresa.ACTIVA;
        suscripcion.vigenteDesde = vigenteDesde;
        suscripcion.vigenteHasta = vigenteHasta;
        await suscripcionesRepository.save(suscripcion);
      } else {
        await suscripcionesRepository.save(
          suscripcionesRepository.create({
            empresaId: pago.empresaId,
            plan: pago.plan,
            estado: EstadoSuscripcionEmpresa.ACTIVA,
            vigenteDesde,
            vigenteHasta,
          }),
        );
      }

      pago.suscripcionActivadaEn = ahora;
      pago.vigenciaDesdeAplicada = vigenteDesde;
      pago.vigenciaHastaAplicada = vigenteHasta;
      pago.motivoFallo = null;
      return pagosRepository.save(pago);
    });
  }

  private async procesarAnulacion(
    parametros: ParametrosRetorno,
  ): Promise<string> {
    const buyOrder = textoParametro(parametros.TBK_ORDEN_COMPRA);
    const sessionId = textoParametro(parametros.TBK_ID_SESION);
    if (!buyOrder || !sessionId) return this.urlResultado(null, 'error');

    const pago = await this.pagosRepository.findOne({
      where: { buyOrder, sessionId },
    });
    if (!pago) return this.urlResultado(null, 'error');

    if (pago.estado === EstadoPagoTransbank.INICIADA) {
      pago.estado = EstadoPagoTransbank.ANULADA;
      pago.motivoFallo = 'El pago fue cancelado antes de completarse';
      await this.pagosRepository.save(pago);
    }
    return this.urlResultado(pago.id, pago.estado);
  }

  private mapearPago(pago: PagoTransbank) {
    const plan = obtenerPlanComercial(pago.plan);
    const mensajes: Record<EstadoPagoTransbank, string> = {
      [EstadoPagoTransbank.INICIADA]: 'El pago todavía no ha sido completado.',
      [EstadoPagoTransbank.CONFIRMANDO]:
        'Estamos confirmando el resultado con Transbank.',
      [EstadoPagoTransbank.AUTORIZADA]: pago.suscripcionActivadaEn
        ? 'Pago de prueba autorizado y plan Premium activado correctamente.'
        : 'Pago autorizado. La activación Premium se reintentará automáticamente.',
      [EstadoPagoTransbank.RECHAZADA]: 'El pago de prueba fue rechazado.',
      [EstadoPagoTransbank.ANULADA]: 'El pago de prueba fue cancelado.',
      [EstadoPagoTransbank.ERROR]:
        'No fue posible completar la validación del pago.',
    };

    return {
      id: pago.id,
      ambiente: 'integracion',
      pagoReal: false,
      suscripcionActivada: pago.suscripcionActivadaEn !== null,
      suscripcion:
        pago.suscripcionActivadaEn &&
        pago.vigenciaDesdeAplicada &&
        pago.vigenciaHastaAplicada
          ? {
              plan: pago.plan,
              estado: 'activa',
              vigenteDesde: pago.vigenciaDesdeAplicada.toISOString(),
              vigenteHasta: pago.vigenciaHastaAplicada.toISOString(),
              activadaEn: pago.suscripcionActivadaEn.toISOString(),
            }
          : null,
      estado: pago.estado,
      mensaje: mensajes[pago.estado],
      ordenCompra: pago.buyOrder,
      plan,
      monto: pago.monto,
      moneda: pago.moneda,
      codigoAutorizacion: pago.codigoAutorizacion,
      tipoPago: pago.tipoPago,
      numeroCuotas: pago.numeroCuotas,
      ultimosCuatroTarjeta: pago.ultimosCuatroTarjeta,
      fechaTransaccion: pago.fechaTransaccion?.toISOString() ?? null,
      creadoEn: pago.creadoEn.toISOString(),
    };
  }

  private generarBuyOrder(): string {
    return `GMA-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  }

  private sumarMeses(fecha: Date, meses: number): Date {
    const anio = fecha.getUTCFullYear();
    const mesObjetivo = fecha.getUTCMonth() + meses;
    const ultimoDiaObjetivo = new Date(
      Date.UTC(anio, mesObjetivo + 1, 0),
    ).getUTCDate();
    const resultado = new Date(fecha);
    resultado.setUTCDate(Math.min(fecha.getUTCDate(), ultimoDiaObjetivo));
    resultado.setUTCFullYear(anio, mesObjetivo);
    return resultado;
  }

  private generarSessionId(usuarioId: string): string {
    return `S-${usuarioId.slice(0, 8)}-${randomBytes(8).toString('hex')}`;
  }

  private esEstadoFinal(estado: EstadoPagoTransbank): boolean {
    return [
      EstadoPagoTransbank.AUTORIZADA,
      EstadoPagoTransbank.RECHAZADA,
      EstadoPagoTransbank.ANULADA,
      EstadoPagoTransbank.ERROR,
    ].includes(estado);
  }

  private urlResultado(pagoId: string | null, estado: string): string {
    const url = new URL(this.publicAppUrl);
    url.searchParams.set('pago', pagoId ?? 'desconocido');
    url.searchParams.set('resultadoPago', estado);
    return url.toString();
  }

  private mensajeError(error: unknown): string {
    return (error instanceof Error ? error.message : 'Error desconocido').slice(
      0,
      300,
    );
  }
}
