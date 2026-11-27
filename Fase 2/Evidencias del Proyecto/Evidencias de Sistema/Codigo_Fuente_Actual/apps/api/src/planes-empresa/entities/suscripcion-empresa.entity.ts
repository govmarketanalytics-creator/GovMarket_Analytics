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

export enum PlanPagoEmpresa {
  INDIVIDUAL = 'individual',
  EMPRESA = 'empresa',
}

export enum EstadoSuscripcionEmpresa {
  ACTIVA = 'activa',
  CANCELADA = 'cancelada',
}

@Entity({ name: 'suscripciones_empresa' })
@Index('UQ_suscripciones_empresa_empresa_id', ['empresaId'], { unique: true })
@Check('CHK_suscripciones_empresa_plan', `"plan" IN ('individual', 'empresa')`)
@Check(
  'CHK_suscripciones_empresa_estado',
  `"estado" IN ('activa', 'cancelada')`,
)
@Check(
  'CHK_suscripciones_empresa_vigencia',
  `"vigente_hasta" > "vigente_desde"`,
)
export class SuscripcionEmpresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'empresa_id',
    foreignKeyConstraintName: 'FK_suscripciones_empresa_empresa',
  })
  empresa: Empresa;

  @Column({ type: 'varchar', length: 20 })
  plan: PlanPagoEmpresa;

  @Column({ type: 'varchar', length: 20 })
  estado: EstadoSuscripcionEmpresa;

  @Column({ name: 'vigente_desde', type: 'timestamptz' })
  vigenteDesde: Date;

  @Column({ name: 'vigente_hasta', type: 'timestamptz' })
  vigenteHasta: Date;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
