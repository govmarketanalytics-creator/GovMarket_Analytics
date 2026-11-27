import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowGoogleOnlyUsuarios1790100000000 implements MigrationInterface {
  name = 'AllowGoogleOnlyUsuarios1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" ALTER COLUMN "password_hash" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_metodo_autenticacion" CHECK ("password_hash" IS NOT NULL OR "google_sub" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL rechaza SET NOT NULL si ya hay cuentas creadas solo con Google.
    // Se ejecuta primero para conservar la restricción CHECK si falla la reversión.
    await queryRunner.query(
      `ALTER TABLE "usuarios" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "CHK_usuarios_metodo_autenticacion"`,
    );
  }
}
