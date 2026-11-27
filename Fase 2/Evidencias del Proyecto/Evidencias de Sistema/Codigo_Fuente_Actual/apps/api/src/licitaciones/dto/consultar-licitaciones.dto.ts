import { z } from 'zod';

const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe utilizar el formato AAAA-MM-DD',
  })
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    return (
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() === mes - 1 &&
      fecha.getUTCDate() === dia
    );
  }, 'La fecha indicada no existe');

export const consultarLicitacionesSchema = z
  .object({
    texto: z.string().trim().min(2).max(200).optional(),
    codigoEstado: z.coerce.number().int().nonnegative().max(999).optional(),
    codigoOrganismo: z.string().trim().min(1).max(50).optional(),
    region: z.string().trim().min(1).max(120).optional(),
    publicadaDesde: fechaIsoSchema.optional(),
    publicadaHasta: fechaIsoSchema.optional(),
    cierreDesde: fechaIsoSchema.optional(),
    cierreHasta: fechaIsoSchema.optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((filtros, contexto) => {
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

    if (
      filtros.cierreDesde &&
      filtros.cierreHasta &&
      filtros.cierreDesde > filtros.cierreHasta
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['cierreHasta'],
        message: 'La fecha final de cierre no puede ser anterior a la inicial',
      });
    }
  });

export type ConsultarLicitacionesDto = z.infer<
  typeof consultarLicitacionesSchema
>;
