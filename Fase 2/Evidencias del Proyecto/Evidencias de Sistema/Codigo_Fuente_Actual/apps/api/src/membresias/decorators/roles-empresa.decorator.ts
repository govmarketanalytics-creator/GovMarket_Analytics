import { SetMetadata } from '@nestjs/common';
import { RolMembresiaEmpresa } from '../entities/membresia-empresa.entity';

export const ROLES_EMPRESA_KEY = 'roles_empresa';

export const RolesEmpresa = (...roles: RolMembresiaEmpresa[]) =>
  SetMetadata(ROLES_EMPRESA_KEY, roles);
