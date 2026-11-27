import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveSyncMetadataToLicitaciones1791936000000 implements MigrationInterface {
  name = 'AddActiveSyncMetadataToLicitaciones1791936000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "licitaciones" ADD "activa_en_listado" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones" ADD "visto_activo_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones" ADD "detalle_sincronizado_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "licitaciones" SET "detalle_sincronizado_en" = "sincronizado_en"`,
    );
    await queryRunner.query(
      `UPDATE "licitaciones" SET "activa_en_listado" = true, "visto_activo_en" = now() WHERE "codigo_estado" = 5 AND "fecha_cierre" >= now()`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_detalle_sincronizado" ON "licitaciones" ("detalle_sincronizado_en")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_activa_estado_cierre" ON "licitaciones" ("activa_en_listado", "codigo_estado", "fecha_cierre")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_activa_estado_cierre"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_detalle_sincronizado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones" DROP COLUMN "detalle_sincronizado_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones" DROP COLUMN "visto_activo_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones" DROP COLUMN "activa_en_listado"`,
    );
  }
}
