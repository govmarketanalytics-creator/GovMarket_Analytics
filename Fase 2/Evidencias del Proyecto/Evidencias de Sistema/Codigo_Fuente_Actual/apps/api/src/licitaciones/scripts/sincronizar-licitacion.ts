import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { LicitacionesService } from '../licitaciones.service';

async function sincronizarLicitacion(): Promise<void> {
  const codigo = process.argv[2]?.trim();
  let aplicacion: INestApplicationContext | undefined;

  if (!codigo) {
    console.error(
      'Debes indicar un código: npm run licitacion:sincronizar -- CODIGO',
    );

    process.exitCode = 1;
    return;
  }

  try {
    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });

    const licitacionesService = aplicacion.get(LicitacionesService);
    const resultado = await licitacionesService.sincronizarPorCodigo(codigo);

    console.log('SINCRONIZACION: OK');
    console.log(`CODIGO: ${resultado.codigoExterno}`);
    console.log(`CREADA: ${resultado.creada ? 'SI' : 'NO'}`);
    console.log(`ITEMS GUARDADOS: ${resultado.itemsGuardados}`);
    console.log(`SINCRONIZADA EN: ${resultado.sincronizadoEn.toISOString()}`);
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message
        : 'Error desconocido durante la sincronización';

    console.error(`SINCRONIZACION: ERROR - ${mensaje}`);
    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void sincronizarLicitacion();
