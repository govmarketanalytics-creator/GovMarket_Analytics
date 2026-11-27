import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestaLicitacionesService } from '../ingesta-licitaciones.service';

async function sincronizarActivas(): Promise<void> {
  const limiteTexto = process.argv[2];
  const limite = limiteTexto === undefined ? undefined : Number(limiteTexto);
  let aplicacion: INestApplicationContext | undefined;

  try {
    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });

    const ingestaService = aplicacion.get(IngestaLicitacionesService);
    const resultado = await ingestaService.sincronizarActivas(limite);

    console.log('INGESTA DE ACTIVAS: OK');
    console.log(`CONSULTADO EN: ${resultado.consultadoEn}`);
    console.log(`INFORMADAS POR API: ${resultado.informadasPorApi}`);
    console.log(`INDEXADAS EN BASE: ${resultado.indexadas}`);
    console.log(`CREADAS EN CATALOGO: ${resultado.creadasEnCatalogo}`);
    console.log(
      `ACTUALIZADAS EN CATALOGO: ${resultado.actualizadasEnCatalogo}`,
    );
    console.log(`CON CIERRE FUTURO: ${resultado.conCierreFuturo}`);
    console.log(`CON CIERRE VENCIDO: ${resultado.conCierreVencido}`);
    console.log(`LIMITE DE DETALLES: ${resultado.limiteDetalles}`);
    console.log(`DETALLES PROCESADOS: ${resultado.detallesProcesados}`);
    console.log(`DETALLES COMPLETADOS: ${resultado.detallesCompletados}`);
    console.log(`DETALLES FALLIDOS: ${resultado.detallesFallidos}`);
    console.log(`ITEMS GUARDADOS: ${resultado.itemsGuardados}`);
    console.log(`VIGENTES CON DETALLE: ${resultado.cobertura.conDetalle} / ${resultado.cobertura.total}`);
    console.log(`PENDIENTES: ${resultado.cobertura.pendientes}`);
    if (resultado.pausa) console.log(`PAUSA CONTROLADA: ${resultado.pausa}`);

    for (const error of resultado.errores) {
      console.error(`ERROR ${error.codigoExterno}: ${error.mensaje}`);
    }

    if (resultado.detallesFallidos > 0) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message
        : 'Error desconocido durante la ingesta';

    console.error(`INGESTA DE ACTIVAS: ERROR - ${mensaje}`);
    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void sincronizarActivas();
