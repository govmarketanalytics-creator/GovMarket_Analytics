import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasModule } from '../alertas/alertas.module';
import { LicitacionesModule } from '../licitaciones/licitaciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { AutomatizacionService } from './automatizacion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PerfilEmpresa]),
    LicitacionesModule,
    AlertasModule,
    NotificacionesModule,
    PlanesEmpresaModule,
  ],
  providers: [AutomatizacionService],
})
export class AutomatizacionModule {}
