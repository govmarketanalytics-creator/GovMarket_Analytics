import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsuariosTable1788389042276 implements MigrationInterface {
  name = 'CreateUsuariosTable1788389042276';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."estado_usuario_enum" AS ENUM('activo', 'bloqueado', 'inactivo')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "password_hash" character varying(255) NOT NULL, "nombres" character varying(120) NOT NULL, "apellido_paterno" character varying(80) NOT NULL, "apellido_materno" character varying(80), "correo_verificado" boolean NOT NULL DEFAULT false, "es_superadministrador" boolean NOT NULL DEFAULT false, "estado" "public"."estado_usuario_enum" NOT NULL DEFAULT 'activo', "ultimo_acceso_en" TIMESTAMP WITH TIME ZONE, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_usuarios_email" ON "usuarios"  ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_usuarios_email"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."estado_usuario_enum"`);
  }
}
