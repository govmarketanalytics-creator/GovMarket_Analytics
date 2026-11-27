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
import { Empresa } from '../../empresas/entities/empresa.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum RolMembresiaEmpresa {
  ADMINISTRADOR = 'administrador',
  ANALISTA_COMERCIAL = 'analista_comercial',
}

@Entity({ name: 'membresias_empresa' })
@Index('UQ_membresias_empresa_empresa_usuario', ['empresaId', 'usuarioId'], {
  unique: true,
})
@Index('IDX_membresias_empresa_usuario_id', ['usuarioId'])
export class MembresiaEmpresa {
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
    foreignKeyConstraintName: 'FK_membresias_empresa_empresa',
  })
  empresa: Empresa;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_membresias_empresa_usuario',
  })
  usuario: Usuario;

  @Column({
    type: 'enum',
    enum: RolMembresiaEmpresa,
    enumName: 'rol_membresia_empresa_enum',
  })
  rol: RolMembresiaEmpresa;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
