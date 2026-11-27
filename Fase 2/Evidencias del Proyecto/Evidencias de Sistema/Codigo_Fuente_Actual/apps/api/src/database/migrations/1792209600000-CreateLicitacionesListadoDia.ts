import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLicitacionesListadoDia1792209600000 implements MigrationInterface {
  name = 'CreateLicitacionesListadoDia1792209600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "licitaciones_listado_dia" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fecha" date NOT NULL,
        "licitacion_id" uuid NOT NULL,
        "codigo_estado" integer,
        "estado" character varying(100),
        "fecha_cierre" TIMESTAMP WITH TIME ZONE,
        "sincronizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_licitaciones_listado_dia" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitaciones_listado_dia_fecha_licitacion"
       ON "licitaciones_listado_dia" ("fecha", "licitacion_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_listado_dia_fecha"
       ON "licitaciones_listado_dia" ("fecha")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_listado_dia_licitacion"
       ON "licitaciones_listado_dia" ("licitacion_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_listado_dia"
       ADD CONSTRAINT "FK_licitaciones_listado_dia_licitacion"
       FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "licitaciones_listado_dia"`);
  }
}
