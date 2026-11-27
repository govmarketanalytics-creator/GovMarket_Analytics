import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificacionesOportunidad1792195200000 implements MigrationInterface {
  name = 'CreateNotificacionesOportunidad1792195200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notificaciones_oportunidad" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "empresa_id" uuid NOT NULL,
        "licitacion_id" uuid NOT NULL,
        "tipo" character varying(40) NOT NULL,
        "porcentaje_compatibilidad" numeric(5,2) NOT NULL,
        "es_prueba" boolean NOT NULL DEFAULT false,
        "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_notificaciones_oportunidad_porcentaje"
          CHECK ("porcentaje_compatibilidad" >= 0 AND "porcentaje_compatibilidad" <= 100),
        CONSTRAINT "PK_notificaciones_oportunidad" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notificaciones_oportunidad_empresa_licitacion_tipo"
       ON "notificaciones_oportunidad" ("empresa_id", "licitacion_id", "tipo")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notificaciones_oportunidad_empresa_creada"
       ON "notificaciones_oportunidad" ("empresa_id", "creada_en")`,
    );
    await queryRunner.query(
      `CREATE TABLE "notificaciones_usuario" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "notificacion_id" uuid NOT NULL,
        "usuario_id" uuid NOT NULL,
        "leida" boolean NOT NULL DEFAULT false,
        "leida_en" TIMESTAMP WITH TIME ZONE,
        "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notificaciones_usuario" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notificaciones_usuario_notificacion_usuario"
       ON "notificaciones_usuario" ("notificacion_id", "usuario_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notificaciones_usuario_usuario_leida"
       ON "notificaciones_usuario" ("usuario_id", "leida")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones_oportunidad"
       ADD CONSTRAINT "FK_notificaciones_oportunidad_empresa"
       FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones_oportunidad"
       ADD CONSTRAINT "FK_notificaciones_oportunidad_licitacion"
       FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones_usuario"
       ADD CONSTRAINT "FK_notificaciones_usuario_notificacion"
       FOREIGN KEY ("notificacion_id") REFERENCES "notificaciones_oportunidad"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones_usuario"
       ADD CONSTRAINT "FK_notificaciones_usuario_usuario"
       FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notificaciones_usuario"`);
    await queryRunner.query(`DROP TABLE "notificaciones_oportunidad"`);
  }
}
