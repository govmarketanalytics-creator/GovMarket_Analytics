import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { LicitacionFavorita } from './entities/licitacion-favorita.entity';

const CODIGO_LICITACION_PATTERN = /^\d+-\d+-[a-zA-Z0-9]+$/;

@Injectable()
export class FavoritosService {
  constructor(
    @InjectRepository(LicitacionFavorita)
    private readonly favoritosRepository: Repository<LicitacionFavorita>,

    @InjectRepository(Licitacion)
    private readonly licitacionesRepository: Repository<Licitacion>,
  ) {}

  async agregar(empresaId: string, codigoExterno: string, usuarioId: string) {
    const codigoNormalizado = this.normalizarCodigo(codigoExterno);

    const licitacion = await this.licitacionesRepository.findOne({
      where: {
        codigoExterno: codigoNormalizado,
      },
    });

    if (!licitacion) {
      throw new NotFoundException('La licitación indicada no existe');
    }

    const favoritoExistente = await this.favoritosRepository.findOne({
      where: {
        empresaId,
        licitacionId: licitacion.id,
      },
    });

    if (favoritoExistente) {
      throw new ConflictException('La licitación ya está en favoritos');
    }

    const favorito = this.favoritosRepository.create({
      empresaId,
      licitacionId: licitacion.id,
      licitacion,
      agregadaPorUsuarioId: usuarioId,
    });

    try {
      const favoritoGuardado = await this.favoritosRepository.save(favorito);

      return this.mapearFavorito(favoritoGuardado);
    } catch (error) {
      if (this.esViolacionUnica(error)) {
        throw new ConflictException('La licitación ya está en favoritos');
      }

      throw error;
    }
  }

  async listar(empresaId: string) {
    const favoritos = await this.favoritosRepository.find({
      where: {
        empresaId,
      },
      relations: {
        licitacion: true,
      },
      order: {
        creadoEn: 'DESC',
      },
    });

    return {
      datos: favoritos.map((favorito) => this.mapearFavorito(favorito)),
      total: favoritos.length,
    };
  }

  async eliminar(empresaId: string, codigoExterno: string): Promise<void> {
    const codigoNormalizado = this.normalizarCodigo(codigoExterno);

    const favorito = await this.favoritosRepository
      .createQueryBuilder('favorito')
      .innerJoinAndSelect('favorito.licitacion', 'licitacion')
      .where('favorito.empresaId = :empresaId', { empresaId })
      .andWhere('licitacion.codigoExterno = :codigoExterno', {
        codigoExterno: codigoNormalizado,
      })
      .getOne();

    if (!favorito) {
      throw new NotFoundException(
        'La licitación no se encuentra en los favoritos de la empresa',
      );
    }

    await this.favoritosRepository.remove(favorito);
  }

  private normalizarCodigo(codigoExterno: string): string {
    const codigoNormalizado = codigoExterno.trim().toUpperCase();

    if (!CODIGO_LICITACION_PATTERN.test(codigoNormalizado)) {
      throw new BadRequestException('El código de licitación no es válido');
    }

    return codigoNormalizado;
  }

  private mapearFavorito(favorito: LicitacionFavorita) {
    const licitacion = favorito.licitacion;

    return {
      id: favorito.id,
      empresaId: favorito.empresaId,
      agregadaPorUsuarioId: favorito.agregadaPorUsuarioId,
      creadoEn: favorito.creadoEn.toISOString(),
      licitacion: {
        id: licitacion.id,
        codigoExterno: licitacion.codigoExterno,
        nombre: licitacion.nombre,
        descripcion: licitacion.descripcion,
        codigoEstado: licitacion.codigoEstado,
        activaEnListado: licitacion.activaEnListado,
        esPrueba: String(licitacion.datosOrigen?.esPrueba ?? 'false') === 'true',
        estado: licitacion.estado,
        codigoTipo: licitacion.codigoTipo,
        tipo: licitacion.tipo,
        moneda: licitacion.moneda,
        montoEstimado: licitacion.montoEstimado,
        fechaPublicacion: licitacion.fechaPublicacion?.toISOString() ?? null,
        fechaCierre: licitacion.fechaCierre?.toISOString() ?? null,
        fechaAdjudicacion: licitacion.fechaAdjudicacion?.toISOString() ?? null,
        codigoOrganismo: licitacion.codigoOrganismo,
        nombreOrganismo: licitacion.nombreOrganismo,
        comunaUnidad: licitacion.comunaUnidad,
        regionUnidad: licitacion.regionUnidad,
        cantidadReclamos: licitacion.cantidadReclamos,
        sincronizadoEn: licitacion.sincronizadoEn.toISOString(),
      },
    };
  }

  private esViolacionUnica(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string };

    return driverError.code === '23505';
  }
}
