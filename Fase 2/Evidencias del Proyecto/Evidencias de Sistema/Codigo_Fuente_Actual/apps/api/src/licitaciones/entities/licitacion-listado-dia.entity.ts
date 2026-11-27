import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Licitacion } from './licitacion.entity';

@Entity({ name: 'licitaciones_listado_dia' })
@Index(
  'UQ_licitaciones_listado_dia_fecha_licitacion',
  ['fecha', 'licitacionId'],
  { unique: true },
)
@Index('IDX_licitaciones_listado_dia_fecha', ['fecha'])
@Index('IDX_licitaciones_listado_dia_licitacion', ['licitacionId'])
export class LicitacionListadoDia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'licitacion_id', type: 'uuid' })
  licitacionId: string;

  @ManyToOne(() => Licitacion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'licitacion_id',
    foreignKeyConstraintName: 'FK_licitaciones_listado_dia_licitacion',
  })
  licitacion: Licitacion;

  @Column({ name: 'codigo_estado', type: 'integer', nullable: true })
  codigoEstado: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  estado: string | null;

  @Column({ name: 'fecha_cierre', type: 'timestamptz', nullable: true })
  fechaCierre: Date | null;

  @UpdateDateColumn({ name: 'sincronizado_en', type: 'timestamptz' })
  sincronizadoEn: Date;
}
