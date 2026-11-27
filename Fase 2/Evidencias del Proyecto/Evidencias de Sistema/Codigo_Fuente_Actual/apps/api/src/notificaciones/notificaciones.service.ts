import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { MembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import type { ConsultarNotificacionesDto } from './dto/consultar-notificaciones.dto';
import {
  NotificacionOportunidad,
  TipoNotificacionOportunidad,
} from './entities/notificacion-oportunidad.entity';
import { NotificacionUsuario } from './entities/notificacion-usuario.entity';

interface CrearNotificacionEntrada {
  empresaId: string;
  licitacionId: string;
  porcentajeCompatibilidad: number;
  esPrueba?: boolean;
}

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(NotificacionUsuario)
    private readonly destinatariosRepository: Repository<NotificacionUsuario>,
    @InjectRepository(PerfilEmpresa)
    private readonly perfilesRepository: Repository<PerfilEmpresa>,
    private readonly dataSource: DataSource,
    private readonly planesEmpresaService: PlanesEmpresaService,
    private readonly oportunidadesService: OportunidadesService,
  ) {}

  async listar(
    empresaId: string,
    usuarioId: string,
    filtros: ConsultarNotificacionesDto,
  ) {
    const query = this.destinatariosRepository
      .createQueryBuilder('destinatario')
      .innerJoinAndSelect('destinatario.notificacion', 'notificacion')
      .innerJoinAndSelect('notificacion.empresa', 'empresa')
      .innerJoinAndSelect('notificacion.licitacion', 'licitacion')
      .where('destinatario.usuarioId = :usuarioId', { usuarioId })
      .andWhere('notificacion.empresaId = :empresaId', { empresaId });

    if (filtros.leida !== undefined) {
      query.andWhere('destinatario.leida = :leida', { leida: filtros.leida });
    }

    const [destinatarios, total] = await query
      .orderBy('notificacion.creadaEn', 'DESC')
      .addOrderBy('destinatario.id', 'ASC')
      .skip((filtros.pagina - 1) * filtros.limite)
      .take(filtros.limite)
      .getManyAndCount();
    const noLeidas = await this.contarNoLeidas(empresaId, usuarioId);
    const premiumVigente =
      await this.planesEmpresaService.esPremiumVigente(empresaId);

    return {
      datos: destinatarios.map((destinatario) =>
        this.mapear(destinatario, premiumVigente),
      ),
      resumen: { noLeidas },
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }

  async marcarComoLeida(
    empresaId: string,
    usuarioId: string,
    notificacionId: string,
  ) {
    const destinatario = await this.destinatariosRepository
      .createQueryBuilder('destinatario')
      .innerJoinAndSelect('destinatario.notificacion', 'notificacion')
      .innerJoinAndSelect('notificacion.empresa', 'empresa')
      .innerJoinAndSelect('notificacion.licitacion', 'licitacion')
      .where('destinatario.usuarioId = :usuarioId', { usuarioId })
      .andWhere('notificacion.id = :notificacionId', { notificacionId })
      .andWhere('notificacion.empresaId = :empresaId', { empresaId })
      .getOne();

    if (!destinatario) {
      throw new NotFoundException('La notificación indicada no existe');
    }

    if (!destinatario.leida) {
      destinatario.leida = true;
      destinatario.leidaEn = new Date();
      await this.destinatariosRepository.save(destinatario);
    }

    const premiumVigente =
      await this.planesEmpresaService.esPremiumVigente(empresaId);
    return this.mapear(destinatario, premiumVigente);
  }

  async marcarTodasComoLeidas(empresaId: string, usuarioId: string) {
    const pendientes = await this.destinatariosRepository
      .createQueryBuilder('destinatario')
      .innerJoin('destinatario.notificacion', 'notificacion')
      .where('destinatario.usuarioId = :usuarioId', { usuarioId })
      .andWhere('notificacion.empresaId = :empresaId', { empresaId })
      .andWhere('destinatario.leida = false')
      .getMany();
    const ahora = new Date();

    for (const destinatario of pendientes) {
      destinatario.leida = true;
      destinatario.leidaEn = ahora;
    }

    if (pendientes.length > 0) {
      await this.destinatariosRepository.save(pendientes);
    }

    return { actualizadas: pendientes.length, noLeidas: 0 };
  }

  async generarParaCodigosNuevos(codigosExternos: string[]) {
    const codigos = [...new Set(codigosExternos)];
    if (codigos.length === 0) return { procesadas: 0, creadas: 0 };

    const perfiles = await this.perfilesRepository.find({
      where: { activo: true },
    });
    let procesadas = 0;
    let creadas = 0;

    for (const perfil of perfiles) {
      const umbral = Math.max(60, Number(perfil.puntajeMinimoAlerta));

      for (const codigoExterno of codigos) {
        const oportunidad =
          await this.oportunidadesService.evaluarLicitacionParaEmpresa(
            perfil.empresaId,
            codigoExterno,
          );
        procesadas += 1;

        const coincideCapacidad = oportunidad &&
          (oportunidad.coincidencias.palabrasClave.length > 0 || oportunidad.coincidencias.codigosCategoria.length > 0);
        if (!oportunidad || !coincideCapacidad || oportunidad.porcentajeCompatibilidad < umbral) {
          continue;
        }

        const resultado = await this.crearParaEmpresa({
          empresaId: perfil.empresaId,
          licitacionId: oportunidad.id,
          porcentajeCompatibilidad: oportunidad.porcentajeCompatibilidad,
        });
        if (resultado.creada) creadas += 1;
      }
    }

    return { procesadas, creadas };
  }

  async crearPrueba(
    email: string,
    porcentajeCompatibilidad = 87,
    empresaId?: string,
  ) {
    if (
      !Number.isFinite(porcentajeCompatibilidad) ||
      porcentajeCompatibilidad < 60 ||
      porcentajeCompatibilidad > 100
    ) {
      throw new BadRequestException(
        'El porcentaje de prueba debe estar entre 60 y 100',
      );
    }

    const usuario = await this.dataSource.getRepository(Usuario).findOne({
      where: { email: email.trim().toLowerCase() },
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese correo');
    }

    const membresias = await this.dataSource
      .getRepository(MembresiaEmpresa)
      .find({
        where: empresaId
          ? { usuarioId: usuario.id, empresaId, activa: true }
          : { usuarioId: usuario.id, activa: true },
        relations: { empresa: true },
      });

    if (membresias.length === 0) {
      throw new NotFoundException('El usuario no tiene una empresa activa');
    }
    if (membresias.length > 1 && !empresaId) {
      throw new BadRequestException(
        'El usuario tiene más de una empresa; indica también el empresaId',
      );
    }

    const membresia = membresias[0];
    const ahora = new Date();
    const fechaCierre = new Date(ahora.getTime() + 14 * 24 * 60 * 60 * 1000);
    const codigoExterno = `9999-${Date.now()}-L126`;
    const licitacionesRepository = this.dataSource.getRepository(Licitacion);
    const licitacion = await licitacionesRepository.save(
      licitacionesRepository.create({
        codigoExterno,
        nombre: 'PRUEBA - Licitación fantasma de GovMarket',
        descripcion:
          'Registro de prueba para validar el centro de notificaciones. No corresponde a una publicación real de Mercado Público.',
        codigoEstado: 5,
        estado: 'Publicada',
        codigoTipo: '1',
        tipo: 'L1',
        moneda: 'CLP',
        montoEstimado: '12500000',
        fechaPublicacion: ahora,
        fechaCierre,
        fechaAdjudicacion: null,
        codigoOrganismo: 'GOVMARKET-PRUEBA',
        nombreOrganismo: 'Organismo de prueba GovMarket',
        codigoUnidad: 'UNIDAD-PRUEBA',
        nombreUnidad: 'Unidad de pruebas',
        comunaUnidad: membresia.empresa.comuna,
        regionUnidad: membresia.empresa.regionPrincipal,
        cantidadReclamos: 0,
        datosOrigen: { esPrueba: true, generadoPor: 'GovMarket Analytics' },
        sincronizadoEn: ahora,
        activaEnListado: false,
        vistoActivoEn: null,
        detalleSincronizadoEn: ahora,
      }),
    );

    const notificacion = await this.crearParaEmpresa({
      empresaId: membresia.empresaId,
      licitacionId: licitacion.id,
      porcentajeCompatibilidad,
      esPrueba: true,
    });

    return {
      email: usuario.email,
      empresaId: membresia.empresaId,
      empresa:
        membresia.empresa.nombreFantasia || membresia.empresa.razonSocial,
      codigoExterno,
      porcentajeCompatibilidad,
      notificacionId: notificacion.notificacionId,
    };
  }

  private async crearParaEmpresa(entrada: CrearNotificacionEntrada) {
    return this.dataSource.transaction(async (manager) => {
      const notificacionesRepository = manager.getRepository(
        NotificacionOportunidad,
      );
      const membresiasRepository = manager.getRepository(MembresiaEmpresa);
      const destinatariosRepository =
        manager.getRepository(NotificacionUsuario);
      let notificacion = await notificacionesRepository.findOne({
        where: {
          empresaId: entrada.empresaId,
          licitacionId: entrada.licitacionId,
          tipo: TipoNotificacionOportunidad.NUEVA_OPORTUNIDAD,
        },
      });
      const creada = notificacion === null;

      if (!notificacion) {
        notificacion = await notificacionesRepository.save(
          notificacionesRepository.create({
            empresaId: entrada.empresaId,
            licitacionId: entrada.licitacionId,
            tipo: TipoNotificacionOportunidad.NUEVA_OPORTUNIDAD,
            porcentajeCompatibilidad: String(entrada.porcentajeCompatibilidad),
            esPrueba: entrada.esPrueba ?? false,
          }),
        );
      }

      const membresias = await membresiasRepository.find({
        select: { usuarioId: true },
        where: { empresaId: entrada.empresaId, activa: true },
      });

      if (membresias.length > 0) {
        await destinatariosRepository
          .createQueryBuilder()
          .insert()
          .into(NotificacionUsuario)
          .values(
            membresias.map((membresia) => ({
              notificacionId: notificacion.id,
              usuarioId: membresia.usuarioId,
              leida: false,
              leidaEn: null,
            })),
          )
          .orIgnore()
          .execute();
      }

      return { creada, notificacionId: notificacion.id };
    });
  }

  private async contarNoLeidas(
    empresaId: string,
    usuarioId: string,
  ): Promise<number> {
    return this.destinatariosRepository
      .createQueryBuilder('destinatario')
      .innerJoin('destinatario.notificacion', 'notificacion')
      .where('destinatario.usuarioId = :usuarioId', { usuarioId })
      .andWhere('notificacion.empresaId = :empresaId', { empresaId })
      .andWhere('destinatario.leida = false')
      .getCount();
  }

  private mapear(destinatario: NotificacionUsuario, premiumVigente: boolean) {
    const notificacion = destinatario.notificacion;
    const empresa = notificacion.empresa;
    const licitacion = notificacion.licitacion;
    const porcentaje = Number(notificacion.porcentajeCompatibilidad);
    const nombreEmpresa = empresa.nombreFantasia || empresa.razonSocial;
    const mensaje = notificacion.esPrueba
      ? `PRUEBA: Se publicó una licitación fantasma con alta compatibilidad (${Math.round(porcentaje)}%) para ${nombreEmpresa}.`
      : `Se publicó una nueva oportunidad con alta compatibilidad (${Math.round(porcentaje)}%) para ${nombreEmpresa}.`;

    return {
      id: notificacion.id,
      tipo: notificacion.tipo,
      mensaje,
      porcentajeCompatibilidad: porcentaje,
      esPrueba: notificacion.esPrueba,
      leida: destinatario.leida,
      leidaEn: destinatario.leidaEn?.toISOString() ?? null,
      creadaEn: notificacion.creadaEn.toISOString(),
      accesoCompleto: premiumVigente,
      licitacion: premiumVigente
        ? {
            codigoExterno: licitacion.codigoExterno,
            nombre: licitacion.nombre,
            nombreOrganismo: licitacion.nombreOrganismo,
            montoEstimado:
              licitacion.montoEstimado === null
                ? null
                : Number(licitacion.montoEstimado),
            fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
          }
        : null,
    };
  }
}
