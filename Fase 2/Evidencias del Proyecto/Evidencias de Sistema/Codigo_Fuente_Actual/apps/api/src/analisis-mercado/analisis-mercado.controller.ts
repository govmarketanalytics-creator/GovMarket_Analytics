import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MembresiaEmpresaGuard } from "../membresias/guards/membresia-empresa.guard";
import { PlanPremiumGuard } from "../planes-empresa/guards/plan-premium.guard";
import { AnalisisMercadoService } from "./analisis-mercado.service";
import { NoticiasMercadoService } from "./noticias-mercado.service";
import {
  consultarAnalisisMercadoSchema,
  consultarLicitacionesAnalisisSchema,
  type ConsultarLicitacionesAnalisisDto,
  type ConsultarAnalisisMercadoDto,
} from "./dto/consultar-analisis-mercado.dto";

@Controller("empresas/:empresaId/analisis-mercado")
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard, PlanPremiumGuard)
export class AnalisisMercadoController {
  constructor(
    private readonly analisisMercadoService: AnalisisMercadoService,
    private readonly noticiasMercadoService: NoticiasMercadoService,
  ) {}

  @Get("noticias")
  noticias() {
    return this.noticiasMercadoService.listar();
  }

  @Get("licitaciones")
  licitaciones(
    @Param("empresaId") empresaId: string,
    @Query({ schema: consultarLicitacionesAnalisisSchema })
    filtros: ConsultarLicitacionesAnalisisDto,
  ) {
    return this.analisisMercadoService.listarLicitaciones(empresaId, filtros);
  }

  @Get()
  consultar(
    @Param("empresaId") empresaId: string,
    @Query({ schema: consultarAnalisisMercadoSchema })
    filtros: ConsultarAnalisisMercadoDto,
  ) {
    return this.analisisMercadoService.consultar(empresaId, filtros);
  }
}
