import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestaLicitacionesService } from '../ingesta-licitaciones.service';

function construirFecha(fechaTexto?: string): Date {
  if (!fechaTexto) {
    return new Date();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
    throw new Error('La fecha debe utilizar el formato AAAA-MM-DD');
  }

  const [anio, mes, dia] = fechaTexto.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);

  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    throw new Error('La fecha indicada no existe');
  }

  return fecha;
}

async function sincronizarDia(): Promise<void> {
  const fechaTexto = process.argv[2];
  const limiteTexto = process.argv[3];

  let aplicacion: INestApplicationContext | undefined;

  try {
    const fecha = construirFecha(fechaTexto);
    const limite = limiteTexto === undefined ? undefined : Number(limiteTexto);

    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });

    const ingestaService = aplicacion.get(IngestaLicitacionesService);

    const resultado = await ingestaService.sincronizarFecha(fecha, limite);

    console.log('INGESTA DIARIA: OK');
    console.log(`FECHA: ${resultado.fechaConsulta}`);
    console.log(`INFORMADAS POR API: ${resultado.informadasPorApi}`);
    console.log(`CODIGOS UNICOS: ${resultado.codigosUnicosEncontrados}`);
    console.log(`LIMITE APLICADO: ${resultado.limiteAplicado}`);
    console.log(`PROCESADAS: ${resultado.procesadas}`);
    console.log(`CREADAS: ${resultado.creadas}`);
    console.log(`ACTUALIZADAS: ${resultado.actualizadas}`);
    console.log(`FALLIDAS: ${resultado.fallidas}`);
    console.log(`ITEMS GUARDADOS: ${resultado.itemsGuardados}`);
    console.log(`SOLICITUDES API APROXIMADAS: ${resultado.procesadas + 1}`);

    for (const error of resultado.errores) {
      console.error(`ERROR ${error.codigoExterno}: ${error.mensaje}`);
    }

    if (resultado.fallidas > 0) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message
        : 'Error desconocido durante la ingesta';

    console.error(`INGESTA DIARIA: ERROR - ${mensaje}`);
    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void sincronizarDia();
