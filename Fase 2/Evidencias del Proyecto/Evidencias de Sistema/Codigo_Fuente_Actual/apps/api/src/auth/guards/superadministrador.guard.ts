import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestConUsuario } from '../interfaces/jwt-payload.interface';

@Injectable()
export class SuperadministradorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();

    if (!request.user?.esSuperadministrador) {
      throw new ForbiddenException(
        'Se requieren permisos de superadministrador',
      );
    }

    return true;
  }
}
