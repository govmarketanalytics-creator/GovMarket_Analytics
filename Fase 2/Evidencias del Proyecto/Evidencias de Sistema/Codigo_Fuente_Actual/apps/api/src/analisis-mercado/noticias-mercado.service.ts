import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";

export const NOTICIAS_URL =
  "https://www.chilecompra.cl/wp-json/wp/v2/posts?categories=109&per_page=12&orderby=date&order=desc&_fields=id,date_gmt,link,title";
const HORA = 3_600_000;
const REINTENTO = 300_000;
export interface NoticiaMercado {
  id: number;
  titulo: string;
  url: string;
  publicadoEn: string;
  fuente: "ChileCompra";
  tema:
    | "Tecnología"
    | "Oportunidades"
    | "Normativa"
    | "Capacitación"
    | "Compras públicas";
}
export function textoSeguro(v: string): string {
  const entidades: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    laquo: "«",
    raquo: "»",
  };
  const decodificado = v.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (original, entidad: string) => {
      if (!entidad.startsWith("#"))
        return entidades[entidad.toLowerCase()] ?? original;
      const numero =
        entidad[1]?.toLowerCase() === "x"
          ? parseInt(entidad.slice(2), 16)
          : parseInt(entidad.slice(1), 10);
      return numero > 0 &&
        numero <= 0x10ffff &&
        !(numero >= 0xd800 && numero <= 0xdfff)
        ? String.fromCodePoint(numero)
        : "";
    },
  );
  return decodificado
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex -- Se eliminan controles recibidos en títulos externos.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 350);
}
export function noticiasDesdeJson(
  datos: unknown,
  ahora = Date.now(),
): NoticiaMercado[] {
  if (!Array.isArray(datos))
    throw new Error("Formato de noticias no reconocido");
  const vistas = new Set<string>();
  const noticias: NoticiaMercado[] = [];
  for (const valor of datos.slice(0, 30)) {
    if (!valor || typeof valor !== "object") continue;
    const p = valor as Record<string, unknown>;
    const titulo = p.title as { rendered?: unknown } | undefined;
    if (
      !Number.isSafeInteger(p.id) ||
      typeof p.link !== "string" ||
      typeof titulo?.rendered !== "string" ||
      typeof p.date_gmt !== "string"
    )
      continue;
    let url: URL;
    try {
      url = new URL(p.link);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      !["www.chilecompra.cl", "chilecompra.cl"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/\d{4}\/\d{2}\//.test(url.pathname)
    )
      continue;
    url.search = "";
    url.hash = "";
    const fecha = new Date(
      p.date_gmt.endsWith("Z") ? p.date_gmt : p.date_gmt + "Z",
    );
    const texto = textoSeguro(titulo.rendered);
    if (
      !texto ||
      !Number.isFinite(fecha.getTime()) ||
      fecha.getTime() > ahora + 300_000 ||
      vistas.has(url.href)
    )
      continue;
    vistas.add(url.href);
    const n = texto
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const tema =
      /software|tecnolog|computador|ciber|moodle|inteligencia artificial/.test(
        n,
      )
        ? "Tecnología"
        : /oferta|licitacion|consulta al mercado|convenio marco/.test(n)
          ? "Oportunidades"
          : /norma|reglam|ley |directiva|sancion/.test(n)
            ? "Normativa"
            : /capacita|taller|curso|certificacion/.test(n)
              ? "Capacitación"
              : "Compras públicas";
    noticias.push({
      id: Number(p.id),
      titulo: texto,
      url: url.href,
      publicadoEn: fecha.toISOString(),
      fuente: "ChileCompra",
      tema,
    });
  }
  return noticias
    .sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn))
    .slice(0, 12);
}

@Injectable()
export class NoticiasMercadoService {
  private readonly logger = new Logger(NoticiasMercadoService.name);
  private noticias: NoticiaMercado[] = [];
  private actualizadoEn: string | null = null;
  private siguiente = 0;
  private activado = false;
  private fallo = false;
  private etag: string | null = null;
  private enCurso: Promise<void> | null = null;
  constructor(private readonly config: ConfigService) {}

  private habilitado() {
    const v = this.config.get<boolean | string>("NOTICIAS_HABILITADAS", true);
    return v !== false && v !== "false";
  }

  // El trabajo comienza al consultar la sección, no bloquea el arranque del servidor.
  @Interval("noticias-mercado", 60_000)
  async actualizarProgramadas() {
    if (this.activado && this.habilitado() && Date.now() >= this.siguiente)
      await this.actualizar();
  }

  async listar() {
    if (!this.habilitado())
      return {
        estado: "deshabilitado" as const,
        fuente: "ChileCompra",
        actualizadoEn: null,
        proximaActualizacion: null,
        noticias: [],
        mensaje:
          "Las noticias están deshabilitadas en la configuración del servidor.",
      };
    this.activado = true;
    if (this.enCurso) await this.enCurso;
    else if (Date.now() >= this.siguiente) await this.actualizar();
    return {
      estado: this.fallo
        ? this.actualizadoEn
          ? ("desactualizado" as const)
          : ("no_disponible" as const)
        : ("disponible" as const),
      fuente: "ChileCompra",
      actualizadoEn: this.actualizadoEn,
      proximaActualizacion: this.siguiente
        ? new Date(this.siguiente).toISOString()
        : null,
      noticias: this.noticias,
      mensaje: this.fallo
        ? this.actualizadoEn
          ? "No se pudo actualizar la fuente. Se conserva la última lectura disponible."
          : "No fue posible consultar las noticias oficiales. Se reintentará automáticamente."
        : "Titulares oficiales. Actualización automática cada hora mientras el servidor esté activo.",
    };
  }

  private actualizar(): Promise<void> {
    if (this.enCurso) return this.enCurso;
    this.enCurso = this.descargar().finally(() => {
      this.enCurso = null;
    });
    return this.enCurso;
  }

  private async descargar() {
    this.siguiente = Date.now() + REINTENTO;
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "GovMarket-Analytics/1.0 (noticias oficiales)",
      };
      if (this.etag) headers["If-None-Match"] = this.etag;
      const respuesta = await fetch(NOTICIAS_URL, {
        headers,
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (respuesta.status === 304 && this.actualizadoEn) {
        this.actualizadoEn = new Date().toISOString();
        this.fallo = false;
        this.siguiente = Date.now() + HORA;
        return;
      }
      if (
        !respuesta.ok ||
        !respuesta.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("Fuente no disponible");
      const reader = respuesta.body?.getReader();
      if (!reader) throw new Error("Respuesta vacía");
      const decoder = new TextDecoder();
      let texto = "",
        bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 512_000) throw new Error("Respuesta excesiva");
          texto += decoder.decode(value, { stream: true });
        }
        texto += decoder.decode();
      } finally {
        await reader.cancel().catch(() => {});
      }
      const noticias = noticiasDesdeJson(JSON.parse(texto));
      if (!noticias.length)
        throw new Error("No se recibieron titulares válidos");
      this.noticias = noticias;
      this.etag = respuesta.headers.get("etag");
      this.actualizadoEn = new Date().toISOString();
      this.fallo = false;
      this.siguiente = Date.now() + HORA;
    } catch {
      this.fallo = true;
      this.logger.warn(
        "No se pudo actualizar ChileCompra; se conservará la última lectura y se reintentará en cinco minutos.",
      );
    }
  }
}
