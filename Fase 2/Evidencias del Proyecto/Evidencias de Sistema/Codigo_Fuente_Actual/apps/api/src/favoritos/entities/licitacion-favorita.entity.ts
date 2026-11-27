import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity';
import { Licitacion } from '../../licitaciones/entities/licitacion.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'licitaciones_favoritas' })
@Index(
  'UQ_licitaciones_favoritas_empresa_licitacion',
  ['empresaId', 'licitacionId'],
  { unique: true },
)
@Index('IDX_licitaciones_favoritas_licitacion_id', ['licitacionId'])
@Index('IDX_licitaciones_favoritas_usuario_id', ['agregadaPorUsuarioId'])
export class LicitacionFavorita {
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
    foreignKeyConstraintName: 'FK_licitaciones_favoritas_empresa',
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
    foreignKeyConstraintName: 'FK_licitaciones_favoritas_licitacion',
  })
  licitacion: Licitacion;

  @Column({
    name: 'agregada_por_usuario_id',
    type: 'uuid',
    nullable: true,
  })
  agregadaPorUsuarioId: string | null;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'agregada_por_usuario_id',
    foreignKeyConstraintName: 'FK_licitaciones_favoritas_usuario',
  })
  agregadaPorUsuario: Usuario | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
