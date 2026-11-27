import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PagosService } from './pagos.service';

@Controller('pagos/transbank/webpay-plus')
export class TransbankRetornoController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('retorno')
  async procesarPost(
    @Body() parametros: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const destino = await this.pagosService.procesarRetorno(parametros);
    return response.redirect(HttpStatus.SEE_OTHER, destino);
  }

  @Get('retorno')
  async procesarGet(
    @Query() parametros: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const destino = await this.pagosService.procesarRetorno(parametros);
    return response.redirect(HttpStatus.SEE_OTHER, destino);
  }
}
