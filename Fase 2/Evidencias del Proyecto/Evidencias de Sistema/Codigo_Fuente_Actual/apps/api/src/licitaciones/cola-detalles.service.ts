import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const vigente = `l.activa_en_listado = true AND l.codigo_estado = 5
  AND l.fecha_cierre >= now() AND COALESCE(l.datos_origen ->> 'esPrueba', 'false') <> 'true'`;

export const REGISTRAR_PENDIENTES_SQL = `INSERT INTO licitaciones_ingesta_control (licitacion_id, notificar_al_completar)
  SELECT l.id, l.codigo_externo = ANY($1::text[]) FROM licitaciones l
  WHERE ${vigente} AND l.detalle_sincronizado_en IS NULL
  ON CONFLICT (licitacion_id) DO NOTHING`;

@Injectable()
export class ColaDetallesService {
  constructor(private readonly ds: DataSource) {}

  async registrarPendientes(codigosNuevos: string[]): Promise<void> {
    await this.ds.query(REGISTRAR_PENDIENTES_SQL, [codigosNuevos]);
  }

  async seleccionar(limite: number): Promise<string[]> {
    if (limite === 0) return [];
    // Alterna publicaciones nuevas y el fondo pendiente. No concentra toda la
    // capacidad en cierres inminentes ni abandona indefinidamente el fondo.
    const r = await this.ds.query<Array<{ codigo: string }>>(`WITH pendientes AS (
      SELECT l.codigo_externo AS codigo, c.creada_en, c.licitacion_id,
        row_number() OVER (PARTITION BY c.notificar_al_completar
          ORDER BY c.creada_en, c.licitacion_id) AS turno
      FROM licitaciones_ingesta_control c JOIN licitaciones l ON l.id = c.licitacion_id
      WHERE ${vigente} AND l.detalle_sincronizado_en IS NULL AND c.proximo_intento_en <= now()
    ) SELECT codigo FROM pendientes ORDER BY turno, creada_en, licitacion_id LIMIT $1`, [limite]);
    return r.map((f) => f.codigo);
  }

  async registrarFallo(codigo: string): Promise<void> {
    await this.ds.query(`UPDATE licitaciones_ingesta_control c
      SET intentos_fallidos = intentos_fallidos + 1, ultimo_error = 'DETALLE_NO_COMPLETADO',
        proximo_intento_en = now() + make_interval(mins => LEAST(360, 30 * (intentos_fallidos + 1)))
      FROM licitaciones l WHERE l.id = c.licitacion_id AND l.codigo_externo = $1`, [codigo]);
  }

  async obtenerCobertura() {
    const [r] = await this.ds.query<Array<{ total: number; conDetalle: number; pendientes: number }>>(
      `SELECT COUNT(*)::int AS total, COUNT(l.detalle_sincronizado_en)::int AS "conDetalle",
        COUNT(*) FILTER (WHERE l.detalle_sincronizado_en IS NULL)::int AS pendientes
      FROM licitaciones l WHERE ${vigente}`);
    return r;
  }

  async obtenerNuevasParaNotificar(): Promise<string[]> {
    const filas = await this.ds.query<Array<{ codigo: string }>>(`SELECT l.codigo_externo AS codigo
      FROM licitaciones_ingesta_control c JOIN licitaciones l ON l.id = c.licitacion_id
      WHERE c.notificar_al_completar = true AND c.notificacion_procesada = false
      AND l.detalle_sincronizado_en IS NOT NULL AND ${vigente}
      ORDER BY c.creada_en, c.licitacion_id LIMIT 1000`);
    return filas.map((f) => f.codigo);
  }

  async confirmarNotificaciones(codigos: string[]): Promise<void> {
    if (!codigos.length) return;
    await this.ds.query(`UPDATE licitaciones_ingesta_control c SET notificacion_procesada = true
      FROM licitaciones l WHERE l.id = c.licitacion_id AND l.codigo_externo = ANY($1::text[])`, [codigos]);
  }
}
