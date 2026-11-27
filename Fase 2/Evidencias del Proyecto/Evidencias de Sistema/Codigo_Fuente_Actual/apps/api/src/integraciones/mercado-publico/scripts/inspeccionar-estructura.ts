import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { MercadoPublicoService } from '../mercado-publico.service';

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function mostrarClaves(nombre: string, valor: unknown): void {
  if (!esObjeto(valor)) {
    return;
  }

  console.log(`${nombre}: ${Object.keys(valor).sort().join(', ')}`);
}

function inspeccionarObjetosAnidados(
  licitacion: Record<string, unknown>,
): void {
  for (const [campo, valor] of Object.entries(licitacion)) {
    if (Array.isArray(valor)) {
      if (valor.length > 0 && esObjeto(valor[0])) {
        mostrarClaves(`ELEMENTO ${campo}`, valor[0]);
      }

      continue;
    }

    if (!esObjeto(valor)) {
      continue;
    }

    mostrarClaves(`SUBCAMPOS ${campo}`, valor);

    const listado = valor.Listado;

    if (Array.isArray(listado) && listado.length > 0 && esObjeto(listado[0])) {
      mostrarClaves(`ELEMENTO ${campo}.Listado`, listado[0]);
    }
  }
}

async function inspeccionarEstructura(): Promise<void> {
  let aplicacion: INestApplicationContext | undefined;

  try {
    aplicacion = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });

    const mercadoPublicoService = aplicacion.get(MercadoPublicoService);
    const listado = await mercadoPublicoService.listarLicitacionesDelDia();

    const primeraLicitacion = listado.Listado[0];

    if (!primeraLicitacion?.CodigoExterno) {
      throw new Error('No se encontraron licitaciones para inspeccionar');
    }

    const detalleRespuesta =
      await mercadoPublicoService.obtenerLicitacionPorCodigo(
        primeraLicitacion.CodigoExterno,
      );

    const detalle = detalleRespuesta.Listado[0];

    if (!detalle) {
      throw new Error('La API no entregó el detalle solicitado');
    }

    console.log(`CODIGO INSPECCIONADO: ${detalle.CodigoExterno}`);
    mostrarClaves('CAMPOS LICITACION', detalle);
    inspeccionarObjetosAnidados(detalle);
  } catch {
    console.error(
      'No fue posible inspeccionar la estructura de Mercado Público.',
    );

    process.exitCode = 1;
  } finally {
    await aplicacion?.close();
  }
}

void inspeccionarEstructura();
