import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Empresa } from '../empresas/entities/empresa.entity';
import { MembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { PlanesEmpresaModule } from '../planes-empresa/planes-empresa.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Empresa,
      MembresiaEmpresa,
      PerfilEmpresa,
      Usuario,
    ]),
    AuthModule,
    PlanesEmpresaModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
