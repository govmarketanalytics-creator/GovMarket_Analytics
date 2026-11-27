import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperadministradorGuard } from '../auth/guards/superadministrador.guard';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { crearEmpresaSchema } from './dto/crear-empresa.dto';
import type { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { EmpresasService } from './empresas.service';

@Controller('empresas')
export class EmpresasController {
  constructor(
    private readonly empresasService: EmpresasService,
    private readonly planesEmpresaService: PlanesEmpresaService,
  ) {}

  @UseGuards(JwtAuthGuard, SuperadministradorGuard)
  @Post()
  crear(@Body({ schema: crearEmpresaSchema }) datos: CrearEmpresaDto) {
    return this.empresasService.crear(datos);
  }

  @UseGuards(JwtAuthGuard, SuperadministradorGuard)
  @Get()
  listar() {
    return this.empresasService.listar();
  }

  @UseGuards(JwtAuthGuard, MembresiaEmpresaGuard)
  @Get(':empresaId/plan')
  async obtenerPlan(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
  ) {
    await this.empresasService.buscarPorId(empresaId);
    return this.planesEmpresaService.obtener(empresaId);
  }

  @UseGuards(JwtAuthGuard, MembresiaEmpresaGuard)
  @Get(':empresaId')
  buscarPorId(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
  ) {
    return this.empresasService.buscarPorId(empresaId);
  }
}
