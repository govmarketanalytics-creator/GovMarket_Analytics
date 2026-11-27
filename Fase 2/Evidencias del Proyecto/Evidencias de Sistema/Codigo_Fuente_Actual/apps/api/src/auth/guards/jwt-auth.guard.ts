import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  JwtPayload,
  RequestConUsuario,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();

    const token = this.extraerToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }

    return true;
  }

  private extraerToken(request: RequestConUsuario): string | undefined {
    const partes = request.headers.authorization?.trim().split(/\s+/) ?? [];

    if (partes.length !== 2 || partes[0] !== 'Bearer') {
      return undefined;
    }

    return partes[1];
  }
}
