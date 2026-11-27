import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MercadoPublicoModule } from '../integraciones/mercado-publico/mercado-publico.module';
import { ConsultaLicitacionesService } from './consulta-licitaciones/consulta-licitaciones.service';
import { LicitacionItem } from './entities/licitacion-item.entity';
import { LicitacionAdjudicacion } from './entities/licitacion-adjudicacion.entity';
import { LicitacionListadoDia } from './entities/licitacion-listado-dia.entity';
import { LicitacionResultado } from './entities/licitacion-resultado.entity';
import { Licitacion } from './entities/licitacion.entity';
import { SincronizacionListadoDia } from './entities/sincronizacion-listado-dia.entity';
import { IngestaLicitacionesService } from './ingesta-licitaciones.service';
import { LicitacionesController } from './licitaciones.controller';
import { LicitacionesService } from './licitaciones.service';
import { ColaDetallesService } from './cola-detalles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Licitacion,
      LicitacionItem,
      LicitacionResultado,
      LicitacionAdjudicacion,
      LicitacionListadoDia,
      SincronizacionListadoDia,
    ]),
    MercadoPublicoModule,
    AuthModule,
  ],
  controllers: [LicitacionesController],
  providers: [
    ColaDetallesService,
    LicitacionesService,
    IngestaLicitacionesService,
    ConsultaLicitacionesService,
  ],
  exports: [
    TypeOrmModule,
    LicitacionesService,
    IngestaLicitacionesService,
    ConsultaLicitacionesService,
  ],
})
export class LicitacionesModule {}
