import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowDuplicateItemCorrelativos1792206000000 implements MigrationInterface {
  name = 'AllowDuplicateItemCorrelativos1792206000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_licitacion_items_licitacion_correlativo"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitacion_items_licitacion_correlativo" ON "licitacion_items" ("licitacion_id", "correlativo")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitacion_items_licitacion_correlativo"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitacion_items_licitacion_correlativo" ON "licitacion_items" ("licitacion_id", "correlativo")`,
    );
  }
}
