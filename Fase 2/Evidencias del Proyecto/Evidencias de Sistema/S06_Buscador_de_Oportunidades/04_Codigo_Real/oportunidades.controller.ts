import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { consultarOportunidadesSchema } from './dto/consultar-oportunidades.dto';
import type { ConsultarOportunidadesDto } from './dto/consultar-oportunidades.dto';
import { OportunidadesService } from './oportunidades.service';
import { MedicionOportunidades } from './cache-consultas';

@Controller('empresas/:empresaId/oportunidades')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard)
export class OportunidadesController {
  constructor(private readonly oportunidadesService: OportunidadesService) {}

  @Get()
  async listar(
    @Param('empresaId') empresaId: string,
    @Query({ schema: consultarOportunidadesSchema })
    filtros: ConsultarOportunidadesDto,
    @Res({ passthrough: true }) respuesta?: Response,
  ) {
    const tiempos = new MedicionOportunidades();
    const datos = await tiempos.medir('servicio', () => this.oportunidadesService.listar(empresaId, filtros, tiempos));
    respuesta?.setHeader('Server-Timing', tiempos.cabecera());
    respuesta?.setHeader('Cache-Control', 'private, no-store');
    return datos;
  }

  @Get('filtros')
  listarFiltros(@Param('empresaId') _empresaId: string,
    @Query({ schema: consultarOportunidadesSchema }) filtros: ConsultarOportunidadesDto) {
    return this.oportunidadesService.listarFiltros(filtros.soloVigentes);
  }

  @Get('dashboard/resumen')
  obtenerResumenDashboard(@Param('empresaId') empresaId: string) {
    return this.oportunidadesService.obtenerResumenDashboard(empresaId);
  }

  @Get(':codigoExterno')
  obtenerDetalle(
    @Param('empresaId') empresaId: string,
    @Param('codigoExterno') codigoExterno: string,
    @Req() request: RequestConUsuario,
  ) {
    return this.oportunidadesService.obtenerDetalle(
      empresaId,
      codigoExterno,
      request.user.esSuperadministrador,
    );
  }
}
