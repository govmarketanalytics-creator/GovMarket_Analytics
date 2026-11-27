import { useEffect, useId, useRef, useState } from "react";
import { ErrorConsulta, solicitarJson } from "../opportunities/consulta-http";
import { fechaChile, numeroMercado, parametrosMercado } from "./modeloMercado";
import type { FiltrosAnalisisMercado, LicitacionesAnalisis } from "./types";

export interface ObjetivoMercado {
  nombre: string;
  organismo?: string;
  categoria?: string;
  region?: string;
  rutProveedor?: string;
}
export function MarketDrilldown({
  objetivo,
  filtros,
  accessToken,
  empresaId,
  onCerrar,
  onVerDetalle,
  onSesionExpirada,
}: {
  objetivo: ObjetivoMercado;
  filtros: FiltrosAnalisisMercado;
  accessToken: string;
  empresaId: string;
  onCerrar: () => void;
  onVerDetalle: (codigo: string) => void;
  onSesionExpirada: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useId();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<{
    clave: string;
    datos: LicitacionesAnalisis;
  } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const seleccion = {
    ...filtros,
    ...(objetivo.organismo ? { organismo: objetivo.organismo } : {}),
    ...(objetivo.categoria ? { categoria: objetivo.categoria } : {}),
    ...(objetivo.region ? { region: objetivo.region } : {}),
  };
  const q = new URLSearchParams(parametrosMercado(seleccion));
  q.set("pagina", String(pagina));
  q.set("limite", "10");
  if (objetivo.rutProveedor) q.set("rutProveedor", objetivo.rutProveedor);
  const clave = empresaId + ":" + q.toString() + ":" + accessToken;
  const datos = estado?.clave === clave ? estado.datos : null;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const d = dialogo.current;
    d?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);
  useEffect(() => {
    let vigente = true;
    setError(false);
    void solicitarJson<LicitacionesAnalisis>(
      "/api/v1/empresas/" +
        empresaId +
        "/analisis-mercado/licitaciones?" +
        q.toString(),
      accessToken,
    )
      .then((r) => {
        if (vigente) setEstado({ clave, datos: r });
      })
      .catch((e: unknown) => {
        if (vigente) {
          setError(true);
          if (e instanceof ErrorConsulta && e.estado === 401)
            onSesionExpirada();
        }
      });
    return () => {
      vigente = false;
    };
    // La clave incluye todos los parámetros de selección y la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, revision, onSesionExpirada]);
  return (
    <dialog
      className="ma-dialog"
      ref={dialogo}
      aria-labelledby={titulo}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="ma-dialog-inner">
        <div className="ma-card-heading">
          <div>
            <span className="ma-eyebrow">PROCESOS DE LA SELECCIÓN</span>
            <h2 id={titulo}>{objetivo.nombre}</h2>
          </div>
          <button
            className="ma-button"
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
          >
            Cerrar
          </button>
        </div>
        <p className="ma-note">
          Publicadas entre {fechaChile(filtros.fechaDesde)} y{" "}
          {fechaChile(filtros.fechaHasta)} ·{" "}
          {filtros.alcance === "empresa" ? "Tu sector" : "Todo el mercado"}
          {objetivo.rutProveedor
            ? " · Solo adjudicaciones con importes completos en " +
              filtros.moneda
            : ""}
        </p>
        {error ? (
          <div className="ma-empty" role="alert">
            No se pudieron cargar los procesos.
            <button
              className="ma-button"
              type="button"
              onClick={() => setRevision((v) => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : !datos ? (
          <div className="ma-empty" role="status">
            Cargando procesos…
          </div>
        ) : (
          <>
            <p>{numeroMercado(datos.total)} procesos guardados</p>
            <ul className="ma-processes">
              {datos.datos.map((p) => (
                <li key={p.codigo}>
                  <div>
                    <span className="ma-pill">{p.estado}</span>
                    <small>{p.codigo}</small>
                  </div>
                  <h3>{p.nombre}</h3>
                  <p>
                    Publicada: {fechaChile(p.fechaPublicacion)} · Cierre:{" "}
                    {fechaChile(p.fechaCierre)}
                  </p>
                  <button
                    type="button"
                    className="ma-text-button"
                    onClick={() => onVerDetalle(p.codigo)}
                  >
                    Ver ficha
                  </button>
                </li>
              ))}
            </ul>
            {!datos.total && (
              <div className="ma-empty">
                No hay procesos para esta selección.
              </div>
            )}
            <nav className="ma-pagination" aria-label="Páginas de procesos">
              <button
                className="ma-button"
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </button>
              <span>
                Página {pagina} de{" "}
                {Math.max(1, Math.ceil(datos.total / datos.limite))}
              </span>
              <button
                className="ma-button"
                type="button"
                disabled={pagina * datos.limite >= datos.total}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </nav>
          </>
        )}
      </div>
    </dialog>
  );
}
