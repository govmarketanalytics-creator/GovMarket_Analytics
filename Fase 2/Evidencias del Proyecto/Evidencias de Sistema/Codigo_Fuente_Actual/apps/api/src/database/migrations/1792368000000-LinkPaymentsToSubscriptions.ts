import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkPaymentsToSubscriptions1792368000000 implements MigrationInterface {
  name = 'LinkPaymentsToSubscriptions1792368000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank"
       ADD "suscripcion_activada_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank"
       ADD "vigencia_desde_aplicada" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank"
       ADD "vigencia_hasta_aplicada" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pagos_transbank_suscripcion_activada"
       ON "pagos_transbank" ("suscripcion_activada_en")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pagos_transbank_suscripcion_activada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank" DROP COLUMN "vigencia_hasta_aplicada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank" DROP COLUMN "vigencia_desde_aplicada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank" DROP COLUMN "suscripcion_activada_en"`,
    );
  }
}
