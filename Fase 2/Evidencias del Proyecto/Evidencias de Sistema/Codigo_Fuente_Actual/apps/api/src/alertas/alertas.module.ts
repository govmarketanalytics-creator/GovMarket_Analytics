import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MembresiasModule } from '../membresias/membresias.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PerfilesEmpresaModule } from '../perfiles-empresa/perfiles-empresa.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { AlertaOportunidad } from './entities/alerta-oportunidad.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertaOportunidad]),
    AuthModule,
    MembresiasModule,
    OportunidadesModule,
    PerfilesEmpresaModule,
    PlanesEmpresaModule,
  ],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
