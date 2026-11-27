import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sincronizaciones_listado_dia' })
@Index('UQ_sincronizaciones_listado_dia_fecha', ['fecha'], { unique: true })
export class SincronizacionListadoDia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'cantidad_informada', type: 'integer' })
  cantidadInformada: number;

  @Column({ name: 'codigos_indexados', type: 'integer' })
  codigosIndexados: number;

  @UpdateDateColumn({ name: 'sincronizado_en', type: 'timestamptz' })
  sincronizadoEn: Date;
}
