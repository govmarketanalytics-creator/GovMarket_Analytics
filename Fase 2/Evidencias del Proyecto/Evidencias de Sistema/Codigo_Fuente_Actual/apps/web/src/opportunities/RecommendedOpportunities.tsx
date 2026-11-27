import { useConsultaOportunidades, type MemoriaConsulta } from './useConsultaOportunidades';
import { AvisoConsulta } from './AvisoConsulta';
import { OpportunityCard } from "./OpportunityCard";

interface RecommendedOpportunitiesProps {
  accessToken: string;
  contexto: string;
  memoria: MemoriaConsulta | null;
  onConservar: (m: MemoriaConsulta) => void;
  empresaId: string;
  esPremium: boolean;
  estadoFavoritos: 'cargando' | 'listo' | 'error';
  onReintentarFavoritos: () => void;
  codigosGuardados: ReadonlySet<string>;
  codigoGuardando: string | null;
  onVerDetalle: (codigoExterno: string) => void;
  onVerTodas: () => void;
  onEditarPerfil: () => void;
  onGuardarOportunidad: (codigoExterno: string) => void;
  onSesionExpirada: () => void;
}

export function RecommendedOpportunities({
  accessToken, contexto, memoria, onConservar,
  empresaId,
  esPremium,
  estadoFavoritos,
  onReintentarFavoritos,
  codigosGuardados,
  codigoGuardando,
  onVerDetalle,
  onVerTodas,
  onEditarPerfil,
  onGuardarOportunidad,
  onSesionExpirada,
}: RecommendedOpportunitiesProps) {
  const q = useConsultaOportunidades({ accessToken, empresaId, contexto, memoria, onConservar, onSesionExpirada, recomendadas: true });
  const { region, categoria, orden } = q.borrador;
  const { error, cargando } = q;
  const respuesta = q.respuesta ? { ...q.respuesta, filtrosDisponibles: q.filtros } : null;
  const promedio = respuesta?.resumen.compatibilidadPromedio ?? null;
  const afinidad = promedio === null ? 'Según el perfil de tu empresa'
    : respuesta?.resumen.oportunidadesActivas === 0 ? 'Sin coincidencias en esta búsqueda'
    : promedio >= 80 ? 'Afinidad muy alta con los datos disponibles'
    : promedio >= 60 ? 'Afinidad alta con los datos disponibles'
    : promedio >= 40 ? 'Afinidad media con los datos disponibles'
    : 'Afinidad baja con los datos disponibles';
  const categorias = respuesta?.resumen.distribucionCategorias ?? [];
  const otrasCategorias = categorias.length > 0
    ? Math.max(0, (respuesta?.resumen.oportunidadesActivas ?? 0)
      - categorias.reduce((suma, item) => suma + item.cantidad, 0)) : 0;
  const distribucionCategorias = otrasCategorias > 0 ? [...categorias, {
    categoria: 'Otras categorías', cantidad: otrasCategorias,
    porcentaje: Math.round(otrasCategorias / respuesta!.resumen.oportunidadesActivas * 100),
  }] : categorias;
  const setRegion = (v: string) => { q.setBorrador((f) => ({ ...f, region: v })); q.buscar({ ...q.borrador, region: v }); };
  const setCategoria = (v: string) => { q.setBorrador((f) => ({ ...f, categoria: v })); q.buscar({ ...q.borrador, categoria: v }); };
  const setOrden = q.ordenar;

  return (
    <div className="gm-page gm-recommended-page">
      <header className="gm-page-heading">
        <div>
          <h1>Oportunidades recomendadas para mí ☆</h1>
          <p>
            Oportunidades seleccionadas según el perfil, capacidades y
            preferencias de tu empresa.
          </p>
        </div>
      </header>

      <section className="gm-recommended-metrics">
        <article className="is-green">
          <span>◎</span>
          <div>
            <small>Tu compatibilidad promedio</small>
            <strong>{respuesta ? `${respuesta.resumen.compatibilidadPromedio}%` : "—"}</strong>
            <p>{afinidad}</p>
          </div>
        </article>
        <article className="is-blue">
          <span>↗</span>
          <div>
            <small>Oportunidades para ti</small>
            <strong>{respuesta?.resumen.oportunidadesActivas ?? "—"}</strong>
            <p>activas</p>
          </div>
        </article>
        <article className="is-orange">
          <span>◷</span>
          <div>
            <small>Nuevas para ti esta semana</small>
            <strong>{respuesta?.resumen.nuevasSemana ?? "—"}</strong>
            <p>recién publicadas</p>
          </div>
        </article>
        <article className="is-purple">
          <span>♧</span>
          <div>
            <small>Oportunidades guardadas</small>
            <strong>{!esPremium ? '—' : estadoFavoritos === 'listo'
              ? new Intl.NumberFormat('es-CL').format(codigosGuardados.size)
              : estadoFavoritos === 'cargando' ? '…' : '—'}</strong>
            <p>{!esPremium ? 'Disponible en Premium'
              : estadoFavoritos === 'listo' ? 'Incluye guardadas finalizadas'
              : estadoFavoritos === 'cargando' ? 'Consultando tus guardadas…'
              : 'No pudimos consultar tus guardadas'}</p>
            {esPremium && estadoFavoritos === 'error' && (
              <button type="button" onClick={onReintentarFavoritos}>Reintentar guardadas</button>
            )}
          </div>
        </article>
      </section>

      <section className="gm-recommended-filters">
        <label>
          <span>Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="compatibilidad_desc">Compatibilidad (mayor)</option>
            <option value="cierre_asc">Cierre más próximo</option>
            <option value="fecha_desc">Más recientes</option>
            <option value="monto_desc">Monto mayor</option>
          </select>
        </label>
        <label>
          <span>Región</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Todas las regiones</option>
            {respuesta?.filtrosDisponibles.regiones.map((valor) => (
              <option key={valor}>{valor}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Categoría</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {respuesta?.filtrosDisponibles.categorias.map((valor) => (
              <option key={valor.codigo} value={valor.codigo}>
                {valor.nombre}
              </option>
            ))}
          </select>
        </label>
      </section>

      {respuesta?.perfil?.necesitaOfertasNexus && <div className="gm-feedback" role="status">
        <div><strong>Precisa qué ofrece tu empresa</strong>
          <p>Selecciona servicios o productos específicos para recibir recomendaciones. Tus etiquetas anteriores se conservan.</p>
          <button type="button" onClick={onEditarPerfil}>Configurar mis ofertas</button></div>
      </div>}
      {respuesta?.perfil?.nexusHabilitado && !respuesta.perfil.necesitaOfertasNexus && <p className="gm-query-status">
        Combinamos tus ofertas, etiquetas y palabras clave para priorizar oportunidades, junto con región y monto. Las fichas pendientes de detalle no se puntúan todavía.
      </p>}
      {q.errorFiltros && <p className="gm-query-status" role="status">Los filtros adicionales no se pudieron actualizar. La búsqueda sigue disponible. <button type="button" onClick={q.reintentarFiltros}>Reintentar filtros</button></p>}
      {error && <AvisoConsulta error={error} cargando={cargando} hayResultadosAnteriores={Boolean(q.respuesta)} onReintentar={q.reintentar} />}
      {!error && !respuesta && (
        <div className="gm-feedback">
          <span className="gm-loader" />
          Preparando recomendaciones...
        </div>
      )}

      {cargando && respuesta && <p className="gm-query-status" role="status">Actualizando la última consulta confirmada…</p>}
      {respuesta && (
        <div className="gm-recommended-layout">
          <section className="gm-opportunity-list gm-ranked-list">
            {respuesta.datos.length === 0 ? (
              <div className="gm-feedback">
                Todavía no encontramos recomendaciones para estos filtros.
              </div>
            ) : (
              respuesta.datos.map((oportunidad, indice) => (
                <OpportunityCard
                  key={oportunidad.id}
                  posicion={indice + 1}
                  oportunidad={oportunidad}
                  guardada={codigosGuardados.has(oportunidad.codigoExterno)}
                  guardando={codigoGuardando === oportunidad.codigoExterno}
                  onVerDetalle={onVerDetalle}
                  onGuardar={onGuardarOportunidad}
                />
              ))
            )}
            {respuesta.paginacion.totalPaginas > 1 && <nav className="gm-pagination" aria-label="Paginación de recomendaciones">
              <button type="button" disabled={cargando || q.pagina <= 1} onClick={() => q.setPagina(q.pagina - 1)}>Anterior</button>
              <span>{q.pagina} de {respuesta.paginacion.totalPaginas}</span>
              <button type="button" disabled={cargando || q.pagina >= respuesta.paginacion.totalPaginas} onClick={() => q.setPagina(q.pagina + 1)}>Siguiente</button>
            </nav>}
          </section>

          <aside className="gm-recommended-aside">
            <section className="gm-surface">
              <h3>¿Por qué estas oportunidades?</h3>
              <p>Las recomendamos en base a:</p>
              <ul>
                <li>✓ Perfil y capacidades de tu empresa</li>
                <li>✓ Categorías y palabras clave</li>
                <li>✓ Preferencias comerciales seleccionadas</li>
                <li>✓ Cobertura geográfica y rango de monto</li>
              </ul>
            </section>
            <section className="gm-surface gm-category-distribution">
              <h3>Distribución por categoría</h3>
              {distribucionCategorias.length === 0 ? (
                <p>Sin información suficiente.</p>
              ) : (
                <ul>
                  {distribucionCategorias.map((item) => (
                    <li key={item.categoria}>
                      <span>{item.categoria}</span>
                      <strong>
                        {item.cantidad} ({item.cantidad > 0 && item.porcentaje === 0
                          ? '<1%' : `${item.porcentaje}%`})
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="gm-surface gm-daily-tip">
              <h3>Consejo del día</h3>
              <p>
                Revisa primero las oportunidades nuevas y prepara los
                antecedentes con anticipación.
              </p>
            </section>
            <button
              className="gm-view-all-button"
              type="button"
              onClick={onVerTodas}
            >
              Ver todas las oportunidades
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
