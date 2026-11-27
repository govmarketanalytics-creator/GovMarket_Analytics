import { z } from 'zod';

export const consultarNotificacionesSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(50).default(20),
  leida: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export type ConsultarNotificacionesDto = z.infer<
  typeof consultarNotificacionesSchema
>;
