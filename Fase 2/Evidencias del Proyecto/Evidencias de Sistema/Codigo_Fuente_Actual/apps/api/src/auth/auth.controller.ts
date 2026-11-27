import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { cambiarPasswordSchema } from './dto/cambiar-password.dto';
import type { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { loginGoogleSchema } from './dto/login-google.dto';
import type { LoginGoogleDto } from './dto/login-google.dto';
import { loginSchema } from './dto/login.dto';
import type { LoginDto } from './dto/login.dto';
import { registrarUsuarioSchema } from './dto/registrar-usuario.dto';
import type { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { RequestConUsuario } from './interfaces/jwt-payload.interface';
import { actualizarPerfilSchema } from './dto/actualizar-perfil.dto';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registrarUsuario(
    @Body({ schema: registrarUsuarioSchema }) datos: RegistrarUsuarioDto,
  ) {
    return this.authService.registrarUsuario(datos);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  iniciarSesion(@Body({ schema: loginSchema }) credenciales: LoginDto) {
    return this.authService.iniciarSesion(credenciales);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  iniciarSesionConGoogle(
    @Body({ schema: loginGoogleSchema }) datos: LoginGoogleDto,
  ) {
    return this.authService.iniciarSesionConGoogle(datos.credential);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  obtenerPerfil(@Req() request: RequestConUsuario) {
    return this.authService.obtenerPerfil(request.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  actualizarPerfil(
    @Req() request: RequestConUsuario,
    @Body({ schema: actualizarPerfilSchema }) datos: ActualizarPerfilDto,
  ) {
    return this.authService.actualizarPerfil(request.user.sub, datos);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cambiarPassword(
    @Req() request: RequestConUsuario,
    @Body({ schema: cambiarPasswordSchema }) datos: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(request.user.sub, datos);
  }
}
