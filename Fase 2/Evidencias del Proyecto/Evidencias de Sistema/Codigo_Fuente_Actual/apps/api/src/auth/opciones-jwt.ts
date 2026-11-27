import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export function sesionSinExpiracionLocal(config: ConfigService): boolean {
  const entorno = config.get?.<string>('NODE_ENV');
  return (entorno === 'development' || entorno === 'test') &&
    config.get?.<boolean>('JWT_SESION_SIN_EXPIRACION_LOCAL') === true;
}

export function opcionesFirmaJwt(config: ConfigService) {
  return {
    issuer: config.getOrThrow<string>('JWT_ISSUER'),
    audience: config.getOrThrow<string>('JWT_AUDIENCE'),
    ...(sesionSinExpiracionLocal(config) ? {} : {
      expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'),
    }),
  };
}

export function secretoJwt(config: ConfigService): string {
  const secreto = config.getOrThrow<string>('JWT_SECRET');
  // Las sesiones locales no son aceptables en Azure aunque ambos .env
  // compartan el secreto original. No cambia el secreto de producción.
  return sesionSinExpiracionLocal(config)
    ? createHmac('sha256', secreto).update('gma-sesion-local-sin-expiracion-v1').digest('hex')
    : secreto;
}
