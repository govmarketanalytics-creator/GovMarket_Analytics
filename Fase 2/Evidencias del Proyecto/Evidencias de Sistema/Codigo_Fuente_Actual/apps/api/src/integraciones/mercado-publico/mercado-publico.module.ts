import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MercadoPublicoService } from './mercado-publico.service';
import { ControlConsultasService } from './control-consultas.service';

@Module({
  imports: [ConfigModule],
  providers: [ControlConsultasService, MercadoPublicoService],
  exports: [ControlConsultasService, MercadoPublicoService],
})
export class MercadoPublicoModule {}
