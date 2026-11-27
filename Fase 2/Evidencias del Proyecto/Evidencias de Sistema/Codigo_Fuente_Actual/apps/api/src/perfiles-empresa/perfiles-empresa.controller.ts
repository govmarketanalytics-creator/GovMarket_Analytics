import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesEmpresa } from '../membresias/decorators/roles-empresa.decorator';
import { RolMembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { RolEmpresaGuard } from '../membresias/guards/rol-empresa.guard';
import { guardarPerfilEmpresaSchema } from './dto/guardar-perfil-empresa.dto';
import type { GuardarPerfilEmpresaDto } from './dto/guardar-perfil-empresa.dto';
import { PerfilesEmpresaService } from './perfiles-empresa.service';

@Controller('empresas/:empresaId/perfil')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard, RolEmpresaGuard)
export class PerfilesEmpresaController {
  constructor(
    private readonly perfilesEmpresaService: PerfilesEmpresaService,
  ) {}

  @Get()
  obtener(@Param('empresaId') empresaId: string) {
    return this.perfilesEmpresaService.obtener(empresaId);
  }

  @Put()
  @RolesEmpresa(RolMembresiaEmpresa.ADMINISTRADOR)
  guardar(
    @Param('empresaId') empresaId: string,
    @Body({ schema: guardarPerfilEmpresaSchema })
    datos: GuardarPerfilEmpresaDto,
  ) {
    return this.perfilesEmpresaService.guardar(empresaId, datos);
  }
}
