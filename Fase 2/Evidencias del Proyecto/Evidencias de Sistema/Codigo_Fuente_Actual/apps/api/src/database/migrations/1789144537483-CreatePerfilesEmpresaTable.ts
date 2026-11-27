import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePerfilesEmpresaTable1789144537483 implements MigrationInterface {
  name = 'CreatePerfilesEmpresaTable1789144537483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "perfiles_empresa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "palabras_clave" text array NOT NULL DEFAULT '{}', "codigos_categoria" text array NOT NULL DEFAULT '{}', "regiones" text array NOT NULL DEFAULT '{}', "monto_minimo" numeric(18,2), "monto_maximo" numeric(18,2), "incluir_sin_monto" boolean NOT NULL DEFAULT true, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_perfiles_empresa_rango_montos" CHECK ("monto_minimo" IS NULL OR "monto_maximo" IS NULL OR "monto_minimo" <= "monto_maximo"), CONSTRAINT "CHK_perfiles_empresa_monto_maximo" CHECK ("monto_maximo" IS NULL OR "monto_maximo" >= 0), CONSTRAINT "CHK_perfiles_empresa_monto_minimo" CHECK ("monto_minimo" IS NULL OR "monto_minimo" >= 0), CONSTRAINT "PK_8abc03e48ab06548f7731bb3e44" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_perfiles_empresa_empresa_id" ON "perfiles_empresa"  ("empresa_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "FK_perfiles_empresa_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP CONSTRAINT "FK_perfiles_empresa_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_perfiles_empresa_empresa_id"`,
    );
    await queryRunner.query(`DROP TABLE "perfiles_empresa"`);
  }
}
