import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import {
  NoticiasMercadoService,
  noticiasDesdeJson,
  NOTICIAS_URL,
  textoSeguro,
} from "./noticias-mercado.service";

const post = (id = 1) => ({
  id,
  date_gmt: "2026-01-01T12:00:00",
  link: "https://www.chilecompra.cl/2026/01/noticia-" + id + "/",
  title: { rendered: "Soporte &amp; tecnolog&#237;a" },
});
const config = (habilitado = true) =>
  ({ get: () => habilitado }) as unknown as ConfigService;
const response = (datos: unknown) =>
  new Response(JSON.stringify(datos), {
    headers: { "content-type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Noticias oficiales: datos, seguridad y actualización", () => {
  it("decodifica títulos y devuelve texto plano", () => {
    expect(
      textoSeguro("  <b>Compras</b> &amp; &#8220;TI&#8221; &#x1F4BB;  "),
    ).toBe("Compras & “TI” 💻");
    expect(textoSeguro("&#x110000; &lt;img src=x onerror=alert(1)&gt;")).toBe(
      "",
    );
  });
  it("normaliza, ordena y deduplica sin copiar artículos", () => {
    const r = noticiasDesdeJson([post(), post(), post(2)]);
    expect(r).toHaveLength(2);
    expect(r[0].titulo).toBe("Soporte & tecnología");
    expect(r[0].tema).toBe("Tecnología");
    expect(Object.keys(r[0])).not.toContain("content");
  });
  it.each([
    "javascript:alert(1)",
    "http://www.chilecompra.cl/2026/01/a",
    "https://www.chilecompra.cl.ejemplo.com/2026/01/a",
    "https://usuario@www.chilecompra.cl/2026/01/a",
    "https://www.chilecompra.cl:444/2026/01/a",
  ])("rechaza un enlace no autorizado: %s", (link) => {
    expect(noticiasDesdeJson([{ ...post(), link }])).toEqual([]);
  });
  it("descarta publicaciones con fecha inválida, futura o estructura incompleta", () => {
    expect(
      noticiasDesdeJson([
        { ...post(), date_gmt: "incorrecto" },
        { ...post(), date_gmt: "2099-01-01T12:00:00" },
        { id: 5 },
      ]),
    ).toEqual([]);
    expect(() => noticiasDesdeJson({ message: "error" })).toThrow();
  });
  it("no descarga nada si está deshabilitado", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await new NoticiasMercadoService(config(false)).listar();
    expect(r.estado).toBe("deshabilitado");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("comparte la petición concurrente y usa caché durante una hora", async () => {
    const fetch = vi.fn().mockImplementation(async () => response([post()]));
    vi.stubGlobal("fetch", fetch);
    const s = new NoticiasMercadoService(config());
    const [a, b] = await Promise.all([s.listar(), s.listar()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(NOTICIAS_URL);
    expect(a.noticias).toEqual(b.noticias);
    expect(a.estado).toBe("disponible");
    await s.listar();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].redirect).toBe("error");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("actualiza por horario y conserva la última lectura cuando falla la fuente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => response([post()]))
      .mockRejectedValue(new Error("sin red"));
    vi.stubGlobal("fetch", fetch);
    const s = new NoticiasMercadoService(config());
    await s.actualizarProgramadas();
    expect(fetch).not.toHaveBeenCalled();
    const primero = await s.listar();
    vi.setSystemTime(new Date("2026-06-01T01:01:00Z"));
    await s.actualizarProgramadas();
    const r = await s.listar();
    expect(r.estado).toBe("desactualizado");
    expect(r.noticias).toEqual(primero.noticias);
    expect(r.actualizadoEn).toBe(primero.actualizadoEn);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("informa error sin inventar noticias y retrasa el reintento", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("sin red"));
    vi.stubGlobal("fetch", fetch);
    const s = new NoticiasMercadoService(config());
    const r = await s.listar();
    expect(r.estado).toBe("no_disponible");
    expect(r.noticias).toEqual([]);
    await s.listar();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("no acepta HTML como si fuera la API JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>bloqueo</html>", {
            headers: { "content-type": "text/html" },
          }),
        ),
    );
    expect((await new NoticiasMercadoService(config()).listar()).estado).toBe(
      "no_disponible",
    );
  });
});
