import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertasOportunidadesTable1789150392362 implements MigrationInterface {
  name = 'CreateAlertasOportunidadesTable1789150392362';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "alertas_oportunidades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "licitacion_id" uuid NOT NULL, "porcentaje_compatibilidad" numeric(5,2) NOT NULL, "coincidencias" jsonb NOT NULL, "leida" boolean NOT NULL DEFAULT false, "leida_en" TIMESTAMP WITH TIME ZONE, "generada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_alertas_oportunidades_porcentaje" CHECK ("porcentaje_compatibilidad" >= 0 AND "porcentaje_compatibilidad" <= 100), CONSTRAINT "PK_b68ef1d279aad6900c7ea31bcf4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alertas_oportunidades_licitacion_id" ON "alertas_oportunidades"  ("licitacion_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alertas_oportunidades_empresa_leida" ON "alertas_oportunidades"  ("empresa_id", "leida") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_alertas_oportunidades_empresa_licitacion" ON "alertas_oportunidades"  ("empresa_id", "licitacion_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD "puntaje_minimo_alerta" numeric(5,2) NOT NULL DEFAULT '60'`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "CHK_perfiles_empresa_puntaje_alerta" CHECK ("puntaje_minimo_alerta" >= 0 AND "puntaje_minimo_alerta" <= 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_oportunidades" ADD CONSTRAINT "FK_alertas_oportunidades_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_oportunidades" ADD CONSTRAINT "FK_alertas_oportunidades_licitacion" FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alertas_oportunidades" DROP CONSTRAINT "FK_alertas_oportunidades_licitacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_oportunidades" DROP CONSTRAINT "FK_alertas_oportunidades_empresa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP CONSTRAINT "CHK_perfiles_empresa_puntaje_alerta"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP COLUMN "puntaje_minimo_alerta"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_alertas_oportunidades_empresa_licitacion"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_alertas_oportunidades_empresa_leida"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_alertas_oportunidades_licitacion_id"`,
    );
    await queryRunner.query(`DROP TABLE "alertas_oportunidades"`);
  }
}
