import {
  diasHasta,
  formatearFecha,
  formatearMonto,
  type Oportunidad,
} from "./types";

interface OpportunityCardProps {
  oportunidad: Oportunidad;
  posicion?: number;
  guardada?: boolean;
  guardando?: boolean;
  onVerDetalle: (codigoExterno: string) => void;
  onGuardar: (codigoExterno: string) => void;
}

function iconoCategoria(oportunidad: Oportunidad): string {
  const texto =
    `${oportunidad.nombre} ${oportunidad.categorias.join(" ")} ${oportunidad.clasificacion?.rubros.join(" ") ?? ""}`.toLowerCase();

  if (texto.includes("software") || texto.includes("plataforma")) return "</>";
  if (texto.includes("soporte") || texto.includes("mantención")) return "☊";
  if (texto.includes("seguridad")) return "◇";
  if (texto.includes("nube") || texto.includes("cloud")) return "☁";
  return "↗";
}

export function OpportunityCard({
  oportunidad,
  posicion,
  guardada = false,
  guardando = false,
  onVerDetalle,
  onGuardar,
}: OpportunityCardProps) {
  const dias = diasHasta(oportunidad.fechaCierre);
  const pendiente = oportunidad.nexus?.estado === 'pendiente' || oportunidad.nexus?.estado === 'sin_configurar';

  return (
    <article className="gm-opportunity-card">
      {posicion !== undefined && (
        <span className="gm-opportunity-rank">{posicion}</span>
      )}
      <span className="gm-opportunity-symbol" aria-hidden="true">
        {iconoCategoria(oportunidad)}
      </span>
      <div className="gm-opportunity-copy">
        <div className="gm-opportunity-title-row">
          <h3>{oportunidad.nombre}</h3>
          <span className="gm-status-pill">{oportunidad.estado}</span>
        </div>
        <p>{oportunidad.nombreOrganismo || "Organismo no informado"}</p>
        <small>
          ID: {oportunidad.codigoExterno} · Publicada:{" "}
          {formatearFecha(oportunidad.fechaPublicacion)}
        </small>
        {oportunidad.nexus?.estado === 'coincidencia' && <p className="gm-query-status">{oportunidad.nexus.ofertas[0]?.explicacion}</p>}
        <div className="gm-tag-row">
          {(oportunidad.clasificacion?.etiquetas.length
            ? oportunidad.clasificacion.etiquetas
            : oportunidad.clasificacion?.rubros.length
              ? oportunidad.clasificacion.rubros
              : oportunidad.categorias.length
                ? oportunidad.categorias
                : [oportunidad.tipo || "Sin categoría"]
          )
            .slice(0, 2)
            .map((categoria) => (
              <span key={categoria}>{categoria}</span>
            ))}
        </div>
      </div>
      <div className="gm-card-amount">
        <small>Monto estimado</small>
        <strong>{formatearMonto(oportunidad.montoEstimado)}</strong>
        <span>{oportunidad.moneda || "CLP"}</span>
      </div>
      <div className="gm-card-deadline">
        <small>Cierre de postulaciones</small>
        <strong>{formatearFecha(oportunidad.fechaCierre)}</strong>
        <span>{dias === null ? "Plazo no informado" : `En ${dias} días`}</span>
      </div>
      <div className="gm-score-wrap">
        <div
          className="gm-score-ring"
          style={{
            background: `conic-gradient(#159675 ${oportunidad.porcentajeCompatibilidad}%, #dcece7 0)`,
          }}
        >
          <span>{pendiente ? "—" : `${Math.round(oportunidad.porcentajeCompatibilidad)}%`}</span>
        </div>
        <small>{pendiente ? "Pendiente de evaluación" : "Compatibilidad"}</small>
      </div>
      <div className="gm-card-actions">
        <button
          type="button"
          onClick={() => onVerDetalle(oportunidad.codigoExterno)}
        >
          Ver detalle
        </button>
        <button
          className={`gm-save-button${guardada ? " is-saved" : ""}`}
          type="button"
          aria-label={guardada ? "Quitar de guardadas" : "Guardar oportunidad"}
          title={guardada ? "Quitar de guardadas" : "Guardar oportunidad"}
          disabled={guardando}
          onClick={() => onGuardar(oportunidad.codigoExterno)}
        >
          {guardando ? "…" : guardada ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}
