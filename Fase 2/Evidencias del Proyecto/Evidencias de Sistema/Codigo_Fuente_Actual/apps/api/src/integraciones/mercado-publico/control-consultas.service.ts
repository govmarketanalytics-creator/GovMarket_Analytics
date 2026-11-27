import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

export class ConsultasMercadoPausadas extends ServiceUnavailableException {
  constructor(public readonly motivo: 'deshabilitado' | 'presupuesto' | 'ocupado' | 'limitacion_remota') {
    super(`Extracción pausada: ${motivo}. No se enviaron nuevas solicitudes.`);
  }
}

@Injectable()
export class ControlConsultasService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  private get hashTicket() {
    return createHash('sha256').update(this.config.getOrThrow<string>('MERCADO_PUBLICO_TICKET')).digest('hex');
  }

  comprobarHabilitada(): void {
    if (!this.config.getOrThrow<boolean>('MERCADO_PUBLICO_CONSULTAS_HABILITADAS')) {
      throw new ConsultasMercadoPausadas('deshabilitado');
    }
  }

  async consultarPresupuesto() {
    const limite = this.config.getOrThrow<number>('MERCADO_PUBLICO_MAX_SOLICITUDES_24H');
    const [fila] = await this.ds.query<Array<{ usadas: number }>>(`SELECT COUNT(*)::int AS usadas
      FROM mercado_publico_solicitudes WHERE ticket_hash = $1
      AND solicitado_en > now() - INTERVAL '24 hours'`, [this.hashTicket]);
    return { limite, utilizadas: fila.usadas, disponibles: Math.max(0, limite - fila.usadas) };
  }

  // Reserva ANTES de cada intento HTTP. Un fallo o un cierre abrupto no devuelve
  // la reserva: la fuente puede haber recibido y contabilizado esa solicitud.
  async reservarSolicitud(): Promise<void> {
    this.comprobarHabilitada();
    const hash = this.hashTicket;
    const limite = this.config.getOrThrow<number>('MERCADO_PUBLICO_MAX_SOLICITUDES_24H');
    await this.ds.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(hashtextextended('gma-cuota:' || $1, 0))", [hash]);
      const [f] = await m.query<Array<{ usadas: number }>>(`SELECT COUNT(*)::int AS usadas
        FROM mercado_publico_solicitudes WHERE ticket_hash = $1
        AND solicitado_en > now() - INTERVAL '24 hours'`, [hash]);
      if (f.usadas >= limite) throw new ConsultasMercadoPausadas('presupuesto');
      await m.query('INSERT INTO mercado_publico_solicitudes (ticket_hash) VALUES ($1)', [hash]);
    });
  }

  async conBloqueo<T>(trabajo: () => Promise<T>): Promise<T> {
    this.comprobarHabilitada();
    const q = this.ds.createQueryRunner();
    let bloqueado = false;
    try {
      await q.connect();
      const [f] = await q.query(
        "SELECT pg_try_advisory_lock(hashtextextended('gma-ingesta-licitaciones', 0)) AS obtenido") as Array<{ obtenido: boolean }>;
      bloqueado = f.obtenido;
      if (!bloqueado) throw new ConsultasMercadoPausadas('ocupado');
      return await trabajo();
    } finally {
      try {
        if (bloqueado) await q.query("SELECT pg_advisory_unlock(hashtextextended('gma-ingesta-licitaciones', 0))");
      } finally { await q.release(); }
    }
  }
}
