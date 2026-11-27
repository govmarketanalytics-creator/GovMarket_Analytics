import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestConUsuario } from '../../auth/interfaces/jwt-payload.interface';
import { MembresiaEmpresa } from '../entities/membresia-empresa.entity';

type RequestConMembresia = RequestConUsuario & {
  membresia?: MembresiaEmpresa;
};

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MembresiaEmpresaGuard implements CanActivate {
  constructor(
    @InjectRepository(MembresiaEmpresa)
    private readonly membresiasRepository: Repository<MembresiaEmpresa>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConMembresia>();

    const empresaId = request.params.empresaId;

    if (typeof empresaId !== 'string' || !UUID_V4_PATTERN.test(empresaId)) {
      throw new BadRequestException(
        'El identificador de la empresa no es válido',
      );
    }

    if (request.user.esSuperadministrador) {
      return true;
    }

    const membresia = await this.membresiasRepository.findOne({
      where: {
        empresaId,
        usuarioId: request.user.sub,
        activa: true,
      },
    });

    if (!membresia) {
      throw new ForbiddenException('No tienes acceso a la empresa solicitada');
    }

    request.membresia = membresia;

    return true;
  }
}
