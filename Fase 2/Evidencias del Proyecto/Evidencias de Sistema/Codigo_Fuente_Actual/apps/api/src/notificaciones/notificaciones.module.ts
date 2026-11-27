import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MembresiasModule } from '../membresias/membresias.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { NotificacionOportunidad } from './entities/notificacion-oportunidad.entity';
import { NotificacionUsuario } from './entities/notificacion-usuario.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificacionOportunidad,
      NotificacionUsuario,
      PerfilEmpresa,
    ]),
    AuthModule,
    MembresiasModule,
    OportunidadesModule,
    PlanesEmpresaModule,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
