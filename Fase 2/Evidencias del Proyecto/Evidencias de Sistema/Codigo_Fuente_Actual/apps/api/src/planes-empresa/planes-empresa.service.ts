import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import {
  EstadoSuscripcionEmpresa,
  SuscripcionEmpresa,
} from './entities/suscripcion-empresa.entity';

@Injectable()
export class PlanesEmpresaService {
  constructor(
    @InjectRepository(SuscripcionEmpresa)
    private readonly suscripcionesRepository: Repository<SuscripcionEmpresa>,
  ) {}

  async obtener(empresaId: string) {
    const suscripcion = await this.suscripcionesRepository.findOne({
      where: { empresaId },
    });

    if (!suscripcion) {
      return {
        empresaId,
        plan: 'gratuito',
        estado: 'sin_suscripcion',
        premiumVigente: false,
        vigenteHasta: null,
        usuariosAdicionalesPermitidos: 0,
      };
    }

    return {
      empresaId,
      plan: suscripcion.plan,
      estado: suscripcion.estado,
      premiumVigente: this.estaVigente(suscripcion),
      vigenteHasta: suscripcion.vigenteHasta.toISOString(),
      usuariosAdicionalesPermitidos:
        suscripcion.plan === 'empresa' && this.estaVigente(suscripcion) ? 4 : 0,
    };
  }

  async esPremiumVigente(empresaId: string): Promise<boolean> {
    const suscripcion = await this.suscripcionesRepository.findOne({
      where: { empresaId },
    });

    return suscripcion !== null && this.estaVigente(suscripcion);
  }

  async listarEmpresasPremiumVigentes(): Promise<string[]> {
    const ahora = new Date();
    const suscripciones = await this.suscripcionesRepository.find({
      select: { empresaId: true },
      where: {
        estado: EstadoSuscripcionEmpresa.ACTIVA,
        vigenteDesde: LessThanOrEqual(ahora),
        vigenteHasta: MoreThan(ahora),
      },
    });

    return suscripciones.map((suscripcion) => suscripcion.empresaId);
  }

  private estaVigente(suscripcion: SuscripcionEmpresa): boolean {
    const ahora = Date.now();

    return (
      suscripcion.estado === EstadoSuscripcionEmpresa.ACTIVA &&
      suscripcion.vigenteDesde.getTime() <= ahora &&
      suscripcion.vigenteHasta.getTime() > ahora
    );
  }
}
