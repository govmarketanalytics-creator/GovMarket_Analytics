import { z } from "zod";

export const registrarUsuarioSchema = z
  .object({
    nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
    apellidoPaterno: z.string().trim().min(1, "Ingresa tu apellido").max(80),
    apellidoMaterno: z.string().trim().max(80).nullable().optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .email("Ingresa un correo válido"),
    password: z
      .string()
      .min(15, "La contraseña debe tener al menos 15 caracteres")
      .max(128),
    confirmarPassword: z.string().min(15).max(128),
  })
  .strict()
  .superRefine((datos, contexto) => {
    if (datos.password !== datos.confirmarPassword) {
      contexto.addIssue({
        code: "custom",
        path: ["confirmarPassword"],
        message: "Las contraseñas no coinciden",
      });
    }
  });

export type RegistrarUsuarioDto = z.infer<typeof registrarUsuarioSchema>;
