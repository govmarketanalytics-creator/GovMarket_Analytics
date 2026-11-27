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

export enum TipoOportunidadEmpresa {
  LICITACION_PUBLICA = 'licitacion_publica',
  TRATO_DIRECTO = 'trato_directo',
  CONVENIO_MARCO = 'convenio_marco',
  COMPRA_AGIL = 'compra_agil',
}

export enum FrecuenciaAlertasEmpresa {
  TIEMPO_REAL = 'tiempo_real',
  DIARIA = 'diaria',
  SEMANAL = 'semanal',
}

@Entity({ name: 'perfiles_empresa' })
@Index('UQ_perfiles_empresa_empresa_id', ['empresaId'], { unique: true })
@Check(
  'CHK_perfiles_empresa_monto_minimo',
  '"monto_minimo" IS NULL OR "monto_minimo" >= 0',
)
@Check(
  'CHK_perfiles_empresa_monto_maximo',
  '"monto_maximo" IS NULL OR "monto_maximo" >= 0',
)
@Check(
  'CHK_perfiles_empresa_rango_montos',
  '"monto_minimo" IS NULL OR "monto_maximo" IS NULL OR "monto_minimo" <= "monto_maximo"',
)
@Check(
  'CHK_perfiles_empresa_puntaje_alerta',
  '"puntaje_minimo_alerta" >= 0 AND "puntaje_minimo_alerta" <= 100',
)
export class PerfilEmpresa {
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
    foreignKeyConstraintName: 'FK_perfiles_empresa_empresa',
  })
  empresa: Empresa;

  @Column({
    name: 'palabras_clave',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  palabrasClave: string[];

  @Column({
    name: 'etiquetas_capacidades',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  etiquetasCapacidades: string[];

  @Column({ name: 'ofertas_ids', type: 'text', array: true, default: () => "'{}'" })
  ofertasIds: string[];

  @Column({
    name: 'codigos_categoria',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  codigosCategoria: string[];

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  regiones: string[];

  @Column({
    name: 'monto_minimo',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  montoMinimo: string | null;

  @Column({
    name: 'monto_maximo',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  montoMaximo: string | null;

  @Column({
    name: 'incluir_sin_monto',
    type: 'boolean',
    default: true,
  })
  incluirSinMonto: boolean;

  @Column({
    name: 'tipos_oportunidad',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  tiposOportunidad: TipoOportunidadEmpresa[];

  @Column({
    name: 'frecuencia_alertas',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  frecuenciaAlertas: FrecuenciaAlertasEmpresa | null;

  @Column({
    name: 'puntaje_minimo_alerta',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 60,
  })
  puntajeMinimoAlerta: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
