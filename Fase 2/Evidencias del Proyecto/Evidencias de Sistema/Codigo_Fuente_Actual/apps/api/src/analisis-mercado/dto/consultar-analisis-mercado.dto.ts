import { z } from "zod";

const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const fecha = new Date(v + "T00:00:00Z");
    return (
      Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v
    );
  }, "La fecha debe existir y utilizar el formato AAAA-MM-DD");

export const consultarAnalisisMercadoSchema = z
  .object({
    fechaDesde: fechaIsoSchema,
    fechaHasta: fechaIsoSchema,
    alcance: z.enum(["empresa", "mercado"]).default("mercado"),
    moneda: z.enum(["CLP", "CLF", "UTM", "USD", "EUR"]).default("CLP"),
    region: z.string().trim().min(1).max(120).optional(),
    categoria: z.string().trim().min(1).max(500).optional(),
    organismo: z.string().trim().min(1).max(300).optional(),
  })
  .superRefine((f, ctx) => {
    if (f.fechaDesde > f.fechaHasta)
      ctx.addIssue({
        code: "custom",
        path: ["fechaHasta"],
        message: "La fecha final no puede ser anterior a la fecha inicial",
      });
    const dias =
      (Date.parse(f.fechaHasta) - Date.parse(f.fechaDesde)) / 86_400_000 + 1;
    if (dias > 731)
      ctx.addIssue({
        code: "custom",
        path: ["fechaHasta"],
        message: "El período máximo de análisis es de 24 meses",
      });
  });
export type ConsultarAnalisisMercadoDto = z.infer<
  typeof consultarAnalisisMercadoSchema
>;
export const consultarLicitacionesAnalisisSchema =
  consultarAnalisisMercadoSchema.and(
    z.object({
      pagina: z.coerce.number().int().min(1).max(10000).default(1),
      limite: z.coerce.number().int().min(1).max(50).default(10),
      rutProveedor: z.string().trim().min(3).max(30).optional(),
    }),
  );
export type ConsultarLicitacionesAnalisisDto = z.infer<
  typeof consultarLicitacionesAnalisisSchema
>;
