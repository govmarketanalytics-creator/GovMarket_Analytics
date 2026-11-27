import { useEffect, useState } from "react";
import {
  diasHasta,
  formatearFecha,
  formatearMonto,
  type DetalleOportunidad,
} from "./types";

interface OpportunityDetailProps {
  accessToken: string;
  empresaId: string;
  codigoExterno: string;
  guardada: boolean;
  guardando: boolean;
  onVolver: () => void;
  etiquetaVolver?: string;
  onGuardar: (codigoExterno: string) => void;
  onAccionPremium: () => void;
  onSesionExpirada: () => void;
}

type PestanaDetalle = "resumen" | "requisitos" | "documentos" | "cronograma";

export function OpportunityDetail({
  accessToken,
  empresaId,
  codigoExterno,
  guardada,
  guardando,
  onVolver,
  etiquetaVolver = "Oportunidades",
  onGuardar,
  onAccionPremium,
  onSesionExpirada,
}: OpportunityDetailProps) {
  const [detalle, setDetalle] = useState<DetalleOportunidad | null>(null);
  const [pestana, setPestana] = useState<PestanaDetalle>("resumen");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function cargarDetalle() {
      try {
        const respuesta = await fetch(
          `/api/v1/empresas/${empresaId}/oportunidades/${encodeURIComponent(codigoExterno)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );

        if (respuesta.status === 401) {
          onSesionExpirada();
          return;
        }
        if (!respuesta.ok)
          throw new Error("No fue posible cargar la oportunidad.");
        setDetalle((await respuesta.json()) as DetalleOportunidad);
      } catch (errorDesconocido) {
        if (!controller.signal.aborted) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : "No fue posible conectar con la API.",
          );
        }
      }
    }

    void cargarDetalle();
    return () => controller.abort();
  }, [accessToken, codigoExterno, empresaId, onSesionExpirada]);

  if (error) {
    return (
      <div className="gm-page">
        <button className="gm-back-button" type="button" onClick={onVolver}>
          Volver a {etiquetaVolver}
        </button>
        <div className="gm-feedback gm-feedback--error">{error}</div>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="gm-feedback gm-detail-loading">
        <span className="gm-loader" />
        Cargando detalle...
      </div>
    );
  }

  const diasRestantes = diasHasta(detalle.fechaCierre);

  return (
    <div className="gm-page gm-detail-page">
      <div className="gm-breadcrumbs">
        <button type="button" onClick={onVolver}>
          {etiquetaVolver}
        </button>
        <span>›</span>
        <strong>Detalle de oportunidad</strong>
      </div>
      <header className="gm-page-heading gm-detail-heading">
        <div>
          <h1>Detalle de oportunidad</h1>
          <p>
            {detalle.acceso.completo
              ? "Vista completa de la oportunidad y requisitos para tu empresa."
              : "Consulta los datos principales de esta oportunidad."}
          </p>
        </div>
        <div className="gm-heading-actions">
          <button
            className={`gm-outline-button${guardada ? " is-saved" : ""}`}
            type="button"
            disabled={guardando}
            onClick={() => onGuardar(detalle.codigoExterno)}
          >
            {guardando ? "Guardando..." : guardada ? "★ Guardada" : "☆ Guardar"}
          </button>
          {detalle.acceso.completo && detalle.urlMercadoPublico ? (
            <a
              className="gm-primary-button"
              href={detalle.urlMercadoPublico}
              target="_blank"
              rel="noreferrer"
            >
              Postular a esta oportunidad
            </a>
          ) : (
            <button
              className="gm-primary-button"
              type="button"
              onClick={onAccionPremium}
            >
              Postular a esta oportunidad
            </button>
          )}
        </div>
      </header>

      <div className="gm-detail-grid">
        <div className="gm-detail-main">
          <section className="gm-detail-hero gm-surface">
            <span className="gm-detail-symbol" aria-hidden="true">
              &lt;/&gt;
            </span>
            <div className="gm-detail-hero-copy">
              <h2>{detalle.nombre}</h2>
              <p>{detalle.nombreOrganismo || "Organismo no informado"}</p>
              <small>ID: {detalle.codigoExterno}</small>
              <div className="gm-tag-row">
                {(detalle.clasificacion?.etiquetas.length
                  ? detalle.clasificacion.etiquetas
                  : detalle.clasificacion?.rubros.length
                    ? detalle.clasificacion.rubros
                    : detalle.categorias
                )
                  .slice(0, 3)
                  .map((categoria) => (
                    <span key={categoria}>{categoria}</span>
                  ))}
              </div>
              <p className="gm-detail-description">
                {detalle.descripcion ||
                  "La oportunidad no incluye una descripción general."}
              </p>
            </div>
            <dl className="gm-detail-facts">
              <div>
                <dt>Monto estimado</dt>
                <dd>{formatearMonto(detalle.montoEstimado)}</dd>
              </div>
              <div>
                <dt>Tipo de proceso</dt>
                <dd>{detalle.tipo || "No informado"}</dd>
              </div>
              <div>
                <dt>Región</dt>
                <dd>{detalle.regionUnidad?.trim() || "No informada"}</dd>
              </div>
              <div>
                <dt>Organismo comprador</dt>
                <dd>{detalle.nombreOrganismo || "No informado"}</dd>
              </div>
            </dl>
          </section>

          <section className="gm-detail-tabs gm-surface">
            {!detalle.acceso.completo ? (
              <div className="gm-premium-detail-lock">
                <span aria-hidden="true">🔒</span>
                <p>DETALLE COMPLETO PREMIUM</p>
                <h3>Revisa todos los antecedentes de la licitación</h3>
                <strong>
                  {detalle.acceso.mensaje ||
                    "Actualiza tu plan para continuar con el análisis completo."}
                </strong>
                <ul>
                  <li>Requisitos e ítems solicitados</li>
                  <li>Documentos y bases disponibles</li>
                  <li>Cronograma completo y fechas clave</li>
                  <li>Recomendaciones para preparar la postulación</li>
                </ul>
                <button
                  className="gm-primary-button"
                  type="button"
                  onClick={onAccionPremium}
                >
                  Conocer planes Premium
                </button>
              </div>
            ) : (
              <>
                <nav>
                  {(
                    [
                      ["resumen", "Resumen"],
                      ["requisitos", "Requisitos"],
                      ["documentos", "Documentos"],
                      ["cronograma", "Cronograma"],
                    ] as Array<[PestanaDetalle, string]>
                  ).map(([id, etiqueta]) => (
                    <button
                      key={id}
                      className={pestana === id ? "is-active" : ""}
                      type="button"
                      onClick={() => setPestana(id)}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </nav>

                {pestana === "resumen" && (
                  <div className="gm-tab-content gm-summary-tab">
                    <div>
                      <h3>Descripción de la oportunidad</h3>
                      <p>
                        {detalle.descripcion ||
                          "Descripción no informada por el organismo comprador."}
                      </p>
                      <h3>Alcance principal</h3>
                      <ul>
                        {detalle.items.slice(0, 6).map((item) => (
                          <li key={item.id}>
                            {item.nombreProducto ||
                              item.descripcion ||
                              item.categoria ||
                              "Ítem de la licitación"}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="gm-key-info">
                      <h3>Información clave</h3>
                      <dl>
                        <div>
                          <dt>Fecha de publicación</dt>
                          <dd>
                            {formatearFecha(
                              detalle.informacionClave.fechaPublicacion,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Cierre de postulaciones</dt>
                          <dd>
                            {formatearFecha(
                              detalle.informacionClave.fechaCierre,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Duración del contrato</dt>
                          <dd>
                            {detalle.informacionClave.duracionContrato ||
                              "No informada"}
                          </dd>
                        </div>
                        <div>
                          <dt>Modalidad</dt>
                          <dd>
                            {detalle.informacionClave.modalidad ||
                              "No informada"}
                          </dd>
                        </div>
                        <div>
                          <dt>Moneda</dt>
                          <dd>{detalle.informacionClave.moneda || "CLP"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {pestana === "requisitos" && (
                  <div className="gm-tab-content">
                    <h3>Ítems y requisitos informados</h3>
                    <div className="gm-requirements-list">
                      {detalle.items.map((item) => (
                        <article key={item.id}>
                          <strong>
                            {item.nombreProducto ||
                              item.categoria ||
                              `Ítem ${item.correlativo}`}
                          </strong>
                          <p>
                            {item.descripcion || "Sin descripción adicional."}
                          </p>
                          <small>
                            {item.codigoCategoria || "Categoría no informada"}
                          </small>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {pestana === "documentos" && (
                  <div className="gm-tab-content">
                    <h3>Documentos disponibles</h3>
                    {detalle.documentos.length === 0 ? (
                      <p>
                        Los documentos deben revisarse directamente en Mercado
                        Público utilizando el código {detalle.codigoExterno}.
                      </p>
                    ) : (
                      <div className="gm-documents-list">
                        {detalle.documentos.map((documento) => (
                          <article key={documento.id}>
                            <span>PDF</span>
                            <div>
                              <strong>{documento.nombre}</strong>
                              <small>{documento.tipo || "Documento"}</small>
                            </div>
                            {documento.url && (
                              <a
                                href={documento.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Descargar
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {pestana === "cronograma" && (
                  <div className="gm-tab-content">
                    <h3>Fechas importantes</h3>
                    <div className="gm-timeline">
                      {detalle.fechasImportantes.map((fecha) => (
                        <div key={fecha.id}>
                          <span />
                          <strong>{fecha.etiqueta}</strong>
                          <time>{formatearFecha(fecha.fecha)}</time>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="gm-detail-aside">
          <section className="gm-surface gm-compatibility-panel">
            <h3>Compatibilidad con tu empresa</h3>
            {detalle.nexus && <div className="gm-query-status"><p>{detalle.nexus.motivo}</p>
              {detalle.nexus.ofertas.map(o => <p key={o.ofertaId}><strong>{o.oferta}</strong>: {o.explicacion}
                {o.correlativo !== null ? ` Ítem ${o.correlativo}.` : ''}</p>)}
            </div>}
            <div className="gm-main-score">
              <div
                style={{
                  background: `conic-gradient(#159675 ${detalle.porcentajeCompatibilidad}%, #dcece7 0)`,
                }}
              >
                <span>{detalle.nexus?.estado === 'pendiente' || detalle.nexus?.estado === 'sin_configurar' ? '—' : `${Math.round(detalle.porcentajeCompatibilidad)}%`}</span>
              </div>
              <strong>
                Compatibilidad {detalle.nivelCompatibilidad.replace("_", " ")}
              </strong>
            </div>
            {detalle.desgloseCompatibilidad.some(
              (criterio) => criterio.motivoNoEvaluado === "dato_no_informado",
            ) && (
              <p className="gm-compatibility-pending-note">
                Puntaje provisional: región no informada. Este criterio no
                aporta puntos hasta contar con el dato.
              </p>
            )}
            <ul>
              {detalle.desgloseCompatibilidad
                .filter(
                  (criterio) =>
                    criterio.evaluado ||
                    criterio.motivoNoEvaluado === "dato_no_informado",
                )
                .map((criterio) => (
                  <li
                    key={criterio.criterio}
                    className={criterio.evaluado ? undefined : "gm-criterion-pending"}
                  >
                    <span aria-hidden="true">{criterio.evaluado ? "✓" : "?"}</span>
                    <p>{criterio.criterio}</p>
                    <strong>
                      {criterio.evaluado ? `${criterio.porcentaje}%` : "Sin evaluar"}
                    </strong>
                  </li>
                ))}
            </ul>
          </section>

          <section className="gm-surface gm-important-dates">
            <h3>Fechas importantes</h3>
            <dl>
              {detalle.fechasImportantes.slice(0, 6).map((fecha) => (
                <div key={fecha.id}>
                  <dt>{fecha.etiqueta}</dt>
                  <dd>{formatearFecha(fecha.fecha)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="gm-surface gm-documents-compact">
            <h3>Documentos disponibles</h3>
            {detalle.acceso.completo ? (
              <>
                <p>
                  {detalle.documentos.length > 0
                    ? `${detalle.documentos.length} documentos informados por Mercado Público.`
                    : "Consulta las bases oficiales con el código de la licitación."}
                </p>
                {detalle.urlMercadoPublico && (
                  <a
                    href={detalle.urlMercadoPublico}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ir a Mercado Público
                  </a>
                )}
              </>
            ) : (
              <>
                <p>Los documentos y las bases están disponibles en Premium.</p>
                <button type="button" onClick={onAccionPremium}>
                  Desbloquear documentos
                </button>
              </>
            )}
          </section>
        </aside>
      </div>

      {detalle.acceso.completo ? (
        <section className="gm-recommendation-strip">
          <div className="gm-recommendation-title">
            <strong>Recomendaciones para esta oportunidad</strong>
            <span>
              {diasRestantes === null
                ? "Verifica el plazo oficial"
                : `${diasRestantes} días restantes para postular`}
            </span>
          </div>
          {detalle.recomendaciones.map((recomendacion) => (
            <article key={recomendacion.titulo}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{recomendacion.titulo}</strong>
                <p>{recomendacion.descripcion}</p>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="gm-recommendation-strip gm-recommendation-strip--locked">
          <div className="gm-recommendation-title">
            <strong>Recomendaciones personalizadas</strong>
            <span>Disponibles con Premium</span>
          </div>
          <button type="button" onClick={onAccionPremium}>
            Desbloquear análisis completo
          </button>
        </section>
      )}
    </div>
  );
}
