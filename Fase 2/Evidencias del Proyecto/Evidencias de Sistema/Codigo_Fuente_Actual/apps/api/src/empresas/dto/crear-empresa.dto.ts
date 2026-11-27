import { z } from 'zod';

function limpiarRut(valor: string): string {
  return valor
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\s/g, '')
    .toUpperCase();
}

function normalizarRut(valor: string): string {
  const rutLimpio = limpiarRut(valor);
  const cuerpo = rutLimpio.slice(0, -1);
  const digitoVerificador = rutLimpio.slice(-1);

  return `${cuerpo}-${digitoVerificador}`;
}

function esRutValido(valor: string): boolean {
  const rutLimpio = limpiarRut(valor);

  if (!/^\d{7,8}[0-9K]$/.test(rutLimpio)) {
    return false;
  }

  const cuerpo = rutLimpio.slice(0, -1);
  const digitoVerificador = rutLimpio.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let posicion = cuerpo.length - 1; posicion >= 0; posicion -= 1) {
    suma += Number(cuerpo[posicion]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resultado = 11 - (suma % 11);
  const digitoEsperado =
    resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);

  return digitoVerificador === digitoEsperado;
}

export const crearEmpresaSchema = z
  .object({
    rut: z
      .string()
      .trim()
      .min(1, 'El RUT es obligatorio')
      .max(15, 'El RUT no es válido')
      .transform(normalizarRut)
      .refine(esRutValido, 'El RUT no es válido'),

    razonSocial: z
      .string()
      .trim()
      .min(2, 'La razón social debe tener al menos 2 caracteres')
      .max(200, 'La razón social no puede superar los 200 caracteres'),

    nombreFantasia: z
      .string()
      .trim()
      .max(200, 'El nombre de fantasía no puede superar los 200 caracteres')
      .optional()
      .nullable(),
  })
  .strict();

export type CrearEmpresaDto = z.infer<typeof crearEmpresaSchema>;
