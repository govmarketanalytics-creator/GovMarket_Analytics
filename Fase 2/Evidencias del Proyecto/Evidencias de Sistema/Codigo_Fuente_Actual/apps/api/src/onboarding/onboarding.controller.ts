import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/jwt-payload.interface';
import { guardarEtiquetasCapacidadesSchema } from './dto/guardar-etiquetas-capacidades.dto';
import type { GuardarEtiquetasCapacidadesDto } from './dto/guardar-etiquetas-capacidades.dto';
import { guardarInformacionEmpresaSchema } from './dto/guardar-informacion-empresa.dto';
import type { GuardarInformacionEmpresaDto } from './dto/guardar-informacion-empresa.dto';
import { guardarPreferenciasComercialesSchema } from './dto/guardar-preferencias-comerciales.dto';
import type { GuardarPreferenciasComercialesDto } from './dto/guardar-preferencias-comerciales.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('estado')
  obtenerEstado(@Req() request: RequestConUsuario) {
    return this.onboardingService.obtenerEstado(request.user.sub);
  }

  @Post('empresa')
  registrarEmpresa(
    @Req() request: RequestConUsuario,
    @Body({ schema: guardarInformacionEmpresaSchema })
    datos: GuardarInformacionEmpresaDto,
  ) {
    return this.onboardingService.registrarEmpresa(request.user.sub, datos);
  }

  @Put('empresa')
  actualizarEmpresa(
    @Req() request: RequestConUsuario,
    @Body({ schema: guardarInformacionEmpresaSchema })
    datos: GuardarInformacionEmpresaDto,
  ) {
    return this.onboardingService.actualizarEmpresa(request.user.sub, datos);
  }

  @Put('etiquetas')
  guardarEtiquetas(
    @Req() request: RequestConUsuario,
    @Body({ schema: guardarEtiquetasCapacidadesSchema })
    datos: GuardarEtiquetasCapacidadesDto,
  ) {
    return this.onboardingService.guardarEtiquetas(request.user.sub, datos);
  }

  @Put('preferencias')
  guardarPreferencias(
    @Req() request: RequestConUsuario,
    @Body({ schema: guardarPreferenciasComercialesSchema })
    datos: GuardarPreferenciasComercialesDto,
  ) {
    return this.onboardingService.guardarPreferencias(request.user.sub, datos);
  }

  @Post('confirmar')
  @HttpCode(HttpStatus.OK)
  confirmar(@Req() request: RequestConUsuario) {
    return this.onboardingService.confirmar(request.user.sub);
  }
}
