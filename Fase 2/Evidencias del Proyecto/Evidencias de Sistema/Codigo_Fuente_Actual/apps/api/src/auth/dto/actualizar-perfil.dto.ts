import { z } from 'zod';

export const actualizarPerfilSchema = z
  .object({
    nombres: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre no puede superar los 120 caracteres'),

    apellidoPaterno: z
      .string()
      .trim()
      .min(1, 'El apellido paterno es obligatorio')
      .max(80, 'El apellido paterno no puede superar los 80 caracteres'),

    apellidoMaterno: z
      .string()
      .trim()
      .max(80, 'El apellido materno no puede superar los 80 caracteres')
      .nullable(),
  })
  .strict();

export type ActualizarPerfilDto = z.infer<typeof actualizarPerfilSchema>;