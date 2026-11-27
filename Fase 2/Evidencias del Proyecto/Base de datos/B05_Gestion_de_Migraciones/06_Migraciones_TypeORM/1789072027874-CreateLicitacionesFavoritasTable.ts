import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLicitacionesFavoritasTable1789072027874 implements MigrationInterface {
  name = 'CreateLicitacionesFavoritasTable1789072027874';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "licitaciones_favoritas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "licitacion_id" uuid NOT NULL, "agregada_por_usuario_id" uuid, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2f2b0b409d2f371c4e187359a0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_favoritas_usuario_id" ON "licitaciones_favoritas"  ("agregada_por_usuario_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_licitaciones_favoritas_licitacion_id" ON "licitaciones_favoritas"  ("licitacion_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_licitaciones_favoritas_empresa_licitacion" ON "licitaciones_favoritas"  ("empresa_id", "licitacion_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" ADD CONSTRAINT "FK_licitaciones_favoritas_empresa" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" ADD CONSTRAINT "FK_licitaciones_favoritas_licitacion" FOREIGN KEY ("licitacion_id") REFERENCES "licitaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" ADD CONSTRAINT "FK_licitaciones_favoritas_usuario" FOREIGN KEY ("agregada_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" DROP CONSTRAINT "FK_licitaciones_favoritas_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" DROP CONSTRAINT "FK_licitaciones_favoritas_licitacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitaciones_favoritas" DROP CONSTRAINT "FK_licitaciones_favoritas_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_licitaciones_favoritas_empresa_licitacion"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_favoritas_licitacion_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_licitaciones_favoritas_usuario_id"`,
    );
    await queryRunner.query(`DROP TABLE "licitaciones_favoritas"`);
  }
}
