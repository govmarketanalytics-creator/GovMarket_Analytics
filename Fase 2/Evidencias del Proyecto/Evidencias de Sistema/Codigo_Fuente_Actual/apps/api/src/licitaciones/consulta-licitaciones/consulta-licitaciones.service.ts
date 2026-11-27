import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConsultarLicitacionesDto } from '../dto/consultar-licitaciones.dto';
import { Licitacion } from '../entities/licitacion.entity';

@Injectable()
export class ConsultaLicitacionesService {
  constructor(
    @InjectRepository(Licitacion)
    private readonly licitacionesRepository: Repository<Licitacion>,
  ) {}

  async listar(filtros: ConsultarLicitacionesDto) {
    const consulta = this.licitacionesRepository
      .createQueryBuilder('licitacion')
      .select([
        'licitacion.id',
        'licitacion.codigoExterno',
        'licitacion.nombre',
        'licitacion.descripcion',
        'licitacion.codigoEstado',
        'licitacion.estado',
        'licitacion.codigoTipo',
        'licitacion.tipo',
        'licitacion.moneda',
        'licitacion.montoEstimado',
        'licitacion.fechaPublicacion',
        'licitacion.fechaCierre',
        'licitacion.codigoOrganismo',
        'licitacion.nombreOrganismo',
        'licitacion.codigoUnidad',
        'licitacion.nombreUnidad',
        'licitacion.comunaUnidad',
        'licitacion.regionUnidad',
        'licitacion.sincronizadoEn',
      ]);

    if (filtros.texto) {
      consulta.andWhere(
        `(
          licitacion.codigoExterno ILIKE :texto
          OR licitacion.nombre ILIKE :texto
          OR licitacion.descripcion ILIKE :texto
          OR EXISTS (
            SELECT 1
            FROM licitacion_items item_busqueda
            WHERE item_busqueda.licitacion_id = licitacion.id
              AND (
                item_busqueda.nombre_producto ILIKE :texto
                OR item_busqueda.descripcion ILIKE :texto
                OR item_busqueda.categoria ILIKE :texto
              )
          )
        )`,
        {
          texto: `%${filtros.texto}%`,
        },
      );
    }

    if (filtros.codigoEstado !== undefined) {
      consulta.andWhere('licitacion.codigoEstado = :codigoEstado', {
        codigoEstado: filtros.codigoEstado,
      });
    }

    if (filtros.codigoOrganismo) {
      consulta.andWhere('licitacion.codigoOrganismo = :codigoOrganismo', {
        codigoOrganismo: filtros.codigoOrganismo,
      });
    }

    if (filtros.region) {
      consulta.andWhere('licitacion.regionUnidad ILIKE :region', {
        region: `%${filtros.region}%`,
      });
    }

    if (filtros.publicadaDesde) {
      consulta.andWhere(
        `licitacion.fechaPublicacion >= (
          CAST(:publicadaDesde AS date)
          AT TIME ZONE 'America/Santiago'
        )`,
        {
          publicadaDesde: filtros.publicadaDesde,
        },
      );
    }

    if (filtros.publicadaHasta) {
      consulta.andWhere(
        `licitacion.fechaPublicacion < (
          (CAST(:publicadaHasta AS date) + INTERVAL '1 day')
          AT TIME ZONE 'America/Santiago'
        )`,
        {
          publicadaHasta: filtros.publicadaHasta,
        },
      );
    }

    if (filtros.cierreDesde) {
      consulta.andWhere(
        `licitacion.fechaCierre >= (
          CAST(:cierreDesde AS date)
          AT TIME ZONE 'America/Santiago'
        )`,
        {
          cierreDesde: filtros.cierreDesde,
        },
      );
    }

    if (filtros.cierreHasta) {
      consulta.andWhere(
        `licitacion.fechaCierre < (
          (CAST(:cierreHasta AS date) + INTERVAL '1 day')
          AT TIME ZONE 'America/Santiago'
        )`,
        {
          cierreHasta: filtros.cierreHasta,
        },
      );
    }

    const pagina = filtros.pagina;
    const limite = filtros.limite;

    consulta
      .orderBy('licitacion.fechaPublicacion', 'DESC', 'NULLS LAST')
      .addOrderBy('licitacion.codigoExterno', 'ASC')
      .skip((pagina - 1) * limite)
      .take(limite);

    const [licitaciones, total] = await consulta.getManyAndCount();

    return {
      datos: licitaciones.map((licitacion) =>
        this.serializarResumen(licitacion),
      ),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  async obtenerPorCodigo(codigo: string) {
    const codigoNormalizado = codigo.trim().toUpperCase();

    if (!/^[0-9]+-[0-9]+-[A-Z0-9]+$/.test(codigoNormalizado)) {
      throw new BadRequestException(
        'El código de licitación no tiene un formato válido',
      );
    }

    const licitacion = await this.licitacionesRepository
      .createQueryBuilder('licitacion')
      .leftJoinAndSelect('licitacion.items', 'item')
      .where('licitacion.codigoExterno = :codigoExterno', {
        codigoExterno: codigoNormalizado,
      })
      .orderBy('item.correlativo', 'ASC')
      .getOne();

    if (!licitacion) {
      throw new NotFoundException('La licitación solicitada no existe');
    }

    return {
      id: licitacion.id,
      codigoExterno: licitacion.codigoExterno,
      nombre: licitacion.nombre,
      descripcion: licitacion.descripcion,
      codigoEstado: licitacion.codigoEstado,
      estado: licitacion.estado,
      codigoTipo: licitacion.codigoTipo,
      tipo: licitacion.tipo,
      moneda: licitacion.moneda,
      montoEstimado: licitacion.montoEstimado,
      fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
      fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
      fechaAdjudicacion: licitacion.fechaAdjudicacion?.toISOString() ?? null,
      comprador: {
        codigoOrganismo: licitacion.codigoOrganismo,
        nombreOrganismo: licitacion.nombreOrganismo,
        codigoUnidad: licitacion.codigoUnidad,
        nombreUnidad: licitacion.nombreUnidad,
        comuna: licitacion.comunaUnidad,
        region: licitacion.regionUnidad,
      },
      cantidadReclamos: licitacion.cantidadReclamos,
      items: licitacion.items.map((item) => ({
        id: item.id,
        correlativo: item.correlativo,
        codigoProducto: item.codigoProducto,
        codigoCategoria: item.codigoCategoria,
        categoria: item.categoria,
        nombreProducto: item.nombreProducto,
        descripcion: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: item.cantidad,
      })),
      sincronizadoEn: licitacion.sincronizadoEn.toISOString(),
    };
  }

  private serializarResumen(licitacion: Licitacion) {
    return {
      id: licitacion.id,
      codigoExterno: licitacion.codigoExterno,
      nombre: licitacion.nombre,
      descripcion: licitacion.descripcion,
      codigoEstado: licitacion.codigoEstado,
      estado: licitacion.estado,
      codigoTipo: licitacion.codigoTipo,
      tipo: licitacion.tipo,
      moneda: licitacion.moneda,
      montoEstimado: licitacion.montoEstimado,
      fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
      fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
      codigoOrganismo: licitacion.codigoOrganismo,
      nombreOrganismo: licitacion.nombreOrganismo,
      codigoUnidad: licitacion.codigoUnidad,
      nombreUnidad: licitacion.nombreUnidad,
      comuna: licitacion.comunaUnidad,
      region: licitacion.regionUnidad,
      sincronizadoEn: licitacion.sincronizadoEn.toISOString(),
    };
  }
}
