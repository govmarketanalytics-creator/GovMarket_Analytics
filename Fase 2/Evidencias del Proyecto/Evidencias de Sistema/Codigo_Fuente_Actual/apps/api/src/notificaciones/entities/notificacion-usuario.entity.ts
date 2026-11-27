import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { NotificacionOportunidad } from './notificacion-oportunidad.entity';

@Entity({ name: 'notificaciones_usuario' })
@Index(
  'UQ_notificaciones_usuario_notificacion_usuario',
  ['notificacionId', 'usuarioId'],
  { unique: true },
)
@Index('IDX_notificaciones_usuario_usuario_leida', ['usuarioId', 'leida'])
export class NotificacionUsuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notificacion_id', type: 'uuid' })
  notificacionId: string;

  @ManyToOne(
    () => NotificacionOportunidad,
    (notificacion) => notificacion.destinatarios,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'notificacion_id',
    foreignKeyConstraintName: 'FK_notificaciones_usuario_notificacion',
  })
  notificacion: NotificacionOportunidad;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_notificaciones_usuario_usuario',
  })
  usuario: Usuario;

  @Column({ type: 'boolean', default: false })
  leida: boolean;

  @Column({ name: 'leida_en', type: 'timestamptz', nullable: true })
  leidaEn: Date | null;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ name: 'actualizada_en', type: 'timestamptz' })
  actualizadaEn: Date;
}
