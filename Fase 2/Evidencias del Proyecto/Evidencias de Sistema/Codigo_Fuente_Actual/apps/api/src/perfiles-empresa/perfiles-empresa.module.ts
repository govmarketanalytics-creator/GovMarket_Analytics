import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MembresiasModule } from '../membresias/membresias.module';
import { PerfilEmpresa } from './entities/perfil-empresa.entity';
import { PerfilesEmpresaController } from './perfiles-empresa.controller';
import { PerfilesEmpresaService } from './perfiles-empresa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PerfilEmpresa]),
    AuthModule,
    MembresiasModule,
  ],
  controllers: [PerfilesEmpresaController],
  providers: [PerfilesEmpresaService],
  exports: [PerfilesEmpresaService],
})
export class PerfilesEmpresaModule {}
