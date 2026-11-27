import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LicitacionResultado } from './licitacion-resultado.entity';

@Entity({ name: 'licitacion_adjudicaciones' })
@Index('IDX_licitacion_adjudicaciones_resultado', ['resultadoId'])
@Index('IDX_licitacion_adjudicaciones_rut_proveedor', ['rutProveedor'])
export class LicitacionAdjudicacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resultado_id', type: 'uuid' })
  resultadoId: string;

  @ManyToOne(
    () => LicitacionResultado,
    (resultado) => resultado.adjudicaciones,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'resultado_id',
    foreignKeyConstraintName: 'FK_licitacion_adjudicaciones_resultado',
  })
  resultado: LicitacionResultado;

  @Column({ name: 'item_correlativo', type: 'integer', nullable: true })
  itemCorrelativo: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipo: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  numero: string | null;

  @Column({ name: 'numero_oferentes', type: 'integer', nullable: true })
  numeroOferentes: number | null;

  @Column({ name: 'url_acta', type: 'text', nullable: true })
  urlActa: string | null;

  @Column({
    name: 'nombre_proveedor',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  nombreProveedor: string | null;

  @Column({
    name: 'rut_proveedor',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  rutProveedor: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  cantidad: string | null;

  @Column({
    name: 'monto_unitario',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  montoUnitario: string | null;

  @Column({
    name: 'monto_total',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  montoTotal: string | null;

  @Column({ name: 'datos_origen', type: 'jsonb', default: () => "'{}'::jsonb" })
  datosOrigen: Record<string, unknown>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
