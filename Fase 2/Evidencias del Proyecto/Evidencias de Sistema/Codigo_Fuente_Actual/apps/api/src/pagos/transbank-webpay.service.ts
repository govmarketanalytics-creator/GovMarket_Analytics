import { Injectable } from '@nestjs/common';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from 'transbank-sdk';

export interface RespuestaCrearWebpay {
  token: string;
  url: string;
}

export interface RespuestaCommitWebpay {
  vci?: string;
  amount: number;
  status: string;
  buy_order: string;
  session_id: string;
  card_detail?: { card_number?: string };
  accounting_date?: string;
  transaction_date?: string;
  authorization_code?: string;
  payment_type_code?: string;
  response_code: number;
  installments_number?: number;
}

@Injectable()
export class TransbankWebpayService {
  private readonly transaction: InstanceType<typeof WebpayPlus.Transaction>;

  constructor() {
    const options = new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration,
    );
    this.transaction = new WebpayPlus.Transaction(options);
  }

  crear(
    buyOrder: string,
    sessionId: string,
    monto: number,
    returnUrl: string,
  ): Promise<RespuestaCrearWebpay> {
    return this.transaction.create(buyOrder, sessionId, monto, returnUrl);
  }

  confirmar(token: string): Promise<RespuestaCommitWebpay> {
    return this.transaction.commit(token);
  }
}
