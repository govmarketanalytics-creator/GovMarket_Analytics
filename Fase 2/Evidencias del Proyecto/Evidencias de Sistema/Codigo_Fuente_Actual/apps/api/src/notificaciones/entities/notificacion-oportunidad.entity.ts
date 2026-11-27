import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity';
import { Licitacion } from '../../licitaciones/entities/licitacion.entity';
import { NotificacionUsuario } from './notificacion-usuario.entity';

export enum TipoNotificacionOportunidad {
  NUEVA_OPORTUNIDAD = 'nueva_oportunidad',
}

@Entity({ name: 'notificaciones_oportunidad' })
@Index(
  'UQ_notificaciones_oportunidad_empresa_licitacion_tipo',
  ['empresaId', 'licitacionId', 'tipo'],
  { unique: true },
)
@Index('IDX_notificaciones_oportunidad_empresa_creada', [
  'empresaId',
  'creadaEn',
])
@Check(
  'CHK_notificaciones_oportunidad_porcentaje',
  '"porcentaje_compatibilidad" >= 0 AND "porcentaje_compatibilidad" <= 100',
)
export class NotificacionOportunidad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'empresa_id',
    foreignKeyConstraintName: 'FK_notificaciones_oportunidad_empresa',
  })
  empresa: Empresa;

  @Column({ name: 'licitacion_id', type: 'uuid' })
  licitacionId: string;

  @ManyToOne(() => Licitacion, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'licitacion_id',
    foreignKeyConstraintName: 'FK_notificaciones_oportunidad_licitacion',
  })
  licitacion: Licitacion;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoNotificacionOportunidad;

  @Column({
    name: 'porcentaje_compatibilidad',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  porcentajeCompatibilidad: string;

  @Column({ name: 'es_prueba', type: 'boolean', default: false })
  esPrueba: boolean;

  @OneToMany(
    () => NotificacionUsuario,
    (notificacionUsuario) => notificacionUsuario.notificacion,
  )
  destinatarios: NotificacionUsuario[];

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;
}
