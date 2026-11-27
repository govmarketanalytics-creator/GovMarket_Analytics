import { z } from 'zod';
import { PlanPagoEmpresa } from '../../planes-empresa/entities/suscripcion-empresa.entity';

export const iniciarPagoSchema = z.object({
  plan: z.enum(PlanPagoEmpresa),
});

export type IniciarPagoDto = z.infer<typeof iniciarPagoSchema>;
