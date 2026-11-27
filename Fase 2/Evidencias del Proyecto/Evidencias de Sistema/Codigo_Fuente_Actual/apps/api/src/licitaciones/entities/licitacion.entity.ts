import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LicitacionItem } from './licitacion-item.entity';
import { LicitacionResultado } from './licitacion-resultado.entity';

@Entity({ name: 'licitaciones' })
@Index('UQ_licitaciones_codigo_externo', ['codigoExterno'], {
  unique: true,
})
@Index('IDX_licitaciones_codigo_estado', ['codigoEstado'])
@Index('IDX_licitaciones_fecha_publicacion', ['fechaPublicacion'])
@Index('IDX_licitaciones_fecha_cierre', ['fechaCierre'])
@Index('IDX_licitaciones_codigo_organismo', ['codigoOrganismo'])
@Index('IDX_licitaciones_activa_estado_cierre', [
  'activaEnListado',
  'codigoEstado',
  'fechaCierre',
])
@Index('IDX_licitaciones_detalle_sincronizado', ['detalleSincronizadoEn'])
export class Licitacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'codigo_externo',
    type: 'varchar',
    length: 50,
  })
  codigoExterno: string;

  @Column({
    type: 'varchar',
    length: 500,
  })
  nombre: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion: string | null;

  @Column({
    name: 'codigo_estado',
    type: 'integer',
  })
  codigoEstado: number;

  @Column({
    type: 'varchar',
    length: 100,
  })
  estado: string;

  @Column({
    name: 'codigo_tipo',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  codigoTipo: string | null;

  @Column({
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  tipo: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  moneda: string | null;

  @Column({
    name: 'monto_estimado',
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  montoEstimado: string | null;

  @Column({
    name: 'fecha_publicacion',
    type: 'timestamptz',
    nullable: true,
  })
  fechaPublicacion: Date | null;

  @Column({
    name: 'fecha_cierre',
    type: 'timestamptz',
    nullable: true,
  })
  fechaCierre: Date | null;

  @Column({
    name: 'fecha_adjudicacion',
    type: 'timestamptz',
    nullable: true,
  })
  fechaAdjudicacion: Date | null;

  @Column({
    name: 'codigo_organismo',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  codigoOrganismo: string | null;

  @Column({
    name: 'nombre_organismo',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  nombreOrganismo: string | null;

  @Column({
    name: 'codigo_unidad',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  codigoUnidad: string | null;

  @Column({
    name: 'nombre_unidad',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  nombreUnidad: string | null;

  @Column({
    name: 'comuna_unidad',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  comunaUnidad: string | null;

  @Column({
    name: 'region_unidad',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  regionUnidad: string | null;

  @Column({
    name: 'cantidad_reclamos',
    type: 'integer',
    nullable: true,
  })
  cantidadReclamos: number | null;

  @Column({
    name: 'datos_origen',
    type: 'jsonb',
  })
  datosOrigen: Record<string, unknown>;

  @Column({
    name: 'sincronizado_en',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  sincronizadoEn: Date;

  @Column({
    name: 'activa_en_listado',
    type: 'boolean',
    default: false,
  })
  activaEnListado: boolean;

  @Column({
    name: 'visto_activo_en',
    type: 'timestamptz',
    nullable: true,
  })
  vistoActivoEn: Date | null;

  @Column({
    name: 'detalle_sincronizado_en',
    type: 'timestamptz',
    nullable: true,
  })
  detalleSincronizadoEn: Date | null;

  @OneToMany(() => LicitacionItem, (item) => item.licitacion)
  items: LicitacionItem[];

  @OneToOne(() => LicitacionResultado, (resultado) => resultado.licitacion)
  resultado: LicitacionResultado | null;

  @CreateDateColumn({
    name: 'creado_en',
    type: 'timestamptz',
  })
  creadoEn: Date;

  @UpdateDateColumn({
    name: 'actualizado_en',
    type: 'timestamptz',
  })
  actualizadoEn: Date;
}
