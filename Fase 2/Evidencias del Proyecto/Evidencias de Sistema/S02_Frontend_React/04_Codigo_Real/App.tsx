import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Dashboard } from "./dashboard/Dashboard";
import { GoogleSignIn } from "./GoogleSignIn";
import { RegistroUsuario } from "./auth/RegistroUsuario";
import { obtenerTokenSesion, guardarTokenSesion, eliminarTokenSesion } from "./auth/almacen-sesion";
import { Onboarding, type EstadoOnboarding } from "./onboarding/Onboarding";
import "./App.css";

interface Perfil {
  id: string;
  email: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  estado: string;
  esSuperadministrador: boolean;
}

interface Sesion {
  accessToken: string;
  perfil: Perfil;
}

interface LoginResponse {
  accessToken: string;
  expiresIn?: number | null;
}

class SesionNoAutorizadaError extends Error {}

type EstadoApi = "verificando" | "conectada" | "desconectada";

const apiBase = "/api/v1";
const correoGuardado = "govmarket-correo";

type TipoIcono =
  | "grafico"
  | "objetivo"
  | "estrella"
  | "usuarios"
  | "correo"
  | "candado"
  | "ojo";

function Icono({ tipo }: { tipo: TipoIcono }) {
  const contenido = {
    grafico: (
      <>
        <path d="M3 20h4v-7H3zM10 20h4V9h-4zM17 20h4V4h-4z" />
      </>
    ),
    objetivo: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
      </>
    ),
    estrella: (
      <path d="m12 2 3.1 6.3 7 1-5.1 5 .9 7.1L12 18l-5.9 3.4.9-7.1-5.1-5 7-1z" />
    ),
    usuarios: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M18 11a3 3 0 0 0 0-6M18 14a5 5 0 0 1 3 4v2" />
      </>
    ),
    correo: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    candado: (
      <>
        <rect x="4" y="10" width="16" height="12" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v3" />
      </>
    ),
    ojo: (
      <>
        <path d="M2 12c2.6-4 6-6 10-6s7.4 2 10 6c-2.6 4-6 6-10 6s-7.4-2-10-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  };

  return (
    <svg
      className="icono"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {contenido[tipo]}
    </svg>
  );
}

function App() {
  const [email, setEmail] = useState(
    () => localStorage.getItem(correoGuardado) ?? "",
  );
  const [password, setPassword] = useState("");
  const [recordarCorreo, setRecordarCorreo] = useState(() =>
    Boolean(localStorage.getItem(correoGuardado)),
  );
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [restaurandoSesion, setRestaurandoSesion] = useState(() =>
    Boolean(obtenerTokenSesion()),
  );
  const restauracionIniciada = useRef(false);
  const [errorRestauracion, setErrorRestauracion] = useState<string | null>(null);
  const [estadoOnboarding, setEstadoOnboarding] =
    useState<EstadoOnboarding | null>(null);
  const [cargandoOnboarding, setCargandoOnboarding] = useState(false);
  const [estadoApi, setEstadoApi] = useState<EstadoApi>("verificando");
  const [cargando, setCargando] = useState(false);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function comprobarApi() {
      try {
        const respuesta = await fetch(apiBase + "/health", {
          signal: controller.signal,
        });
        if (!respuesta.ok) throw new Error("API no disponible");
        const estado = (await respuesta.json()) as {
          status?: string;
          database?: string;
        };
        if (!controller.signal.aborted) {
          setEstadoApi(
            estado.status === "ok" && estado.database === "connected"
              ? "conectada"
              : "desconectada",
          );
        }
      } catch {
        if (!controller.signal.aborted) setEstadoApi("desconectada");
      }
    }

    void comprobarApi();
    return () => controller.abort();
  }, []);

  async function crearSesion(accessToken: string, persistirLocal?: boolean) {
    const respuesta = await fetch(apiBase + "/auth/me", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (respuesta.status === 401) throw new SesionNoAutorizadaError("La sesión expiró. Ingresa nuevamente.");
    if (!respuesta.ok) throw new Error("No fue posible obtener tu perfil.");
    const perfil = (await respuesta.json()) as Perfil;
    guardarTokenSesion(accessToken, persistirLocal);
    setSesion({ accessToken, perfil });
    setEstadoOnboarding(null);
    setPassword("");
    setError(null);

    if (perfil.esSuperadministrador) {
      setEstadoOnboarding({
        completado: true,
        pasoActual: 4,
        progreso: 100,
        pasoSiguiente: "dashboard",
        empresa: null,
        membresia: null,
        perfilConfigurado: false,
        perfil: null,
        plan: null,
      });
      return;
    }

    await cargarEstadoOnboarding(accessToken);
  }

  const cargarEstadoOnboarding = useCallback(
    async (accessToken: string, silencioso = false) => {
      if (!silencioso) setCargandoOnboarding(true);
      setError(null);

      try {
        const respuesta = await fetch(apiBase + "/onboarding/estado", {
          headers: { Authorization: "Bearer " + accessToken },
        });

        if (respuesta.status === 401) {
          eliminarTokenSesion();
          setSesion(null);
          setEstadoOnboarding(null);
          setError("La sesión expiró. Ingresa nuevamente.");
          return;
        }

        if (!respuesta.ok) {
          throw new Error("No fue posible consultar el estado de tu cuenta.");
        }

        setEstadoOnboarding((await respuesta.json()) as EstadoOnboarding);
      } catch (errorDesconocido) {
        setEstadoOnboarding(null);
        setError(
          errorDesconocido instanceof Error
            ? errorDesconocido.message
            : "No fue posible conectar con la API.",
        );
      } finally {
        if (!silencioso) setCargandoOnboarding(false);
      }
    },
    [],
  );

  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(apiBase + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (respuesta.status === 401)
        throw new Error("Correo o contraseña incorrectos.");
      if (!respuesta.ok)
        throw new Error("No fue posible iniciar sesión. Revisa los datos.");
      const datos = (await respuesta.json()) as LoginResponse;
      if (!datos.accessToken)
        throw new Error("La API no entregó un token de acceso.");
      await crearSesion(datos.accessToken, datos.expiresIn === null);
      if (recordarCorreo) localStorage.setItem(correoGuardado, email.trim());
      else localStorage.removeItem(correoGuardado);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setCargando(false);
    }
  }

  async function iniciarConGoogle(credential: string) {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(apiBase + "/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (respuesta.status === 401)
        throw new Error("Esta cuenta de Google no tiene acceso autorizado.");
      if (respuesta.status === 503)
        throw new Error(
          "El acceso con Google aún no está configurado en la API.",
        );
      if (!respuesta.ok) throw new Error("No fue posible ingresar con Google.");
      const datos = (await respuesta.json()) as LoginResponse;
      if (!datos.accessToken)
        throw new Error("La API no entregó un token de acceso.");
      await crearSesion(datos.accessToken, datos.expiresIn === null);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setCargando(false);
    }
  }

  async function actualizarPerfil() {
    if (!sesion) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(apiBase + "/auth/me", {
        headers: { Authorization: "Bearer " + sesion.accessToken },
      });
      if (respuesta.status === 401) {
        eliminarTokenSesion();
        setSesion(null);
        throw new Error("La sesión expiró. Ingresa nuevamente.");
      }
      if (!respuesta.ok)
        throw new Error("No fue posible actualizar el perfil.");
      const perfil = (await respuesta.json()) as Perfil;
      setSesion({ accessToken: sesion.accessToken, perfil });
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setCargando(false);
    }
  }

  const cerrarSesion = useCallback(() => {
    eliminarTokenSesion();
    setErrorRestauracion(null);
    setSesion(null);
    setEstadoOnboarding(null);
    setPassword("");
    setError(null);
    window.google?.accounts.id.disableAutoSelect();
  }, []);

  const informarSesionExpirada = useCallback(() => {
    cerrarSesion();
    setError("La sesión expiró. Ingresa nuevamente.");
  }, [cerrarSesion]);

  async function recuperarSesion() {
    const accessToken = obtenerTokenSesion();
    setErrorRestauracion(null);
    if (!accessToken) {
      setRestaurandoSesion(false);
      return;
    }
    setRestaurandoSesion(true);
    try {
      await crearSesion(accessToken);
    } catch (errorDesconocido) {
      if (errorDesconocido instanceof SesionNoAutorizadaError) {
        eliminarTokenSesion();
        setSesion(null);
        setEstadoOnboarding(null);
        setError("La sesión expiró. Ingresa nuevamente.");
      } else {
        // Un corte de red o un reinicio de la API no invalida la sesión.
        setErrorRestauracion("No pudimos conectar con tu cuenta. Tu acceso guardado se conserva; reintenta cuando la API esté disponible.");
      }
    } finally {
      setRestaurandoSesion(false);
    }
  }

  useEffect(() => {
    if (restauracionIniciada.current) return;
    restauracionIniciada.current = true;
    void recuperarSesion();
  }, []);

  const actualizarEstadoCuenta = useCallback(async () => {
    if (!sesion) return;
    await cargarEstadoOnboarding(sesion.accessToken, true);
  }, [cargarEstadoOnboarding, sesion]);

  if (restaurandoSesion || errorRestauracion) {
    return (
      <div className="site">
        <main className="dashboard">
          <header className="dashboard-header">
            <div className="dashboard-brand">
              <img src="/govmarket-logo.png" alt="GovMarket Analytics" />
            </div>
          </header>
          <div className="dashboard-content loading-account" role="status">
            {restaurandoSesion && <span className="loading-spinner" aria-hidden="true" />}
            <h1>{restaurandoSesion ? "Recuperando tu sesión" : "Tu sesión sigue guardada"}</h1>
            <p className="dashboard-intro">
              {errorRestauracion ?? "Estamos validando tu acceso a GovMarket Analytics."}
            </p>
            {errorRestauracion && <div>
              <button className="outline-action" type="button" onClick={() => void recuperarSesion()}>Reintentar sesión</button>
              <button className="outline-action" type="button" onClick={cerrarSesion}>Cerrar sesión</button>
            </div>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="site">
      {sesion && cargandoOnboarding ? (
        <main className="dashboard">
          <header className="dashboard-header">
            <div className="dashboard-brand">
              <img src="/govmarket-logo.png" alt="GovMarket Analytics" />
            </div>
            <button
              className="outline-action"
              type="button"
              onClick={cerrarSesion}
            >
              Cerrar sesión
            </button>
          </header>
          <div className="dashboard-content loading-account" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <h1>Preparando tu cuenta</h1>
            <p className="dashboard-intro">
              Estamos revisando la configuración de tu empresa.
            </p>
          </div>
        </main>
      ) : sesion &&
        estadoOnboarding &&
        estadoOnboarding.pasoSiguiente !== "dashboard" ? (
        <Onboarding
          accessToken={sesion.accessToken}
          estado={estadoOnboarding}
          nombreUsuario={sesion.perfil.nombres}
          onCerrarSesion={cerrarSesion}
          onEstadoActualizado={setEstadoOnboarding}
          onSesionExpirada={informarSesionExpirada}
        />
      ) : sesion && estadoOnboarding ? (
        <Dashboard
          accessToken={sesion.accessToken}
          nombreUsuario={sesion.perfil.nombres}
          estado={estadoOnboarding}
          onEditarPerfil={() => {
            setEstadoOnboarding((actual) =>
              actual ? { ...actual, pasoSiguiente: "empresa" } : actual,
            );
          }}
          onPlanActualizado={actualizarEstadoCuenta}
          onCerrarSesion={cerrarSesion}
          onSesionExpirada={informarSesionExpirada}
        />
      ) : sesion ? (
        <main className="dashboard">
          <header className="dashboard-header">
            <div className="dashboard-brand">
              <img src="/govmarket-logo.png" alt="GovMarket Analytics" />
            </div>
            <button
              className="outline-action"
              type="button"
              onClick={cerrarSesion}
            >
              Cerrar sesión
            </button>
          </header>
          <div className="dashboard-content">
            <section
              className="profile-card account-error"
              aria-labelledby="titulo-error-cuenta"
            >
              <h2 id="titulo-error-cuenta">No pudimos cargar tu empresa</h2>
              <p>Comprueba que la API esté disponible y vuelve a intentarlo.</p>
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-action"
                type="button"
                disabled={cargandoOnboarding}
                onClick={() => void cargarEstadoOnboarding(sesion.accessToken)}
              >
                Reintentar
              </button>
              <button
                className="outline-action"
                type="button"
                disabled={cargando}
                onClick={() => void actualizarPerfil()}
              >
                Actualizar sesión
              </button>
            </section>
          </div>
        </main>
      ) : (
        <main className="login-frame">
          <section className="story-panel" aria-labelledby="mensaje-principal">
            <img
              className="brand-logo"
              src="/govmarket-logo.png"
              alt="GovMarket Analytics"
            />
            <div className="visual-data" aria-hidden="true" />
            <div className="story-copy">
              <h1 id="mensaje-principal">
                Inteligencia de datos
                <br />
                para mejores decisiones
                <br />
                <span>comerciales</span>
              </h1>
              <p>
                GovMarket Analytics transforma los datos de Mercado Público en
                información estratégica para que identifiques y priorices las
                mejores oportunidades para tu empresa.
              </p>
            </div>
            <ul className="benefits">
              <li>
                <span className="benefit-icon">
                  <Icono tipo="grafico" />
                </span>
                <span>Analiza tendencias y patrones históricos</span>
              </li>
              <li>
                <span className="benefit-icon">
                  <Icono tipo="objetivo" />
                </span>
                <span>Encuentra oportunidades relevantes</span>
              </li>
              <li>
                <span className="benefit-icon">
                  <Icono tipo="estrella" />
                </span>
                <span>Prioriza con nuestro sistema de compatibilidad</span>
              </li>
            </ul>
            <div
              className="stats-card"
              aria-label="Indicadores pendientes de cargar"
            >
              <div className="stat">
                <span className="stat-icon">
                  <Icono tipo="grafico" />
                </span>
                <div>
                  <strong>—</strong>
                  <small>
                    Oportunidades TI
                    <br />
                    activas
                  </small>
                </div>
              </div>
              <div className="stat">
                <span className="stat-icon stat-icon--green" aria-hidden="true">
                  $
                </span>
                <div>
                  <strong>—</strong>
                  <small>Monto total disponible</small>
                </div>
              </div>
              <div className="stat">
                <span className="stat-icon">
                  <Icono tipo="usuarios" />
                </span>
                <div>
                  <strong>—</strong>
                  <small>
                    Organismos compradores
                    <br />
                    activos
                  </small>
                </div>
              </div>
            </div>
          </section>
          <section className="form-side" aria-labelledby="titulo-login">
            <div className="login-card">
              {mostrarRegistro ? (
                <RegistroUsuario
                  emailInicial={email}
                  onRegistrado={crearSesion}
                  onVolver={() => {
                    setMostrarRegistro(false);
                    setError(null);
                  }}
                />
              ) : (
                <>
                  <h2 id="titulo-login">Iniciar sesión</h2>
                  <p className="login-subtitle">
                    Ingresa tus credenciales para acceder
                    <br />a tu cuenta
                  </p>
                  <form onSubmit={(evento) => void iniciarSesion(evento)}>
                    <label htmlFor="email">Correo electrónico</label>
                    <div className="input-wrap">
                      <span className="input-icon">
                        <Icono tipo="correo" />
                      </span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        placeholder="ejemplo@empresa.cl"
                        value={email}
                        onChange={(evento) => setEmail(evento.target.value)}
                        required
                      />
                    </div>
                    <label htmlFor="password">Contraseña</label>
                    <div className="input-wrap">
                      <span className="input-icon">
                        <Icono tipo="candado" />
                      </span>
                      <input
                        id="password"
                        name="password"
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Ingresa tu contraseña"
                        value={password}
                        onChange={(evento) => setPassword(evento.target.value)}
                        required
                      />
                      <button
                        className="reveal-password"
                        type="button"
                        aria-label={
                          mostrarPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        aria-pressed={mostrarPassword}
                        onClick={() => setMostrarPassword(!mostrarPassword)}
                      >
                        <Icono tipo="ojo" />
                      </button>
                    </div>
                    <div className="form-tools">
                      <label className="remember">
                        <input
                          type="checkbox"
                          checked={recordarCorreo}
                          onChange={(evento) =>
                            setRecordarCorreo(evento.target.checked)
                          }
                        />
                        <span>Recordar mi correo</span>
                      </label>
                    </div>
                    {error && (
                      <p className="error-message" role="alert">
                        {error}
                      </p>
                    )}
                    <button
                      className="primary-action"
                      type="submit"
                      disabled={cargando}
                    >
                      {cargando ? "Ingresando..." : "Iniciar sesión"}
                    </button>
                  </form>
                  <div className="divider">
                    <span>o continúa con</span>
                  </div>
                  <GoogleSignIn
                    onCredential={iniciarConGoogle}
                    disabled={cargando}
                  />
                  <p className="access-note">
                    ¿Aún no tienes cuenta?{" "}
                    <button
                      className="registro-enlace"
                      type="button"
                      disabled={cargando}
                      onClick={() => {
                        setError(null);
                        setPassword("");
                        setMostrarRegistro(true);
                      }}
                    >
                      Crear cuenta con correo
                    </button>
                    <br />
                    También puedes continuar con Google.
                  </p>
                </>
              )}
            </div>
          </section>
        </main>
      )}
      {!sesion && (
        <footer className="site-footer">
          <span>
            © {new Date().getFullYear()} GovMarket Analytics. Todos los derechos
            reservados.
          </span>
          <span className={"api-status api-status--" + estadoApi} role="status">
            <span className="status-dot" aria-hidden="true" />
            {estadoApi === "conectada"
              ? "En línea"
              : estadoApi === "desconectada"
                ? "API no disponible"
                : "Verificando API"}
          </span>
        </footer>
      )}
    </div>
  );
}

export default App;
