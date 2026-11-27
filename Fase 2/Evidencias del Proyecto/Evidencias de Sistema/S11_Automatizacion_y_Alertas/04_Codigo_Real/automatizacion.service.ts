import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertasService } from '../alertas/alertas.service';
import { IngestaLicitacionesService } from '../licitaciones/ingesta-licitaciones.service';
import type { ResultadoIngestaActivas } from '../licitaciones/ingesta-licitaciones.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';

@Injectable()
export class AutomatizacionService {
  private readonly logger = new Logger(AutomatizacionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ingestaLicitacionesService: IngestaLicitacionesService,
    private readonly alertasService: AlertasService,
    private readonly notificacionesService: NotificacionesService,
    @InjectRepository(PerfilEmpresa)
    private readonly perfilesRepository: Repository<PerfilEmpresa>,
    private readonly planesEmpresaService: PlanesEmpresaService,
  ) {}

  @Cron('0 */30 * * * *', {
    name: 'ingesta-mercado-publico-cada-30-minutos',
    timeZone: 'America/Santiago',
    waitForCompletion: true,
  })
  async sincronizarYGenerarAlertas(): Promise<void> {
    const habilitada = this.configService.getOrThrow<boolean>(
      'AUTOMATIZACION_HABILITADA',
    );

    if (!habilitada) {
      return;
    }

    const limite = this.configService.getOrThrow<number>(
      'AUTOMATIZACION_LIMITE_POR_CICLO',
    );

    let resultado: ResultadoIngestaActivas;

    try {
      resultado =
        await this.ingestaLicitacionesService.sincronizarActivas(limite);
    } catch {
      this.logger.error('No se pudo completar la ingesta programada.');
      return;
    }

    this.logger.log(
      `Catálogo activo: ${resultado.indexadas} indexadas, ` +
        `${resultado.detallesCompletados} detalles completados, ` +
        `${resultado.detallesFallidos} detalles fallidos.`,
    );

    try {
      const notificaciones =
        await this.notificacionesService.generarParaCodigosNuevos(
          resultado.codigosNuevosParaNotificar,
        );
      await this.ingestaLicitacionesService.confirmarNotificacionesNuevas(resultado.codigosNuevosParaNotificar);
      this.logger.log(
        `Notificaciones: ${notificaciones.procesadas} coincidencias evaluadas, ` +
          `${notificaciones.creadas} notificaciones creadas.`,
      );
    } catch {
      this.logger.error(
        'No se pudieron generar las notificaciones de nuevas oportunidades.',
      );
    }

    let perfiles: PerfilEmpresa[];
    let empresasConPremium: Set<string>;

    try {
      empresasConPremium = new Set(
        await this.planesEmpresaService.listarEmpresasPremiumVigentes(),
      );
      perfiles = await this.perfilesRepository.find({
        select: { empresaId: true },
        where: { activo: true },
      });
    } catch {
      this.logger.error(
        'No se pudieron consultar los perfiles y planes vigentes.',
      );
      return;
    }

    let empresasProcesadas = 0;
    let empresasFallidas = 0;
    let alertasCreadas = 0;

    for (const perfil of perfiles) {
      if (!empresasConPremium.has(perfil.empresaId)) {
        continue;
      }

      try {
        const resumen = await this.alertasService.generar(perfil.empresaId);
        empresasProcesadas += 1;
        alertasCreadas += resumen.creadas;
      } catch {
        empresasFallidas += 1;
        this.logger.error(
          `No se generaron alertas para la empresa ${perfil.empresaId}.`,
        );
      }
    }

    this.logger.log(
      `Alertas: ${empresasProcesadas} empresas procesadas, ` +
        `${empresasFallidas} empresas fallidas, ${alertasCreadas} alertas creadas.`,
    );
  }
}
