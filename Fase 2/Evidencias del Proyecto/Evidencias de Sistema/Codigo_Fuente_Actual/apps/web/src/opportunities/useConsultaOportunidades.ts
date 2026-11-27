import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ErrorConsulta, solicitarJson } from './consulta-http';
import type { RespuestaOportunidades } from './types';

export interface FiltrosBusqueda {
  texto: string; region: string; categoria: string; organismo: string;
  montoMinimo: string; montoMaximo: string; periodo: string; orden: string;
  incluirFinalizadas: boolean; horizonteCierre: string;
}
export const filtrosIniciales: FiltrosBusqueda = { texto: '', region: '', categoria: '', organismo: '',
  montoMinimo: '', montoMaximo: '', periodo: 'todos', orden: 'fecha_desc', incluirFinalizadas: false, horizonteCierre: '' };
export interface MemoriaConsulta {
  contexto: string; borrador: FiltrosBusqueda; aplicados: FiltrosBusqueda; pagina: number;
  respuesta: RespuestaOportunidades | null; filtros: RespuestaOportunidades['filtrosDisponibles']; scroll: number;
}
const vacios = { regiones: [], organismos: [], categorias: [] };
export function parametrosConsulta(f: FiltrosBusqueda, pagina: number, recomendadas = false) {
  const q = new URLSearchParams({ alcance: recomendadas ? 'recomendadas' : 'todas', pagina: String(pagina),
    limite: recomendadas ? '20' : '10', puntajeMinimo: recomendadas ? '1' : '0',
    soloVigentes: String(!f.incluirFinalizadas), orden: f.orden, incluirFiltros: 'false' });
  if (f.texto.trim().length >= 2) q.set('texto', f.texto.trim());
  for (const [campo, valor] of Object.entries({ region: f.region, codigoCategoria: f.categoria,
    codigoOrganismo: f.organismo, montoMinimo: f.montoMinimo, montoMaximo: f.montoMaximo, horizonteCierre: f.horizonteCierre })) {
    if (valor) q.set(campo, valor);
  }
  if (f.periodo !== 'todos') {
    const d = new Date(); d.setDate(d.getDate() - Number(f.periodo));
    q.set('publicadaDesde', d.toISOString().slice(0, 10));
  }
  return q.toString();
}

export function useConsultaOportunidades({ accessToken, empresaId, contexto, memoria, onConservar, onSesionExpirada, recomendadas = false }: {
  accessToken: string; empresaId: string; contexto: string; memoria: MemoriaConsulta | null;
  onConservar: (m: MemoriaConsulta) => void; onSesionExpirada: () => void; recomendadas?: boolean;
}) {
  const inicial = memoria?.contexto === contexto ? memoria : null;
  const defecto = { ...filtrosIniciales, orden: recomendadas ? 'compatibilidad_desc' : 'fecha_desc' };
  const [borrador, setBorrador] = useState(inicial?.borrador ?? defecto);
  const [aplicados, setAplicados] = useState(inicial?.aplicados ?? defecto);
  const [pagina, setPagina] = useState(inicial?.pagina ?? 1);
  const [respuesta, setRespuesta] = useState<RespuestaOportunidades | null>(inicial?.respuesta ?? null);
  const [filtros, setFiltros] = useState<RespuestaOportunidades['filtrosDisponibles']>(inicial?.filtros ?? vacios);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorFiltros, setErrorFiltros] = useState(false);
  const [revision, setRevision] = useState(0);
  const [revisionFiltros, setRevisionFiltros] = useState(0);
  const url = `/api/v1/empresas/${empresaId}/oportunidades?${parametrosConsulta(aplicados, pagina, recomendadas)}`;
  const estadoActual = useRef<MemoriaConsulta | null>(null);
  useEffect(() => {
    estadoActual.current = { contexto, borrador, aplicados, pagina, respuesta, filtros, scroll: 0 };
  }, [contexto, borrador, aplicados, pagina, respuesta, filtros]);
  useLayoutEffect(() => {
    if (inicial?.scroll) window.scrollTo({ top: inicial.scroll, behavior: 'instant' });
    return () => { if (estadoActual.current) onConservar({ ...estadoActual.current, scroll: window.scrollY }); };
    // Se restaura solo al montar, no al modificar filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(null);
    void solicitarJson<RespuestaOportunidades>(url, accessToken).then((valor) => {
      if (vigente) setRespuesta(valor);
    }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ErrorConsulta && e.estado === 401) { onSesionExpirada(); return; }
      setError(e instanceof ErrorConsulta ? e.message : 'No pudimos actualizar la búsqueda. Vuelve a intentarlo.');
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [url, accessToken, revision, onSesionExpirada]);
  useEffect(() => {
    let vigente = true;
    setErrorFiltros(false);
    void solicitarJson<RespuestaOportunidades['filtrosDisponibles']>(
      `/api/v1/empresas/${empresaId}/oportunidades/filtros?soloVigentes=${!aplicados.incluirFinalizadas}`, accessToken,
    ).then((valor) => { if (vigente) setFiltros(valor); }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ErrorConsulta && e.estado === 401) onSesionExpirada();
      setErrorFiltros(true);
    });
    return () => { vigente = false; };
  }, [accessToken, empresaId, aplicados.incluirFinalizadas, revisionFiltros, onSesionExpirada]);
  function buscar(f = borrador) {
    setAplicados({ ...f }); setPagina(1); setRevision((n) => n + 1);
  }
  function limpiar() { setBorrador(defecto); buscar(defecto); }
  function ordenar(orden: string) {
    setBorrador((v) => ({ ...v, orden })); setAplicados((v) => ({ ...v, orden })); setPagina(1);
  }
  return { borrador, setBorrador, aplicados, pagina, setPagina, respuesta, filtros, cargando, error,
    errorFiltros, reintentar: () => setRevision((n) => n + 1),
    reintentarFiltros: () => setRevisionFiltros((n) => n + 1), buscar, limpiar, ordenar };
}
