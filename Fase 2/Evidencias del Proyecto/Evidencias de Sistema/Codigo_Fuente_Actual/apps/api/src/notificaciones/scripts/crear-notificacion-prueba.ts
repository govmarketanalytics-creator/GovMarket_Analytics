import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { NotificacionesService } from '../notificaciones.service';

async function crearNotificacionPrueba(): Promise<void> {
  const email = process.argv[2]?.trim();
  const porcentajeTexto = process.argv[3]?.trim();
  const empresaId = process.argv[4]?.trim() || undefined;

  if (!email) {
    throw new Error(
      'Uso: npm run notificaciones:crear-prueba --workspace=apps/api -- correo@ejemplo.cl [porcentaje] [empresaId]',
    );
  }

  const porcentaje = porcentajeTexto ? Number(porcentajeTexto) : 87;
  const aplicacion = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const servicio = aplicacion.get(NotificacionesService);
    const resultado = await servicio.crearPrueba(email, porcentaje, empresaId);

    console.log('NOTIFICACION DE PRUEBA: OK');
    console.log(`USUARIO: ${resultado.email}`);
    console.log(`EMPRESA: ${resultado.empresa}`);
    console.log(`CODIGO FANTASMA: ${resultado.codigoExterno}`);
    console.log(`COMPATIBILIDAD: ${resultado.porcentajeCompatibilidad}%`);
    console.log(
      'Este registro está marcado como prueba y no aparece en el buscador de oportunidades.',
    );
  } finally {
    await aplicacion.close();
  }
}

void crearNotificacionPrueba().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : 'Error desconocido';
  console.error(`ERROR: ${mensaje}`);
  process.exitCode = 1;
});
