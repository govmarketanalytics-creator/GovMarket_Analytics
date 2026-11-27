import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorConsulta, solicitarJson } from '../../../web/src/opportunities/consulta-http';
import { filtrosIniciales, parametrosConsulta } from '../../../web/src/opportunities/useConsultaOportunidades';
describe('Cliente de consultas: sin respuestas persistidas', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('una consulta identica en curso comparte un solo HTTP y luego se revalida', async () => {
    const f = vi.fn(async () => new Response('{"n":1}')); vi.stubGlobal('fetch', f);
    const a = solicitarJson('/api/v1/empresas/A/oportunidades', 'token-falso-A'), b = solicitarJson('/api/v1/empresas/A/oportunidades', 'token-falso-A');
    expect(a).toBe(b); await a; expect(f).toHaveBeenCalledTimes(1);
    await solicitarJson('/api/v1/empresas/A/oportunidades', 'token-falso-A'); expect(f).toHaveBeenCalledTimes(2);
  });
  it('otra sesion o empresa no comparte solicitudes', async () => {
    const f = vi.fn(async () => new Response('{}')); vi.stubGlobal('fetch', f);
    await Promise.all([solicitarJson('/A', 'falso1'), solicitarJson('/B', 'falso1'), solicitarJson('/A', 'falso2')]);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('un 401 es error de sesion y no se guarda como resultados vacios', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 })); vi.stubGlobal('fetch', f);
    await expect(solicitarJson('/401', 'falso')).rejects.toBeInstanceOf(ErrorConsulta);
    f.mockImplementationOnce(async () => new Response('{"ok":true}'));
    await expect(solicitarJson('/401', 'falso')).resolves.toEqual({ ok: true });
  });
  it('la pagina se pide sin esperar metadata y no cambia los filtros aplicados', () => {
    const f = { ...filtrosIniciales, texto: 'software', horizonteCierre: '7mas', region: 'Metropolitana' };
    const q = new URLSearchParams(parametrosConsulta(f, 3));
    expect(q.get('incluirFiltros')).toBe('false'); expect(q.get('pagina')).toBe('3'); expect(q.get('limite')).toBe('10');
    expect(q.get('texto')).toBe('software'); expect(q.get('horizonteCierre')).toBe('7mas'); expect(f.texto).toBe('software');
  });
});
