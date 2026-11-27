import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleSubUsuarios1790013600000 implements MigrationInterface {
  name = 'AddGoogleSubUsuarios1790013600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "google_sub" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_usuarios_google_sub" ON "usuarios" ("google_sub")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_usuarios_google_sub"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "google_sub"`);
  }
}
