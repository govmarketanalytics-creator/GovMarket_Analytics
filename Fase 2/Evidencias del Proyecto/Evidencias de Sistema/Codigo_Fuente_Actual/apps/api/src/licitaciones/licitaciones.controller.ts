import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsultaLicitacionesService } from './consulta-licitaciones/consulta-licitaciones.service';
import { consultarLicitacionesSchema } from './dto/consultar-licitaciones.dto';
import type { ConsultarLicitacionesDto } from './dto/consultar-licitaciones.dto';
import { obtenerCatalogoPublico } from './catalogo-etiquetas';
import { catalogoNexusPublico } from '../nexus/catalogo-nexus';

@Controller('licitaciones')
@UseGuards(JwtAuthGuard)
export class LicitacionesController {
  constructor(
    private readonly consultaLicitacionesService: ConsultaLicitacionesService,
  ) {}

  @Get()
  listar(
    @Query({ schema: consultarLicitacionesSchema })
    filtros: ConsultarLicitacionesDto,
  ) {
    return this.consultaLicitacionesService.listar(filtros);
  }

  @Get('catalogo-etiquetas')
  obtenerCatalogoEtiquetas() {
    return { rubros: obtenerCatalogoPublico(), nexus: catalogoNexusPublico() };
  }

  @Get(':codigoExterno')
  obtenerPorCodigo(@Param('codigoExterno') codigoExterno: string) {
    return this.consultaLicitacionesService.obtenerPorCodigo(codigoExterno);
  }
}
