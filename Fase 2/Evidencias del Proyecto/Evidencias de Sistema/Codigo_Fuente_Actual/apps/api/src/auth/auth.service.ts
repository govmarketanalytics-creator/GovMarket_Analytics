import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { QueryFailedError } from 'typeorm';
import { EstadoUsuario, Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { CambiarPasswordDto } from './dto/cambiar-password.dto';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import { sesionSinExpiracionLocal } from './opciones-jwt';


type IdentidadGoogle = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
  given_name?: string;
  family_name?: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  private registrosEnCurso = 0;
  private intentosRegistro: number[] = [];

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registrarUsuario(datos: RegistrarUsuarioDto) {
    // Protección acotada por instancia contra ráfagas y hashes simultáneos.
    // No sustituye un límite distribuido/WAF si se escala a varias instancias.
    const ahora = Date.now();
    this.intentosRegistro = this.intentosRegistro.filter(
      (instante) => instante > ahora - 60_000,
    );
    if (this.registrosEnCurso >= 2 || this.intentosRegistro.length >= 20) {
      throw new HttpException(
        'Hay muchos registros en este momento. Intenta nuevamente en un minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.intentosRegistro.push(ahora);
    this.registrosEnCurso += 1;

    try {
      const existente = await this.usuariosService.buscarPorEmailConGoogleSub(
        datos.email,
      );
      if (existente) throw this.correoYaRegistrado();

      const passwordHash = await argon2.hash(datos.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      let usuario: Usuario;
      try {
        usuario = await this.usuariosService.registrarConPassword({
          email: datos.email,
          passwordHash,
          nombres: datos.nombres,
          apellidoPaterno: datos.apellidoPaterno,
          apellidoMaterno: datos.apellidoMaterno || null,
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          error.driverError?.code === '23505'
        ) {
          throw this.correoYaRegistrado();
        }
        throw error;
      }

      // La misma sesión JWT que usa el ingreso normal. No devuelve el hash.
      return this.respuestaDeAcceso(usuario);
    } finally {
      this.registrosEnCurso -= 1;
    }
  }

  private correoYaRegistrado(): ConflictException {
    return new ConflictException(
      'Ya existe una cuenta con ese correo. Inicia sesión con el método que utilizaste al registrarte.',
    );
  }

  async iniciarSesion(credenciales: LoginDto) {
    const usuario = await this.usuariosService.buscarPorEmailParaAutenticacion(
      credenciales.email,
    );

    if (
      !usuario ||
      usuario.estado !== EstadoUsuario.ACTIVO ||
      !usuario.passwordHash
    ) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await argon2.verify(
      usuario.passwordHash,
      credenciales.password,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.respuestaDeAcceso(usuario);
  }

  async iniciarSesionConGoogle(credential: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new ServiceUnavailableException('Acceso con Google no configurado');
    }

    let identidad: IdentidadGoogle | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      identidad = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Cuenta de Google no autorizada');
    }

    const googleSub = identidad?.sub;
    const email = identidad?.email?.trim().toLowerCase();
    const partesCorreo = email?.split('@');
    const dominio =
      partesCorreo?.length === 2 && partesCorreo[0]
        ? partesCorreo[1]
        : undefined;
    const googleEsAutoritativo =
      dominio === 'gmail.com' ||
      Boolean(identidad?.hd && identidad.hd.toLowerCase() === dominio);

    // Gmail y Workspace verificado (hd coincidente) prueban titularidad del correo.
    if (
      !googleSub ||
      googleSub.length > 255 ||
      !email ||
      email.length > 254 ||
      !identidad?.email_verified ||
      !googleEsAutoritativo
    ) {
      throw new UnauthorizedException('Cuenta de Google no autorizada');
    }

    let usuario = await this.usuariosService.buscarPorGoogleSub(googleSub);

    if (!usuario) {
      usuario = await this.usuariosService.buscarPorEmailConGoogleSub(email);

      if (!usuario && dominio === 'gmail.com') {
        usuario = await this.usuariosService.registrarGmailSiNoExiste({
          email,
          googleSub,
          nombres: (identidad?.given_name?.trim() || email.split('@')[0]).slice(
            0,
            120,
          ),
          apellidoPaterno: (identidad?.family_name?.trim() || '').slice(0, 80),
        });
      }

      if (
        !usuario ||
        usuario.estado !== EstadoUsuario.ACTIVO ||
        (usuario.googleSub && usuario.googleSub !== googleSub)
      ) {
        throw new UnauthorizedException('Cuenta de Google no autorizada');
      }

      if (!usuario.googleSub) {
        // Evita que una cuenta pública sin verificar se vincule a Google sólo
        // por coincidencia de correo conservando una contraseña ajena.
        if (!usuario.correoVerificado) {
          throw new UnauthorizedException(
            'Este correo tiene una cuenta manual. Inicia sesión con correo y contraseña.',
          );
        }
        try {
          const vinculada = await this.usuariosService.vincularGoogle(
            usuario.id,
            googleSub,
          );
          if (!vinculada) {
            throw new UnauthorizedException('Cuenta de Google no autorizada');
          }
        } catch {
          // La restricción única y el WHERE google_sub IS NULL impiden vincular otra cuenta.
          throw new UnauthorizedException('Cuenta de Google no autorizada');
        }
      }
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('Cuenta de Google no autorizada');
    }

    return this.respuestaDeAcceso(usuario);
  }

  async obtenerPerfil(usuarioId: string) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);

    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException(
        'El usuario del token ya no está disponible',
      );
    }

    return {
      id: usuario.id,
      email: usuario.email,
      nombres: usuario.nombres,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      correoVerificado: usuario.correoVerificado,
      esSuperadministrador: usuario.esSuperadministrador,
      estado: usuario.estado,
    };
  }


  async actualizarPerfil(usuarioId: string, datos: ActualizarPerfilDto) {
    const usuario = await this.usuariosService.buscarPorId(usuarioId);

    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
  throw new UnauthorizedException(
    'El usuario del token ya no está disponible',
  );
}
  await this.usuariosService.actualizarPerfil(usuario.id, datos);
  }



  
  async cambiarPassword(usuarioId: string, datos: CambiarPasswordDto) {
    const usuario =
      await this.usuariosService.buscarPorIdParaAutenticacion(usuarioId);

    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException(
        'El usuario del token ya no está disponible',
      );
    }

    if (!usuario.passwordHash) {
      throw new BadRequestException(
        'Esta cuenta no tiene una contraseña local',
      );
    }

    const passwordActualValida = await argon2.verify(
      usuario.passwordHash,
      datos.passwordActual,
    );

    if (!passwordActualValida) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const passwordYaUtilizada = await argon2.verify(
      usuario.passwordHash,
      datos.passwordNueva,
    );

    if (passwordYaUtilizada) {
      throw new BadRequestException(
        'La contraseña nueva debe ser diferente de la actual',
      );
    }

    const nuevoPasswordHash = await argon2.hash(datos.passwordNueva, {
      type: argon2.argon2id,
    });

    await this.usuariosService.actualizarPasswordHash(
      usuario.id,
      nuevoPasswordHash,
    );

    return { message: 'Contraseña actualizada correctamente' };
  }

  private async respuestaDeAcceso(usuario: Usuario) {
    return {
      accessToken: await this.generarAccessToken(usuario),
      tokenType: 'Bearer',
      expiresIn: sesionSinExpiracionLocal(this.configService) ? null : this.configService.getOrThrow<number>(
        'JWT_EXPIRES_IN_SECONDS',
      ),
    };
  }

  private async generarAccessToken(usuario: Usuario): Promise<string> {
    return this.jwtService.signAsync({
      sub: usuario.id,
      email: usuario.email,
      esSuperadministrador: usuario.esSuperadministrador,
    });
  }
}
