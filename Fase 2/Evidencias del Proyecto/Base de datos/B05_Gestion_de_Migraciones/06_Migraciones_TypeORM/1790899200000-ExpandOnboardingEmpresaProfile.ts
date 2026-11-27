import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandOnboardingEmpresaProfile1790899200000 implements MigrationInterface {
  name = 'ExpandOnboardingEmpresaProfile1790899200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "empresas" ADD "descripcion" text`);
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "sitio_web" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "region_principal" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "comuna" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "tamanio_empresa" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "anio_fundacion" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "correo_contacto" character varying(254)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "telefono_contacto" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "onboarding_paso" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "onboarding_completado" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "onboarding_completado_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_tamanio" CHECK ("tamanio_empresa" IS NULL OR "tamanio_empresa" IN ('micro', 'pequena', 'mediana', 'grande'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_anio_fundacion" CHECK ("anio_fundacion" IS NULL OR ("anio_fundacion" >= 1800 AND "anio_fundacion" <= 2100))`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_onboarding_paso" CHECK ("onboarding_paso" >= 1 AND "onboarding_paso" <= 4)`,
    );

    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD "etiquetas_capacidades" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD "tipos_oportunidad" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD "frecuencia_alertas" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "CHK_perfiles_empresa_tipos_oportunidad" CHECK ("tipos_oportunidad" <@ ARRAY['licitacion_publica', 'trato_directo', 'convenio_marco', 'compra_agil']::text[])`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "CHK_perfiles_empresa_frecuencia_alertas" CHECK ("frecuencia_alertas" IS NULL OR "frecuencia_alertas" IN ('tiempo_real', 'diaria', 'semanal'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP CONSTRAINT "CHK_perfiles_empresa_frecuencia_alertas"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP CONSTRAINT "CHK_perfiles_empresa_tipos_oportunidad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP COLUMN "frecuencia_alertas"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP COLUMN "tipos_oportunidad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perfiles_empresa" DROP COLUMN "etiquetas_capacidades"`,
    );

    await queryRunner.query(
      `ALTER TABLE "empresas" DROP CONSTRAINT "CHK_empresas_onboarding_paso"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP CONSTRAINT "CHK_empresas_anio_fundacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP CONSTRAINT "CHK_empresas_tamanio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "onboarding_completado_en"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "onboarding_completado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "onboarding_paso"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "telefono_contacto"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "correo_contacto"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "anio_fundacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "tamanio_empresa"`,
    );
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN "comuna"`);
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "region_principal"`,
    );
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN "sitio_web"`);
    await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN "descripcion"`);
  }
}
