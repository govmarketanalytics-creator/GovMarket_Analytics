import { z } from 'zod';

export const consultarAlertasSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),

  limite: z.coerce.number().int().positive().max(100).default(20),

  leida: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export type ConsultarAlertasDto = z.infer<typeof consultarAlertasSchema>;
