import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MembresiasModule } from '../membresias/membresias.module';
import { PagoTransbank } from './entities/pago-transbank.entity';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { TransbankRetornoController } from './transbank-retorno.controller';
import { TransbankWebpayService } from './transbank-webpay.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PagoTransbank]),
    AuthModule,
    MembresiasModule,
  ],
  controllers: [PagosController, TransbankRetornoController],
  providers: [PagosService, TransbankWebpayService],
  exports: [PagosService],
})
export class PagosModule {}
