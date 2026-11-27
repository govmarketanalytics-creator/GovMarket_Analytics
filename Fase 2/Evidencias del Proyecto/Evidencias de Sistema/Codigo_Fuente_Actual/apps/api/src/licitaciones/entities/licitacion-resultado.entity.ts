import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClasificacionResultadoLicitacion } from '../analizador-resultados';
import { LicitacionAdjudicacion } from './licitacion-adjudicacion.entity';
import { Licitacion } from './licitacion.entity';

@Entity({ name: 'licitacion_resultados' })
@Index('UQ_licitacion_resultados_licitacion', ['licitacionId'], {
  unique: true,
})
@Index('IDX_licitacion_resultados_clasificacion', ['clasificacion'])
@Index('IDX_licitacion_resultados_sincronizado', ['resultadoSincronizadoEn'])
export class LicitacionResultado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'licitacion_id', type: 'uuid' })
  licitacionId: string;

  @OneToOne(() => Licitacion, (licitacion) => licitacion.resultado, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'licitacion_id',
    foreignKeyConstraintName: 'FK_licitacion_resultados_licitacion',
  })
  licitacion: Licitacion;

  @Column({ type: 'varchar', length: 30 })
  clasificacion: ClasificacionResultadoLicitacion;

  @Column({ type: 'text', nullable: true })
  motivo: string | null;

  @Column({
    name: 'fuente_motivo',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fuenteMotivo: string | null;

  @Column({ name: 'numero_oferentes', type: 'integer', nullable: true })
  numeroOferentes: number | null;

  @Column({
    name: 'monto_total_adjudicado',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  montoTotalAdjudicado: string;

  @Column({ name: 'cantidad_adjudicaciones', type: 'integer', default: 0 })
  cantidadAdjudicaciones: number;

  @Column({ name: 'datos_origen', type: 'jsonb', default: () => "'{}'::jsonb" })
  datosOrigen: Record<string, unknown>;

  @Column({ name: 'resultado_sincronizado_en', type: 'timestamptz' })
  resultadoSincronizadoEn: Date;

  @OneToMany(
    () => LicitacionAdjudicacion,
    (adjudicacion) => adjudicacion.resultado,
  )
  adjudicaciones: LicitacionAdjudicacion[];

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
