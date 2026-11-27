import { useEffect, useMemo, useState } from "react";
import { ErrorConsulta, solicitarJson } from "../opportunities/consulta-http";
import { ChileMap } from "./ChileMap";
import { MarketChart } from "./MarketChart";
import { MarketDrilldown } from "./MarketDrilldown";
import type { ObjetivoMercado } from "./MarketDrilldown";
import { MarketNews } from "./MarketNews";
import {
  csvMercado,
  fechaChile,
  filtrosMercadoIniciales,
  montoMercado,
  numeroMercado,
  parametrosMercado,
  porcentajeMercado,
  rangoMercado,
  resumenMercado,
} from "./modeloMercado";
import type { FiltrosAnalisisMercado, RespuestaAnalisisMercado } from "./types";
import "./MarketAnalysis.css";

interface MarketAnalysisProps {
  accessToken: string;
  empresaId: string;
  onSesionExpirada: () => void;
  onVerDetalle: (codigo: string) => void;
  filtrosIniciales?: FiltrosAnalisisMercado;
  onConservarFiltros?: (filtros: FiltrosAnalisisMercado) => void;
}
function IconoMercado({
  tipo,
}: {
  tipo: "procesos" | "monto" | "personas" | "participacion" | "desiertas";
}) {
  const paths = {
    procesos: "M7 3h10v18H7z M10 7h4 M10 11h4 M10 15h3",
    monto: "m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5",
    personas:
      "M10 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M2 21v-3a5 5 0 0 1 10 0v3 M15 5a3 3 0 1 1 0 6 M16 15a5 5 0 0 1 6 5v1",
    participacion:
      "M12 3v9h9 M9 3.5A9 9 0 1 0 20.5 15 M15 3.5A9 9 0 0 1 20.5 9H15z",
    desiertas: "m12 3 10 18H2z M12 9v5 M12 17v1",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[tipo]} />
    </svg>
  );
}
function Variacion({ valor }: { valor: number | null }) {
  return (
    <span className="ma-change">
      {valor === null
        ? "Sin base anterior para comparar"
        : (valor > 0 ? "+" : "") +
          numeroMercado(valor) +
          "% vs. período anterior"}
    </span>
  );
}
const nombreResultado = (v: string) =>
  ({
    adjudicada: "Adjudicadas",
    desierta: "Desiertas",
    pendiente: "Pendientes",
    cerrada_sin_resultado: "Cerradas sin resultado",
    revocada: "Revocadas",
    suspendida: "Suspendidas",
    otro: "Otros",
  })[v] ?? v;

export function MarketAnalysis({
  accessToken,
  empresaId,
  onSesionExpirada,
  onVerDetalle,
  filtrosIniciales,
  onConservarFiltros,
}: MarketAnalysisProps) {
  const [borrador, setBorrador] = useState<FiltrosAnalisisMercado>(
    () => filtrosIniciales ?? filtrosMercadoIniciales(),
  );
  const [aplicados, setAplicados] = useState<FiltrosAnalisisMercado>(
    () => filtrosIniciales ?? filtrosMercadoIniciales(),
  );
  const [snapshot, setSnapshot] = useState<{
    clave: string;
    respuesta: RespuestaAnalisisMercado;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [periodoRapido, setPeriodoRapido] = useState(
    filtrosIniciales ? "" : "90",
  );
  const [grafico, setGrafico] = useState<"monto" | "cantidad">("cantidad");
  const [ordenCompradores, setOrdenCompradores] = useState<
    "cantidad" | "monto"
  >("cantidad");
  const [objetivo, setObjetivo] = useState<ObjetivoMercado | null>(null);
  const [opciones, setOpciones] = useState<
    RespuestaAnalisisMercado["opciones"]
  >({ regiones: [], categorias: [], organismos: [] });
  const [todosProveedores, setTodosProveedores] = useState(false);
  const parametros = parametrosMercado(aplicados);
  const clave = empresaId + ":" + accessToken + ":" + parametros;
  const respuesta = snapshot?.clave === clave ? snapshot.respuesta : null;

  useEffect(() => {
    onConservarFiltros?.(aplicados);
  }, [aplicados, onConservarFiltros]);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    void solicitarJson<RespuestaAnalisisMercado>(
      "/api/v1/empresas/" + empresaId + "/analisis-mercado?" + parametros,
      accessToken,
    )
      .then((r) => {
        if (!vigente) return;
        setSnapshot({ clave, respuesta: r });
        setOpciones((previas) => {
          if (!aplicados.region && !aplicados.organismo && !aplicados.categoria)
            return r.opciones;
          const unir = <T,>(a: T[], b: T[], llave: (v: T) => string): T[] => [
            ...new Map([...a, ...b].map((v) => [llave(v), v])).values(),
          ];
          return {
            regiones: unir(
              previas.regiones,
              r.opciones.regiones,
              (v) => v.codigo,
            ),
            categorias: unir(
              previas.categorias,
              r.opciones.categorias,
              (v) => v.nombre,
            ),
            organismos: unir(
              previas.organismos,
              r.opciones.organismos,
              (v) => v.codigo,
            ),
          };
        });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        if (e instanceof ErrorConsulta && e.estado === 401) onSesionExpirada();
        setError(
          e instanceof ErrorConsulta && e.estado === 403
            ? "No se pudo validar el acceso Premium. Revisa la sesión y el plan de tu empresa."
            : "No se pudo cargar el análisis. Comprueba las fechas y vuelve a intentarlo.",
        );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // La clave representa la empresa, la sesión y todos los filtros aplicados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, revision, onSesionExpirada]);
  const compradores = useMemo(
    () =>
      [...(respuesta?.organismos ?? [])].sort((a, b) =>
        ordenCompradores === "monto"
          ? Number(b.monto ?? -1) - Number(a.monto ?? -1) ||
            b.cantidad - a.cantidad
          : b.cantidad - a.cantidad,
      ),
    [respuesta, ordenCompradores],
  );
  const regionesActivas = [...(respuesta?.regiones.datos ?? [])]
    .filter((r) => r.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);
  function aplicar(f: FiltrosAnalisisMercado) {
    setObjetivo(null);
    setAplicados({ ...f });
    setRevision((v) => v + 1);
  }
  function seleccionarRegion(region: string) {
    const f = { ...aplicados, region };
    setBorrador(f);
    aplicar(f);
  }
  function cambiarAlcance(alcance: FiltrosAnalisisMercado["alcance"]) {
    const f = {
      ...borrador,
      alcance,
      region: undefined,
      categoria: undefined,
      organismo: undefined,
    };
    setBorrador(f);
    setOpciones({ regiones: [], categorias: [], organismos: [] });
    aplicar(f);
  }
  function exportar() {
    if (!respuesta || cargando || error) return;
    const url = URL.createObjectURL(
      new Blob([csvMercado(respuesta)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "GovMarket_analisis_" +
      aplicados.fechaDesde +
      "_" +
      aplicados.fechaHasta +
      ".csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const m = respuesta?.metricas;
  const moneda = aplicados.moneda;
  return (
    <div className="market-analysis-page ma-v2">
      <header className="ma-heading">
        <div>
          <span className="ma-eyebrow">INTELIGENCIA COMERCIAL</span>
          <h1>Análisis de mercado</h1>
          <p>Descubre dónde competir y cómo evoluciona tu sector.</p>
        </div>
        <button
          className="ma-button"
          type="button"
          disabled={!respuesta || cargando || !!error}
          onClick={exportar}
        >
          Exportar informe CSV
        </button>
      </header>
      <form
        className="ma-filters"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar(borrador);
        }}
      >
        <div
          className="ma-scope"
          role="group"
          aria-label="Alcance del análisis"
        >
          <button
            type="button"
            aria-pressed={aplicados.alcance === "empresa"}
            onClick={() => cambiarAlcance("empresa")}
          >
            Mi sector
          </button>
          <button
            type="button"
            aria-pressed={aplicados.alcance === "mercado"}
            onClick={() => cambiarAlcance("mercado")}
          >
            Todo el mercado
          </button>
        </div>
        <label>
          Período rápido
          <select
            value={periodoRapido}
            onChange={(e) => {
              setPeriodoRapido(e.target.value);
              if (e.target.value)
                setBorrador((v) => ({
                  ...v,
                  ...rangoMercado(Number(e.target.value)),
                }));
            }}
          >
            <option value="">Personalizado</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Últimos 12 meses</option>
            <option value="730">Últimos 24 meses</option>
          </select>
        </label>
        <label>
          Desde
          <input
            required
            type="date"
            value={borrador.fechaDesde}
            max={borrador.fechaHasta}
            onChange={(e) => {
              setPeriodoRapido("");
              setBorrador((v) => ({ ...v, fechaDesde: e.target.value }));
            }}
          />
        </label>
        <label>
          Hasta
          <input
            required
            type="date"
            value={borrador.fechaHasta}
            min={borrador.fechaDesde}
            onChange={(e) => {
              setPeriodoRapido("");
              setBorrador((v) => ({ ...v, fechaHasta: e.target.value }));
            }}
          />
        </label>
        <label>
          Región del comprador
          <select
            value={borrador.region ?? ""}
            onChange={(e) =>
              setBorrador((v) => ({
                ...v,
                region: e.target.value || undefined,
              }))
            }
          >
            <option value="">Todas las regiones</option>
            {opciones.regiones.map((r) => (
              <option value={r.nombre} key={r.codigo}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select
            value={borrador.categoria ?? ""}
            onChange={(e) =>
              setBorrador((v) => ({
                ...v,
                categoria: e.target.value || undefined,
              }))
            }
          >
            <option value="">Todas las categorías</option>
            {opciones.categorias.map((c, i) => (
              <option key={c.nombre + i} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Comprador
          <select
            value={borrador.organismo ?? ""}
            onChange={(e) =>
              setBorrador((v) => ({
                ...v,
                organismo: e.target.value || undefined,
              }))
            }
          >
            <option value="">Todos los compradores</option>
            {opciones.organismos.map((o) => (
              <option key={o.codigo} value={o.nombre}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Moneda de montos
          <select
            value={borrador.moneda}
            onChange={(e) =>
              setBorrador((v) => ({
                ...v,
                moneda: e.target.value as FiltrosAnalisisMercado["moneda"],
              }))
            }
          >
            <option value="CLP">CLP · Pesos</option>
            <option value="CLF">UF</option>
            <option value="UTM">UTM</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <div className="ma-filter-actions">
          <button
            className="ma-button"
            type="button"
            onClick={() => {
              const f = filtrosMercadoIniciales();
              setPeriodoRapido("90");
              setBorrador(f);
              aplicar(f);
            }}
          >
            Limpiar
          </button>
          <button
            className="ma-button ma-primary"
            type="submit"
            disabled={cargando}
          >
            Aplicar
          </button>
        </div>
      </form>
      <p className="ma-selection">
        Selección activa: {fechaChile(aplicados.fechaDesde)} a{" "}
        {fechaChile(aplicados.fechaHasta)} ·{" "}
        {aplicados.alcance === "empresa" ? "Mi sector" : "Todo el mercado"}
        {aplicados.region ? " · " + aplicados.region : ""}
        {aplicados.categoria ? " · " + aplicados.categoria : ""}
        {aplicados.organismo ? " · " + aplicados.organismo : ""} · Montos en{" "}
        {moneda}. Los conteos incluyen todas las monedas.
      </p>
      {cargando && (
        <div className="ma-status" role="status">
          Actualizando el análisis…
        </div>
      )}
      {error && (
        <div className="ma-alert" role="alert">
          {error}{" "}
          {respuesta &&
            "Los datos visibles son de la última consulta y no están revalidados."}
          <button
            className="ma-button"
            type="button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {respuesta && m && (
        <>
          {aplicados.alcance === "empresa" && !respuesta.perfil.configurado && (
            <div className="ma-alert">
              Tu perfil no tiene categorías ni términos suficientes para
              identificar tu sector. Puedes configurarlo en Mi empresa o
              consultar Todo el mercado.
            </div>
          )}
          <section className="ma-kpis" aria-label="Indicadores del mercado">
            <article>
              <span className="ma-kpi-icon">
                <IconoMercado tipo="procesos" />
              </span>
              <h2>Licitaciones publicadas</h2>
              <strong>{numeroMercado(m.publicadas)}</strong>
              <Variacion valor={respuesta.comparacion.publicadas.variacion} />
            </article>
            <article>
              <span className="ma-kpi-icon is-gold">
                <IconoMercado tipo="monto" />
              </span>
              <h2>Monto adjudicado · {moneda}</h2>
              <strong className="ma-money">
                {montoMercado(m.montoAdjudicado, moneda)}
              </strong>
              <Variacion valor={respuesta.comparacion.monto.variacion} />
              <small>
                {numeroMercado(m.conMonto)} procesos con importes completos
              </small>
            </article>
            <article>
              <span className="ma-kpi-icon is-violet">
                <IconoMercado tipo="personas" />
              </span>
              <h2>Mediana de oferentes</h2>
              <strong>
                {m.medianaOferentes === null
                  ? "Sin datos"
                  : numeroMercado(m.medianaOferentes)}
              </strong>
              <small>
                Base: {numeroMercado(m.conOferentes)} procesos cerrados con
                número informado
              </small>
            </article>
            <article>
              <span className="ma-kpi-icon">
                <IconoMercado tipo="participacion" />
              </span>
              <h2>Con 2 o menos oferentes</h2>
              <strong>
                {porcentajeMercado(m.porcentajeBajaParticipacion)}
              </strong>
              <small>
                {numeroMercado(m.bajaParticipacion)} de{" "}
                {numeroMercado(m.conOferentes)} procesos informados
              </small>
            </article>
            <article>
              <span className="ma-kpi-icon is-rose">
                <IconoMercado tipo="desiertas" />
              </span>
              <h2>Licitaciones desiertas</h2>
              <strong>{porcentajeMercado(m.tasaDesiertas)}</strong>
              <small>
                {numeroMercado(m.desiertas)} de{" "}
                {numeroMercado(m.adjudicadas + m.desiertas)} adjudicadas o
                desiertas
              </small>
            </article>
          </section>
          <section className="ma-insight">
            <span className="ma-insight-star" aria-hidden="true">
              ✧
            </span>
            <div>
              <h2>Lectura del mercado</h2>
              <p>{resumenMercado(respuesta)}</p>
            </div>
            <button
              className="ma-button"
              type="button"
              disabled={!m.publicadas}
              onClick={() =>
                setObjetivo({ nombre: "Licitaciones de la selección" })
              }
            >
              Ver licitaciones
            </button>
          </section>
          <div className="ma-grid ma-grid-main">
            <section className="ma-card">
              <div className="ma-card-heading">
                <div>
                  <h2>Evolución del mercado</h2>
                  <p>Cohorte por fecha de publicación</p>
                </div>
                <div
                  className="ma-tabs"
                  role="group"
                  aria-label="Medida del gráfico"
                >
                  <button
                    type="button"
                    aria-pressed={grafico === "cantidad"}
                    onClick={() => setGrafico("cantidad")}
                  >
                    Publicaciones
                  </button>
                  <button
                    type="button"
                    aria-pressed={grafico === "monto"}
                    onClick={() => setGrafico("monto")}
                  >
                    Monto adjudicado
                  </button>
                </div>
              </div>
              <p className="ma-note">
                Tramos de {respuesta.periodoAnterior.diasPorTramo} días ·
                Anterior: {fechaChile(respuesta.periodoAnterior.fechaDesde)} a{" "}
                {fechaChile(respuesta.periodoAnterior.fechaHasta)}
                {grafico === "monto" ? " · Montos en " + moneda : ""}
              </p>
              <MarketChart respuesta={respuesta} modo={grafico} />
              <p className="ma-note">
                Los montos corresponden a adjudicaciones de estas licitaciones.
                No representan gasto por fecha de adjudicación.
              </p>
            </section>
            <section className="ma-card">
              <div className="ma-card-heading">
                <div>
                  <h2>Actividad por región</h2>
                  <p>Ubicación del comprador</p>
                </div>
              </div>
              <div className="ma-map-layout">
                <ChileMap
                  regiones={respuesta.regiones.datos}
                  regionSeleccionada={aplicados.region}
                  onSeleccionar={seleccionarRegion}
                  compacto
                />
                <ol className="ma-regions">
                  {regionesActivas.slice(0, 4).map((r) => (
                    <li key={r.codigo}>
                      <button
                        type="button"
                        onClick={() => seleccionarRegion(r.nombre)}
                      >
                        <span>{r.nombre}</span>
                        <b>{porcentajeMercado(r.porcentaje)}</b>
                      </button>
                      <div className="ma-track">
                        <i style={{ width: (r.porcentaje ?? 0) + "%" }} />
                      </div>
                      <small>
                        {numeroMercado(r.cantidad)} procesos ·{" "}
                        {montoMercado(r.monto, moneda)}
                      </small>
                    </li>
                  ))}
                  {!regionesActivas.length && (
                    <li>Sin regiones identificadas para esta selección.</li>
                  )}
                </ol>
              </div>
              <p className="ma-note">
                Mapa esquemático: verde oscuro, 11 o más; turquesa, 1 a 10;
                gris, sin registros. Sin región reconocida:{" "}
                {numeroMercado(respuesta.regiones.sinRegion)}.
              </p>
              {aplicados.region && (
                <button
                  className="ma-text-button"
                  type="button"
                  onClick={() => {
                    const f = { ...aplicados, region: undefined };
                    setBorrador(f);
                    aplicar(f);
                  }}
                >
                  Quitar filtro regional
                </button>
              )}
            </section>
          </div>
          <div className="ma-grid">
            <section className="ma-card">
              <div className="ma-card-heading">
                <div>
                  <h2>Principales compradores</h2>
                  <p>Explora sus procesos y actividad</p>
                </div>
                <div
                  className="ma-tabs"
                  role="group"
                  aria-label="Orden de compradores"
                >
                  <button
                    type="button"
                    aria-pressed={ordenCompradores === "cantidad"}
                    onClick={() => setOrdenCompradores("cantidad")}
                  >
                    Procesos
                  </button>
                  <button
                    type="button"
                    aria-pressed={ordenCompradores === "monto"}
                    onClick={() => setOrdenCompradores("monto")}
                  >
                    Monto
                  </button>
                </div>
              </div>
              <ol className="ma-buyers">
                {compradores.slice(0, 5).map((o, i) => (
                  <li key={(o.codigo ?? "") + o.nombre}>
                    <span className="ma-rank">{i + 1}</span>
                    <div>
                      <button
                        className="ma-entity"
                        type="button"
                        disabled={o.nombre === "Comprador no informado"}
                        onClick={() =>
                          setObjetivo({ nombre: o.nombre, organismo: o.nombre })
                        }
                      >
                        {o.nombre}
                      </button>
                      <div className="ma-track">
                        <i
                          style={{
                            width:
                              (ordenCompradores === "monto"
                                ? Math.max(0, Number(o.monto ?? 0)) /
                                  Math.max(
                                    1,
                                    ...compradores.map((v) =>
                                      Number(v.monto ?? 0),
                                    ),
                                  )
                                : o.cantidad /
                                  Math.max(
                                    1,
                                    ...compradores.map((v) => v.cantidad),
                                  )) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                      <p className="ma-note">
                        {numeroMercado(o.cantidad)} procesos ·{" "}
                        {numeroMercado(o.adjudicadas)} adjudicados
                      </p>
                    </div>
                    <strong>{montoMercado(o.monto, moneda)}</strong>
                  </li>
                ))}
              </ol>
              {!compradores.length && (
                <div className="ma-empty">
                  No hay compradores para esta selección.
                </div>
              )}
              <p className="ma-note">
                Hasta 30 compradores en el informe. Los importes se suman solo
                en {moneda}.
              </p>
            </section>
            <section className="ma-card">
              <div className="ma-card-heading">
                <div>
                  <h2>Competencia y concentración</h2>
                  <p>Proveedores con adjudicaciones identificadas</p>
                </div>
              </div>
              {!respuesta.proveedores.length ? (
                <div className="ma-empty">
                  No hay adjudicaciones con proveedor, RUT e importes completos
                  en {moneda} para el período. Puedes ampliar las fechas.
                </div>
              ) : (
                <div
                  className="ma-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Proveedores adjudicados"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Proveedor</th>
                        <th>Participación</th>
                        <th>Procesos</th>
                        <th>Monto {moneda}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respuesta.proveedores
                        .slice(0, todosProveedores ? 10 : 5)
                        .map((p) => (
                          <tr key={p.rut}>
                            <td>
                              <button
                                className="ma-entity"
                                type="button"
                                onClick={() =>
                                  setObjetivo({
                                    nombre: p.nombre,
                                    rutProveedor: p.rut,
                                  })
                                }
                              >
                                {p.nombre}
                              </button>
                              <small>{p.rut}</small>
                            </td>
                            <td>{porcentajeMercado(p.participacion)}</td>
                            <td>{numeroMercado(p.adjudicaciones)}</td>
                            <td>{montoMercado(p.monto, moneda)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="ma-soft-note">
                Base identificada:{" "}
                {montoMercado(respuesta.proveedoresBase.monto, moneda)} ·{" "}
                {numeroMercado(respuesta.proveedoresBase.cantidad)} proveedores.
                La participación corresponde a esta base.
              </div>
              {respuesta.proveedores.length > 5 && (
                <button
                  className="ma-text-button"
                  type="button"
                  onClick={() => setTodosProveedores((v) => !v)}
                >
                  {todosProveedores
                    ? "Ver cinco proveedores"
                    : "Ver hasta diez proveedores"}
                </button>
              )}
            </section>
          </div>
          <details className="ma-card ma-more">
            <summary>Más detalles del mercado</summary>
            <div className="ma-grid ma-extra">
              <section>
                <h2>Categorías con mayor actividad</h2>
                <ul className="ma-simple-list">
                  {respuesta.categorias.map((c, i) => (
                    <li key={(c.codigo ?? "") + i}>
                      <button
                        className="ma-entity"
                        type="button"
                        onClick={() =>
                          setObjetivo({ nombre: c.nombre, categoria: c.nombre })
                        }
                      >
                        {c.nombre.split("/").at(-1)?.trim()}
                      </button>
                      <strong>{numeroMercado(c.cantidad)}</strong>
                    </li>
                  ))}
                </ul>
                <p className="ma-note">
                  Un proceso puede aparecer en varias categorías. No se suman
                  como un total único.
                </p>
              </section>
              <section>
                <h2>Resultado de los procesos</h2>
                <ul className="ma-simple-list">
                  {respuesta.resultados.map((e) => (
                    <li key={e.clasificacion}>
                      <span>{nombreResultado(e.clasificacion)}</span>
                      <strong>{numeroMercado(e.cantidad)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2>Tipos de proceso</h2>
                <ul className="ma-simple-list">
                  {respuesta.distribucionTipos.map((t) => (
                    <li key={t.tipo}>
                      <span>{t.tipo}</span>
                      <strong>{numeroMercado(t.cantidad)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </details>
          <section className="ma-card ma-quality">
            <div>
              <span className="ma-eyebrow">TRAZABILIDAD DE LOS DATOS</span>
              <h2>Cobertura de esta selección</h2>
            </div>
            <div className="ma-quality-grid">
              <p>
                <strong>
                  {numeroMercado(respuesta.cobertura.conDetalle)} /{" "}
                  {numeroMercado(m.publicadas)}
                </strong>
                <span>Con detalle descargado</span>
              </p>
              <p>
                <strong>
                  {numeroMercado(respuesta.cobertura.conResultado)} /{" "}
                  {numeroMercado(m.publicadas)}
                </strong>
                <span>Con análisis de resultado</span>
              </p>
              <p>
                <strong>{numeroMercado(m.conOferentes)}</strong>
                <span>Cerrados con oferentes informados</span>
              </p>
              <p>
                <strong>{numeroMercado(m.conMonto)}</strong>
                <span>Con importes completos en {moneda}</span>
              </p>
            </div>
            <p className="ma-note">
              Última sincronización de detalle:{" "}
              {fechaChile(respuesta.cobertura.ultimaSincronizacion, true)}.
              Cálculo generado: {fechaChile(respuesta.generadoEn, true)}.
              Cobertura de registros guardados; no acredita el universo completo
              de Mercado Público.
            </p>
            <details>
              <summary>Cómo se calculan los indicadores</summary>
              <ul className="ma-methodology">
                {respuesta.metodologia.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}
      <MarketNews
        accessToken={accessToken}
        empresaId={empresaId}
        onSesionExpirada={onSesionExpirada}
      />
      <footer className="ma-footer">
        <span>
          Fuente: Dirección ChileCompra · Datos almacenados en GovMarket
        </span>
        <span>Períodos en hora de Chile · Sin conversión de monedas</span>
      </footer>
      {objetivo && (
        <MarketDrilldown
          objetivo={objetivo}
          filtros={aplicados}
          accessToken={accessToken}
          empresaId={empresaId}
          onCerrar={() => setObjetivo(null)}
          onVerDetalle={onVerDetalle}
          onSesionExpirada={onSesionExpirada}
        />
      )}
    </div>
  );
}
