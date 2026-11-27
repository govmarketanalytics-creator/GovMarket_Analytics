import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { MembresiaEmpresaGuard } from '../membresias/guards/membresia-empresa.guard';
import { PlanPremiumGuard } from '../planes-empresa/guards/plan-premium.guard';
import { FavoritosService } from './favoritos.service';

@Controller('empresas/:empresaId/favoritos')
@UseGuards(JwtAuthGuard, MembresiaEmpresaGuard, PlanPremiumGuard)
export class FavoritosController {
  constructor(private readonly favoritosService: FavoritosService) {}

  @Post(':codigoExterno')
  agregar(
    @Param('empresaId') empresaId: string,
    @Param('codigoExterno') codigoExterno: string,
    @Req() request: RequestConUsuario,
  ) {
    return this.favoritosService.agregar(
      empresaId,
      codigoExterno,
      request.user.sub,
    );
  }

  @Get()
  listar(@Param('empresaId') empresaId: string) {
    return this.favoritosService.listar(empresaId);
  }

  @Delete(':codigoExterno')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('empresaId') empresaId: string,
    @Param('codigoExterno') codigoExterno: string,
  ) {
    return this.favoritosService.eliminar(empresaId, codigoExterno);
  }
}
