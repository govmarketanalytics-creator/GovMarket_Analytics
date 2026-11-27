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
import { Licitacion } from '../../licitaciones/entities/licitacion.entity';

@Entity({ name: 'alertas_oportunidades' })
@Index(
  'UQ_alertas_oportunidades_empresa_licitacion',
  ['empresaId', 'licitacionId'],
  { unique: true },
)
@Index('IDX_alertas_oportunidades_empresa_leida', ['empresaId', 'leida'])
@Index('IDX_alertas_oportunidades_licitacion_id', ['licitacionId'])
@Check(
  'CHK_alertas_oportunidades_porcentaje',
  '"porcentaje_compatibilidad" >= 0 AND "porcentaje_compatibilidad" <= 100',
)
export class AlertaOportunidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'empresa_id',
    foreignKeyConstraintName: 'FK_alertas_oportunidades_empresa',
  })
  empresa: Empresa;

  @Column({ name: 'licitacion_id', type: 'uuid' })
  licitacionId: string;

  @ManyToOne(() => Licitacion, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'licitacion_id',
    foreignKeyConstraintName: 'FK_alertas_oportunidades_licitacion',
  })
  licitacion: Licitacion;

  @Column({
    name: 'porcentaje_compatibilidad',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  porcentajeCompatibilidad: string;

  @Column({
    type: 'jsonb',
  })
  coincidencias: Record<string, unknown>;

  @Column({
    type: 'boolean',
    default: false,
  })
  leida: boolean;

  @Column({
    name: 'leida_en',
    type: 'timestamptz',
    nullable: true,
  })
  leidaEn: Date | null;

  @CreateDateColumn({
    name: 'generada_en',
    type: 'timestamptz',
  })
  generadaEn: Date;

  @UpdateDateColumn({
    name: 'actualizada_en',
    type: 'timestamptz',
  })
  actualizadaEn: Date;
}
