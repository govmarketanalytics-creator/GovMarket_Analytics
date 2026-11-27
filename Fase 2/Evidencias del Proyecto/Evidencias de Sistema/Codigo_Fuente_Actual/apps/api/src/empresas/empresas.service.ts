import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { Empresa } from './entities/empresa.entity';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresasRepository: Repository<Empresa>,
  ) {}

  async crear(datos: CrearEmpresaDto): Promise<Empresa> {
    const empresaExistente = await this.empresasRepository.findOne({
      where: { rut: datos.rut },
    });

    if (empresaExistente) {
      throw new ConflictException(
        'Ya existe una empresa registrada con ese RUT',
      );
    }

    const empresa = this.empresasRepository.create({
      rut: datos.rut,
      razonSocial: datos.razonSocial,
      nombreFantasia: datos.nombreFantasia?.trim() || null,
    });

    try {
      return await this.empresasRepository.save(empresa);
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new ConflictException(
          'Ya existe una empresa registrada con ese RUT',
        );
      }

      throw error;
    }
  }

  listar(): Promise<Empresa[]> {
    return this.empresasRepository.find({
      order: {
        creadoEn: 'DESC',
      },
    });
  }

  async buscarPorId(id: string): Promise<Empresa> {
    const empresa = await this.empresasRepository.findOne({
      where: { id },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa indicada no existe');
    }

    return empresa;
  }
}
