import { z } from 'zod';

const mercadoPublicoApiUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' && url.hostname === 'api.mercadopublico.cl'
      );
    },
    {
      message:
        'MERCADO_PUBLICO_API_URL debe utilizar el dominio oficial de Mercado Público',
    },
  );

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  NEXUS_REDUCIDO_HABILITADO: z.enum(['true', 'false']).default('false')
    .transform(value => value === 'true'),
  NOTICIAS_HABILITADAS: z.enum(['true', 'false']).default('true')
    .transform((value) => value === 'true'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().max(65535).default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  JWT_SECRET: z.string().min(64),
  JWT_SESION_SIN_EXPIRACION_LOCAL: z.enum(['true', 'false'])
    .default('false').transform((value) => value === 'true'),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(86400)
    .default(900),
  JWT_ISSUER: z.string().min(1).default('govmarket-analytics-api'),
  JWT_AUDIENCE: z.string().min(1).default('govmarket-analytics-web'),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),

  PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  TRANSBANK_ENVIRONMENT: z.literal('integration').default('integration'),

  MERCADO_PUBLICO_API_URL: mercadoPublicoApiUrlSchema.default(
    'https://api.mercadopublico.cl/servicios/v1/publico',
  ),
  MERCADO_PUBLICO_TICKET: z.string().trim().min(10),
  MERCADO_PUBLICO_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(15000),
  MERCADO_PUBLICO_BATCH_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .max(1000)
    .default(250),
  MERCADO_PUBLICO_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(5000)
    .default(2500),
  MERCADO_PUBLICO_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  MERCADO_PUBLICO_RETRY_BASE_DELAY_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(10000)
    .default(1000),

  MERCADO_PUBLICO_CONSULTAS_HABILITADAS: z.enum(['true', 'false'])
    .default('false').transform((v) => v === 'true'),
  MERCADO_PUBLICO_MAX_SOLICITUDES_24H: z.coerce.number().int().min(1).max(9000).default(6000),
  MERCADO_PUBLICO_PAUSA_429_MINUTOS: z.coerce.number().int().min(5).max(1440).default(60),
  AUTOMATIZACION_HABILITADA: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTOMATIZACION_LIMITE_DIARIO: z.coerce
    .number()
    .int()
    .positive()
    .max(1000)
    .default(20),
  AUTOMATIZACION_LIMITE_POR_CICLO: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(25),
  AUTOMATIZACION_LIMITE_NOCTURNO: z.coerce.number().int().min(1).max(100).default(100),
});
