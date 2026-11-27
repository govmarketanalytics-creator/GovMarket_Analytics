import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ControlIngestaIncremental1794960000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "mercado_publico_solicitudes" (
      "id" bigserial PRIMARY KEY,
      "ticket_hash" varchar(64) NOT NULL,
      "solicitado_en" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "IDX_mercado_solicitudes_ticket_fecha"
      ON "mercado_publico_solicitudes" ("ticket_hash", "solicitado_en")`);
    await q.query(`CREATE TABLE "licitaciones_ingesta_control" (
      "licitacion_id" uuid PRIMARY KEY REFERENCES "licitaciones"("id") ON DELETE CASCADE,
      "creada_en" timestamptz NOT NULL DEFAULT now(),
      "intentos_fallidos" integer NOT NULL DEFAULT 0 CHECK ("intentos_fallidos" >= 0),
      "proximo_intento_en" timestamptz NOT NULL DEFAULT now(),
      "ultimo_error" varchar(40),
      "notificar_al_completar" boolean NOT NULL DEFAULT false,
      "notificacion_procesada" boolean NOT NULL DEFAULT false
    )`);
    await q.query(`CREATE INDEX "IDX_ingesta_proximo_intento"
      ON "licitaciones_ingesta_control" ("proximo_intento_en", "creada_en")`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "licitaciones_ingesta_control"');
    await q.query('DROP TABLE "mercado_publico_solicitudes"');
  }
}
