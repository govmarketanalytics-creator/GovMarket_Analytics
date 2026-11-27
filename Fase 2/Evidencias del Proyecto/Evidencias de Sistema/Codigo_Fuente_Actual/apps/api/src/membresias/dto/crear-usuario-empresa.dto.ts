import { z } from 'zod';
import { RolMembresiaEmpresa } from '../entities/membresia-empresa.entity';

export const crearUsuarioEmpresaSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, 'El correo electrónico no puede superar los 254 caracteres')
      .email('El correo electrónico no es válido'),

    password: z
      .string()
      .min(12, 'La contraseña debe tener al menos 12 caracteres')
      .max(128, 'La contraseña no puede superar los 128 caracteres'),

    nombres: z
      .string()
      .trim()
      .min(2, 'Los nombres deben tener al menos 2 caracteres')
      .max(120, 'Los nombres no pueden superar los 120 caracteres'),

    apellidoPaterno: z
      .string()
      .trim()
      .min(2, 'El apellido paterno debe tener al menos 2 caracteres')
      .max(80, 'El apellido paterno no puede superar los 80 caracteres'),

    apellidoMaterno: z
      .string()
      .trim()
      .max(80, 'El apellido materno no puede superar los 80 caracteres')
      .optional()
      .nullable(),

    rol: z.enum(RolMembresiaEmpresa, {
      error: 'El rol debe ser administrador o analista_comercial',
    }),
  })
  .strict();

export type CrearUsuarioEmpresaDto = z.infer<typeof crearUsuarioEmpresaSchema>;
