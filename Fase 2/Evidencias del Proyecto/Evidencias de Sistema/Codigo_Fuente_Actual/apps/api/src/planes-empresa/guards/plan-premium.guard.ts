import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestConUsuario } from '../../auth/interfaces/jwt-payload.interface';
import type { MembresiaEmpresa } from '../../membresias/entities/membresia-empresa.entity';
import { PlanesEmpresaService } from '../planes-empresa.service';

type RequestConMembresia = RequestConUsuario & {
  membresia?: MembresiaEmpresa;
};

@Injectable()
export class PlanPremiumGuard implements CanActivate {
  constructor(private readonly planesEmpresaService: PlanesEmpresaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConMembresia>();

    if (request.user.esSuperadministrador) {
      return true;
    }

    const empresaId = request.params.empresaId;

    if (
      !request.membresia ||
      request.membresia.empresaId !== empresaId ||
      !(await this.planesEmpresaService.esPremiumVigente(empresaId))
    ) {
      throw new ForbiddenException({
        code: 'PLAN_PREMIUM_REQUERIDO',
        message:
          'Para acceder a esta función, suscríbete a un plan Premium Individual o Empresa.',
      });
    }

    return true;
  }
}
