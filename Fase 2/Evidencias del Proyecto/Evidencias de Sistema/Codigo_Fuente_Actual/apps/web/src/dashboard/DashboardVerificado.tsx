import { useState, type ReactNode } from 'react';
import { ChileMap } from '../market-analysis/ChileMap';
import { favoritosVigentesDashboard, type FavoritoDashboard, type ResumenDashboard } from './dashboardVerificado.types';
import { coberturaInicio, etiquetaCategoria, horizontesValidos, numeroInicio as numero, porcentajeInicio, type FiltroInicio } from './modeloInicio';
import './DashboardVerificado.css';

interface Props {
  resumen: ResumenDashboard; esPremium: boolean; favoritos: FavoritoDashboard[];
  estadoFavoritos: 'cargando' | 'listo' | 'error';
  onVerDetalle: (codigo: string) => void; onExplorar: (filtro?: FiltroInicio) => void;
  onEditarPerfil: () => void; onPremium: () => void; onActualizar: () => void; onReintentarFavoritos: () => void;
}
const fecha = (f: string) => new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(f));
const colores = ['#df9149', '#7b98d1', '#159b87', '#c5e1db'];
function Icono({ tipo }: { tipo: 'catalogo' | 'reloj' | 'calendario' | 'estrella' }) {
  const trazos = { catalogo: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4', reloj: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    calendario: 'M5 5h14v15H5z M8 3v4 M16 3v4 M5 10h14 M9 14h2 M14 14h2', estrella: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z' };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={trazos[tipo]} /></svg>;
}
function Indicador({ icono, valor, titulo, detalle, accion, clase = '' }: {
  icono: 'catalogo' | 'reloj' | 'calendario' | 'estrella'; valor: ReactNode; titulo: string; detalle: string; accion: () => void; clase?: string;
}) {
  return <button type="button" className={`inicio-kpi ${clase}`} onClick={accion}><span className="inicio-icon"><Icono tipo={icono} /></span>
    <span><small>{titulo}</small><strong>{valor}</strong><span className="inicio-kpi-detail">{detalle}</span></span></button>;
}
function Encabezado({ titulo, subtitulo, etiqueta }: { titulo: string; subtitulo: string; etiqueta?: string }) {
  return <header className="inicio-card-heading"><div><h2>{titulo}</h2><p>{subtitulo}</p></div>{etiqueta && <span className="inicio-chip">{etiqueta}</span>}</header>;
}
function Preparacion({ titulo, accion }: { titulo: string; accion: () => void }) {
  return <div className="inicio-preparacion"><h3>{titulo}</h3><p>Este cuadro se habilita al completar la cobertura necesaria. Puedes seguir explorando el catálogo completo.</p>
    <button className="inicio-link" type="button" onClick={accion}>Explorar oportunidades</button></div>;
}

export function DashboardVerificado({ resumen: r, esPremium, favoritos, estadoFavoritos,
  onVerDetalle, onExplorar, onEditarPerfil, onPremium, onActualizar, onReintentarFavoritos }: Props) {
  const [codigoRegion, setCodigoRegion] = useState('');
  const premium = esPremium && r.acceso.premium;
  const total = r.metricas.oportunidadesActivas;
  const guardadas = favoritosVigentesDashboard(favoritos, r.generadoEn);
  const sieteMas = Math.max(0, total - r.metricas.cierranSemana);
  const base = (n: number | null) => `Base: ${numero(n ?? 0)} de ${numero(total)} procesos`;
  const ranking = r.organismos.slice(0, 5), categorias = r.distribucionCategorias.slice(0, 5);
  const region = r.regiones.find((v) => v.codigo === codigoRegion) ?? r.regiones[0];
  const explorar = () => onExplorar();
  const binsValidos = horizontesValidos(r);
  let acumulado = 0;

  return <div className="verified-dashboard inicio-v2">
    <p className="inicio-intro">Prioriza tus próximos pasos con el catálogo vigente de Mercado Público.</p>
    <section className={`inicio-kpis${premium ? '' : ' is-basic'}`} aria-label="Indicadores operativos">
      <Indicador icono="catalogo" valor={numero(total)} titulo="Oportunidades en plazo" detalle="Publicadas y con cierre vigente" accion={explorar} />
      <Indicador icono="reloj" valor={numero(r.metricas.cierran48Horas)} titulo="Cierran en 48 horas"
        detalle={`${porcentajeInicio(r.metricas.cierran48Horas, total)} del catálogo · revisa tus plazos`} clase="is-urgente" accion={() => onExplorar({ horizonteCierre: '48h' })} />
      {premium && <>
        <Indicador icono="calendario" valor={numero(sieteMas)} titulo="Con 7 días o más"
          detalle={`${porcentajeInicio(sieteMas, total)} del catálogo · tiempo para preparar`} accion={() => onExplorar({ horizonteCierre: '7mas' })} />
        <Indicador icono="estrella" valor={estadoFavoritos === 'listo' ? numero(guardadas.length) : estadoFavoritos === 'cargando' ? '…' : 'Revisar'}
          titulo="Tus guardadas en plazo" detalle="Tu lista corta · no son postulaciones" clase="is-guardadas"
          accion={() => { if (estadoFavoritos === 'error') onReintentarFavoritos(); else document.getElementById('inicio-lista-corta')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
      </>}
    </section>
    {!premium ? <section className="inicio-upgrade"><h2>Un espacio para preparar tu próxima decisión</h2>
      <p>Explora todas las oportunidades. Premium incorpora la agenda, tus guardadas y una lectura de compradores, categorías y regiones.</p>
      {esPremium ? <><p>Estamos verificando el acceso de tu empresa. No necesitas volver a pagar.</p><button type="button" onClick={onActualizar}>Revalidar acceso</button></> :
        <button type="button" onClick={onPremium}>Ver planes Premium</button>}
    </section> : <>
      <section className="inicio-main-grid">
        <article className="inicio-card inicio-plazos">
          <Encabezado titulo="¿Cuánto tiempo tienes para preparar una oferta?" subtitulo="Organiza tu revisión según los próximos cierres." etiqueta="Catálogo completo" />
          {total > 0 && binsValidos ? <>
            <div className="inicio-donut-layout"><div className="inicio-donut">
              <svg viewBox="0 0 220 220" role="img" aria-label={`Plazos de cierre de ${numero(total)} oportunidades. Tramos excluyentes.`}>
                <circle cx="110" cy="110" r="84" className="inicio-ring-base" />
                {r.horizonteCierres.map((h, i) => {
                  const tramo = h.cantidad / total * 100, antes = acumulado; acumulado += tramo;
                  return <circle key={h.clave} cx="110" cy="110" r="84" fill="none" pathLength="100" stroke={colores[i]} strokeWidth="23"
                    strokeDasharray={`${tramo} ${100 - tramo}`} strokeDashoffset={-antes} transform="rotate(-90 110 110)" />;
                })}
                <text x="110" y="109" className="inicio-donut-value" textAnchor="middle">{numero(total)}</text>
                <text x="110" y="132" className="inicio-donut-label" textAnchor="middle">en plazo</text>
              </svg>
            </div><ul className="inicio-donut-legend">{r.horizonteCierres.map((h, i) => <li key={h.clave}>
              <button type="button" onClick={() => onExplorar({ horizonteCierre: h.clave as FiltroInicio['horizonteCierre'] })}>
                <i style={{ background: colores[i] }} /><span>{h.etiqueta}</span><strong>{numero(h.cantidad)}</strong><small>{porcentajeInicio(h.cantidad, total)}</small>
              </button></li>)}</ul></div>
            <div className="inicio-insight"><span className="inicio-insight-dot" />
              <p><strong>{numero(sieteMas)} procesos</strong> tienen siete días o más hasta el cierre. Compara requisitos y capacidad de entrega antes de elegir.</p>
              <button type="button" onClick={() => onExplorar({ horizonteCierre: '7mas' })}>Explorar con tiempo</button></div>
          </> : <Preparacion titulo={total ? 'Agenda en preparación' : 'Prepara tu próxima búsqueda'} accion={explorar} />}
          <p className="inicio-base">Base: {numero(total)} procesos. Tramos excluyentes desde el corte. No es una recomendación de compatibilidad ni una probabilidad de ganar.</p>
        </article>
        <article className="inicio-card inicio-compradores">
          <Encabezado titulo="¿Quiénes están comprando?" subtitulo="Compradores con más oportunidades vigentes." etiqueta={coberturaInicio(r, r.calidad.baseCompradores) ? `${numero(r.metricas.organismosCompradores ?? 0)} compradores` : undefined} />
          {coberturaInicio(r, r.calidad.baseCompradores) && ranking.length ? <>
            <ol className="inicio-ranking">{ranking.map((o, i) => <li key={o.codigo}>
              <button type="button" onClick={() => onExplorar({ codigoOrganismo: o.codigo })} title={o.nombre}>
                <span className="inicio-rank-position">{i + 1}</span><span className="inicio-ranking-name">{o.nombre}</span><strong>{numero(o.cantidad)}</strong>
                <span className="inicio-rank-track"><i style={{ width: `${o.cantidad / Math.max(...ranking.map((v) => v.cantidad), 1) * 100}%` }}><b /></i></span>
              </button></li>)}</ol>
            <p className="inicio-ranking-note">{numero(ranking.reduce((n, o) => n + o.cantidad, 0))} procesos en estos {ranking.length} compradores. Longitud relativa al mayor del ranking.</p>
            <p className="inicio-base">{base(r.calidad.baseCompradores)} con comprador identificado. Agrupación por código; no es un ranking por dinero ni por adjudicaciones.</p>
          </> : <Preparacion titulo="Compradores del catálogo en preparación" accion={explorar} />}
        </article>
      </section>
      <section className="inicio-secondary-grid">
        <article className="inicio-card inicio-categorias">
          <Encabezado titulo="¿Qué se está solicitando?" subtitulo="Categorías con mayor presencia en el catálogo." />
          {coberturaInicio(r, r.calidad.baseCategorias) && categorias.length ? <>
            <ul className="inicio-category-bars">{categorias.map((c, i) => <li key={c.codigo}>
              <button type="button" title={c.categoria} onClick={() => onExplorar({ codigoCategoria: c.codigo })}>
                <span>{etiquetaCategoria(c.categoria)}</span><strong>{numero(c.cantidad)}</strong>
                <span className="inicio-category-track"><i style={{ width: `${c.cantidad / Math.max(...categorias.map((v) => v.cantidad), 1) * 100}%`, opacity: 1 - i * .12 }} /></span>
              </button></li>)}</ul>
            <p className="inicio-base">{base(r.calidad.baseCategorias)} con categoría identificada. Un proceso puede aparecer en varias categorías. Hasta cinco; barras relativas a la mayor.</p>
          </> : <Preparacion titulo="Clasificación del catálogo en preparación" accion={explorar} />}
          <button className="inicio-link" type="button" onClick={explorar}>Explorar todas las categorías</button>
        </article>
        <article className="inicio-card inicio-territorio">
          <Encabezado titulo="¿Dónde están los compradores?" subtitulo="Explora la actividad por región del comprador." />
          {coberturaInicio(r, r.calidad.baseRegiones) && region ? <>
            <div className="inicio-map-layout"><ChileMap compacto regionSeleccionada={region.nombre}
              onSeleccionar={(nombre) => setCodigoRegion(r.regiones.find((v) => v.nombre === nombre)?.codigo ?? '')}
              regiones={r.regiones.map((v) => ({ ...v, nivel: v.cantidad <= 10 ? 'baja' as const : 'alta' as const }))} unidadConteo="procesos con región publicada" />
              <div className="inicio-region-detail"><label htmlFor="inicio-region">Región del comprador</label>
                <select id="inicio-region" value={region.codigo} onChange={(e) => setCodigoRegion(e.target.value)}>{r.regiones.map((v) => <option key={v.codigo} value={v.codigo}>{v.nombre}</option>)}</select>
                <strong>{numero(region.cantidad)}</strong><span>oportunidades en plazo</span><p><b>{porcentajeInicio(region.cantidad, total)}</b> del catálogo vigente</p>
                <button className="inicio-link" type="button" onClick={() => onExplorar({ region: region.nombre })}>Explorar esta región</button>
              </div></div>
            <div className="inicio-legend"><span><i />11 o más</span><span><i />1 a 10</span><span><i />Sin procesos identificados</span></div>
            <p className="inicio-base">{base(r.calidad.baseRegiones)} con región reconocida. Región del comprador, no necesariamente de entrega. El gris no implica ausencia de licitaciones.</p>
          </> : <Preparacion titulo="Distribución territorial en preparación" accion={explorar} />}
        </article>
        <article id="inicio-lista-corta" className="inicio-card inicio-action-card">
          <span className="inicio-action-tag">TU PRÓXIMA ACCIÓN</span><h2>Construye tu<br />lista corta.</h2>
          <p>Del catálogo a una decisión: guarda ofertas, compara sus bases y revisa tus capacidades.</p>
          {estadoFavoritos === 'cargando' && <p role="status">Consultando las oportunidades que guardó tu empresa…</p>}
          {estadoFavoritos === 'error' && <div role="alert"><p>No pudimos consultar tus guardadas. El contador no se reemplaza por cero.</p><button type="button" onClick={onReintentarFavoritos}>Reintentar guardadas</button></div>}
          {estadoFavoritos === 'listo' && (guardadas.length ? <>
            <div className="inicio-saved-count"><Icono tipo="estrella" /><span><strong>{numero(guardadas.length)}</strong> guardadas en plazo</span></div>
            <ul className="inicio-shortlist">{guardadas.slice(0, 3).map(({ licitacion: l }) => <li key={l.codigoExterno}><button type="button" onClick={() => onVerDetalle(l.codigoExterno)} title={l.nombre}>
              <strong>{l.nombre}</strong><time dateTime={l.fechaCierre!}>Cierra {fecha(l.fechaCierre!)}</time></button></li>)}</ul>
          </> : <p>Aún no tienes guardadas vigentes verificadas. Empieza por una oferta que puedas evaluar con tiempo.</p>)}
          <button className="inicio-action-primary" type="button" onClick={explorar}>Buscar oportunidades</button>
          <button className="inicio-action-secondary" type="button" onClick={onEditarPerfil}>Revisar perfil de mi empresa</button>
          <small>Guardar no equivale a postular.</small>
        </article>
      </section>
      <section className="inicio-agenda" aria-label="Próximos cierres"><div><h2>Próximos cierres</h2><p>Revisa que el plazo alcance para preparar tus antecedentes.</p></div>
        <ul>{r.agendaCierres.slice(0, 3).map((a) => <li key={a.codigoExterno}><button type="button" onClick={() => onVerDetalle(a.codigoExterno)}><strong>{a.nombre}</strong><span>{a.codigoExterno} · <time dateTime={a.fechaCierre}>{fecha(a.fechaCierre)}</time></span></button></li>)}</ul>
      </section>
    </>}
    <footer className="inicio-source"><span>Catálogo general · todos los rubros</span><span>Corte: {fecha(r.generadoEn)} · hora de Chile{r.calidad.catalogoConsultadoEn ? ` · Listado: ${fecha(r.calidad.catalogoConsultadoEn)}` : ''}</span></footer>
  </div>;
}
