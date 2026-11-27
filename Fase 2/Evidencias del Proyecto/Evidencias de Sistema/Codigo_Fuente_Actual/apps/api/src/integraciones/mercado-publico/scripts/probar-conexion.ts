import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { MercadoPublicoService } from '../mercado-publico.service';

async function probarConexion(): Promise<void> {
  let aplicacion: INestApplicationContext | undefined;

  try {
    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });

    const mercadoPublicoService = aplicacion.get(MercadoPublicoService);
    const respuesta = await mercadoPublicoService.listarLicitacionesDelDia();

    console.log('CONEXION MERCADO PUBLICO: OK');
    console.log(`VERSION API: ${respuesta.Version}`);
    console.log(`LICITACIONES INFORMADAS: ${respuesta.Cantidad}`);
    console.log(`REGISTROS RECIBIDOS: ${respuesta.Listado.length}`);
  } catch {
    console.error(
      'No fue posible comprobar la integración con Mercado Público.',
    );

    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void probarConexion();
