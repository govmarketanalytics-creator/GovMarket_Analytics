import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import type { ConsultarAlertasDto } from './dto/consultar-alertas.dto';
import { AlertaOportunidad } from './entities/alerta-oportunidad.entity';

interface OportunidadParaAlerta {
  id: string;
  porcentajeCompatibilidad: number;
  coincidencias: {
    palabrasClave: string[];
    codigosCategoria: string[];
    region: boolean | null;
    monto: boolean | null;
  };
}

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(AlertaOportunidad)
    private readonly alertasRepository: Repository<AlertaOportunidad>,
    private readonly oportunidadesService: OportunidadesService,
    private readonly perfilesEmpresaService: PerfilesEmpresaService,
    private readonly planesEmpresaService: PlanesEmpresaService,
  ) {}

  async generar(empresaId: string, esSuperadministrador = false) {
    if (
      !esSuperadministrador &&
      !(await this.planesEmpresaService.esPremiumVigente(empresaId))
    ) {
      throw new ForbiddenException({
        code: 'PLAN_PREMIUM_REQUERIDO',
        message:
          'Para acceder a esta función, suscríbete a un plan Premium Individual o Empresa.',
      });
    }

    const perfil = await this.perfilesEmpresaService.obtener(empresaId);
    const oportunidades = await this.obtenerTodasLasOportunidades(
      empresaId,
      perfil.puntajeMinimoAlerta,
    );

    if (oportunidades.length === 0) {
      return {
        empresaId,
        puntajeMinimoAlerta: perfil.puntajeMinimoAlerta,
        procesadas: 0,
        creadas: 0,
        actualizadas: 0,
      };
    }

    const licitacionIds = oportunidades.map((oportunidad) => oportunidad.id);

    const alertasExistentes = await this.alertasRepository.find({
      where: {
        empresaId,
        licitacionId: In(licitacionIds),
      },
    });

    const alertasPorLicitacion = new Map(
      alertasExistentes.map((alerta) => [alerta.licitacionId, alerta]),
    );

    const alertasParaGuardar: AlertaOportunidad[] = [];
    let creadas = 0;
    let actualizadas = 0;

    for (const oportunidad of oportunidades) {
      const coincidencias: Record<string, unknown> = {
        ...oportunidad.coincidencias,
      };

      const alertaExistente = alertasPorLicitacion.get(oportunidad.id);

      if (alertaExistente) {
        alertaExistente.porcentajeCompatibilidad = String(
          oportunidad.porcentajeCompatibilidad,
        );
        alertaExistente.coincidencias = coincidencias;
        alertasParaGuardar.push(alertaExistente);
        actualizadas += 1;
        continue;
      }

      alertasParaGuardar.push(
        this.alertasRepository.create({
          empresaId,
          licitacionId: oportunidad.id,
          porcentajeCompatibilidad: String(
            oportunidad.porcentajeCompatibilidad,
          ),
          coincidencias,
          leida: false,
          leidaEn: null,
        }),
      );

      creadas += 1;
    }

    await this.alertasRepository.save(alertasParaGuardar);

    return {
      empresaId,
      puntajeMinimoAlerta: perfil.puntajeMinimoAlerta,
      procesadas: oportunidades.length,
      creadas,
      actualizadas,
    };
  }

  async listar(empresaId: string, filtros: ConsultarAlertasDto) {
    const query = this.alertasRepository
      .createQueryBuilder('alerta')
      .select([
        'alerta.id',
        'alerta.empresaId',
        'alerta.licitacionId',
        'alerta.porcentajeCompatibilidad',
        'alerta.coincidencias',
        'alerta.leida',
        'alerta.leidaEn',
        'alerta.generadaEn',
        'alerta.actualizadaEn',
      ])
      .innerJoin('alerta.licitacion', 'licitacion')
      .addSelect([
        'licitacion.id',
        'licitacion.codigoExterno',
        'licitacion.nombre',
        'licitacion.descripcion',
        'licitacion.codigoEstado',
        'licitacion.estado',
        'licitacion.moneda',
        'licitacion.montoEstimado',
        'licitacion.fechaPublicacion',
        'licitacion.fechaCierre',
        'licitacion.codigoOrganismo',
        'licitacion.nombreOrganismo',
        'licitacion.comunaUnidad',
        'licitacion.regionUnidad',
      ])
      .where('alerta.empresaId = :empresaId', { empresaId });

    if (filtros.leida !== undefined) {
      query.andWhere('alerta.leida = :leida', {
        leida: filtros.leida,
      });
    }

    const [alertas, total] = await query
      .orderBy('alerta.generadaEn', 'DESC')
      .addOrderBy('licitacion.fechaCierre', 'ASC', 'NULLS LAST')
      .skip((filtros.pagina - 1) * filtros.limite)
      .take(filtros.limite)
      .getManyAndCount();

    return {
      datos: alertas.map((alerta) => this.mapearAlerta(alerta)),
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }

  async marcarComoLeida(empresaId: string, alertaId: string) {
    const alerta = await this.alertasRepository.findOne({
      where: {
        id: alertaId,
        empresaId,
      },
      relations: {
        licitacion: true,
      },
    });

    if (!alerta) {
      throw new NotFoundException('La alerta indicada no existe');
    }

    if (!alerta.leida) {
      alerta.leida = true;
      alerta.leidaEn = new Date();
      await this.alertasRepository.save(alerta);
    }

    return this.mapearAlerta(alerta);
  }

  private async obtenerTodasLasOportunidades(
    empresaId: string,
    puntajeMinimo: number,
  ): Promise<OportunidadParaAlerta[]> {
    const oportunidades: OportunidadParaAlerta[] = [];
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const resultado = await this.oportunidadesService.listar(empresaId, {
        alcance: 'recomendadas',
        pagina,
        limite: 100,
        puntajeMinimo,
        soloVigentes: true,
        orden: 'compatibilidad_desc',
      });

      oportunidades.push(...resultado.datos);
      totalPaginas = resultado.paginacion.totalPaginas;
      pagina += 1;
    } while (pagina <= totalPaginas);

    return oportunidades;
  }

  private mapearAlerta(alerta: AlertaOportunidad) {
    const licitacion = alerta.licitacion;

    return {
      id: alerta.id,
      empresaId: alerta.empresaId,
      porcentajeCompatibilidad: Number(alerta.porcentajeCompatibilidad),
      coincidencias: alerta.coincidencias,
      leida: alerta.leida,
      leidaEn: alerta.leidaEn?.toISOString() ?? null,
      generadaEn: alerta.generadaEn.toISOString(),
      actualizadaEn: alerta.actualizadaEn.toISOString(),
      licitacion: {
        id: licitacion.id,
        codigoExterno: licitacion.codigoExterno,
        nombre: licitacion.nombre,
        descripcion: licitacion.descripcion,
        codigoEstado: licitacion.codigoEstado,
        estado: licitacion.estado,
        moneda: licitacion.moneda,
        montoEstimado:
          licitacion.montoEstimado === null
            ? null
            : Number(licitacion.montoEstimado),
        fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
        fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
        codigoOrganismo: licitacion.codigoOrganismo,
        nombreOrganismo: licitacion.nombreOrganismo,
        comunaUnidad: licitacion.comunaUnidad,
        regionUnidad: licitacion.regionUnidad,
      },
    };
  }
}
