import { z } from 'zod';

export const cambiarPasswordSchema = z
  .object({
    passwordActual: z
      .string()
      .min(8, 'La contraseña actual debe tener al menos 8 caracteres')
      .max(128, 'La contraseña actual no puede superar los 128 caracteres'),

    passwordNueva: z
      .string()
      .min(12, 'La contraseña nueva debe tener al menos 12 caracteres')
      .max(128, 'La contraseña nueva no puede superar los 128 caracteres'),

    confirmarPasswordNueva: z
      .string()
      .min(12, 'La confirmación debe tener al menos 12 caracteres')
      .max(128, 'La confirmación no puede superar los 128 caracteres'),
  })
  .strict()
  .superRefine((datos, contexto) => {
    if (datos.passwordNueva !== datos.confirmarPasswordNueva) {
      contexto.addIssue({
        code: 'custom',
        path: ['confirmarPasswordNueva'],
        message: 'La confirmación de la contraseña no coincide',
      });
    }

    if (datos.passwordActual === datos.passwordNueva) {
      contexto.addIssue({
        code: 'custom',
        path: ['passwordNueva'],
        message: 'La contraseña nueva debe ser diferente de la actual',
      });
    }
  });

export type CambiarPasswordDto = z.infer<typeof cambiarPasswordSchema>;
