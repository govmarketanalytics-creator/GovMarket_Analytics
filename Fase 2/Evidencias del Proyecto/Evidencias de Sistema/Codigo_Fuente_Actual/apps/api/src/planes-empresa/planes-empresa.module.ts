import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuscripcionEmpresa } from './entities/suscripcion-empresa.entity';
import { PlanPremiumGuard } from './guards/plan-premium.guard';
import { PlanesEmpresaService } from './planes-empresa.service';

@Module({
  imports: [TypeOrmModule.forFeature([SuscripcionEmpresa])],
  providers: [PlanesEmpresaService, PlanPremiumGuard],
  exports: [PlanesEmpresaService, PlanPremiumGuard],
})
export class PlanesEmpresaModule {}
