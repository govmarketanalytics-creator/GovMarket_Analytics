import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { opcionesFirmaJwt, secretoJwt, sesionSinExpiracionLocal } from './opciones-jwt';
import { environmentSchema } from '../config/environment.schema';

const config = (NODE_ENV: string | undefined, activo: boolean) => new ConfigService({
  NODE_ENV, JWT_SESION_SIN_EXPIRACION_LOCAL: activo,
  JWT_SECRET: 'prueba-local-sin-credenciales-reales-'.repeat(3), JWT_ISSUER: 'gma-prueba',
  JWT_AUDIENCE: 'web-prueba', JWT_EXPIRES_IN_SECONDS: 900,
});
const jwt = (c: ConfigService) => new JwtService({ secret: secretoJwt(c), signOptions: opcionesFirmaJwt(c),
  verifyOptions: { issuer: 'gma-prueba', audience: 'web-prueba' } });

describe('Sesiones sin vencimiento, sólo para pruebas locales', () => {
  it.each(['development', 'test'])('mantiene la sesión después de 30 días en %s con activación explícita', async (entorno) => {
    const servicio = jwt(config(entorno, true));
    const token = await servicio.signAsync({ sub: 'usuario-de-prueba' });
    const claims = servicio.decode<{ iat: number; exp?: number }>(token);
    expect(claims).not.toHaveProperty('exp');
    await expect(servicio.verifyAsync(token, { clockTimestamp: claims.iat + 30 * 86400 }))
      .resolves.toMatchObject({ sub: 'usuario-de-prueba' });
  });
  it.each([['production', true], ['production', false], ['development', false], ['no-configurado', true]] as const)
  ('conserva expiración en entorno=%s, indicador=%s', async (entorno, activo) => {
    const c = config(entorno, activo), servicio = jwt(c);
    expect(sesionSinExpiracionLocal(c)).toBe(false);
    const token = await servicio.signAsync({ sub: 'usuario' });
    const claims = servicio.decode<{ iat: number; exp: number }>(token);
    expect(claims.exp - claims.iat).toBe(900);
    await expect(servicio.verifyAsync(token, { clockTimestamp: claims.exp + 1 })).rejects.toThrow();
  });
  it('una sesión local no sirve en producción aunque el secreto base sea el mismo', async () => {
    const token = await jwt(config('development', true)).signAsync({ sub: 'usuario' });
    await expect(jwt(config('production', true)).verifyAsync(token)).rejects.toThrow();
    await expect(jwt(config('development', false)).verifyAsync(token)).rejects.toThrow();
  });
  it('conserva las comprobaciones de firma, emisor y audiencia', async () => {
    const servicio = jwt(config('development', true)), token = await servicio.signAsync({ sub: 'usuario' });
    await expect(servicio.verifyAsync(token, { issuer: 'otro' })).rejects.toThrow();
    await expect(servicio.verifyAsync(token, { audience: 'otra' })).rejects.toThrow();
    await expect(servicio.verifyAsync(token + 'alterado')).rejects.toThrow();
  });
  it('el indicador es optativo y desactivado de forma predeterminada', () => {
    const s = environmentSchema.shape.JWT_SESION_SIN_EXPIRACION_LOCAL;
    expect(s.parse(undefined)).toBe(false); expect(s.parse('true')).toBe(true);
    expect(s.safeParse('cualquier-cosa').success).toBe(false);
  });
});
