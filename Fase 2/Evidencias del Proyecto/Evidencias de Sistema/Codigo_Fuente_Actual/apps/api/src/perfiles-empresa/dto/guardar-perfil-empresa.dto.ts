import { z } from 'zod';
import { ofertasIdsSchema } from '../../nexus/ofertas.dto';

const palabrasClaveSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, 'Cada palabra clave debe tener al menos 2 caracteres')
      .max(100, 'Cada palabra clave puede tener hasta 100 caracteres'),
  )
  .max(50, 'Se permiten hasta 50 palabras clave')
  .transform((valores) => [
    ...new Set(valores.map((valor) => valor.toLowerCase())),
  ]);

const codigosCategoriaSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'El código de categoría no puede estar vacío')
      .max(100, 'Cada código de categoría puede tener hasta 100 caracteres'),
  )
  .max(100, 'Se permiten hasta 100 códigos de categoría')
  .transform((valores) => [
    ...new Set(valores.map((valor) => valor.toUpperCase())),
  ]);

const regionesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, 'Cada región debe tener al menos 2 caracteres')
      .max(120, 'Cada región puede tener hasta 120 caracteres'),
  )
  .max(20, 'Se permiten hasta 20 regiones')
  .transform((valores) => [...new Set(valores)]);

const montoSchema = z
  .number({
    error: 'El monto debe ser numérico',
  })
  .finite('El monto debe ser finito')
  .nonnegative('El monto no puede ser negativo')
  .max(999_999_999_999.99, 'El monto no puede superar 999.999.999.999,99');

export const guardarPerfilEmpresaSchema = z
  .object({
    ofertasIds: ofertasIdsSchema.optional(),
    etiquetasCapacidades: z.array(z.string().trim().min(2).max(100)).max(50).optional(),
    palabrasClave: palabrasClaveSchema.optional(),
    codigosCategoria: codigosCategoriaSchema.optional(),
    regiones: regionesSchema.optional(),
    montoMinimo: montoSchema.nullable().optional(),
    montoMaximo: montoSchema.nullable().optional(),
    incluirSinMonto: z.boolean().optional(),
    puntajeMinimoAlerta: z
      .number({
        error: 'El puntaje mínimo de alerta debe ser numérico',
      })
      .finite()
      .min(0, 'El puntaje mínimo de alerta no puede ser menor que 0')
      .max(100, 'El puntaje mínimo de alerta no puede superar 100')
      .optional(),
    activo: z.boolean().optional(),
  })
  .strict().superRefine((datos, contexto) => {
    if (
      datos.montoMinimo != null &&
      datos.montoMaximo != null &&
      datos.montoMinimo > datos.montoMaximo
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['montoMaximo'],
        message: 'El monto máximo no puede ser menor que el monto mínimo',
      });
    }
  });

export type GuardarPerfilEmpresaDto = z.infer<
  typeof guardarPerfilEmpresaSchema
>;
