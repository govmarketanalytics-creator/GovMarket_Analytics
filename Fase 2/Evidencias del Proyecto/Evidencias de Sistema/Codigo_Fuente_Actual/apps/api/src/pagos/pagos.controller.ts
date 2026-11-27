import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { RolesEmpresa } from '../membresias/decorators/roles-empresa.decorator';
import { RolMembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { RolEmpresaGuard } from '../membresias/guards/rol-empresa.guard';
import { iniciarPagoSchema } from './dto/iniciar-pago.dto';
import type { IniciarPagoDto } from './dto/iniciar-pago.dto';
import { PagosService } from './pagos.service';

@Controller('empresas/:empresaId/pagos')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard, RolEmpresaGuard)
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get('planes')
  listarPlanes() {
    return this.pagosService.listarPlanes();
  }

  @Post('webpay-plus/iniciar')
  @RolesEmpresa(RolMembresiaEmpresa.ADMINISTRADOR)
  @HttpCode(HttpStatus.OK)
  iniciarPago(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
    @Req() request: RequestConUsuario,
    @Body({ schema: iniciarPagoSchema }) datos: IniciarPagoDto,
  ) {
    return this.pagosService.iniciarPago(
      empresaId,
      request.user.sub,
      datos.plan,
    );
  }

  @Get(':pagoId')
  obtenerPago(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
    @Param('pagoId', new ParseUUIDPipe({ version: '4' })) pagoId: string,
  ) {
    return this.pagosService.obtenerPago(empresaId, pagoId);
  }
}
