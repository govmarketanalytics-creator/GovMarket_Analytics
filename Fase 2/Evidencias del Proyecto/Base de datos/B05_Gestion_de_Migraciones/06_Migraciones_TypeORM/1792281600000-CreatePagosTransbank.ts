import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePagosTransbank1792281600000 implements MigrationInterface {
  name = 'CreatePagosTransbank1792281600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pagos_transbank" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "empresa_id" uuid NOT NULL,
        "usuario_id" uuid NOT NULL,
        "plan" character varying(20) NOT NULL,
        "buy_order" character varying(26) NOT NULL,
        "session_id" character varying(61) NOT NULL,
        "token_ws" character varying(128),
        "monto" integer NOT NULL,
        "moneda" character varying(3) NOT NULL DEFAULT 'CLP',
        "estado" character varying(20) NOT NULL,
        "estado_transbank" character varying(40),
        "codigo_respuesta" integer,
        "codigo_autorizacion" character varying(40),
        "tipo_pago" character varying(10),
        "numero_cuotas" integer,
        "ultimos_cuatro_tarjeta" character varying(4),
        "fecha_transaccion" TIMESTAMP WITH TIME ZONE,
        "motivo_fallo" character varying(300),
        "autorizado_en" TIMESTAMP WITH TIME ZONE,
        "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_pagos_transbank_monto" CHECK ("monto" > 0),
        CONSTRAINT "CHK_pagos_transbank_plan" CHECK ("plan" IN ('individual', 'empresa')),
        CONSTRAINT "CHK_pagos_transbank_estado" CHECK (
          "estado" IN ('iniciada', 'confirmando', 'autorizada', 'rechazada', 'anulada', 'error')
        ),
        CONSTRAINT "PK_pagos_transbank" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pagos_transbank_buy_order"
       ON "pagos_transbank" ("buy_order")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pagos_transbank_token_ws"
       ON "pagos_transbank" ("token_ws")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pagos_transbank_empresa_creado"
       ON "pagos_transbank" ("empresa_id", "creado_en")`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank"
       ADD CONSTRAINT "FK_pagos_transbank_empresa"
       FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pagos_transbank"
       ADD CONSTRAINT "FK_pagos_transbank_usuario"
       FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pagos_transbank"`);
  }
}
