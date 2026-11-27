import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { MembresiasModule } from '../membresias/membresias.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { LicitacionFavorita } from './entities/licitacion-favorita.entity';
import { FavoritosController } from './favoritos.controller';
import { FavoritosService } from './favoritos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LicitacionFavorita, Licitacion]),
    AuthModule,
    MembresiasModule,
    PlanesEmpresaModule,
  ],
  controllers: [FavoritosController],
  providers: [FavoritosService],
  exports: [FavoritosService],
})
export class FavoritosModule {}
