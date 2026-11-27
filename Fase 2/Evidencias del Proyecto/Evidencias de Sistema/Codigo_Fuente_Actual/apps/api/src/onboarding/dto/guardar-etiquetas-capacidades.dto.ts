import { z } from 'zod';
import { ofertasIdsSchema } from '../../nexus/ofertas.dto';
import { nexusHabilitado } from '../../nexus/catalogo-nexus';

function quitarDuplicados(valores: string[]): string[] {
  const encontrados = new Set<string>();

  return valores.filter((valor) => {
    const normalizado = valor.toLocaleLowerCase('es-CL');

    if (encontrados.has(normalizado)) {
      return false;
    }

    encontrados.add(normalizado);
    return true;
  });
}

export const guardarEtiquetasCapacidadesSchema = z
  .object({
    ofertasIds: ofertasIdsSchema.optional(),
    etiquetasCapacidades: z
      .array(
        z
          .string()
          .trim()
          .min(2, 'Cada etiqueta debe tener al menos 2 caracteres')
          .max(100, 'Cada etiqueta puede tener hasta 100 caracteres'),
      )
      .max(50, 'Se permiten hasta 50 etiquetas y capacidades')
      .transform(quitarDuplicados),
  })
  .strict().superRefine((datos, ctx) => {
    if (!nexusHabilitado() && datos.etiquetasCapacidades.length === 0) ctx.addIssue({
      code: 'custom', path: ['etiquetasCapacidades'], message: 'Selecciona al menos una etiqueta o capacidad.',
    });
    if (nexusHabilitado() && !datos.ofertasIds?.length) ctx.addIssue({
      code: 'custom', path: ['ofertasIds'], message: 'Selecciona al menos una oferta específica del catálogo.',
    });
  });

export type GuardarEtiquetasCapacidadesDto = z.infer<
  typeof guardarEtiquetasCapacidadesSchema
>;
