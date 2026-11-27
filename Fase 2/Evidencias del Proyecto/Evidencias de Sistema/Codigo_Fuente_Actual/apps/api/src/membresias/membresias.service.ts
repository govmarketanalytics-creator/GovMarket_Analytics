import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource, QueryFailedError } from 'typeorm';
import { Empresa } from '../empresas/entities/empresa.entity';
import {
  EstadoSuscripcionEmpresa,
  PlanPagoEmpresa,
  SuscripcionEmpresa,
} from '../planes-empresa/entities/suscripcion-empresa.entity';
import { EstadoUsuario, Usuario } from '../usuarios/entities/usuario.entity';
import type { CrearUsuarioEmpresaDto } from './dto/crear-usuario-empresa.dto';
import {
  MembresiaEmpresa,
  RolMembresiaEmpresa,
} from './entities/membresia-empresa.entity';

const MAXIMO_USUARIOS_ADICIONALES_PLAN_EMPRESA = 4;

@Injectable()
export class MembresiasService {
  constructor(private readonly dataSource: DataSource) {}

  async crearUsuarioEnEmpresa(
    empresaId: string,
    datos: CrearUsuarioEmpresaDto,
    esSuperadministrador = false,
  ) {
    const passwordHash = await argon2.hash(datos.password, {
      type: argon2.argon2id,
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        const empresasRepository = manager.getRepository(Empresa);
        const usuariosRepository = manager.getRepository(Usuario);
        const membresiasRepository = manager.getRepository(MembresiaEmpresa);

        const empresa = await empresasRepository.findOne({
          where: { id: empresaId },
        });

        if (!empresa) {
          throw new NotFoundException('La empresa indicada no existe');
        }

        if (!esSuperadministrador) {
          await manager.query(
            'SELECT id FROM empresas WHERE id = $1 FOR UPDATE',
            [empresaId],
          );
          const suscripcion = await manager
            .getRepository(SuscripcionEmpresa)
            .findOne({ where: { empresaId } });
          const ahora = Date.now();

          if (
            !suscripcion ||
            suscripcion.plan !== PlanPagoEmpresa.EMPRESA ||
            suscripcion.estado !== EstadoSuscripcionEmpresa.ACTIVA ||
            suscripcion.vigenteDesde.getTime() > ahora ||
            suscripcion.vigenteHasta.getTime() <= ahora
          ) {
            throw new ForbiddenException({
              code: 'PLAN_EMPRESA_REQUERIDO',
              message:
                'La creación de usuarios adicionales requiere un plan Premium Empresa vigente.',
            });
          }

          if (datos.rol === RolMembresiaEmpresa.ADMINISTRADOR) {
            throw new ForbiddenException({
              code: 'ADMINISTRADOR_ADICIONAL_NO_PERMITIDO',
              message:
                'El plan Empresa permite un administrador y hasta cuatro usuarios adicionales.',
            });
          }

          const usuariosAdicionales = await membresiasRepository.count({
            where: {
              empresaId,
              activa: true,
              rol: RolMembresiaEmpresa.ANALISTA_COMERCIAL,
            },
          });

          if (usuariosAdicionales >= MAXIMO_USUARIOS_ADICIONALES_PLAN_EMPRESA) {
            throw new ConflictException({
              code: 'LIMITE_USUARIOS_PLAN_EMPRESA',
              message:
                'El plan Empresa alcanzó el máximo de cuatro usuarios adicionales.',
            });
          }
        }

        const usuarioExistente = await usuariosRepository.findOne({
          where: { email: datos.email },
        });

        if (usuarioExistente) {
          throw new ConflictException(
            'Ya existe un usuario registrado con ese correo electrónico',
          );
        }

        const usuario = usuariosRepository.create({
          email: datos.email,
          passwordHash,
          nombres: datos.nombres,
          apellidoPaterno: datos.apellidoPaterno,
          apellidoMaterno: datos.apellidoMaterno?.trim() || null,
          correoVerificado: false,
          esSuperadministrador: false,
          estado: EstadoUsuario.ACTIVO,
        });

        const usuarioGuardado = await usuariosRepository.save(usuario);

        const membresia = membresiasRepository.create({
          empresaId,
          usuarioId: usuarioGuardado.id,
          rol: datos.rol,
          activa: true,
        });

        const membresiaGuardada = await membresiasRepository.save(membresia);

        return {
          usuario: {
            id: usuarioGuardado.id,
            email: usuarioGuardado.email,
            nombres: usuarioGuardado.nombres,
            apellidoPaterno: usuarioGuardado.apellidoPaterno,
            apellidoMaterno: usuarioGuardado.apellidoMaterno,
            correoVerificado: usuarioGuardado.correoVerificado,
            esSuperadministrador: usuarioGuardado.esSuperadministrador,
            estado: usuarioGuardado.estado,
            creadoEn: usuarioGuardado.creadoEn,
          },
          membresia: {
            id: membresiaGuardada.id,
            empresaId: membresiaGuardada.empresaId,
            usuarioId: membresiaGuardada.usuarioId,
            rol: membresiaGuardada.rol,
            activa: membresiaGuardada.activa,
            creadoEn: membresiaGuardada.creadoEn,
          },
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new ConflictException(
          'El usuario o la membresía ya se encuentran registrados',
        );
      }

      throw error;
    }
  }

  async listarUsuariosDeEmpresa(empresaId: string) {
    const empresasRepository = this.dataSource.getRepository(Empresa);
    const membresiasRepository =
      this.dataSource.getRepository(MembresiaEmpresa);

    const empresa = await empresasRepository.findOne({
      where: { id: empresaId },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa indicada no existe');
    }

    const membresias = await membresiasRepository.find({
      where: { empresaId },
      relations: {
        usuario: true,
      },
      order: {
        creadoEn: 'ASC',
      },
    });

    return membresias.map((membresia) => ({
      usuario: {
        id: membresia.usuario.id,
        email: membresia.usuario.email,
        nombres: membresia.usuario.nombres,
        apellidoPaterno: membresia.usuario.apellidoPaterno,
        apellidoMaterno: membresia.usuario.apellidoMaterno,
        correoVerificado: membresia.usuario.correoVerificado,
        estado: membresia.usuario.estado,
        ultimoAccesoEn: membresia.usuario.ultimoAccesoEn,
      },
      membresia: {
        id: membresia.id,
        empresaId: membresia.empresaId,
        rol: membresia.rol,
        activa: membresia.activa,
        creadoEn: membresia.creadoEn,
      },
    }));
  }
}
