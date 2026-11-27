import { useEffect, useRef, useState } from "react";
type PasoPerfil = "empresa" | "etiquetas" | "preferencias" | "resumen";
type VistaWorkspace =
  | "inicio"
  | "oportunidades"
  | "recomendadas"
  | "analisis"
  | "reportes"
  | "usuarios"
  | "ayuda";

interface WorkspaceSidebarProps {
  modo: "onboarding" | "dashboard";
  nombreUsuario: string;
  nombreEmpresa?: string | null;
  plan?: string | null;
  pasoActivo?: PasoPerfil;
  pasoDisponible?: number;
  vistaActiva?: VistaWorkspace;
  onSeleccionarPaso?: (paso: PasoPerfil) => void;
  onNavegar?: (vista: VistaWorkspace) => void;
  onCerrarSesion: () => void;
}

type IconoMenu =
  | "inicio"
  | "oportunidades"
  | "estrella"
  | "grafico"
  | "documento"
  | "empresa"
  | "usuarios"
  | "ayuda"
  | "salir"
  | "check"
  | "candado";

function Icono({ tipo }: { tipo: IconoMenu }) {
  const trazos = {
    inicio: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5M9 21v-7h6v7" />
      </>
    ),
    oportunidades: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m12 7 1.6 3.4L17 12l-3.4 1.6L12 17l-1.6-3.4L7 12l3.4-1.6Z" />
      </>
    ),
    estrella: (
      <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z" />
    ),
    grafico: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
        <path d="M2 20h21" />
      </>
    ),
    documento: (
      <>
        <path d="M6 2h9l4 4v16H6Z" />
        <path d="M14 2v5h5M9 12h7M9 16h7" />
      </>
    ),
    empresa: (
      <>
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M2 21h20M8 10h2M14 10h2M8 14h2M14 14h2M10 21v-3h4v3" />
      </>
    ),
    usuarios: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2" />
      </>
    ),
    ayuda: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.8M12 17h.01" />
      </>
    ),
    salir: (
      <>
        <path d="M10 4H4v16h6M15 8l4 4-4 4M8 12h11" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    candado: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };

  return (
    <svg
      className="workspace-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {trazos[tipo]}
    </svg>
  );
}

const pasosPerfil: Array<{
  id: PasoPerfil;
  numero: number;
  etiqueta: string;
}> = [
  { id: "empresa", numero: 1, etiqueta: "Perfil empresarial" },
  { id: "etiquetas", numero: 2, etiqueta: "Etiquetas y capacidades" },
  { id: "preferencias", numero: 3, etiqueta: "Preferencias comerciales" },
  { id: "resumen", numero: 4, etiqueta: "Resumen y confirmación" },
];

function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase())
      .join("") || "GM"
  );
}

export function WorkspaceSidebar({
  modo,
  nombreUsuario,
  nombreEmpresa,
  plan,
  pasoActivo,
  pasoDisponible = 1,
  vistaActiva = "inicio",
  onSeleccionarPaso,
  onNavegar,
  onCerrarSesion,
}: WorkspaceSidebarProps) {
  const enOnboarding = modo === "onboarding";
  const [empresaDesplegada, setEmpresaDesplegada] = useState(enOnboarding);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const botonAbrirRef = useRef<HTMLButtonElement>(null);
  const botonCerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuMovilAbierto) return;

    const overflowAnterior = document.body.style.overflow;

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setMenuMovilAbierto(false);
        botonAbrirRef.current?.focus();
      }
    }

    function cerrarAlAmpliarPantalla() {
      if (window.innerWidth > 900) setMenuMovilAbierto(false);
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", cerrarConEscape);
    window.addEventListener("resize", cerrarAlAmpliarPantalla);
    botonCerrarRef.current?.focus();

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", cerrarConEscape);
      window.removeEventListener("resize", cerrarAlAmpliarPantalla);
    };
  }, [menuMovilAbierto]);

  function cerrarMenuMovil(devolverFoco = false) {
    setMenuMovilAbierto(false);
    if (devolverFoco) {
      window.requestAnimationFrame(() => botonAbrirRef.current?.focus());
    }
  }

  function navegar(vista: VistaWorkspace) {
    onNavegar?.(vista);
    cerrarMenuMovil();
  }

  function seleccionarPaso(paso: PasoPerfil) {
    onSeleccionarPaso?.(paso);
    cerrarMenuMovil();
  }

  function cerrarSesion() {
    cerrarMenuMovil();
    onCerrarSesion();
  }

  return (
    <>
      <header className="workspace-mobile-header">
        <button
          ref={botonAbrirRef}
          className="workspace-mobile-menu-button"
          type="button"
          aria-label="Abrir menú principal"
          aria-controls="workspace-sidebar"
          aria-expanded={menuMovilAbierto}
          onClick={() => setMenuMovilAbierto(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <img src="/govmarket-logo.png" alt="GovMarket Analytics" />
        <span className="workspace-mobile-avatar" aria-hidden="true">
          {iniciales(nombreUsuario)}
        </span>
      </header>

      <button
        className={`workspace-sidebar-overlay${menuMovilAbierto ? " is-visible" : ""}`}
        type="button"
        aria-label="Cerrar menú principal"
        tabIndex={menuMovilAbierto ? 0 : -1}
        onClick={() => cerrarMenuMovil(true)}
      />

      <aside
        id="workspace-sidebar"
        className={`workspace-sidebar${menuMovilAbierto ? " is-mobile-open" : ""}`}
        aria-label="Menú de GovMarket Analytics"
      >
        <div className="workspace-brand">
          <img src="/govmarket-logo.png" alt="GovMarket Analytics" />
          <button
            ref={botonCerrarRef}
            className="workspace-mobile-close"
            type="button"
            aria-label="Cerrar menú principal"
            onClick={() => cerrarMenuMovil(true)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className="workspace-nav" aria-label="Navegación principal">
          <p className="workspace-nav-label">MENÚ PRINCIPAL</p>
          <button
            className={
              modo === "dashboard" && vistaActiva === "inicio"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("inicio")}
          >
            <Icono tipo="inicio" />
            <span>Inicio</span>
            {enOnboarding && <Icono tipo="candado" />}
          </button>
          <button
            className={
              modo === "dashboard" && vistaActiva === "oportunidades"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("oportunidades")}
          >
            <Icono tipo="oportunidades" />
            <span>Oportunidades</span>
            {enOnboarding && <Icono tipo="candado" />}
          </button>
          <button
            className={
              modo === "dashboard" && vistaActiva === "recomendadas"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("recomendadas")}
          >
            <Icono tipo="estrella" />
            <span>Recomendadas para mí</span>
            {!enOnboarding && (
              <span className="workspace-feature-badge">PREMIUM</span>
            )}
            {enOnboarding && <Icono tipo="candado" />}
          </button>
          <button
            className={
              modo === "dashboard" && vistaActiva === "analisis"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("analisis")}
          >
            <Icono tipo="grafico" />
            <span>Análisis de mercado</span>
            {!enOnboarding && (
              <span className="workspace-feature-badge">PREMIUM</span>
            )}
            {enOnboarding && <Icono tipo="candado" />}
          </button>
          <button
            className={
              modo === "dashboard" && vistaActiva === "reportes"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("reportes")}
          >
            <Icono tipo="documento" />
            <span>Reportes</span>
            {!enOnboarding && (
              <span className="workspace-feature-badge">PREMIUM</span>
            )}
            {enOnboarding && <Icono tipo="candado" />}
          </button>

          <p className="workspace-nav-label workspace-nav-label--section">
            MI EMPRESA
          </p>
          <button
            className="workspace-company-title"
            type="button"
            onClick={() => setEmpresaDesplegada((actual) => !actual)}
            aria-expanded={empresaDesplegada}
          >
            <Icono tipo="empresa" />
            <span>{nombreEmpresa || "Configuración inicial"}</span>
            <span>{empresaDesplegada ? "▲" : "▼"}</span>
          </button>
          {empresaDesplegada && (
            <div className="workspace-profile-steps">
              {pasosPerfil.map((paso) => {
                const disponible =
                  !enOnboarding || paso.numero <= pasoDisponible;
                const completado = enOnboarding && paso.numero < pasoDisponible;
                const activo = enOnboarding && paso.id === pasoActivo;

                return (
                  <button
                    key={paso.id}
                    className={activo ? "is-active" : ""}
                    type="button"
                    disabled={!disponible}
                    onClick={() => disponible && seleccionarPaso(paso.id)}
                  >
                    <span
                      className={`workspace-step-state${completado ? " is-complete" : ""}`}
                    >
                      {completado ? <Icono tipo="check" /> : paso.numero}
                    </span>
                    <span>{paso.etiqueta}</span>
                    {!disponible && <Icono tipo="candado" />}
                  </button>
                );
              })}
            </div>
          )}

          <p className="workspace-nav-label workspace-nav-label--section">
            ADMINISTRACIÓN
          </p>
          <button
            className={
              modo === "dashboard" && vistaActiva === "usuarios"
                ? "is-active"
                : ""
            }
            type="button"
            disabled={enOnboarding}
            onClick={() => navegar("usuarios")}
          >
            <Icono tipo="usuarios" />
            <span>Usuarios y permisos</span>
            {!enOnboarding && (
              <span className="workspace-feature-badge workspace-feature-badge--empresa">
                EMPRESA
              </span>
            )}
            {enOnboarding && <Icono tipo="candado" />}
          </button>
        </nav>

        <div className="workspace-sidebar-footer">
          <button
            className={`workspace-help${modo === "dashboard" && vistaActiva === "ayuda" ? " is-active" : ""}`}
            type="button"
            onClick={() => navegar("ayuda")}
          >
            <Icono tipo="ayuda" />
            <span>Centro de ayuda</span>
          </button>
          <div className="workspace-user">
            <span className="workspace-avatar">{iniciales(nombreUsuario)}</span>
            <div>
              <strong>{nombreUsuario}</strong>
              <small>
                {plan === "gratuito" || !plan
                  ? "Plan gratuito"
                  : `Plan ${plan}`}
              </small>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <Icono tipo="salir" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export type { PasoPerfil, VistaWorkspace };
