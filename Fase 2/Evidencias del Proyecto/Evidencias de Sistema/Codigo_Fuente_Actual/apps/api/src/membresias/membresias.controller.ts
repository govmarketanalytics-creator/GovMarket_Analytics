import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { PlanPremiumGuard } from '../planes-empresa/guards/plan-premium.guard';
import { RolesEmpresa } from './decorators/roles-empresa.decorator';
import { crearUsuarioEmpresaSchema } from './dto/crear-usuario-empresa.dto';
import type { CrearUsuarioEmpresaDto } from './dto/crear-usuario-empresa.dto';
import { RolMembresiaEmpresa } from './entities/membresia-empresa.entity';
import { MembresiaEmpresaGuard } from './guards/membresia-empresa.guard';
import { RolEmpresaGuard } from './guards/rol-empresa.guard';
import { MembresiasService } from './membresias.service';

@Controller('empresas/:empresaId/usuarios')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard, RolEmpresaGuard)
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @RolesEmpresa(RolMembresiaEmpresa.ADMINISTRADOR)
  @UseGuards(PlanPremiumGuard)
  @Post()
  crearUsuarioEnEmpresa(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
    @Body({ schema: crearUsuarioEmpresaSchema })
    datos: CrearUsuarioEmpresaDto,
    @Req() request: RequestConUsuario,
  ) {
    return this.membresiasService.crearUsuarioEnEmpresa(
      empresaId,
      datos,
      request.user.esSuperadministrador,
    );
  }

  @RolesEmpresa(RolMembresiaEmpresa.ADMINISTRADOR)
  @Get()
  listarUsuariosDeEmpresa(
    @Param('empresaId', new ParseUUIDPipe({ version: '4' }))
    empresaId: string,
  ) {
    return this.membresiasService.listarUsuariosDeEmpresa(empresaId);
  }
}
