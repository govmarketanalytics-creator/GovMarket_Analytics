import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMembresiasEmpresaTable1788389985118 implements MigrationInterface {
  name = 'CreateMembresiasEmpresaTable1788389985118';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rol_membresia_empresa_enum" AS ENUM('administrador', 'analista_comercial')`,
    );
    await queryRunner.query(
      `CREATE TABLE "membresias_empresa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "rol" "public"."rol_membresia_empresa_enum" NOT NULL, "activa" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2ecf10c117780cb9c30b7b68656" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_membresias_empresa_usuario_id" ON "membresias_empresa"  ("usuario_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_membresias_empresa_empresa_usuario" ON "membresias_empresa"  ("empresa_id", "usuario_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "membresias_empresa" ADD CONSTRAINT "FK_membresias_empresa_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "membresias_empresa" ADD CONSTRAINT "FK_membresias_empresa_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membresias_empresa" DROP CONSTRAINT "FK_membresias_empresa_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "membresias_empresa" DROP CONSTRAINT "FK_membresias_empresa_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_membresias_empresa_empresa_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_membresias_empresa_usuario_id"`,
    );
    await queryRunner.query(`DROP TABLE "membresias_empresa"`);
    await queryRunner.query(`DROP TYPE "public"."rol_membresia_empresa_enum"`);
  }
}
