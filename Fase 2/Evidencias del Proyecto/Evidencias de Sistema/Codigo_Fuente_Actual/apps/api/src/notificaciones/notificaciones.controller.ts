import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { consultarNotificacionesSchema } from './dto/consultar-notificaciones.dto';
import type { ConsultarNotificacionesDto } from './dto/consultar-notificaciones.dto';
import { NotificacionesService } from './notificaciones.service';

@Controller('empresas/:empresaId/notificaciones')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(
    @Param('empresaId') empresaId: string,
    @Req() request: RequestConUsuario,
    @Query({ schema: consultarNotificacionesSchema })
    filtros: ConsultarNotificacionesDto,
  ) {
    return this.notificacionesService.listar(
      empresaId,
      request.user.sub,
      filtros,
    );
  }

  @Patch('leer-todas')
  marcarTodasComoLeidas(
    @Param('empresaId') empresaId: string,
    @Req() request: RequestConUsuario,
  ) {
    return this.notificacionesService.marcarTodasComoLeidas(
      empresaId,
      request.user.sub,
    );
  }

  @Patch(':notificacionId/leida')
  marcarComoLeida(
    @Param('empresaId') empresaId: string,
    @Param('notificacionId', new ParseUUIDPipe({ version: '4' }))
    notificacionId: string,
    @Req() request: RequestConUsuario,
  ) {
    return this.notificacionesService.marcarComoLeida(
      empresaId,
      request.user.sub,
      notificacionId,
    );
  }
}
