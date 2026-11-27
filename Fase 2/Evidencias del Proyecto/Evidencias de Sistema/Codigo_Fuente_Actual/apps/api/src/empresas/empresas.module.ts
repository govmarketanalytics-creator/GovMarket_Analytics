import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MembresiasModule } from '../membresias/membresias.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { Empresa } from './entities/empresa.entity';
import { EmpresasController } from './empresas.controller';
import { EmpresasService } from './empresas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Empresa]),
    AuthModule,
    MembresiasModule,
    PlanesEmpresaModule,
  ],
  controllers: [EmpresasController],
  providers: [EmpresasService],
  exports: [EmpresasService],
})
export class EmpresasModule {}
