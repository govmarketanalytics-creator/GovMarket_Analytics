import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLicitacionesTables1789067048070 implements MigrationInterface {
  name = 'CreateLicitacionesTables1789067048070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "licitaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codigo_externo" character varying(50) NOT NULL, "nombre" character varying(500) NOT NULL, "descripcion" text, "codigo_estado" integer NOT NULL, "estado" character varying(100) NOT NULL, "codigo_tipo" character varying(20), "tipo" character varying(250), "moneda" character varying(10), "monto_estimado" numeric(18,2), "fecha_publicacion" TIMESTAMP WITH TIME ZONE, "fecha_cierre" TIMESTAMP WITH TIME ZONE, "fecha_adjudicacion" TIMESTAMP WITH TIME ZONE, "codigo_organismo" character varying(50), "nombre_organismo" character varying(300), "codigo_unidad" character varying(50), "nombre_unidad" character varying(300), "comuna_unidad" character varying(120), "region_unidad" character varying(120), "cantidad_reclamos" integer, "datos_origen" jsonb NOT NULL, "sincronizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_378bbe0c37e96cf8297fb0efa68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_codigo_organismo" ON "licitaciones"  ("codigo_organismo") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_fecha_cierre" ON "licitaciones"  ("fecha_cierre") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_fecha_publicacion" ON "licitaciones"  ("fecha_publicacion") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_codigo_estado" ON "licitaciones"  ("codigo_estado") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitaciones_codigo_externo" ON "licitaciones"  ("codigo_externo") `,
    );
    await queryRunner.query(
      `CREATE TABLE "licitacion_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "licitacion_id" uuid NOT NULL, "correlativo" integer NOT NULL, "codigo_producto" character varying(100), "codigo_categoria" character varying(100), "categoria" character varying(500), "nombre_producto" character varying(500), "descripcion" text, "unidad_medida" character varying(100), "cantidad" numeric(18,4), CONSTRAINT "PK_917452084169282e08d2a8e62c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_items_codigo_categoria" ON "licitacion_items"  ("codigo_categoria") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_items_codigo_producto" ON "licitacion_items"  ("codigo_producto") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitacion_items_licitacion_correlativo" ON "licitacion_items"  ("licitacion_id", "correlativo") `,
    );
    await queryRunner.query(
      `ALTER TABLE "licitacion_items" ADD CONSTRAINT "FK_licitacion_items_licitacion" FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "licitacion_items" DROP CONSTRAINT "FK_licitacion_items_licitacion"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_licitacion_items_licitacion_correlativo"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitacion_items_codigo_producto"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitacion_items_codigo_categoria"`,
    );
    await queryRunner.query(`DROP TABLE "licitacion_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_licitaciones_codigo_externo"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_codigo_estado"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_fecha_publicacion"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_fecha_cierre"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_codigo_organismo"`,
    );
    await queryRunner.query(`DROP TABLE "licitaciones"`);
  }
}
