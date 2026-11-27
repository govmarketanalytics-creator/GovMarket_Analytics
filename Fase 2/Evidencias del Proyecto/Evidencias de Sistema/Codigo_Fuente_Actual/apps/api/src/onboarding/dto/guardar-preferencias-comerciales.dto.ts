import { z } from 'zod';
import {
  FrecuenciaAlertasEmpresa,
  TipoOportunidadEmpresa,
} from '../../perfiles-empresa/entities/perfil-empresa.entity';

const montoSchema = z
  .number({ error: 'El monto debe ser numérico' })
  .finite('El monto debe ser finito')
  .nonnegative('El monto no puede ser negativo')
  .max(999_999_999_999.99, 'El monto no puede superar 999.999.999.999,99');

function valoresUnicos(valores: string[]): string[] {
  return [
    ...new Set(
      valores.map((valor) => valor.trim()).filter((valor) => valor.length > 0),
    ),
  ];
}

export const guardarPreferenciasComercialesSchema = z
  .object({
    regiones: z
      .array(
        z
          .string()
          .trim()
          .min(2, 'Cada región debe tener al menos 2 caracteres')
          .max(120, 'Cada región puede tener hasta 120 caracteres'),
      )
      .max(20, 'Se permiten hasta 20 regiones')
      .transform(valoresUnicos),
    montoMinimo: montoSchema.nullable(),
    montoMaximo: montoSchema.nullable(),
    incluirSinMonto: z.boolean(),
    tiposOportunidad: z
      .array(z.enum(TipoOportunidadEmpresa))
      .min(1, 'Selecciona al menos un tipo de oportunidad')
      .max(4)
      .transform((valores) => [...new Set(valores)]),
    frecuenciaAlertas: z.enum(FrecuenciaAlertasEmpresa),
    palabrasClave: z
      .array(
        z
          .string()
          .trim()
          .min(2, 'Cada palabra clave debe tener al menos 2 caracteres')
          .max(100, 'Cada palabra clave puede tener hasta 100 caracteres'),
      )
      .max(50, 'Se permiten hasta 50 palabras clave')
      .transform((valores) =>
        valoresUnicos(valores.map((valor) => valor.toLowerCase())),
      ),
  })
  .superRefine((datos, contexto) => {
    if (
      datos.montoMinimo !== null &&
      datos.montoMaximo !== null &&
      datos.montoMinimo > datos.montoMaximo
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['montoMaximo'],
        message: 'El monto máximo no puede ser menor que el monto mínimo',
      });
    }
  });

export type GuardarPreferenciasComercialesDto = z.infer<
  typeof guardarPreferenciasComercialesSchema
>;
