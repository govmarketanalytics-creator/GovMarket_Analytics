import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { IngestaLicitacionesService as ServicioIngesta } from '../ingesta-licitaciones.service';
import type { ControlConsultasService as ServicioControl } from '../../integraciones/mercado-publico/control-consultas.service';
import { ColaDetallesService } from '../cola-detalles.service';

// El plan abre una conexion de lectura sin Nest. La ejecucion se autoriza en
// otro paso; nunca cambia .env, activa cron ni abre el servidor HTTP.
async function main() {
  config({ path: resolve(__dirname, '../../../.env'), quiet: true });
  const [modo, loteTexto = '500', maxLotesTexto = '12', ...sobrantes] = process.argv.slice(2);
  if (!['--check', '--plan', '--ejecutar'].includes(modo) || sobrantes.length ||
    (modo !== '--ejecutar' && process.argv.length > 3)) throw new Error('Usa --check, --plan, o --ejecutar [lote 1-1000] [maximo de lotes 1-48].');
  const lote = Number(loteTexto), maxLotes = Number(maxLotesTexto);
  if (!Number.isInteger(lote) || lote < 1 || lote > 1000 || !Number.isInteger(maxLotes) || maxLotes < 1 || maxLotes > 48) throw new Error('Limites de lote invalidos.');
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? '') ||
      process.env.DB_NAME !== 'govmarket_analytics' || process.env.DB_USERNAME !== 'gma_app' || Number(process.env.DB_PORT) !== 5432) {
    throw new Error('Destino distinto del laboratorio local principal esperado. No se ejecuta ninguna carga.');
  }
  console.log('DESTINO: PostgreSQL local / govmarket_analytics / gma_app');
  if (modo === '--check') {
    const { environmentSchema } = require('../../config/environment.schema');
    const env = environmentSchema.parse(process.env);
    console.log(`CONSULTAS EXTERNAS HABILITADAS: ${env.MERCADO_PUBLICO_CONSULTAS_HABILITADAS}`);
    console.log(`AUTOMATIZACION HABILITADA: ${env.AUTOMATIZACION_HABILITADA}`);
    console.log(`PRESUPUESTO CONFIGURADO / 24H: ${env.MERCADO_PUBLICO_MAX_SOLICITUDES_24H}`);
    console.log(`DETALLES POR CICLO: ${env.AUTOMATIZACION_LIMITE_POR_CICLO}`);
    console.log('COMPROBACION SIN CONEXION. No se abrio PostgreSQL, Nest, cron ni Mercado Publico.');
    return;
  }
  if (modo === '--plan') {
    const ds = new DataSource({ type: 'postgres', host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true', entities: [], synchronize: false,
      migrationsRun: false, installExtensions: false, logging: false,
      extra: { options: '-c default_transaction_read_only=on -c statement_timeout=15000' } });
    try {
      await ds.initialize();
      const cobertura = await ds.query(`SELECT COUNT(*)::int AS vigentes,
        COUNT(detalle_sincronizado_en)::int AS con_detalle,
        COUNT(*) FILTER (WHERE detalle_sincronizado_en IS NULL)::int AS pendientes
        FROM licitaciones WHERE activa_en_listado = true AND codigo_estado = 5
        AND fecha_cierre >= now() AND COALESCE(datos_origen ->> 'esPrueba', 'false') <> 'true'`);
      const hash = createHash('sha256').update(process.env.MERCADO_PUBLICO_TICKET ?? '').digest('hex');
      const uso = await ds.query(`SELECT COUNT(*)::int AS solicitudes_registradas_24h
        FROM mercado_publico_solicitudes WHERE ticket_hash = $1
        AND solicitado_en > now() - INTERVAL '24 hours'`, [hash]);
      console.table(cobertura); console.table(uso);
      const planificador = { query: async (sql: string, params?: unknown[]) => {
        await ds.query('EXPLAIN (FORMAT JSON) ' + sql, params); return [];
      } } as unknown as DataSource;
      const cola = new ColaDetallesService(planificador);
      await cola.registrarPendientes([]); await cola.seleccionar(1);
      await cola.registrarFallo('0-0-LE26'); await cola.obtenerNuevasParaNotificar();
      await cola.confirmarNotificaciones(['0-0-LE26']);
      console.log('Consultas de cola analizadas con EXPLAIN, sin ANALYZE ni ejecucion de escrituras.');
      console.log('PLAN DE SOLO LECTURA. Solicitudes a Mercado Publico: 0. No se iniciaron Nest, cron, Google ni Transbank.');
      console.log('El contador no incluye consumos anteriores a su instalacion ni otros entornos con otra base.');
      console.log('Antes de ejecutar: revisar presupuesto disponible y mantener deshabilitada la ingesta en los demas entornos.');
    } finally { if (ds.isInitialized) await ds.destroy(); }
    return;
  }
  if (process.env.MERCADO_PUBLICO_CONSULTAS_HABILITADAS !== 'true') throw new Error('La extraccion requiere habilitacion explicita en esta consola. No se enviaron solicitudes.');
  process.env.AUTOMATIZACION_HABILITADA = 'false';
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = require('../../app.module');
  const { IngestaLicitacionesService } = require('../ingesta-licitaciones.service');
  const { ControlConsultasService } = require('../../integraciones/mercado-publico/control-consultas.service');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const ingesta = app.get<ServicioIngesta>(IngestaLicitacionesService), control = app.get<ServicioControl>(ControlConsultasService);
    for (let n = 1; n <= maxLotes; n++) {
      const presupuesto = await control.consultarPresupuesto();
      if (!presupuesto.disponibles) { console.log('PAUSA: presupuesto agotado; el progreso queda en PostgreSQL.'); break; }
      console.log(`LOTE ${n}/${maxLotes}: hasta ${lote} pendientes. No se vuelven a descargar detalles completos.`);
      const r = await ingesta.sincronizarActivas(lote, (hechas, total) => console.log(`PROGRESO DEL LOTE: ${hechas}/${total}`));
      console.table([{ vigentes: r.cobertura.total, con_detalle: r.cobertura.conDetalle,
        pendientes: r.cobertura.pendientes, completadas_lote: r.detallesCompletados,
        fallidas_lote: r.detallesFallidos, pausa: r.pausa }]);
      if (!r.cobertura.pendientes) { console.log('CATALOGO VIGENTE RECORRIDO: no quedan fichas sin descargar en el corte actual.'); break; }
      if (r.pausa || r.detallesProcesados === 0) { console.log('PAUSA: faltantes en espera; se retomaran sin perder lo completado.'); break; }
    }
    console.log('No se envio correo, no se realizaron pagos ni se activaron tareas programadas. Sin commit ni Azure.');
  } finally { await app.close(); }
}
void main().catch(() => {
  console.error('No se pudo completar el comando. Revisa destino, migracion y habilitacion; no se muestran trazas ni credenciales.');
  process.exitCode = 1;
});
