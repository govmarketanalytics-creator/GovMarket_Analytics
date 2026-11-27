import { z } from 'zod';
import { crearEmpresaSchema } from '../../empresas/dto/crear-empresa.dto';
import { TamanioEmpresa } from '../../empresas/entities/empresa.entity';

function normalizarSitioWeb(valor: string | null): string | null {
  if (!valor) {
    return null;
  }

  return /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
}

function esSitioWebValido(valor: string | null): boolean {
  if (!valor) {
    return true;
  }

  try {
    const url = new URL(normalizarSitioWeb(valor) ?? '');
    return (
      ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

const sitioWebSchema = z
  .union([
    z.string().trim().max(255, 'El sitio web no puede superar 255 caracteres'),
    z.null(),
  ])
  .refine(esSitioWebValido, 'El sitio web no es válido')
  .transform(normalizarSitioWeb);

export const guardarInformacionEmpresaSchema = crearEmpresaSchema.extend({
  descripcion: z
    .string()
    .trim()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(1000, 'La descripción no puede superar 1000 caracteres'),
  sitioWeb: sitioWebSchema,
  regionPrincipal: z
    .string()
    .trim()
    .min(2, 'La región principal es obligatoria')
    .max(120, 'La región principal no puede superar 120 caracteres'),
  comuna: z
    .string()
    .trim()
    .min(2, 'La comuna es obligatoria')
    .max(120, 'La comuna no puede superar 120 caracteres'),
  tamanioEmpresa: z.enum(TamanioEmpresa),
  anioFundacion: z
    .number({ error: 'El año de fundación debe ser numérico' })
    .int('El año de fundación debe ser un número entero')
    .min(1800, 'El año de fundación no puede ser anterior a 1800')
    .max(
      new Date().getFullYear(),
      'El año de fundación no puede ser posterior al año actual',
    )
    .nullable(),
  correoContacto: z
    .string()
    .trim()
    .toLowerCase()
    .email('El correo de contacto no es válido')
    .max(254),
  telefonoContacto: z
    .string()
    .trim()
    .min(8, 'El teléfono debe tener al menos 8 caracteres')
    .max(30, 'El teléfono no puede superar 30 caracteres')
    .regex(/^\+?[0-9\s()-]+$/, 'El teléfono contiene caracteres no permitidos'),
});

export type GuardarInformacionEmpresaDto = z.infer<
  typeof guardarInformacionEmpresaSchema
>;
