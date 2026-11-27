import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GuardarPerfilEmpresaDto } from './dto/guardar-perfil-empresa.dto';
import { PerfilEmpresa } from './entities/perfil-empresa.entity';
import { nexusHabilitado } from '../nexus/catalogo-nexus';

@Injectable()
export class PerfilesEmpresaService {
  constructor(
    @InjectRepository(PerfilEmpresa)
    private readonly perfilesRepository: Repository<PerfilEmpresa>,
  ) {}

  async guardar(empresaId: string, datos: GuardarPerfilEmpresaDto) {
    const perfilExistente = await this.perfilesRepository.findOne({
      where: {
        empresaId,
      },
    });

    const valores = {
      empresaId,
      ofertasIds: datos.ofertasIds ?? perfilExistente?.ofertasIds ?? [],
      etiquetasCapacidades: datos.etiquetasCapacidades ?? perfilExistente?.etiquetasCapacidades ?? [],
      palabrasClave: datos.palabrasClave ?? perfilExistente?.palabrasClave ?? [],
      codigosCategoria: datos.codigosCategoria ?? perfilExistente?.codigosCategoria ?? [],
      regiones: datos.regiones ?? perfilExistente?.regiones ?? [],
      montoMinimo: datos.montoMinimo === undefined ? perfilExistente?.montoMinimo ?? null
        : datos.montoMinimo === null ? null : String(datos.montoMinimo),
      montoMaximo: datos.montoMaximo === undefined ? perfilExistente?.montoMaximo ?? null
        : datos.montoMaximo === null ? null : String(datos.montoMaximo),
      incluirSinMonto: datos.incluirSinMonto ?? perfilExistente?.incluirSinMonto ?? true,
      puntajeMinimoAlerta: datos.puntajeMinimoAlerta === undefined ? perfilExistente?.puntajeMinimoAlerta ?? '60'
        : String(datos.puntajeMinimoAlerta),
      activo: datos.activo ?? perfilExistente?.activo ?? true,
    };
    if (valores.montoMinimo !== null && valores.montoMaximo !== null
        && Number(valores.montoMinimo) > Number(valores.montoMaximo)) {
      throw new BadRequestException('El monto máximo no puede ser menor que el mínimo guardado.');
    }

    const perfil = perfilExistente
      ? this.perfilesRepository.merge(perfilExistente, valores)
      : this.perfilesRepository.create(valores);

    const perfilGuardado = await this.perfilesRepository.save(perfil);

    return this.mapearPerfil(perfilGuardado);
  }

  async obtener(empresaId: string) {
    const perfil = await this.perfilesRepository.findOne({
      where: {
        empresaId,
      },
    });

    if (!perfil) {
      throw new NotFoundException(
        'La empresa todavía no tiene un perfil de oportunidades',
      );
    }

    return this.mapearPerfil(perfil);
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
}
