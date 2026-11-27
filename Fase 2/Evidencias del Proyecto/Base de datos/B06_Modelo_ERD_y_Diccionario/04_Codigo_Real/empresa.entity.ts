import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoEmpresa {
  ACTIVA = 'activa',
  SUSPENDIDA = 'suspendida',
  INACTIVA = 'inactiva',
}

export enum TamanioEmpresa {
  MICRO = 'micro',
  PEQUENA = 'pequena',
  MEDIANA = 'mediana',
  GRANDE = 'grande',
}

@Entity({ name: 'empresas' })
@Index('UQ_empresas_rut', ['rut'], { unique: true })
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12 })
  rut: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 200 })
  razonSocial: string;

  @Column({
    name: 'nombre_fantasia',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  nombreFantasia: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'sitio_web', type: 'varchar', length: 255, nullable: true })
  sitioWeb: string | null;

  @Column({
    name: 'region_principal',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  regionPrincipal: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  comuna: string | null;

  @Column({
    name: 'tamanio_empresa',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tamanioEmpresa: TamanioEmpresa | null;

  @Column({ name: 'anio_fundacion', type: 'smallint', nullable: true })
  anioFundacion: number | null;

  @Column({
    name: 'correo_contacto',
    type: 'varchar',
    length: 254,
    nullable: true,
  })
  correoContacto: string | null;

  @Column({
    name: 'telefono_contacto',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefonoContacto: string | null;

  @Column({ name: 'onboarding_paso', type: 'smallint', default: 1 })
  onboardingPaso: number;

  @Column({
    name: 'onboarding_completado',
    type: 'boolean',
    default: false,
  })
  onboardingCompletado: boolean;

  @Column({
    name: 'onboarding_completado_en',
    type: 'timestamptz',
    nullable: true,
  })
  onboardingCompletadoEn: Date | null;

  @Column({
    type: 'enum',
    enum: EstadoEmpresa,
    enumName: 'estado_empresa_enum',
    default: EstadoEmpresa.ACTIVA,
  })
  estado: EstadoEmpresa;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
