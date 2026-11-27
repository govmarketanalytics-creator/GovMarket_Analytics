import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmpresasTable1788386438732 implements MigrationInterface {
  name = 'CreateEmpresasTable1788386438732';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."estado_empresa_enum" AS ENUM('activa', 'suspendida', 'inactiva')`,
    );
    await queryRunner.query(
      `CREATE TABLE "empresas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rut" character varying(12) NOT NULL, "razon_social" character varying(200) NOT NULL, "nombre_fantasia" character varying(200), "estado" "public"."estado_empresa_enum" NOT NULL DEFAULT 'activa', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ce7b122b37c6499bfd6520873e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresas_rut" ON "empresas"  ("rut") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_empresas_rut"`);
    await queryRunner.query(`DROP TABLE "empresas"`);
    await queryRunner.query(`DROP TYPE "public"."estado_empresa_enum"`);
  }
}
