import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { MembresiasModule } from '../membresias/membresias.module';
import { PerfilesEmpresaModule } from '../perfiles-empresa/perfiles-empresa.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Licitacion]),
    AuthModule,
    MembresiasModule,
    PerfilesEmpresaModule,
    PlanesEmpresaModule,
  ],
  controllers: [OportunidadesController],
  providers: [OportunidadesService],
  exports: [OportunidadesService],
})
export class OportunidadesModule {}
