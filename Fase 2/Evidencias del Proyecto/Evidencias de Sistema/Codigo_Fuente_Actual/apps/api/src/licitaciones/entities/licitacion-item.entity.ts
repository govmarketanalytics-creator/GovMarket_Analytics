import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Licitacion } from './licitacion.entity';

@Entity({ name: 'licitacion_items' })
@Index('IDX_licitacion_items_licitacion_correlativo', [
  'licitacionId',
  'correlativo',
])
@Index('IDX_licitacion_items_codigo_producto', ['codigoProducto'])
@Index('IDX_licitacion_items_codigo_categoria', ['codigoCategoria'])
export class LicitacionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'licitacion_id',
    type: 'uuid',
  })
  licitacionId: string;

  @ManyToOne(() => Licitacion, (licitacion) => licitacion.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'licitacion_id',
    foreignKeyConstraintName: 'FK_licitacion_items_licitacion',
  })
  licitacion: Licitacion;

  @Column({
    type: 'integer',
  })
  correlativo: number;

  @Column({
    name: 'codigo_producto',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  codigoProducto: string | null;

  @Column({
    name: 'codigo_categoria',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  codigoCategoria: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  categoria: string | null;

  @Column({
    name: 'nombre_producto',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  nombreProducto: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  descripcion: string | null;

  @Column({
    name: 'unidad_medida',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  unidadMedida: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  cantidad: string | null;
}
