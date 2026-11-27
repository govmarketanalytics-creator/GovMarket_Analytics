import { useEffect, useState } from "react";
import { ErrorConsulta, solicitarJson } from "../opportunities/consulta-http";
import { fechaChile } from "./modeloMercado";
import type { RespuestaNoticiasMercado } from "./types";

export function MarketNews({
  accessToken,
  empresaId,
  onSesionExpirada,
}: {
  accessToken: string;
  empresaId: string;
  onSesionExpirada: () => void;
}) {
  const clave = empresaId + ":" + accessToken;
  const [estado, setEstado] = useState<{
    clave: string;
    datos: RespuestaNoticiasMercado;
  } | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  const [tema, setTema] = useState("Todos");
  const [todas, setTodas] = useState(false);
  const respuesta = estado?.clave === clave ? estado.datos : null;
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(false);
    void solicitarJson<RespuestaNoticiasMercado>(
      "/api/v1/empresas/" + empresaId + "/analisis-mercado/noticias",
      accessToken,
    )
      .then((datos) => {
        if (vigente) setEstado({ clave, datos });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        if (e instanceof ErrorConsulta && e.estado === 401) onSesionExpirada();
        setError(true);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, empresaId, clave, revision, onSesionExpirada]);
  useEffect(() => {
    const t = window.setInterval(() => setRevision((n) => n + 1), 300_000);
    return () => window.clearInterval(t);
  }, []);
  const noticias = (respuesta?.noticias ?? []).filter(
    (n) => tema === "Todos" || n.tema === tema,
  );
  return (
    <section className="ma-card ma-news" aria-labelledby="ma-noticias">
      <div className="ma-card-heading">
        <div>
          <span className="ma-eyebrow">INFORMACIÓN PARA DECIDIR</span>
          <h2 id="ma-noticias">Actualidad para tu empresa</h2>
          <p>
            Noticias oficiales de compras públicas. Lee cada publicación en su
            fuente.
          </p>
        </div>
        <button
          className="ma-button"
          type="button"
          onClick={() => setTodas((v) => !v)}
        >
          {todas ? "Ver destacadas" : "Ver todas"}
        </button>
      </div>
      <div className="ma-news-controls">
        <label>
          Tema{" "}
          <select value={tema} onChange={(e) => setTema(e.target.value)}>
            {[
              "Todos",
              "Tecnología",
              "Oportunidades",
              "Normativa",
              "Capacitación",
              "Compras públicas",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <span role="status">
          {cargando
            ? "Consultando titulares…"
            : error
              ? "No se pudo comprobar la fuente."
              : respuesta?.estado === "disponible"
                ? "Actualización automática cada hora"
                : respuesta?.mensaje}
        </span>
        <button
          className="ma-text-button"
          type="button"
          disabled={cargando}
          onClick={() => setRevision((v) => v + 1)}
        >
          Revisar novedades
        </button>
      </div>
      {respuesta?.actualizadoEn && (
        <p className="ma-note">
          Última lectura: {fechaChile(respuesta.actualizadoEn, true)} · hora de
          Chile
          {respuesta.estado === "desactualizado" || error
            ? " · Lectura anterior sin revalidar"
            : ""}
        </p>
      )}
      {!noticias.length ? (
        <div className="ma-empty">
          {cargando
            ? "Las estadísticas pueden consultarse mientras cargan las noticias."
            : respuesta?.estado === "deshabilitado"
              ? respuesta.mensaje
              : tema !== "Todos" && (respuesta?.noticias.length ?? 0) > 0
                ? "No hay titulares de ese tema en la última lectura."
                : "No hay titulares disponibles en este momento. Puedes consultar directamente ChileCompra."}
          <a
            href="https://www.chilecompra.cl/category/noticias/noticias/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visitar noticias ChileCompra
          </a>
        </div>
      ) : (
        <div className="ma-news-grid">
          {noticias.slice(0, todas ? 12 : 3).map((n) => (
            <article key={n.id} className="ma-news-item">
              <div
                className={
                  "ma-news-visual tema-" +
                  (n.tema === "Tecnología"
                    ? "tecnologia"
                    : n.tema === "Oportunidades"
                      ? "oportunidades"
                      : "general")
                }
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 64 64"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="14" y="13" width="36" height="39" rx="4" />
                  <path d="M22 23h20M22 31h20M22 39h12M26 13V8m12 5V8" />
                </svg>
                <span>{n.tema}</span>
              </div>
              <div className="ma-news-content">
                <p className="ma-news-source">
                  ChileCompra ·{" "}
                  <time dateTime={n.publicadoEn}>
                    {fechaChile(n.publicadoEn)}
                  </time>
                </p>
                <h3>{n.titulo}</h3>
                <a href={n.url} target="_blank" rel="noopener noreferrer">
                  Leer en la fuente
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="ma-news-external">
        <span>También puedes consultar:</span>
        <a
          href="https://www.df.cl/dflab/techempresas"
          target="_blank"
          rel="noopener noreferrer"
        >
          DF · Tech &amp; Empresas
        </a>
        <a
          href="https://www.df.cl/empresas/telecom"
          target="_blank"
          rel="noopener noreferrer"
        >
          DF · Telecomunicaciones
        </a>
        <small>Enlaces externos a sus secciones editoriales.</small>
      </div>
    </section>
  );
}
