import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSuscripcionesEmpresaTable1790103600000 implements MigrationInterface {
  name = 'CreateSuscripcionesEmpresaTable1790103600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "suscripciones_empresa" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "empresa_id" uuid NOT NULL,
        "plan" character varying(20) NOT NULL,
        "estado" character varying(20) NOT NULL,
        "vigente_desde" TIMESTAMP WITH TIME ZONE NOT NULL,
        "vigente_hasta" TIMESTAMP WITH TIME ZONE NOT NULL,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_897cb074e495fa0f67c83e26f4b" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_suscripciones_empresa_plan" CHECK ("plan" IN ('individual', 'empresa')),
        CONSTRAINT "CHK_suscripciones_empresa_estado" CHECK ("estado" IN ('activa', 'cancelada')),
        CONSTRAINT "CHK_suscripciones_empresa_vigencia" CHECK ("vigente_hasta" > "vigente_desde")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_suscripciones_empresa_empresa_id" ON "suscripciones_empresa" ("empresa_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "suscripciones_empresa" ADD CONSTRAINT "FK_suscripciones_empresa_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suscripciones_empresa" DROP CONSTRAINT "FK_suscripciones_empresa_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_suscripciones_empresa_empresa_id"`,
    );
    await queryRunner.query(`DROP TABLE "suscripciones_empresa"`);
  }
}
