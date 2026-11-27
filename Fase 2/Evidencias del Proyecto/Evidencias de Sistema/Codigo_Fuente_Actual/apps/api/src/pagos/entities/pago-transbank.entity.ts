import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity';
import { PlanPagoEmpresa } from '../../planes-empresa/entities/suscripcion-empresa.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum EstadoPagoTransbank {
  INICIADA = 'iniciada',
  CONFIRMANDO = 'confirmando',
  AUTORIZADA = 'autorizada',
  RECHAZADA = 'rechazada',
  ANULADA = 'anulada',
  ERROR = 'error',
}

@Entity({ name: 'pagos_transbank' })
@Index('UQ_pagos_transbank_buy_order', ['buyOrder'], { unique: true })
@Index('UQ_pagos_transbank_token_ws', ['tokenWs'], { unique: true })
@Index('IDX_pagos_transbank_empresa_creado', ['empresaId', 'creadoEn'])
@Check('CHK_pagos_transbank_monto', '"monto" > 0')
@Check('CHK_pagos_transbank_plan', `"plan" IN ('individual', 'empresa')`)
@Check(
  'CHK_pagos_transbank_estado',
  `"estado" IN ('iniciada', 'confirmando', 'autorizada', 'rechazada', 'anulada', 'error')`,
)
export class PagoTransbank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'empresa_id',
    foreignKeyConstraintName: 'FK_pagos_transbank_empresa',
  })
  empresa: Empresa;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_pagos_transbank_usuario',
  })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 20 })
  plan: PlanPagoEmpresa;

  @Column({ name: 'buy_order', type: 'varchar', length: 26 })
  buyOrder: string;

  @Column({ name: 'session_id', type: 'varchar', length: 61 })
  sessionId: string;

  @Column({ name: 'token_ws', type: 'varchar', length: 128, nullable: true })
  tokenWs: string | null;

  @Column({ type: 'integer' })
  monto: number;

  @Column({ type: 'varchar', length: 3, default: 'CLP' })
  moneda: 'CLP';

  @Column({ type: 'varchar', length: 20 })
  estado: EstadoPagoTransbank;

  @Column({
    name: 'estado_transbank',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  estadoTransbank: string | null;

  @Column({ name: 'codigo_respuesta', type: 'integer', nullable: true })
  codigoRespuesta: number | null;

  @Column({
    name: 'codigo_autorizacion',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  codigoAutorizacion: string | null;

  @Column({ name: 'tipo_pago', type: 'varchar', length: 10, nullable: true })
  tipoPago: string | null;

  @Column({ name: 'numero_cuotas', type: 'integer', nullable: true })
  numeroCuotas: number | null;

  @Column({
    name: 'ultimos_cuatro_tarjeta',
    type: 'varchar',
    length: 4,
    nullable: true,
  })
  ultimosCuatroTarjeta: string | null;

  @Column({ name: 'fecha_transaccion', type: 'timestamptz', nullable: true })
  fechaTransaccion: Date | null;

  @Column({
    name: 'motivo_fallo',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  motivoFallo: string | null;

  @Column({ name: 'autorizado_en', type: 'timestamptz', nullable: true })
  autorizadoEn: Date | null;

  @Column({
    name: 'suscripcion_activada_en',
    type: 'timestamptz',
    nullable: true,
  })
  suscripcionActivadaEn: Date | null;

  @Column({
    name: 'vigencia_desde_aplicada',
    type: 'timestamptz',
    nullable: true,
  })
  vigenciaDesdeAplicada: Date | null;

  @Column({
    name: 'vigencia_hasta_aplicada',
    type: 'timestamptz',
    nullable: true,
  })
  vigenciaHastaAplicada: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
