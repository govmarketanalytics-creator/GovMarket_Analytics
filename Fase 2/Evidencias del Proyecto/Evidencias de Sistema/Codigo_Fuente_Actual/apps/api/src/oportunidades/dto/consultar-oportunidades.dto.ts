import { z } from 'zod';

const fechaIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'La fecha debe utilizar el formato AAAA-MM-DD',
});

export const consultarOportunidadesSchema = z
  .object({
    alcance: z.enum(['recomendadas', 'todas']).default('recomendadas'),
    texto: z.string().trim().min(2).max(200).optional(),
    codigoOrganismo: z.string().trim().min(1).max(50).optional(),
    region: z.string().trim().min(1).max(120).optional(),
    codigoCategoria: z.string().trim().min(1).max(100).optional(),
    incluirFiltros: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    horizonteCierre: z.enum(['48h', '2a7', '7a30', '30mas', '7mas']).optional(),
    montoMinimo: z.coerce.number().nonnegative().optional(),
    montoMaximo: z.coerce.number().nonnegative().optional(),
    publicadaDesde: fechaIsoSchema.optional(),
    publicadaHasta: fechaIsoSchema.optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().positive().max(100).default(20),
    puntajeMinimo: z.coerce.number().min(0).max(100).default(0),
    soloVigentes: z
      .enum(['true', 'false'])
      .default('true')
      .transform((valor) => valor === 'true'),
    orden: z
      .enum([
        'compatibilidad_desc',
        'fecha_desc',
        'cierre_asc',
        'monto_desc',
        'monto_asc',
      ])
      .default('compatibilidad_desc'),
  })
  .superRefine((filtros, contexto) => {
    if (
      filtros.montoMinimo !== undefined &&
      filtros.montoMaximo !== undefined &&
      filtros.montoMinimo > filtros.montoMaximo
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['montoMaximo'],
        message: 'El monto máximo no puede ser menor que el monto mínimo',
      });
    }

    if (
      filtros.publicadaDesde &&
      filtros.publicadaHasta &&
      filtros.publicadaDesde > filtros.publicadaHasta
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['publicadaHasta'],
        message:
          'La fecha final de publicación no puede ser anterior a la inicial',
      });
    }
  });

export type ConsultarOportunidadesDto = z.infer<
  typeof consultarOportunidadesSchema
>;
