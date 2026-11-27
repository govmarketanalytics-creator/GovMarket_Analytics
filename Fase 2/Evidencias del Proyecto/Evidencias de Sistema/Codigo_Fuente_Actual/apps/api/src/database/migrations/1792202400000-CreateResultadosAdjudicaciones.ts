import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateResultadosAdjudicaciones1792202400000 implements MigrationInterface {
  name = 'CreateResultadosAdjudicaciones1792202400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "licitacion_resultados" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "licitacion_id" uuid NOT NULL,
        "clasificacion" character varying(30) NOT NULL,
        "motivo" text,
        "fuente_motivo" character varying(100),
        "numero_oferentes" integer,
        "monto_total_adjudicado" numeric(18,2) NOT NULL DEFAULT 0,
        "cantidad_adjudicaciones" integer NOT NULL DEFAULT 0,
        "datos_origen" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "resultado_sincronizado_en" TIMESTAMP WITH TIME ZONE NOT NULL,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_licitacion_resultados_clasificacion" CHECK (
          "clasificacion" IN (
            'pendiente', 'adjudicada', 'desierta', 'revocada',
            'cerrada_sin_resultado', 'otro'
          )
        ),
        CONSTRAINT "CHK_licitacion_resultados_oferentes" CHECK (
          "numero_oferentes" IS NULL OR "numero_oferentes" >= 0
        ),
        CONSTRAINT "PK_licitacion_resultados" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitacion_resultados_licitacion"
       ON "licitacion_resultados" ("licitacion_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_resultados_clasificacion"
       ON "licitacion_resultados" ("clasificacion")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_resultados_sincronizado"
       ON "licitacion_resultados" ("resultado_sincronizado_en")`,
    );

    await queryRunner.query(
      `CREATE TABLE "licitacion_adjudicaciones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resultado_id" uuid NOT NULL,
        "item_correlativo" integer,
        "tipo" character varying(100),
        "fecha" TIMESTAMP WITH TIME ZONE,
        "numero" character varying(100),
        "numero_oferentes" integer,
        "url_acta" text,
        "nombre_proveedor" character varying(300),
        "rut_proveedor" character varying(30),
        "cantidad" numeric(18,4),
        "monto_unitario" numeric(18,2),
        "monto_total" numeric(18,2),
        "datos_origen" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_licitacion_adjudicaciones" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_adjudicaciones_resultado"
       ON "licitacion_adjudicaciones" ("resultado_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_adjudicaciones_rut_proveedor"
       ON "licitacion_adjudicaciones" ("rut_proveedor")`,
    );

    await queryRunner.query(
      `CREATE TABLE "sincronizaciones_listado_dia" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fecha" date NOT NULL,
        "cantidad_informada" integer NOT NULL,
        "codigos_indexados" integer NOT NULL,
        "sincronizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sincronizaciones_listado_dia" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sincronizaciones_listado_dia_fecha"
       ON "sincronizaciones_listado_dia" ("fecha")`,
    );

    await queryRunner.query(
      `ALTER TABLE "licitacion_resultados"
       ADD CONSTRAINT "FK_licitacion_resultados_licitacion"
       FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitacion_adjudicaciones"
       ADD CONSTRAINT "FK_licitacion_adjudicaciones_resultado"
       FOREIGN KEY ("resultado_id") REFERENCES "licitacion_resultados"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sincronizaciones_listado_dia"`);
    await queryRunner.query(`DROP TABLE "licitacion_adjudicaciones"`);
    await queryRunner.query(`DROP TABLE "licitacion_resultados"`);
  }
}
