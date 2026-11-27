import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoUsuario {
  ACTIVO = 'activo',
  BLOQUEADO = 'bloqueado',
  INACTIVO = 'inactivo',
}

@Entity({ name: 'usuarios' })
@Index('UQ_usuarios_email', ['email'], { unique: true })
@Index('UQ_usuarios_google_sub', ['googleSub'], { unique: true })
@Check(
  'CHK_usuarios_metodo_autenticacion',
  '"password_hash" IS NOT NULL OR "google_sub" IS NOT NULL',
)
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Column({
    name: 'google_sub',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  googleSub: string | null;

  @Column({ type: 'varchar', length: 120 })
  nombres: string;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 80 })
  apellidoPaterno: string;

  @Column({
    name: 'apellido_materno',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  apellidoMaterno: string | null;

  @Column({ name: 'correo_verificado', type: 'boolean', default: false })
  correoVerificado: boolean;

  @Column({ name: 'es_superadministrador', type: 'boolean', default: false })
  esSuperadministrador: boolean;

  @Column({
    type: 'enum',
    enum: EstadoUsuario,
    enumName: 'estado_usuario_enum',
    default: EstadoUsuario.ACTIVO,
  })
  estado: EstadoUsuario;

  @Column({ name: 'ultimo_acceso_en', type: 'timestamptz', nullable: true })
  ultimoAccesoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
