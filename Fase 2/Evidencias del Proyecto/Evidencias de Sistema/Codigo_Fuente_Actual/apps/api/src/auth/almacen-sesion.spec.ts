import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardarTokenSesion, obtenerTokenSesion, eliminarTokenSesion } from '../../../web/src/auth/almacen-sesion';

function almacen() {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => datos.set(k, v),
    removeItem: (k: string) => datos.delete(k), clear: () => datos.clear() };
}
describe('Persistencia de la sesión de pruebas en localhost', () => {
  let local: ReturnType<typeof almacen>, sesion: ReturnType<typeof almacen>;
  beforeEach(() => {
    local = almacen(); sesion = almacen();
    vi.stubGlobal('window', { location: { hostname: 'localhost' }, localStorage: local, sessionStorage: sesion });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('permite cerrar la pestaña y restaurar hasta pulsar Cerrar sesión', () => {
    guardarTokenSesion('token-falso-local', true); sesion.clear();
    expect(obtenerTokenSesion()).toBe('token-falso-local');
    guardarTokenSesion('token-falso-local');
    expect(local.getItem('govmarket-access-token-local')).toBe('token-falso-local');
    eliminarTokenSesion(); expect(obtenerTokenSesion()).toBeNull();
  });
  it('los accesos normales continúan en sessionStorage', () => {
    guardarTokenSesion('normal', false); expect(obtenerTokenSesion()).toBe('normal');
    expect(local.getItem('govmarket-access-token-local')).toBeNull();
    sesion.clear(); expect(obtenerTokenSesion()).toBeNull();
  });
  it('una cuenta nueva sustituye el acceso anterior y el cierre elimina ambos almacenes', () => {
    guardarTokenSesion('A', true); guardarTokenSesion('B', false);
    expect(obtenerTokenSesion()).toBe('B'); expect(local.getItem('govmarket-access-token-local')).toBeNull();
    eliminarTokenSesion(); expect(obtenerTokenSesion()).toBeNull();
  });
  it('en el dominio público no persiste ni restaura el token local', () => {
    local.setItem('govmarket-access-token-local', 'local-falso');
    window.location.hostname = 'www.govmarket.cl';
    expect(obtenerTokenSesion()).toBeNull();
    guardarTokenSesion('normal', true);
    expect(local.getItem('govmarket-access-token-local')).toBeNull(); expect(obtenerTokenSesion()).toBe('normal');
  });
  it('tolera almacenamiento bloqueado y permite cerrar la sesión', () => {
    const bloqueado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); },
      removeItem() { throw new Error('bloqueado'); } };
    vi.stubGlobal('window', { location: { hostname: 'localhost' }, localStorage: bloqueado, sessionStorage: bloqueado });
    expect(() => guardarTokenSesion('falso', true)).not.toThrow();
    expect(obtenerTokenSesion()).toBeNull(); expect(() => eliminarTokenSesion()).not.toThrow();
  });
});
