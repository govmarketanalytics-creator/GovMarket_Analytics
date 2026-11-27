import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestaLicitacionesService } from '../ingesta-licitaciones.service';

function interpretarPeriodo(texto?: string): { anio: number; mes: number } {
  if (!texto || !/^\d{4}-\d{2}$/.test(texto)) {
    throw new Error('El período debe utilizar el formato AAAA-MM');
  }
  const [anio, mes] = texto.split('-').map(Number);
  return { anio, mes };
}

async function sincronizarMes(): Promise<void> {
  let aplicacion: INestApplicationContext | undefined;

  try {
    const { anio, mes } = interpretarPeriodo(process.argv[2]);
    const limite = process.argv[3] ? Number(process.argv[3]) : undefined;
    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    const servicio = aplicacion.get(IngestaLicitacionesService);
    const resultado = await servicio.sincronizarMes(anio, mes, limite);

    console.log('INGESTA MENSUAL: OK');
    console.log(`PERIODO: ${resultado.periodo}`);
    console.log(`RANGO: ${resultado.fechaInicio} A ${resultado.fechaFin}`);
    console.log(`DIAS CONSULTADOS: ${resultado.diasConsultados}`);
    console.log(
      `DIAS OMITIDOS POR CHECKPOINT: ${resultado.diasOmitidosPorCheckpoint}`,
    );
    console.log(`INFORMADAS POR API: ${resultado.informadasPorApi}`);
    console.log(`CODIGOS INDEXADOS: ${resultado.codigosIndexados}`);
    console.log(`CREADAS EN CATALOGO: ${resultado.creadasEnCatalogo}`);
    console.log(
      `ACTUALIZADAS EN CATALOGO: ${resultado.actualizadasEnCatalogo}`,
    );
    console.log(`RESULTADOS PROCESADOS: ${resultado.resultadosProcesados}`);
    console.log(`RESULTADOS DESDE BASE: ${resultado.resultadosDesdeBase}`);
    console.log(
      `DETALLES CONSULTADOS A API: ${resultado.detallesConsultadosApi}`,
    );
    console.log(`RESULTADOS COMPLETADOS: ${resultado.resultadosCompletados}`);
    console.log(`RESULTADOS FALLIDOS: ${resultado.resultadosFallidos}`);
    console.log(
      `PENDIENTES SIN RESULTADO: ${resultado.pendientesSinResultado}`,
    );
    console.log(`ITEMS GUARDADOS: ${resultado.itemsGuardados}`);
    console.log(
      `SOLICITUDES API APROXIMADAS: ${resultado.solicitudesApiAproximadas}`,
    );

    for (const error of resultado.errores) {
      console.error(`ERROR ${error.codigoExterno}: ${error.mensaje}`);
    }
    if (resultado.resultadosFallidos > 0) process.exitCode = 1;
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error(`INGESTA MENSUAL: ERROR - ${mensaje}`);
    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void sincronizarMes();
