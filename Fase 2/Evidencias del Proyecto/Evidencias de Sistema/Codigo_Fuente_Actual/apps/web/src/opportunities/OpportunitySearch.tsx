import type { FormEvent } from "react";
import { useConsultaOportunidades, type MemoriaConsulta } from './useConsultaOportunidades';
import { AvisoConsulta } from './AvisoConsulta';
import { OpportunityCard } from "./OpportunityCard";
import type { RespuestaOportunidades } from "./types";

interface OpportunitySearchProps {
  accessToken: string;
  contexto: string;
  memoria: MemoriaConsulta | null;
  onConservar: (m: MemoriaConsulta) => void;
  empresaId: string;
  codigosGuardados: ReadonlySet<string>;
  codigoGuardando: string | null;
  onVerDetalle: (codigoExterno: string) => void;
  onGuardarOportunidad: (codigoExterno: string) => void;
  onAccionPremium: () => void;
  onSesionExpirada: () => void;
}

const respuestaInicial: RespuestaOportunidades = {
  datos: [],
  paginacion: { pagina: 1, limite: 10, total: 0, totalPaginas: 0 },
  resumen: {
    compatibilidadPromedio: 0,
    oportunidadesActivas: 0,
    nuevasSemana: 0,
    ultimaActualizacion: null,
    distribucionCategorias: [],
  },
  filtrosDisponibles: { regiones: [], organismos: [], categorias: [] },
};

export function OpportunitySearch({
  accessToken, contexto, memoria, onConservar,
  empresaId,
  codigosGuardados,
  codigoGuardando,
  onVerDetalle,
  onGuardarOportunidad,
  onAccionPremium,
  onSesionExpirada,
}: OpportunitySearchProps) {
  const q = useConsultaOportunidades({ accessToken, empresaId, contexto, memoria, onConservar, onSesionExpirada });
  const { region, categoria, orden, texto, organismo, montoMinimo, montoMaximo, periodo, incluirFinalizadas, horizonteCierre } = q.borrador;
  const { error, cargando, pagina } = q;
  const respuesta = { ...(q.respuesta ?? respuestaInicial), filtrosDisponibles: q.filtros };
  const setRegion = (v: string) => { q.setBorrador((f) => ({ ...f, region: v }));  };
  const setCategoria = (v: string) => { q.setBorrador((f) => ({ ...f, categoria: v }));  };
  const setOrden = q.ordenar;
  const setTexto = (v: string) => q.setBorrador((f) => ({ ...f, texto: v }));
  const setOrganismo = (v: string) => q.setBorrador((f) => ({ ...f, organismo: v }));
  const setMontoMinimo = (v: string) => q.setBorrador((f) => ({ ...f, montoMinimo: v }));
  const setMontoMaximo = (v: string) => q.setBorrador((f) => ({ ...f, montoMaximo: v }));
  const setPeriodo = (v: string) => q.setBorrador((f) => ({ ...f, periodo: v }));
  const setIncluirFinalizadas = (v: boolean) => q.setBorrador((f) => ({ ...f, incluirFinalizadas: v }));
  const limpiar = q.limpiar;
  const cargar = q.setPagina;
  function buscar(evento: FormEvent<HTMLFormElement>) { evento.preventDefault(); q.buscar(); }

  return (
    <div className="gm-page gm-search-page">
      <header className="gm-page-heading">
        <div>
          <h1>Buscador de oportunidades</h1>
          <p>
            Explora todas las licitaciones almacenadas y encuentra nuevas
            alternativas, aunque pertenezcan a otros rubros.
          </p>
        </div>
        <button
          className="gm-outline-button"
          type="button"
          onClick={onAccionPremium}
        >
          ♧ Guardar búsqueda
        </button>
      </header>

      <form className="gm-search-panel" onSubmit={buscar}>
        <div className="gm-search-main-row">
          <label className="gm-search-input">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar oportunidades por palabra clave, ID, organismo o descripción..."
            />
          </label>
          <button className="gm-primary-button" type="submit">
            Buscar
          </button>
        </div>
        <div className="gm-filter-grid">
          <label>
            <span>Categoría</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {respuesta.filtrosDisponibles.categorias.map((opcion) => (
                <option key={opcion.codigo} value={opcion.codigo}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Organismo comprador</span>
            <select
              value={organismo}
              onChange={(e) => setOrganismo(e.target.value)}
            >
              <option value="">Todos los organismos</option>
              {respuesta.filtrosDisponibles.organismos.map((opcion) => (
                <option key={opcion.codigo} value={opcion.codigo}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Región</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Todas las regiones</option>
              {respuesta.filtrosDisponibles.regiones.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Fecha de publicación</span>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="todos">Sin límite de fecha</option>
            </select>
          </label>
          <label>
            <span>Monto mínimo (CLP)</span>
            <input
              type="number"
              min="0"
              value={montoMinimo}
              onChange={(e) => setMontoMinimo(e.target.value)}
              placeholder="Sin mínimo"
            />
          </label>
          <label>
            <span>Monto máximo (CLP)</span>
            <input
              type="number"
              min="0"
              value={montoMaximo}
              onChange={(e) => setMontoMaximo(e.target.value)}
              placeholder="Sin máximo"
            />
          </label>
          <label><span>Tiempo hasta el cierre</span><select value={horizonteCierre} onChange={(e) => q.setBorrador((v) => ({ ...v, horizonteCierre: e.target.value }))}>
            <option value="">Cualquier plazo</option><option value="48h">Próximas 48 horas</option><option value="2a7">De 48 horas a 7 días</option>
            <option value="7a30">De 7 a 30 días</option><option value="30mas">30 días o más</option><option value="7mas">7 días o más</option>
          </select></label>
          <label className="gm-history-filter">
            <input
              type="checkbox"
              checked={incluirFinalizadas}
              onChange={(e) => setIncluirFinalizadas(e.target.checked)}
            />
            <span>Incluir finalizadas o vencidas</span>
          </label>
          <button className="gm-clear-button" type="button" onClick={limpiar}>
            Limpiar filtros
          </button>
        </div>
      </form>

      <div className="gm-results-toolbar">
        <div>
          <strong>
            {!q.respuesta ? "Preparando resultados…" : <>{respuesta.paginacion.total.toLocaleString("es-CL")} oportunidades
            encontradas</>}
          </strong>
          <span>
            Página {respuesta.paginacion.pagina} de{" "}
            {Math.max(1, respuesta.paginacion.totalPaginas)}
          </span>
        </div>
        <label>
          <span>Ordenar por:</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="fecha_desc">Publicación más reciente</option>
            <option value="cierre_asc">Cierre más próximo</option>
            <option value="monto_desc">Monto mayor</option>
            <option value="monto_asc">Monto menor</option>
            <option value="compatibilidad_desc">Compatibilidad (mayor)</option>
          </select>
        </label>
      </div>

      {cargando && (
        <div className="gm-feedback">
          <span className="gm-loader" />
          {q.respuesta ? "Actualizando resultados; se mantiene la última consulta confirmada…" : "Buscando oportunidades…"}
        </div>
      )}
      {q.errorFiltros && <p className="gm-query-status" role="status">Los filtros adicionales no se pudieron actualizar. La búsqueda sigue disponible. <button type="button" onClick={q.reintentarFiltros}>Reintentar filtros</button></p>}
      {error && (
        <AvisoConsulta error={error} cargando={cargando} hayResultadosAnteriores={Boolean(q.respuesta)} onReintentar={q.reintentar} />
      )}
      {!cargando && !error && respuesta.datos.length === 0 && (
        <div className="gm-feedback">
          No encontramos oportunidades con estos filtros.
        </div>
      )}
      {q.respuesta && respuesta.datos.length > 0 && (
        <section className="gm-opportunity-list">
          {respuesta.datos.map((oportunidad) => (
            <OpportunityCard
              key={oportunidad.id}
              oportunidad={oportunidad}
              guardada={codigosGuardados.has(oportunidad.codigoExterno)}
              guardando={codigoGuardando === oportunidad.codigoExterno}
              onVerDetalle={onVerDetalle}
              onGuardar={onGuardarOportunidad}
            />
          ))}
        </section>
      )}

      {respuesta.paginacion.totalPaginas > 1 && (
        <nav className="gm-pagination" aria-label="Paginación">
          <button
            type="button"
            disabled={cargando || pagina <= 1}
            onClick={() => void cargar(pagina - 1)}
          >
            ‹
          </button>
          <span>{pagina}</span>
          <button
            type="button"
            disabled={cargando || pagina >= respuesta.paginacion.totalPaginas}
            onClick={() => void cargar(pagina + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}
