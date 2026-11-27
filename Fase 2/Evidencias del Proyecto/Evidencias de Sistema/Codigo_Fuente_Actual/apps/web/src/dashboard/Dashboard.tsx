import { useCallback, useEffect, useRef, useState } from "react";
import { MarketAnalysis } from "../market-analysis/MarketAnalysis";
import type { FiltrosAnalisisMercado } from "../market-analysis/types";
import type { EstadoOnboarding } from "../onboarding/Onboarding";
import { OpportunityDetail } from "../opportunities/OpportunityDetail";
import { OpportunitySearch } from "../opportunities/OpportunitySearch";
import { RecommendedOpportunities } from "../opportunities/RecommendedOpportunities";
import { formatearMonto } from "../opportunities/types";
import "../opportunities/Opportunities.css";
import { SectionPlaceholder } from "../placeholders/SectionPlaceholder";
import { Reports } from "../reports/Reports";
import {
  WorkspaceSidebar,
  type VistaWorkspace,
} from "../workspace/WorkspaceSidebar";
import "../workspace/Workspace.css";
import "./Dashboard.css";
import { DashboardVerificado } from "./DashboardVerificado";
import type { FavoritoDashboard, ResumenDashboard } from "./dashboardVerificado.types";
import { ConsejosBusqueda } from "./ConsejosBusqueda";
import { filtrosIniciales, type MemoriaConsulta } from '../opportunities/useConsultaOportunidades';
import type { FiltroInicio } from './modeloInicio';

interface DashboardProps {
  accessToken: string;
  nombreUsuario: string;
  estado: EstadoOnboarding;
  onEditarPerfil: () => void;
  onPlanActualizado: () => Promise<void>;
  onCerrarSesion: () => void;
  onSesionExpirada: () => void;
}


interface NotificacionDashboard {
  id: string;
  tipo: "nueva_oportunidad";
  mensaje: string;
  porcentajeCompatibilidad: number;
  esPrueba: boolean;
  leida: boolean;
  leidaEn: string | null;
  creadaEn: string;
  accesoCompleto: boolean;
  licitacion: {
    codigoExterno: string;
    nombre: string;
    nombreOrganismo: string | null;
    montoEstimado: number | null;
    fechaCierre: string | null;
  } | null;
}

interface RespuestaNotificaciones {
  datos: NotificacionDashboard[];
  resumen: { noLeidas: number };
}

type PlanPago = "individual" | "empresa";

interface RespuestaInicioPago {
  pagoId: string;
  ambiente: "integracion";
  pagoReal: false;
  formulario: {
    metodo: "POST";
    url: string;
    tokenWs: string;
  };
}

interface ResultadoPago {
  id: string;
  ambiente: "integracion";
  pagoReal: false;
  suscripcionActivada: boolean;
  suscripcion: {
    plan: PlanPago;
    estado: "activa";
    vigenteDesde: string;
    vigenteHasta: string;
    activadaEn: string;
  } | null;
  estado:
    | "iniciada"
    | "confirmando"
    | "autorizada"
    | "rechazada"
    | "anulada"
    | "error";
  mensaje: string;
  ordenCompra: string;
  plan: {
    id: PlanPago;
    nombre: string;
    monto: number;
    moneda: "CLP";
    mesesVigencia: number;
  };
  monto: number;
  moneda: "CLP";
  codigoAutorizacion: string | null;
  tipoPago: string | null;
  numeroCuotas: number | null;
  ultimosCuatroTarjeta: string | null;
  fechaTransaccion: string | null;
}


let contextoSonidoNotificaciones: AudioContext | null = null;

async function prepararSonidoNotificaciones(): Promise<AudioContext | null> {
  try {
    contextoSonidoNotificaciones ??= new AudioContext();
    if (contextoSonidoNotificaciones.state === "suspended") {
      await contextoSonidoNotificaciones.resume();
    }
    return contextoSonidoNotificaciones.state === "running"
      ? contextoSonidoNotificaciones
      : null;
  } catch {
    return null;
  }
}

async function emitirSonidoNotificacion(): Promise<void> {
  const contexto = await prepararSonidoNotificaciones();
  if (!contexto) return;

  const inicio = contexto.currentTime;
  const notas = [
    { frecuencia: 587.33, retraso: 0, duracion: 0.24 },
    { frecuencia: 783.99, retraso: 0.19, duracion: 0.32 },
  ];

  for (const nota of notas) {
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    const comienzo = inicio + nota.retraso;
    const termino = comienzo + nota.duracion;

    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(nota.frecuencia, comienzo);
    volumen.gain.setValueAtTime(0.0001, comienzo);
    volumen.gain.exponentialRampToValueAtTime(0.075, comienzo + 0.035);
    volumen.gain.exponentialRampToValueAtTime(0.0001, termino);
    oscilador.connect(volumen);
    volumen.connect(contexto.destination);
    oscilador.start(comienzo);
    oscilador.stop(termino);
  }
}

export function Dashboard({
  accessToken,
  nombreUsuario,
  estado,
  onEditarPerfil,
  onPlanActualizado,
  onCerrarSesion,
  onSesionExpirada,
}: DashboardProps) {
  const [vista, setVista] = useState<VistaWorkspace>("inicio");
  const [codigoDetalle, setCodigoDetalle] = useState<string | null>(null);
  const memoriaBusqueda = useRef<MemoriaConsulta | null>(null);
  const memoriaAnalisis = useRef<{ empresaId: string; filtros: FiltrosAnalisisMercado } | null>(null);
  const memoriaRecomendadas = useRef<MemoriaConsulta | null>(null);
  const origenDetalle = useRef<VistaWorkspace>('oportunidades');
  const [revisionBusqueda, setRevisionBusqueda] = useState(0);
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [revisionDashboard, setRevisionDashboard] = useState(0);
  const [favoritosDashboard, setFavoritosDashboard] = useState<FavoritoDashboard[]>([]);
  const [estadoFavoritos, setEstadoFavoritos] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [revisionFavoritos, setRevisionFavoritos] = useState(0);
  const [cargando, setCargando] = useState(Boolean(estado.empresa));
  const [error, setError] = useState<string | null>(null);
  const [mostrarPremium, setMostrarPremium] = useState(false);
  const [planProcesando, setPlanProcesando] = useState<PlanPago | null>(null);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [resultadoPago, setResultadoPago] = useState<ResultadoPago | null>(
    null,
  );
  const [cargandoResultadoPago, setCargandoResultadoPago] = useState(false);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [notificaciones, setNotificaciones] = useState<NotificacionDashboard[]>(
    [],
  );
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);
  const [toastNotificacion, setToastNotificacion] =
    useState<NotificacionDashboard | null>(null);
  const [codigosFavoritos, setCodigosFavoritos] = useState<Set<string>>(
    () => new Set(),
  );
  const [codigoGuardando, setCodigoGuardando] = useState<string | null>(null);
  const [avisoOportunidad, setAvisoOportunidad] = useState<{
    tipo: "exito" | "error";
    mensaje: string;
  } | null>(null);
  const notificacionesInicializadas = useRef(false);
  const idsNotificacionesConocidas = useRef(new Set<string>());
  const claveResumenCargado = useRef<string | null>(null);
  const empresaId = estado.empresa?.id ?? null;
  const esAdministrador =
    estado.membresia?.rol === "administrador" || estado.empresa === null;
  const nombreEmpresa =
    estado.empresa?.nombreFantasia || estado.empresa?.razonSocial;
  const esPremium = Boolean(estado.plan?.premiumVigente);
  const contextoConsulta = JSON.stringify([empresaId, accessToken, estado.plan?.plan, esPremium, estado.perfil?.actualizadoEn, estado.perfil?.ofertasIds]);

  useEffect(() => {
    if (!empresaId) return;
    const parametros = new URLSearchParams(window.location.search);
    const pagoId = parametros.get("pago");
    if (!pagoId) return;

    const limpiarParametros = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("pago");
      url.searchParams.delete("resultadoPago");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    };

    if (pagoId === "desconocido") {
      setErrorPago(
        "Transbank regresó sin una orden reconocida. No se registró ningún pago.",
      );
      setMostrarPremium(true);
      limpiarParametros();
      return;
    }

    const empresaPagoId = empresaId;
    const pagoConfirmadoId = pagoId;
    const controller = new AbortController();
    async function cargarResultadoPago() {
      setCargandoResultadoPago(true);
      try {
        const respuesta = await fetch(
          `/api/v1/empresas/${empresaPagoId}/pagos/${encodeURIComponent(pagoConfirmadoId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );
        if (respuesta.status === 401) {
          onSesionExpirada();
          return;
        }
        if (!respuesta.ok) {
          throw new Error("No fue posible consultar el resultado del pago.");
        }
        const resultado = (await respuesta.json()) as ResultadoPago;
        setResultadoPago(resultado);
        if (resultado.suscripcionActivada) {
          await onPlanActualizado();
        }
      } catch (errorDesconocido) {
        if (!controller.signal.aborted) {
          setErrorPago(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : "No fue posible consultar el resultado del pago.",
          );
          setMostrarPremium(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargandoResultadoPago(false);
          limpiarParametros();
        }
      }
    }

    void cargarResultadoPago();
    return () => controller.abort();
  }, [accessToken, empresaId, onPlanActualizado, onSesionExpirada]);

  const cargarNotificaciones = useCallback(
    async (anunciarNuevas: boolean) => {
      if (!empresaId) return;

      try {
        const respuesta = await fetch(
          `/api/v1/empresas/${empresaId}/notificaciones?pagina=1&limite=20`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (respuesta.status === 401) {
          onSesionExpirada();
          return;
        }
        if (!respuesta.ok) return;

        const resultado = (await respuesta.json()) as RespuestaNotificaciones;
        const nuevas = resultado.datos.filter(
          (notificacion) =>
            !notificacion.leida &&
            !idsNotificacionesConocidas.current.has(notificacion.id),
        );

        setNotificaciones(resultado.datos);
        setNotificacionesNoLeidas(resultado.resumen.noLeidas);
        idsNotificacionesConocidas.current = new Set(
          resultado.datos.map((notificacion) => notificacion.id),
        );

        if (
          anunciarNuevas &&
          notificacionesInicializadas.current &&
          nuevas.length > 0
        ) {
          setToastNotificacion(nuevas[0]);
          void emitirSonidoNotificacion();
        }
        notificacionesInicializadas.current = true;
      } catch {
        // El dashboard continúa operativo aunque falle esta consulta auxiliar.
      }
    },
    [accessToken, empresaId, onSesionExpirada],
  );

  useEffect(() => {
    if (!empresaId) return;
    const controller = new AbortController();
    const clave = `${empresaId}|${accessToken}|${esPremium}`;

    async function cargarDashboard() {
      try {
        const resultado = await fetch(
          `/api/v1/empresas/${empresaId}/oportunidades/dashboard/resumen`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );

        if (resultado.status === 401) {
          onSesionExpirada();
          return;
        }
        if (!resultado.ok) {
          throw new Error("No fue posible cargar el resumen ejecutivo.");
        }
        const datos = (await resultado.json()) as ResumenDashboard;
        if (datos.versionContrato !== 3 || !datos.acceso || !datos.calidad || !Array.isArray(datos.metricas?.montosPorMoneda)) {
          throw new Error("El dashboard verificado requiere la API y la web actualizadas juntas. No se muestran indicadores del contrato anterior.");
        }
        if (controller.signal.aborted) return;
        claveResumenCargado.current = clave;
        setResumen(datos);
      } catch (errorDesconocido) {
        if (!controller.signal.aborted) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : "No fue posible conectar con la API.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }

    const cargaInicial = claveResumenCargado.current !== clave;
    setCargando(cargaInicial);
    setError(null);
    if (cargaInicial) setResumen(null);
    void cargarDashboard();
    return () => controller.abort();
  }, [accessToken, empresaId, esPremium, revisionDashboard, onSesionExpirada]);

  useEffect(() => {
    if (!empresaId || vista !== 'inicio') return;
    // Relee exclusivamente nuestra API/BD. No invoca la extraccion externa.
    const releer = () => {
      if (document.visibilityState === 'visible') setRevisionDashboard((v) => v + 1);
    };
    const intervalo = window.setInterval(releer, 60_000);
    document.addEventListener('visibilitychange', releer);
    return () => { window.clearInterval(intervalo); document.removeEventListener('visibilitychange', releer); };
  }, [empresaId, vista]);

  useEffect(() => {
    function activarSonido() {
      void prepararSonidoNotificaciones();
      window.removeEventListener("pointerdown", activarSonido);
      window.removeEventListener("keydown", activarSonido);
    }

    if (navigator.userActivation?.hasBeenActive) {
      void prepararSonidoNotificaciones();
    }
    window.addEventListener("pointerdown", activarSonido, { once: true });
    window.addEventListener("keydown", activarSonido, { once: true });

    return () => {
      window.removeEventListener("pointerdown", activarSonido);
      window.removeEventListener("keydown", activarSonido);
    };
  }, []);

  useEffect(() => {
    if (!empresaId) return;

    void cargarNotificaciones(false);
    const intervalo = window.setInterval(
      () => void cargarNotificaciones(true),
      30_000,
    );

    return () => window.clearInterval(intervalo);
  }, [cargarNotificaciones, empresaId]);

  useEffect(() => {
    if (!toastNotificacion) return;
    const temporizador = window.setTimeout(
      () => setToastNotificacion(null),
      9_000,
    );
    return () => window.clearTimeout(temporizador);
  }, [toastNotificacion]);

  useEffect(() => {
    if (!empresaId || !esPremium) {
      setCodigosFavoritos(new Set());
      setFavoritosDashboard([]);
      setEstadoFavoritos('listo');
      return;
    }

    const controller = new AbortController();
    async function cargarFavoritos() {
      try {
        const respuesta = await fetch(
          `/api/v1/empresas/${empresaId}/favoritos`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );
        if (respuesta.status === 401) {
          onSesionExpirada();
          return;
        }
        if (!respuesta.ok) throw new Error('No fue posible cargar las guardadas.');

        const resultado = (await respuesta.json()) as {
          datos: FavoritoDashboard[];
        };
        if (controller.signal.aborted) return;
        setFavoritosDashboard(resultado.datos);
        setEstadoFavoritos('listo');
        setCodigosFavoritos(
          new Set(resultado.datos.map((item) => item.licitacion.codigoExterno)),
        );
      } catch {
        if (!controller.signal.aborted) setEstadoFavoritos('error');
      }
    }

    setEstadoFavoritos('cargando');
    setFavoritosDashboard([]);
    setCodigosFavoritos(new Set());
    void cargarFavoritos();
    return () => controller.abort();
  }, [accessToken, empresaId, esPremium, revisionFavoritos, onSesionExpirada]);

  useEffect(() => {
    if (!avisoOportunidad) return;
    const temporizador = window.setTimeout(
      () => setAvisoOportunidad(null),
      5_000,
    );
    return () => window.clearTimeout(temporizador);
  }, [avisoOportunidad]);

  function navegar(nuevaVista: VistaWorkspace) {
    if (
      !esPremium &&
      (nuevaVista === "recomendadas" || nuevaVista === "analisis")
    ) {
      setMostrarPremium(true);
      return;
    }
    setCodigoDetalle(null);
    setVista(nuevaVista);
  }

  function verDetalle(codigoExterno: string) {
    origenDetalle.current = vista;
    setCodigoDetalle(codigoExterno);
    setVista("oportunidades");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function explorarInicio(filtro?: FiltroInicio) {
    const f = { ...filtrosIniciales, horizonteCierre: filtro?.horizonteCierre ?? '',
      organismo: filtro?.codigoOrganismo ?? '', categoria: filtro?.codigoCategoria ?? '', region: filtro?.region ?? '' };
    memoriaBusqueda.current = { contexto: contextoConsulta, borrador: f, aplicados: f, pagina: 1, respuesta: null,
      filtros: { regiones: [], organismos: [], categorias: [] }, scroll: 0 };
    setRevisionBusqueda((v) => v + 1);
    navegar('oportunidades');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function gestionarFavorito(codigoExterno: string) {
    if (!empresaId || codigoGuardando) return;
    if (!esPremium) {
      setMostrarPremium(true);
      return;
    }

    const estabaGuardada = codigosFavoritos.has(codigoExterno);
    setCodigoGuardando(codigoExterno);
    setAvisoOportunidad(null);

    try {
      const respuesta = await fetch(
        `/api/v1/empresas/${empresaId}/favoritos/${encodeURIComponent(codigoExterno)}`,
        {
          method: estabaGuardada ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (respuesta.status === 401) {
        onSesionExpirada();
        return;
      }

      if (!estabaGuardada && respuesta.status === 409) {
        setRevisionFavoritos((v) => v + 1);
        setCodigosFavoritos((actuales) => new Set(actuales).add(codigoExterno));
        setAvisoOportunidad({
          tipo: "exito",
          mensaje: "Esta oportunidad ya estaba guardada en tu empresa.",
        });
        return;
      }

      if (respuesta.status === 403) {
        await onPlanActualizado();
        throw new Error(
          "No pudimos validar la vigencia de Premium. Actualizamos tu plan; intenta nuevamente.",
        );
      }

      if (!respuesta.ok) {
        const detalle = (await respuesta.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          detalle?.message || "No fue posible actualizar esta oportunidad.",
        );
      }

      setCodigosFavoritos((actuales) => {
        const siguientes = new Set(actuales);
        if (estabaGuardada) siguientes.delete(codigoExterno);
        else siguientes.add(codigoExterno);
        return siguientes;
      });
      setRevisionFavoritos((v) => v + 1);
      setAvisoOportunidad({
        tipo: "exito",
        mensaje: estabaGuardada
          ? "La oportunidad se quitó de tus guardadas."
          : "Oportunidad guardada correctamente.",
      });
    } catch (errorDesconocido) {
      setAvisoOportunidad({
        tipo: "error",
        mensaje:
          errorDesconocido instanceof Error
            ? errorDesconocido.message
            : "No fue posible actualizar esta oportunidad.",
      });
    } finally {
      setCodigoGuardando(null);
    }
  }

  async function iniciarPagoPrueba(plan: PlanPago) {
    if (!empresaId || !esAdministrador || planProcesando) return;
    setPlanProcesando(plan);
    setErrorPago(null);

    try {
      const respuesta = await fetch(
        `/api/v1/empresas/${empresaId}/pagos/webpay-plus/iniciar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan }),
        },
      );
      if (respuesta.status === 401) {
        onSesionExpirada();
        return;
      }

      const datosError = !respuesta.ok
        ? ((await respuesta.json().catch(() => null)) as {
            message?: string | string[];
          } | null)
        : null;
      if (!respuesta.ok) {
        const mensaje = Array.isArray(datosError?.message)
          ? datosError.message.join(" ")
          : datosError?.message;
        throw new Error(mensaje ?? "No fue posible iniciar el pago de prueba.");
      }

      const datos = (await respuesta.json()) as RespuestaInicioPago;
      if (!datos.formulario?.url || !datos.formulario.tokenWs) {
        throw new Error("La API no entregó el formulario de Transbank.");
      }

      const formulario = document.createElement("form");
      formulario.method = "POST";
      formulario.action = datos.formulario.url;
      formulario.style.display = "none";

      const token = document.createElement("input");
      token.type = "hidden";
      token.name = "token_ws";
      token.value = datos.formulario.tokenWs;
      formulario.appendChild(token);
      document.body.appendChild(formulario);
      formulario.submit();
    } catch (errorDesconocido) {
      setErrorPago(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible iniciar el pago de prueba.",
      );
      setPlanProcesando(null);
    }
  }

  async function marcarNotificacionLeida(notificacion: NotificacionDashboard) {
    if (!empresaId || notificacion.leida) return;

    const respuesta = await fetch(
      `/api/v1/empresas/${empresaId}/notificaciones/${notificacion.id}/leida`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!respuesta.ok) return;

    setNotificaciones((actuales) =>
      actuales.map((item) =>
        item.id === notificacion.id ? { ...item, leida: true } : item,
      ),
    );
    setNotificacionesNoLeidas((cantidad) => Math.max(0, cantidad - 1));
  }

  async function marcarTodasLeidas() {
    if (!empresaId || notificacionesNoLeidas === 0) return;
    const respuesta = await fetch(
      `/api/v1/empresas/${empresaId}/notificaciones/leer-todas`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!respuesta.ok) return;

    setNotificaciones((actuales) =>
      actuales.map((notificacion) => ({ ...notificacion, leida: true })),
    );
    setNotificacionesNoLeidas(0);
  }

  async function abrirNotificacion(notificacion: NotificacionDashboard) {
    await marcarNotificacionLeida(notificacion);
    if (notificacion.accesoCompleto && notificacion.licitacion) {
      setMostrarNotificaciones(false);
      verDetalle(notificacion.licitacion.codigoExterno);
      return;
    }

    setMostrarNotificaciones(false);
    setMostrarPremium(true);
  }

  const etiquetaVista =
    codigoDetalle !== null
      ? "Detalle de oportunidad"
      : vista === "oportunidades"
        ? "Oportunidades"
        : vista === "recomendadas"
          ? "Recomendadas para mí"
          : vista === "analisis"
            ? "Análisis de mercado"
            : vista === "reportes"
              ? "Reportes"
              : vista === "usuarios"
                ? "Usuarios y permisos"
                : vista === "ayuda"
                  ? "Centro de ayuda"
                  : "Inicio";

  const distintivoVista =
    vista === "usuarios"
      ? { icono: "◆", texto: "Plan Empresa", variante: "empresa" }
      : vista === "recomendadas" || vista === "analisis" || vista === "reportes"
        ? { icono: "★", texto: "Premium", variante: "premium" }
        : null;

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        modo="dashboard"
        nombreUsuario={nombreUsuario}
        nombreEmpresa={nombreEmpresa}
        plan={estado.plan?.plan}
        pasoDisponible={4}
        onSeleccionarPaso={() => onEditarPerfil()}
        vistaActiva={vista}
        onNavegar={navegar}
        onCerrarSesion={onCerrarSesion}
      />

      <main className="workspace-main dashboard-main">
        <header className={"dashboard-topbar" + (vista === "analisis" ? " dashboard-topbar--market" : "")}>
          <div>
            <div className="dashboard-view-title">
              <strong>{etiquetaVista}</strong>
              {distintivoVista && (
                <span
                  className={`dashboard-plan-badge dashboard-plan-badge--${distintivoVista.variante}`}
                >
                  <b aria-hidden="true">{distintivoVista.icono}</b>
                  {distintivoVista.texto}
                </span>
              )}
            </div>
            <span>{nombreEmpresa || "GovMarket Analytics"}</span>
          </div>
          <div className="dashboard-topbar-actions">
            <button
              className="notification-bell"
              type="button"
              aria-label={`Notificaciones${notificacionesNoLeidas ? `, ${notificacionesNoLeidas} sin leer` : ""}`}
              aria-expanded={mostrarNotificaciones}
              onClick={() => {
                setMostrarNotificaciones(true);
                void cargarNotificaciones(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
              {notificacionesNoLeidas > 0 && (
                <span className="notification-badge">
                  {notificacionesNoLeidas > 99 ? "99+" : notificacionesNoLeidas}
                </span>
              )}
            </button>
            {esPremium && (
              <span
                className="dashboard-account-premium"
                title={`Plan Premium ${estado.plan?.plan === "empresa" ? "Empresa" : "Individual"} vigente`}
              >
                <b aria-hidden="true">★</b>
                PREMIUM
              </span>
            )}
            <span className="dashboard-user-name">{nombreUsuario}</span>
          </div>
        </header>

        {vista === "inicio" && (
          <div className="dashboard-body executive-dashboard">
            <section className="executive-heading">
              <div>
                <h1>¡Bienvenido {nombreEmpresa || "GovMarket Analytics"}!</h1>
              </div>
              <div className="executive-heading-actions">
                <span>▣ Catálogo vigente</span>
                {!esPremium && (
                  <button type="button" onClick={() => setMostrarPremium(true)}>
                    Mejorar a Premium
                  </button>
                )}
              </div>
            </section>

            {!esPremium && (
              <section className="executive-free-banner">
                <span aria-hidden="true">★</span>
                <div>
                  <strong>Estás utilizando el Plan Gratuito</strong>
                  <p>
                    Explora el mercado y tus coincidencias. Premium desbloquea
                    detalles, notificaciones, favoritos y análisis.
                  </p>
                </div>
                <button type="button" onClick={() => setMostrarPremium(true)}>
                  Conocer planes
                </button>
              </section>
            )}

            {cargando && (
              <div className="dashboard-empty executive-loading" role="status">
                <span className="dashboard-loader" />
                <strong>Preparando el resumen ejecutivo</strong>
                <p>Estamos procesando el catálogo y el perfil de tu empresa.</p>
              </div>
            )}

            {!cargando && error && (
              <div className="dashboard-empty dashboard-empty--error">
                <strong>No pudimos cargar el dashboard</strong>
                <p>{error}</p>
              </div>
            )}

            {!cargando && !error && resumen && (
              <DashboardVerificado resumen={resumen} esPremium={esPremium}
                favoritos={favoritosDashboard} estadoFavoritos={estadoFavoritos}
                onVerDetalle={verDetalle} onExplorar={explorarInicio}
                onEditarPerfil={onEditarPerfil} onPremium={() => setMostrarPremium(true)}
                onActualizar={() => { setRevisionDashboard((v) => v + 1); setRevisionFavoritos((v) => v + 1); }}
                onReintentarFavoritos={() => setRevisionFavoritos((v) => v + 1)} />
            )}
          </div>
        )}

        {vista === "oportunidades" && empresaId && codigoDetalle === null && (
          <OpportunitySearch
            key={`${contextoConsulta}:${revisionBusqueda}`}
            contexto={contextoConsulta}
            memoria={memoriaBusqueda.current}
            onConservar={(m) => { memoriaBusqueda.current = m; }}
            accessToken={accessToken}
            empresaId={empresaId}
            codigosGuardados={codigosFavoritos}
            codigoGuardando={codigoGuardando}
            onVerDetalle={verDetalle}
            onGuardarOportunidad={(codigo) => void gestionarFavorito(codigo)}
            onAccionPremium={() => setMostrarPremium(true)}
            onSesionExpirada={onSesionExpirada}
          />
        )}

        {vista === "oportunidades" && empresaId && codigoDetalle !== null && (
          <OpportunityDetail
            accessToken={accessToken}
            empresaId={empresaId}
            codigoExterno={codigoDetalle}
            etiquetaVolver={origenDetalle.current === "analisis" ? "Análisis de mercado" : "Oportunidades"}
            guardada={codigosFavoritos.has(codigoDetalle)}
            guardando={codigoGuardando === codigoDetalle}
            onVolver={() => { setCodigoDetalle(null); setVista(origenDetalle.current); }}
            onGuardar={(codigo) => void gestionarFavorito(codigo)}
            onAccionPremium={() => setMostrarPremium(true)}
            onSesionExpirada={onSesionExpirada}
          />
        )}

        {vista === "recomendadas" && empresaId && (
          <RecommendedOpportunities
            key={contextoConsulta}
            contexto={contextoConsulta}
            memoria={memoriaRecomendadas.current}
            onConservar={(m) => { memoriaRecomendadas.current = m; }}
            accessToken={accessToken}
            empresaId={empresaId}
            esPremium={esPremium}
            estadoFavoritos={estadoFavoritos}
            onEditarPerfil={onEditarPerfil}
            onReintentarFavoritos={() => setRevisionFavoritos((v) => v + 1)}
            codigosGuardados={codigosFavoritos}
            codigoGuardando={codigoGuardando}
            onVerDetalle={verDetalle}
            onVerTodas={() => navegar("oportunidades")}
            onGuardarOportunidad={(codigo) => void gestionarFavorito(codigo)}
            onSesionExpirada={onSesionExpirada}
          />
        )}

        {vista === "analisis" && empresaId && (
          <MarketAnalysis
            accessToken={accessToken}
            empresaId={empresaId}
            onVerDetalle={verDetalle}
            filtrosIniciales={memoriaAnalisis.current?.empresaId === empresaId ? memoriaAnalisis.current.filtros : undefined}
            onConservarFiltros={(filtros) => { memoriaAnalisis.current = { empresaId, filtros }; }}
            onSesionExpirada={onSesionExpirada}
          />
        )}

        {vista === "reportes" && <Reports nombreEmpresa={nombreEmpresa} />}

        {vista === "usuarios" && <SectionPlaceholder tipo="usuarios" />}

        {vista === "ayuda" && <SectionPlaceholder tipo="ayuda" />}
      </main>

      {avisoOportunidad && (
        <aside
          className={`opportunity-action-toast is-${avisoOportunidad.tipo}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            {avisoOportunidad.tipo === "exito" ? "✓" : "!"}
          </span>
          <p>{avisoOportunidad.mensaje}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setAvisoOportunidad(null)}
          >
            ×
          </button>
        </aside>
      )}

      {toastNotificacion && (
        <aside className="notification-toast" aria-live="polite">
          <button
            className="notification-toast-close"
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setToastNotificacion(null)}
          >
            ×
          </button>
          <button
            className="notification-toast-content"
            type="button"
            onClick={() => {
              setToastNotificacion(null);
              setMostrarNotificaciones(true);
            }}
          >
            <span className="notification-toast-icon" aria-hidden="true">
              ♢
            </span>
            <span>
              <strong>
                {toastNotificacion.esPrueba
                  ? "Notificación de prueba"
                  : "Nueva oportunidad para tu empresa"}
              </strong>
              <small>{toastNotificacion.mensaje}</small>
            </span>
          </button>
        </aside>
      )}

      {mostrarNotificaciones && (
        <div
          className="notification-modal-backdrop"
          role="presentation"
          onMouseDown={() => setMostrarNotificaciones(false)}
        >
          <section
            className="notification-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-center-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <header>
              <div>
                <span className="notification-center-bell" aria-hidden="true">
                  ♢
                </span>
                <div>
                  <h2 id="notification-center-title">Notificaciones</h2>
                  <p>
                    {notificacionesNoLeidas === 0
                      ? "No tienes mensajes pendientes"
                      : `${notificacionesNoLeidas} sin leer`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setMostrarNotificaciones(false)}
              >
                ×
              </button>
            </header>

            <div className="notification-center-toolbar">
              <strong>Actividad reciente</strong>
              <button type="button" onClick={() => void marcarTodasLeidas()}>
                Marcar todas como leídas
              </button>
            </div>

            <div className="notification-center-list">
              {notificaciones.length === 0 ? (
                <div className="notification-center-empty">
                  <span aria-hidden="true">♢</span>
                  <strong>Aún no tienes notificaciones</strong>
                  <p>
                    Te avisaremos cuando aparezca una oportunidad compatible con
                    el perfil de tu empresa.
                  </p>
                </div>
              ) : (
                notificaciones.map((notificacion) => (
                  <button
                    type="button"
                    className={`notification-row${notificacion.leida ? " is-read" : ""}${notificacion.esPrueba ? " is-test" : ""}`}
                    key={notificacion.id}
                    onClick={() => void abrirNotificacion(notificacion)}
                  >
                    <span className="notification-row-icon" aria-hidden="true">
                      {notificacion.esPrueba ? "P" : "★"}
                    </span>
                    <span className="notification-row-copy">
                      <strong>
                        {notificacion.esPrueba
                          ? "Prueba del centro de notificaciones"
                          : "Nueva oportunidad compatible"}
                      </strong>
                      <small>{notificacion.mensaje}</small>
                      <time>
                        {new Intl.DateTimeFormat("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(notificacion.creadaEn))}
                      </time>
                    </span>
                    {!notificacion.leida && (
                      <i aria-label="Sin leer" title="Sin leer" />
                    )}
                  </button>
                ))
              )}
              <ConsejosBusqueda perfil={estado.perfil}
              onBuscar={() => { setMostrarNotificaciones(false); navegar('oportunidades'); }}
              onEditarPerfil={() => { setMostrarNotificaciones(false); onEditarPerfil(); }} />
            </div>

            {!esPremium && notificaciones.length > 0 && (
              <footer>
                <p>
                  El plan gratuito te avisa del match. Premium permite abrir el
                  detalle y gestionar la oportunidad.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarNotificaciones(false);
                    setMostrarPremium(true);
                  }}
                >
                  Conocer Premium
                </button>
              </footer>
            )}
          </section>
        </div>
      )}

      {mostrarPremium && (
        <div
          className="premium-modal-backdrop"
          role="presentation"
          onMouseDown={() => setMostrarPremium(false)}
        >
          <section
            className="premium-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <button
              className="premium-modal-close"
              type="button"
              aria-label="Cerrar"
              onClick={() => setMostrarPremium(false)}
            >
              ×
            </button>
            <span className="premium-modal-icon" aria-hidden="true">
              ★
            </span>
            <p>GOVMARKET PREMIUM</p>
            <h2 id="premium-title">Convierte oportunidades en negocios</h2>
            <span>
              Elige el plan que mejor se adapte a tu forma de trabajar. Para
              este proyecto todos los pagos se realizarán en el ambiente de
              prueba de Transbank y no generarán cobros reales.
            </span>
            <span className="premium-test-badge">PAGO DE PRUEBA</span>
            <div className="premium-options">
              <article>
                <span className="premium-option-icon" aria-hidden="true">
                  ★
                </span>
                <strong>Premium Individual</strong>
                <b>
                  $9.990 <small>/ mes</small>
                </b>
                <small>
                  1 administrador. Incluye detalle completo, recomendaciones,
                  favoritos, alertas y análisis de mercado.
                </small>
                <button
                  className="premium-plan-select"
                  type="button"
                  disabled={!esAdministrador || planProcesando !== null}
                  onClick={() => void iniciarPagoPrueba("individual")}
                >
                  {planProcesando === "individual"
                    ? "Conectando con Webpay..."
                    : "Elegir Individual"}
                </button>
              </article>
              <article>
                <span className="premium-option-icon" aria-hidden="true">
                  ◆
                </span>
                <strong>Premium Empresa</strong>
                <b>
                  $59.990 <small>/ 3 meses</small>
                </b>
                <small>
                  1 administrador y hasta 4 usuarios adicionales. Incluye todas
                  las funciones Premium y trabajo colaborativo.
                </small>
                <button
                  className="premium-plan-select"
                  type="button"
                  disabled={!esAdministrador || planProcesando !== null}
                  onClick={() => void iniciarPagoPrueba("empresa")}
                >
                  {planProcesando === "empresa"
                    ? "Conectando con Webpay..."
                    : "Elegir Empresa"}
                </button>
              </article>
            </div>
            <div className="premium-test-data">
              <strong>Datos ficticios para una prueba aprobada</strong>
              <span>
                VISA 4051 8856 0044 6623 · CVV 123 · vencimiento futuro
              </span>
              <span>Autenticación: RUT 11.111.111-1 · clave 123</span>
            </div>
            {!esAdministrador && (
              <p className="premium-payment-warning">
                Solamente el administrador de la empresa puede contratar un
                plan.
              </p>
            )}
            {errorPago && (
              <p className="premium-payment-error" role="alert">
                {errorPago}
              </p>
            )}
            <button
              className="premium-modal-later"
              type="button"
              onClick={() => setMostrarPremium(false)}
            >
              Continuar con el plan gratuito
            </button>
          </section>
        </div>
      )}

      {(cargandoResultadoPago || resultadoPago) && (
        <div className="premium-modal-backdrop" role="presentation">
          <section
            className="payment-result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-result-title"
          >
            {cargandoResultadoPago ? (
              <div className="payment-result-loading" role="status">
                <span className="dashboard-loader" />
                <strong>Consultando el pago de prueba</strong>
                <p>
                  Estamos verificando la respuesta registrada por Transbank.
                </p>
              </div>
            ) : resultadoPago ? (
              <>
                <span
                  className={`payment-result-icon payment-result-icon--${resultadoPago.estado}`}
                  aria-hidden="true"
                >
                  {resultadoPago.estado === "autorizada" ? "✓" : "!"}
                </span>
                <p>TRANSBANK · AMBIENTE DE PRUEBA</p>
                <h2 id="payment-result-title">{resultadoPago.mensaje}</h2>
                <dl>
                  <div>
                    <dt>Plan</dt>
                    <dd>{resultadoPago.plan.nombre}</dd>
                  </div>
                  <div>
                    <dt>Monto simulado</dt>
                    <dd>{formatearMonto(resultadoPago.monto)}</dd>
                  </div>
                  <div>
                    <dt>Orden</dt>
                    <dd>{resultadoPago.ordenCompra}</dd>
                  </div>
                  {resultadoPago.codigoAutorizacion && (
                    <div>
                      <dt>Autorización</dt>
                      <dd>{resultadoPago.codigoAutorizacion}</dd>
                    </div>
                  )}
                  {resultadoPago.ultimosCuatroTarjeta && (
                    <div>
                      <dt>Tarjeta de prueba</dt>
                      <dd>•••• {resultadoPago.ultimosCuatroTarjeta}</dd>
                    </div>
                  )}
                </dl>
                {resultadoPago.estado === "autorizada" && (
                  <div className="payment-stage-notice">
                    {resultadoPago.suscripcionActivada &&
                    resultadoPago.suscripcion
                      ? `Premium ${resultadoPago.plan.nombre.replace("Premium ", "")} quedó activo hasta el ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(new Date(resultadoPago.suscripcion.vigenteHasta))}.`
                      : "La transacción fue autorizada, pero la suscripción aún no figura activada."}
                  </div>
                )}
                <button
                  className="premium-modal-action"
                  type="button"
                  onClick={() => setResultadoPago(null)}
                >
                  Volver a GovMarket
                </button>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
