import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { RolesEmpresa } from '../membresias/decorators/roles-empresa.decorator';
import { RolMembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { RolEmpresaGuard } from '../membresias/guards/rol-empresa.guard';
import { PlanPremiumGuard } from '../planes-empresa/guards/plan-premium.guard';
import { consultarAlertasSchema } from './dto/consultar-alertas.dto';
import type { ConsultarAlertasDto } from './dto/consultar-alertas.dto';
import { AlertasService } from './alertas.service';

@Controller('empresas/:empresaId/alertas')
@UseGuards(
  JwtAuthGuard,
  MembresiaEmpresaGuard,
  RolEmpresaGuard,
  PlanPremiumGuard,
)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post('generar')
  @HttpCode(HttpStatus.OK)
  @RolesEmpresa(RolMembresiaEmpresa.ADMINISTRADOR)
  generar(
    @Param('empresaId') empresaId: string,
    @Req() request: RequestConUsuario,
  ) {
    return this.alertasService.generar(
      empresaId,
      request.user.esSuperadministrador,
    );
  }

  @Get()
  listar(
    @Param('empresaId') empresaId: string,
    @Query({ schema: consultarAlertasSchema })
    filtros: ConsultarAlertasDto,
  ) {
    return this.alertasService.listar(empresaId, filtros);
  }

  @Patch(':alertaId/leida')
  marcarComoLeida(
    @Param('empresaId') empresaId: string,
    @Param('alertaId', new ParseUUIDPipe({ version: '4' }))
    alertaId: string,
  ) {
    return this.alertasService.marcarComoLeida(empresaId, alertaId);
  }
}
