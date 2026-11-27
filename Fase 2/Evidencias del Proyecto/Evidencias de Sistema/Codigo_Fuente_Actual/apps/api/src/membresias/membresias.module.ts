import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { MembresiaEmpresa } from './entities/membresia-empresa.entity';
import { MembresiaEmpresaGuard } from './guards/membresia-empresa.guard';
import { RolEmpresaGuard } from './guards/rol-empresa.guard';
import { MembresiasController } from './membresias.controller';
import { MembresiasService } from './membresias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MembresiaEmpresa]),
    AuthModule,
    PlanesEmpresaModule,
  ],
  controllers: [MembresiasController],
  providers: [MembresiasService, MembresiaEmpresaGuard, RolEmpresaGuard],
  exports: [
    TypeOrmModule,
    MembresiasService,
    MembresiaEmpresaGuard,
    RolEmpresaGuard,
  ],
})
export class MembresiasModule {}
