import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AgregarOfertasNexus1795737600000 implements MigrationInterface {
  name = 'AgregarOfertasNexus1795737600000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE perfiles_empresa ADD COLUMN ofertas_ids text[] NOT NULL DEFAULT '{}'`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE perfiles_empresa DROP COLUMN ofertas_ids');
  }
}
