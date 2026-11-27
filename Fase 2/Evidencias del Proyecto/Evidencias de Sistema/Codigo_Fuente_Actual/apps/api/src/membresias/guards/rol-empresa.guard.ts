import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestConUsuario } from '../../auth/interfaces/jwt-payload.interface';
import {
  MembresiaEmpresa,
  RolMembresiaEmpresa,
} from '../entities/membresia-empresa.entity';
import { ROLES_EMPRESA_KEY } from '../decorators/roles-empresa.decorator';

type RequestConMembresia = RequestConUsuario & {
  membresia?: MembresiaEmpresa;
};

@Injectable()
export class RolEmpresaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<
      RolMembresiaEmpresa[]
    >(ROLES_EMPRESA_KEY, [context.getHandler(), context.getClass()]);

    if (!rolesPermitidos?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConMembresia>();

    if (request.user.esSuperadministrador) {
      return true;
    }

    if (
      !request.membresia ||
      !rolesPermitidos.includes(request.membresia.rol)
    ) {
      throw new ForbiddenException(
        'No tienes el rol requerido para realizar esta operación',
      );
    }

    return true;
  }
}
