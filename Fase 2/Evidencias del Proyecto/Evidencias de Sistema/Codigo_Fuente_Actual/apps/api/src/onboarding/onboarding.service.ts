import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Empresa } from '../empresas/entities/empresa.entity';
import {
  MembresiaEmpresa,
  RolMembresiaEmpresa,
} from '../membresias/entities/membresia-empresa.entity';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { EstadoUsuario, Usuario } from '../usuarios/entities/usuario.entity';
import type { GuardarEtiquetasCapacidadesDto } from './dto/guardar-etiquetas-capacidades.dto';
import type { GuardarInformacionEmpresaDto } from './dto/guardar-informacion-empresa.dto';
import type { GuardarPreferenciasComercialesDto } from './dto/guardar-preferencias-comerciales.dto';
import { nexusHabilitado } from '../nexus/catalogo-nexus';

type PasoOnboarding =
  | 'empresa'
  | 'etiquetas'
  | 'preferencias'
  | 'resumen'
  | 'esperar_configuracion'
  | 'dashboard';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly planesEmpresaService: PlanesEmpresaService,
  ) {}

  async obtenerEstado(usuarioId: string) {
    const membresia = await this.dataSource
      .getRepository(MembresiaEmpresa)
      .findOne({
        where: {
          usuarioId,
          activa: true,
        },
        relations: {
          empresa: true,
        },
        order: {
          creadoEn: 'ASC',
        },
      });

    if (!membresia) {
      return {
        completado: false,
        pasoActual: 1,
        progreso: 25,
        pasoSiguiente: 'empresa' as PasoOnboarding,
        empresa: null,
        membresia: null,
        perfilConfigurado: false,
        perfil: null,
        plan: null,
      };
    }

    const perfil = await this.dataSource.getRepository(PerfilEmpresa).findOne({
      where: {
        empresaId: membresia.empresaId,
      },
    });

    const pasoSiguiente = this.determinarPasoSiguiente(
      membresia.empresa,
      membresia.rol,
    );

    return {
      completado: membresia.empresa.onboardingCompletado,
      pasoActual: membresia.empresa.onboardingCompletado
        ? 4
        : membresia.empresa.onboardingPaso,
      progreso: membresia.empresa.onboardingCompletado
        ? 100
        : membresia.empresa.onboardingPaso * 25,
      pasoSiguiente,
      empresa: this.mapearEmpresa(membresia.empresa),
      membresia: {
        id: membresia.id,
        rol: membresia.rol,
        activa: membresia.activa,
      },
      perfilConfigurado: membresia.empresa.onboardingCompletado,
      perfil: perfil ? this.mapearPerfil(perfil) : null,
      plan: await this.planesEmpresaService.obtener(membresia.empresaId),
    };
  }

  async registrarEmpresa(
    usuarioId: string,
    datos: GuardarInformacionEmpresaDto,
  ) {
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.bloquearOnboarding(manager, usuarioId);

        const usuariosRepository = manager.getRepository(Usuario);
        const empresasRepository = manager.getRepository(Empresa);
        const membresiasRepository = manager.getRepository(MembresiaEmpresa);

        const usuario = await usuariosRepository.findOne({
          where: {
            id: usuarioId,
            estado: EstadoUsuario.ACTIVO,
          },
        });

        if (!usuario) {
          throw new UnauthorizedException(
            'El usuario del token ya no está disponible',
          );
        }

        const membresiaExistente = await membresiasRepository.findOne({
          where: {
            usuarioId,
            activa: true,
          },
        });

        if (membresiaExistente) {
          throw new ConflictException(
            'El usuario ya pertenece a una empresa activa',
          );
        }

        const empresaExistente = await empresasRepository.findOne({
          where: {
            rut: datos.rut,
          },
        });

        if (empresaExistente) {
          throw new ConflictException(
            'Ya existe una empresa registrada con ese RUT',
          );
        }

        const empresaGuardada = await empresasRepository.save(
          empresasRepository.create({
            ...this.mapearDatosEmpresa(datos),
            onboardingPaso: 2,
            onboardingCompletado: false,
            onboardingCompletadoEn: null,
          }),
        );

        await membresiasRepository.save(
          membresiasRepository.create({
            empresaId: empresaGuardada.id,
            usuarioId,
            rol: RolMembresiaEmpresa.ADMINISTRADOR,
            activa: true,
          }),
        );
      });
    } catch (error: unknown) {
      this.procesarErrorUnico(error);
    }

    return this.obtenerEstado(usuarioId);
  }

  async actualizarEmpresa(
    usuarioId: string,
    datos: GuardarInformacionEmpresaDto,
  ) {
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.bloquearOnboarding(manager, usuarioId);
        const { empresa } = await this.obtenerContextoAdministrador(
          usuarioId,
          manager,
        );
        const empresasRepository = manager.getRepository(Empresa);

        const empresaConRut = await empresasRepository.findOne({
          where: { rut: datos.rut },
        });

        if (empresaConRut && empresaConRut.id !== empresa.id) {
          throw new ConflictException(
            'Ya existe una empresa registrada con ese RUT',
          );
        }

        empresasRepository.merge(empresa, this.mapearDatosEmpresa(datos));

        if (!empresa.onboardingCompletado) {
          empresa.onboardingPaso = Math.max(empresa.onboardingPaso, 2);
        }

        await empresasRepository.save(empresa);
      });
    } catch (error: unknown) {
      this.procesarErrorUnico(error);
    }

    return this.obtenerEstado(usuarioId);
  }

  async guardarEtiquetas(
    usuarioId: string,
    datos: GuardarEtiquetasCapacidadesDto,
  ) {
    const valoresOfertas = {
      ofertasIds: datos.ofertasIds ?? [],
      etiquetasCapacidades: datos.etiquetasCapacidades,
    };
    await this.dataSource.transaction(async (manager) => {
      await this.bloquearOnboarding(manager, usuarioId);
      const { empresa } = await this.obtenerContextoAdministrador(
        usuarioId,
        manager,
      );

      if (!empresa.onboardingCompletado && empresa.onboardingPaso < 2) {
        throw new BadRequestException(
          'Primero debes completar la información de la empresa',
        );
      }

      const perfilesRepository = manager.getRepository(PerfilEmpresa);
      const perfilExistente = await perfilesRepository.findOne({
        where: { empresaId: empresa.id },
      });
      const perfil = perfilExistente
        ? perfilesRepository.merge(perfilExistente, {
            ...valoresOfertas,
            activo: empresa.onboardingCompletado,
          })
        : perfilesRepository.create({
            empresaId: empresa.id,
            palabrasClave: [],
            ...valoresOfertas,
            codigosCategoria: [],
            regiones: [],
            montoMinimo: null,
            montoMaximo: null,
            incluirSinMonto: true,
            tiposOportunidad: [],
            frecuenciaAlertas: null,
            puntajeMinimoAlerta: '60',
            activo: false,
          });

      await perfilesRepository.save(perfil);

      if (!empresa.onboardingCompletado) {
        empresa.onboardingPaso = Math.max(empresa.onboardingPaso, 3);
        await manager.getRepository(Empresa).save(empresa);
      }
    });

    return this.obtenerEstado(usuarioId);
  }

  async guardarPreferencias(
    usuarioId: string,
    datos: GuardarPreferenciasComercialesDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.bloquearOnboarding(manager, usuarioId);
      const { empresa } = await this.obtenerContextoAdministrador(
        usuarioId,
        manager,
      );

      if (!empresa.onboardingCompletado && empresa.onboardingPaso < 3) {
        throw new BadRequestException(
          'Primero debes completar las etiquetas y capacidades',
        );
      }

      const perfilesRepository = manager.getRepository(PerfilEmpresa);
      const perfil = await perfilesRepository.findOne({
        where: { empresaId: empresa.id },
      });

      if (!perfil) {
        throw new BadRequestException(
          'Primero debes completar las etiquetas y capacidades',
        );
      }

      perfilesRepository.merge(perfil, {
        regiones: datos.regiones,
        montoMinimo:
          datos.montoMinimo === null ? null : String(datos.montoMinimo),
        montoMaximo:
          datos.montoMaximo === null ? null : String(datos.montoMaximo),
        incluirSinMonto: datos.incluirSinMonto,
        tiposOportunidad: datos.tiposOportunidad,
        frecuenciaAlertas: datos.frecuenciaAlertas,
        palabrasClave: datos.palabrasClave,
        activo: empresa.onboardingCompletado,
      });
      await perfilesRepository.save(perfil);

      if (!empresa.onboardingCompletado) {
        empresa.onboardingPaso = Math.max(empresa.onboardingPaso, 4);
        await manager.getRepository(Empresa).save(empresa);
      }
    });

    return this.obtenerEstado(usuarioId);
  }

  async confirmar(usuarioId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.bloquearOnboarding(manager, usuarioId);
      const { empresa } = await this.obtenerContextoAdministrador(
        usuarioId,
        manager,
      );

      if (!empresa.onboardingCompletado && empresa.onboardingPaso < 4) {
        throw new BadRequestException(
          'Completa todos los pasos antes de confirmar el perfil',
        );
      }

      this.validarInformacionEmpresa(empresa);

      const perfilesRepository = manager.getRepository(PerfilEmpresa);
      const perfil = await perfilesRepository.findOne({
        where: { empresaId: empresa.id },
      });

      if (
        !perfil ||
        (nexusHabilitado() ? !perfil.ofertasIds?.length : perfil.etiquetasCapacidades.length === 0) ||
        perfil.tiposOportunidad.length === 0 ||
        perfil.frecuenciaAlertas === null
      ) {
        throw new BadRequestException(
          'El perfil todavía tiene información pendiente',
        );
      }

      perfil.activo = true;
      await perfilesRepository.save(perfil);

      empresa.onboardingPaso = 4;
      empresa.onboardingCompletado = true;
      empresa.onboardingCompletadoEn ??= new Date();
      await manager.getRepository(Empresa).save(empresa);
    });

    return this.obtenerEstado(usuarioId);
  }

  private determinarPasoSiguiente(
    empresa: Empresa,
    rol: RolMembresiaEmpresa,
  ): PasoOnboarding {
    if (empresa.onboardingCompletado) {
      return 'dashboard';
    }

    if (rol !== RolMembresiaEmpresa.ADMINISTRADOR) {
      return 'esperar_configuracion';
    }

    const pasos: Record<number, PasoOnboarding> = {
      1: 'empresa',
      2: 'etiquetas',
      3: 'preferencias',
      4: 'resumen',
    };

    return pasos[empresa.onboardingPaso] ?? 'empresa';
  }

  private async obtenerContextoAdministrador(
    usuarioId: string,
    manager: EntityManager,
  ): Promise<{ membresia: MembresiaEmpresa; empresa: Empresa }> {
    const membresia = await manager.getRepository(MembresiaEmpresa).findOne({
      where: {
        usuarioId,
        activa: true,
      },
      relations: {
        empresa: true,
      },
      order: {
        creadoEn: 'ASC',
      },
    });

    if (!membresia) {
      throw new NotFoundException('El usuario no tiene una empresa activa');
    }

    if (membresia.rol !== RolMembresiaEmpresa.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo un administrador puede configurar el perfil de la empresa',
      );
    }

    return {
      membresia,
      empresa: membresia.empresa,
    };
  }

  private mapearDatosEmpresa(datos: GuardarInformacionEmpresaDto) {
    return {
      rut: datos.rut,
      razonSocial: datos.razonSocial,
      nombreFantasia: datos.nombreFantasia?.trim() || null,
      descripcion: datos.descripcion,
      sitioWeb: datos.sitioWeb,
      regionPrincipal: datos.regionPrincipal,
      comuna: datos.comuna,
      tamanioEmpresa: datos.tamanioEmpresa,
      anioFundacion: datos.anioFundacion,
      correoContacto: datos.correoContacto,
      telefonoContacto: datos.telefonoContacto,
    };
  }

  private mapearEmpresa(empresa: Empresa) {
    return {
      id: empresa.id,
      rut: empresa.rut,
      razonSocial: empresa.razonSocial,
      nombreFantasia: empresa.nombreFantasia,
      descripcion: empresa.descripcion,
      sitioWeb: empresa.sitioWeb,
      regionPrincipal: empresa.regionPrincipal,
      comuna: empresa.comuna,
      tamanioEmpresa: empresa.tamanioEmpresa,
      anioFundacion: empresa.anioFundacion,
      correoContacto: empresa.correoContacto,
      telefonoContacto: empresa.telefonoContacto,
      onboardingPaso: empresa.onboardingPaso,
      onboardingCompletado: empresa.onboardingCompletado,
      onboardingCompletadoEn:
        empresa.onboardingCompletadoEn?.toISOString() ?? null,
      estado: empresa.estado,
      creadoEn: empresa.creadoEn.toISOString(),
      actualizadoEn: empresa.actualizadoEn.toISOString(),
    };
  }

  private mapearPerfil(perfil: PerfilEmpresa) {
    return {
      id: perfil.id,
      empresaId: perfil.empresaId,
      palabrasClave: perfil.palabrasClave ?? [],
      etiquetasCapacidades: perfil.etiquetasCapacidades ?? [],
      ofertasIds: perfil.ofertasIds ?? [],
      nexusHabilitado: nexusHabilitado(),
      codigosCategoria: perfil.codigosCategoria ?? [],
      regiones: perfil.regiones ?? [],
      montoMinimo:
        perfil.montoMinimo === null ? null : Number(perfil.montoMinimo),
      montoMaximo:
        perfil.montoMaximo === null ? null : Number(perfil.montoMaximo),
      incluirSinMonto: perfil.incluirSinMonto,
      tiposOportunidad: perfil.tiposOportunidad ?? [],
      frecuenciaAlertas: perfil.frecuenciaAlertas,
      puntajeMinimoAlerta: Number(perfil.puntajeMinimoAlerta),
      activo: perfil.activo,
      creadoEn: perfil.creadoEn.toISOString(),
      actualizadoEn: perfil.actualizadoEn.toISOString(),
    };
  }

  private validarInformacionEmpresa(empresa: Empresa): void {
    if (
      !empresa.descripcion ||
      !empresa.regionPrincipal ||
      !empresa.comuna ||
      !empresa.tamanioEmpresa ||
      !empresa.correoContacto ||
      !empresa.telefonoContacto
    ) {
      throw new BadRequestException(
        'La información de la empresa todavía está incompleta',
      );
    }
  }

  private async bloquearOnboarding(
    manager: EntityManager,
    usuarioId: string,
  ): Promise<void> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [usuarioId],
    );
  }

  private procesarErrorUnico(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      throw new ConflictException(
        'La empresa o la membresía ya se encuentran registradas',
      );
    }

    throw error;
  }
}
