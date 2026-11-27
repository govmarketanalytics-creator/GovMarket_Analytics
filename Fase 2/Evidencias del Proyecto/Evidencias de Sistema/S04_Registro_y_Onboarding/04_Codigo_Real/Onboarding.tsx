import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  WorkspaceSidebar,
  type PasoPerfil,
} from "../workspace/WorkspaceSidebar";
import "../workspace/Workspace.css";
import "./Onboarding.css";
import { SelectorOfertas, type OfertaCatalogo } from "./SelectorOfertas";

interface EmpresaOnboarding {
  id: string;
  rut: string;
  razonSocial: string;
  nombreFantasia: string | null;
  descripcion: string | null;
  sitioWeb: string | null;
  regionPrincipal: string | null;
  comuna: string | null;
  tamanioEmpresa: "micro" | "pequena" | "mediana" | "grande" | null;
  anioFundacion: number | null;
  correoContacto: string | null;
  telefonoContacto: string | null;
  onboardingPaso: number;
  onboardingCompletado: boolean;
  onboardingCompletadoEn: string | null;
  estado: string;
}

interface MembresiaOnboarding {
  id: string;
  rol: string;
  activa: boolean;
}

interface PerfilOnboarding {
  ofertasIds?: string[];
  nexusHabilitado?: boolean;
  actualizadoEn?: string;
  id: string;
  empresaId: string;
  palabrasClave: string[];
  etiquetasCapacidades: string[];
  codigosCategoria: string[];
  regiones: string[];
  montoMinimo: number | null;
  montoMaximo: number | null;
  incluirSinMonto: boolean;
  tiposOportunidad: TipoOportunidad[];
  frecuenciaAlertas: FrecuenciaAlertas | null;
  puntajeMinimoAlerta: number;
  activo: boolean;
}

interface PlanOnboarding {
  plan: string;
  estado: string;
  premiumVigente: boolean;
  vigenteHasta: string | null;
}

interface RubroCatalogo {
  id: string;
  nombre: string;
  etiquetas: Array<{ id: string; nombre: string }>;
}

type PasoSiguiente = PasoPerfil | "esperar_configuracion" | "dashboard";

type TipoOportunidad =
  "licitacion_publica" | "trato_directo" | "convenio_marco" | "compra_agil";

type FrecuenciaAlertas = "tiempo_real" | "diaria" | "semanal";

export interface EstadoOnboarding {
  completado: boolean;
  pasoActual: number;
  progreso: number;
  pasoSiguiente: PasoSiguiente;
  empresa: EmpresaOnboarding | null;
  membresia: MembresiaOnboarding | null;
  perfilConfigurado: boolean;
  perfil: PerfilOnboarding | null;
  plan: PlanOnboarding | null;
}

interface OnboardingProps {
  accessToken: string;
  estado: EstadoOnboarding;
  nombreUsuario: string;
  onCerrarSesion: () => void;
  onEstadoActualizado: (estado: EstadoOnboarding) => void;
  onSesionExpirada: () => void;
}

const apiBase = "/api/v1";

const regionesChile = [
  "Región de Arica y Parinacota",
  "Región de Tarapacá",
  "Región de Antofagasta",
  "Región de Atacama",
  "Región de Coquimbo",
  "Región de Valparaíso",
  "Región Metropolitana de Santiago",
  "Región del Libertador General Bernardo O'Higgins",
  "Región del Maule",
  "Región de Ñuble",
  "Región del Biobío",
  "Región de La Araucanía",
  "Región de Los Ríos",
  "Región de Los Lagos",
  "Región de Aysén del General Carlos Ibáñez del Campo",
  "Región de Magallanes y de la Antártica Chilena",
];

const tiposOportunidad: Array<{
  id: TipoOportunidad;
  titulo: string;
  detalle: string;
}> = [
  {
    id: "licitacion_publica",
    titulo: "Licitación pública",
    detalle: "Procesos competitivos publicados en Mercado Público.",
  },
  {
    id: "compra_agil",
    titulo: "Compra Ágil",
    detalle: "Compras rápidas y de menor monto.",
  },
  {
    id: "trato_directo",
    titulo: "Trato directo",
    detalle: "Oportunidades con contratación excepcional.",
  },
  {
    id: "convenio_marco",
    titulo: "Convenio Marco",
    detalle: "Procesos asociados a catálogos electrónicos.",
  },
];

const frecuencias: Array<{
  id: FrecuenciaAlertas;
  titulo: string;
  detalle: string;
}> = [
  {
    id: "tiempo_real",
    titulo: "En tiempo real",
    detalle: "Al detectar una oportunidad relevante.",
  },
  {
    id: "diaria",
    titulo: "Resumen diario",
    detalle: "Una síntesis cada día hábil.",
  },
  {
    id: "semanal",
    titulo: "Resumen semanal",
    detalle: "Una selección consolidada por semana.",
  },
];

const etiquetasTamanio: Record<string, string> = {
  micro: "Microempresa (1 a 9 personas)",
  pequena: "Pequeña empresa (10 a 49 personas)",
  mediana: "Mediana empresa (50 a 199 personas)",
  grande: "Gran empresa (200 o más personas)",
};

const titulosPaso: Record<PasoPerfil, { titulo: string; descripcion: string }> =
  {
    empresa: {
      titulo: "Información de la empresa",
      descripcion: "Cuéntanos los datos principales de tu organización.",
    },
    etiquetas: {
      titulo: "Etiquetas y capacidades",
      descripcion:
        "Define qué hace tu empresa y en qué áreas tiene experiencia.",
    },
    preferencias: {
      titulo: "Preferencias comerciales",
      descripcion:
        "Ajusta los criterios que utilizaremos para encontrar oportunidades.",
    },
    resumen: {
      titulo: "Revisa y confirma tu perfil",
      descripcion:
        "Comprueba la información antes de activar tus recomendaciones.",
    },
  };

async function obtenerMensajeError(
  respuesta: Response,
  mensajePredeterminado: string,
): Promise<string> {
  try {
    const datos = (await respuesta.json()) as { message?: string | string[] };

    if (Array.isArray(datos.message)) return datos.message.join(". ");
    if (typeof datos.message === "string") return datos.message;
  } catch {
    // La API puede responder sin cuerpo en errores de infraestructura.
  }

  return mensajePredeterminado;
}

function esPasoPerfil(paso: PasoSiguiente): paso is PasoPerfil {
  return ["empresa", "etiquetas", "preferencias", "resumen"].includes(paso);
}

function agregarSinDuplicar(valores: string[], nuevoValor: string): string[] {
  const limpio = nuevoValor.trim();

  if (!limpio) return valores;
  if (
    valores.some(
      (valor) =>
        valor.toLocaleLowerCase("es-CL") === limpio.toLocaleLowerCase("es-CL"),
    )
  ) {
    return valores;
  }

  return [...valores, limpio];
}

function formatearMonto(valor: number | null): string {
  if (valor === null) return "Sin límite";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

function ProgresoCircular({ paso }: { paso: number }) {
  const porcentaje = paso * 25;

  return (
    <div className="side-progress-card">
      <h3>Tu progreso</h3>
      <div
        className="side-progress-ring"
        style={{
          background: `conic-gradient(#159675 ${porcentaje}%, #e5ebef ${porcentaje}% 100%)`,
        }}
      >
        <div>
          <strong>{porcentaje}%</strong>
        </div>
      </div>
      <strong>Paso {paso} de 4</strong>
      <span>
        {
          titulosPaso[
            ["empresa", "etiquetas", "preferencias", "resumen"][
              paso - 1
            ] as PasoPerfil
          ].titulo
        }
      </span>
    </div>
  );
}

function PanelLateral({
  paso,
  regiones,
  tiposSeleccionados,
  frecuenciaAlertas,
  montoMinimo,
  montoMaximo,
}: {
  paso: 1 | 2 | 3;
  regiones: string[];
  tiposSeleccionados: TipoOportunidad[];
  frecuenciaAlertas: FrecuenciaAlertas;
  montoMinimo: string;
  montoMaximo: string;
}) {
  return (
    <aside className="onboarding-side-panel">
      {paso === 1 && (
        <section className="side-advice-card side-advice-card--green">
          <h3>Consejos</h3>
          <ul>
            <li>
              Completa todos los campos para obtener mejores recomendaciones.
            </li>
            <li>Podrás editar esta información en cualquier momento.</li>
            <li>Los datos opcionales ayudan a mejorar la precisión.</li>
          </ul>
        </section>
      )}

      {paso === 2 && (
        <>
          <section className="side-advice-card side-advice-card--green">
            <h3>¿Qué son las etiquetas?</h3>
            <p>
              Permiten identificar oportunidades que coinciden con las
              capacidades reales de tu empresa.
            </p>
          </section>
          <section className="side-advice-card">
            <h3>Consejos para elegir</h3>
            <ul>
              <li>
                Sé específico y elige conceptos que representen tus servicios.
              </li>
              <li>Menos es más: conserva las etiquetas relevantes.</li>
              <li>Revísalas cuando cambien tus capacidades.</li>
            </ul>
          </section>
        </>
      )}

      {paso === 3 && (
        <section className="side-advice-card side-preferences-card">
          <h3>Resumen de preferencias</h3>
          <dl>
            <div>
              <dt>Regiones</dt>
              <dd>
                {regiones.length === 0
                  ? "Todas las regiones de Chile"
                  : `${regiones.length} seleccionadas`}
              </dd>
            </div>
            <div>
              <dt>Rango de montos</dt>
              <dd>
                {formatearMonto(
                  montoMinimo === "" ? null : Number(montoMinimo),
                )}{" "}
                —{" "}
                {formatearMonto(
                  montoMaximo === "" ? null : Number(montoMaximo),
                )}
              </dd>
            </div>
            <div>
              <dt>Tipos de oportunidades</dt>
              <dd>{tiposSeleccionados.length} seleccionados</dd>
            </div>
            <div>
              <dt>Frecuencia de alertas</dt>
              <dd>
                {
                  frecuencias.find(
                    (frecuencia) => frecuencia.id === frecuenciaAlertas,
                  )?.titulo
                }
              </dd>
            </div>
          </dl>
        </section>
      )}

      <ProgresoCircular paso={paso} />
    </aside>
  );
}

export function Onboarding({
  accessToken,
  estado,
  nombreUsuario,
  onCerrarSesion,
  onEstadoActualizado,
  onSesionExpirada,
}: OnboardingProps) {
  const pasoInicial = esPasoPerfil(estado.pasoSiguiente)
    ? estado.pasoSiguiente
    : "empresa";
  const [vista, setVista] = useState<PasoPerfil>(pasoInicial);

  const [rut, setRut] = useState(estado.empresa?.rut ?? "");
  const [razonSocial, setRazonSocial] = useState(
    estado.empresa?.razonSocial ?? "",
  );
  const [nombreFantasia, setNombreFantasia] = useState(
    estado.empresa?.nombreFantasia ?? "",
  );
  const [descripcion, setDescripcion] = useState(
    estado.empresa?.descripcion ?? "",
  );
  const [sitioWeb, setSitioWeb] = useState(estado.empresa?.sitioWeb ?? "");
  const [regionPrincipal, setRegionPrincipal] = useState(
    estado.empresa?.regionPrincipal ?? "",
  );
  const [comuna, setComuna] = useState(estado.empresa?.comuna ?? "");
  const [tamanioEmpresa, setTamanioEmpresa] = useState(
    estado.empresa?.tamanioEmpresa ?? "",
  );
  const [anioFundacion, setAnioFundacion] = useState(
    estado.empresa?.anioFundacion ? String(estado.empresa.anioFundacion) : "",
  );
  const [correoContacto, setCorreoContacto] = useState(
    estado.empresa?.correoContacto ?? "",
  );
  const [telefonoContacto, setTelefonoContacto] = useState(
    estado.empresa?.telefonoContacto ?? "",
  );

  const [etiquetas, setEtiquetas] = useState(
    estado.perfil?.etiquetasCapacidades ?? [],
  );
  const [ofertasIds, setOfertasIds] = useState<string[]>(estado.perfil?.ofertasIds ?? []);
  const [ofertasCatalogo, setOfertasCatalogo] = useState<OfertaCatalogo[]>([]);
  const [nexusActivo, setNexusActivo] = useState(Boolean(estado.perfil?.nexusHabilitado));
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [catalogoEtiquetas, setCatalogoEtiquetas] = useState<RubroCatalogo[]>(
    [],
  );
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  const [regiones, setRegiones] = useState<string[]>(
    estado.perfil?.regiones ?? [],
  );
  const [montoMinimo, setMontoMinimo] = useState(
    estado.perfil?.montoMinimo === null ||
      estado.perfil?.montoMinimo === undefined
      ? ""
      : String(estado.perfil.montoMinimo),
  );
  const [montoMaximo, setMontoMaximo] = useState(
    estado.perfil?.montoMaximo === null ||
      estado.perfil?.montoMaximo === undefined
      ? ""
      : String(estado.perfil.montoMaximo),
  );
  const [incluirSinMonto, setIncluirSinMonto] = useState(
    estado.perfil?.incluirSinMonto ?? true,
  );
  const [tiposSeleccionados, setTiposSeleccionados] = useState<
    TipoOportunidad[]
  >(
    estado.perfil?.tiposOportunidad.length
      ? estado.perfil.tiposOportunidad
      : ["licitacion_publica"],
  );
  const [frecuenciaAlertas, setFrecuenciaAlertas] = useState<FrecuenciaAlertas>(
    estado.perfil?.frecuenciaAlertas ?? "diaria",
  );
  const [palabrasClave, setPalabrasClave] = useState(
    estado.perfil?.palabrasClave ?? [],
  );
  const [nuevaPalabra, setNuevaPalabra] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pasoVista =
    ["empresa", "etiquetas", "preferencias", "resumen"].indexOf(vista) + 1;
  const pasoDisponible = estado.completado ? 4 : Math.max(1, estado.pasoActual);
  const progresoVista = pasoVista * 25;
  const nombreEmpresa =
    estado.empresa?.nombreFantasia || estado.empresa?.razonSocial;

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarCatalogo() {
      try {
        const respuesta = await fetch(
          `${apiBase}/licitaciones/catalogo-etiquetas`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controlador.signal,
          },
        );

        if (respuesta.status === 401) {
          onSesionExpirada();
          return;
        }

        if (!respuesta.ok) return;

        const datos = (await respuesta.json()) as { rubros?: RubroCatalogo[];
          nexus?: { habilitado: boolean; ofertas: OfertaCatalogo[] } };
        setNexusActivo(Boolean(datos.nexus?.habilitado));
        setOfertasCatalogo(datos.nexus?.ofertas ?? []);
        setCatalogoEtiquetas(datos.rubros ?? []);
      } catch (errorCarga: unknown) {
        if (
          !(errorCarga instanceof DOMException) ||
          errorCarga.name !== "AbortError"
        ) {
          setCatalogoEtiquetas([]);
        }
      } finally {
        setCargandoCatalogo(false);
      }
    }

    void cargarCatalogo();
    return () => controlador.abort();
  }, [accessToken, onSesionExpirada]);

  function aplicarEstado(actualizado: EstadoOnboarding, continuarEn?: PasoPerfil) {
    // El estado persistido de una empresa ya configurada devuelve dashboard.
    // Guardar un paso debe conservar el asistente hasta confirmar el resumen.
    const siguiente = continuarEn ?? actualizado.pasoSiguiente;
    onEstadoActualizado({ ...actualizado, pasoSiguiente: siguiente });

    if (esPasoPerfil(siguiente)) {
      setVista(siguiente);
    }
  }

  async function enviarEstado(
    ruta: string,
    metodo: "POST" | "PUT",
    cuerpo?: unknown,
    mensajeError = "No fue posible guardar la información.",
  ): Promise<EstadoOnboarding | null> {
    const respuesta = await fetch(`${apiBase}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });

    if (respuesta.status === 401) {
      onSesionExpirada();
      return null;
    }

    if (!respuesta.ok) {
      throw new Error(await obtenerMensajeError(respuesta, mensajeError));
    }

    return (await respuesta.json()) as EstadoOnboarding;
  }

  async function guardarEmpresa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const actualizado = await enviarEstado(
        "/onboarding/empresa",
        estado.empresa ? "PUT" : "POST",
        {
          rut: rut.trim(),
          razonSocial: razonSocial.trim(),
          nombreFantasia: nombreFantasia.trim() || null,
          descripcion: descripcion.trim(),
          sitioWeb: sitioWeb.trim() || null,
          regionPrincipal,
          comuna: comuna.trim(),
          tamanioEmpresa,
          anioFundacion: anioFundacion === "" ? null : Number(anioFundacion),
          correoContacto: correoContacto.trim(),
          telefonoContacto: telefonoContacto.trim(),
        },
        "No fue posible guardar la información de la empresa.",
      );

      if (actualizado) aplicarEstado(actualizado, "etiquetas");
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setGuardando(false);
    }
  }

  function agregarEtiqueta(valor = nuevaEtiqueta) {
    const limpio = valor.trim();
    if (limpio.length < 2 || limpio.length > 100) {
      setError("Cada etiqueta debe tener entre 2 y 100 caracteres.");
      return;
    }
    if (etiquetas.length >= 50 && !etiquetas.some(e => e.toLocaleLowerCase("es-CL") === limpio.toLocaleLowerCase("es-CL"))) {
      setError("Puedes guardar hasta 50 etiquetas complementarias.");
      return;
    }
    setError(null);
    const actualizadas = agregarSinDuplicar(etiquetas, valor);
    setEtiquetas(actualizadas);

    if (valor === nuevaEtiqueta) setNuevaEtiqueta("");
  }

  function alternarEtiquetaCatalogo(
    nombre: string,
    seleccionada: boolean,
  ): void {
    if (seleccionada) {
      setEtiquetas((actuales) =>
        actuales.filter(
          (valor) =>
            valor.toLocaleLowerCase("es-CL") !==
            nombre.toLocaleLowerCase("es-CL"),
        ),
      );
      return;
    }

    agregarEtiqueta(nombre);
  }

  function agregarPalabra(valor = nuevaPalabra) {
    const actualizadas = agregarSinDuplicar(palabrasClave, valor);
    setPalabrasClave(actualizadas);

    if (valor === nuevaPalabra) setNuevaPalabra("");
  }

  function agregarConEnter(
    evento: KeyboardEvent<HTMLInputElement>,
    accion: () => void,
  ) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      accion();
    }
  }

  async function guardarEtiquetas(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (nexusActivo && (ofertasIds.length === 0 || ofertasIds.some(id => !ofertasCatalogo.some(o => o.id === id)))) {
      setError("Selecciona al menos una oferta específica del catálogo disponible.");
      return;
    }
    if (!nexusActivo && etiquetas.length === 0) {
      setError("Agrega al menos una etiqueta o capacidad para continuar.");
      return;
    }

    setGuardando(true);

    try {
      const actualizado = await enviarEstado(
        "/onboarding/etiquetas",
        "PUT",
        { etiquetasCapacidades: etiquetas,
          ...(nexusActivo ? { ofertasIds } : {}) },
        "No fue posible guardar las etiquetas y capacidades.",
      );

      if (actualizado) aplicarEstado(actualizado, "preferencias");
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setGuardando(false);
    }
  }

  function alternarRegion(region: string) {
    setRegiones((actuales) =>
      actuales.includes(region)
        ? actuales.filter((elemento) => elemento !== region)
        : [...actuales, region],
    );
  }

  function alternarTipo(tipo: TipoOportunidad) {
    setTiposSeleccionados((actuales) =>
      actuales.includes(tipo)
        ? actuales.filter((elemento) => elemento !== tipo)
        : [...actuales, tipo],
    );
  }

  async function guardarPreferencias(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const minimo = montoMinimo === "" ? null : Number(montoMinimo);
    const maximo = montoMaximo === "" ? null : Number(montoMaximo);

    if (tiposSeleccionados.length === 0) {
      setError("Selecciona al menos un tipo de oportunidad.");
      return;
    }

    if (minimo !== null && maximo !== null && minimo > maximo) {
      setError("El monto máximo no puede ser menor que el monto mínimo.");
      return;
    }

    setGuardando(true);

    try {
      const actualizado = await enviarEstado(
        "/onboarding/preferencias",
        "PUT",
        {
          regiones,
          montoMinimo: minimo,
          montoMaximo: maximo,
          incluirSinMonto,
          tiposOportunidad: tiposSeleccionados,
          frecuenciaAlertas,
          palabrasClave,
        },
        "No fue posible guardar las preferencias comerciales.",
      );

      if (actualizado) aplicarEstado(actualizado, "resumen");
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarPerfil() {
    setGuardando(true);
    setError(null);

    try {
      const actualizado = await enviarEstado(
        "/onboarding/confirmar",
        "POST",
        undefined,
        "No fue posible activar el perfil.",
      );

      if (actualizado) aplicarEstado(actualizado);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No fue posible conectar con la API.",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (estado.pasoSiguiente === "esperar_configuracion") {
    return (
      <div className="workspace-layout">
        <WorkspaceSidebar
          modo="onboarding"
          nombreUsuario={nombreUsuario}
          nombreEmpresa={nombreEmpresa}
          plan={estado.plan?.plan}
          pasoDisponible={estado.pasoActual}
          onCerrarSesion={onCerrarSesion}
        />
        <main className="workspace-main onboarding-main onboarding-waiting-page">
          <section className="onboarding-waiting-card">
            <span aria-hidden="true">✓</span>
            <h1>Tu empresa ya está registrada</h1>
            <p>
              Un administrador debe terminar la configuración del perfil antes
              de que puedas consultar oportunidades.
            </p>
            <button type="button" onClick={onCerrarSesion}>
              Cerrar sesión
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        modo="onboarding"
        nombreUsuario={nombreUsuario}
        nombreEmpresa={nombreEmpresa}
        plan={estado.plan?.plan}
        pasoActivo={vista}
        pasoDisponible={pasoDisponible}
        onSeleccionarPaso={(paso) => {
          setError(null);
          setVista(paso);
        }}
        onCerrarSesion={onCerrarSesion}
      />

      <main className="workspace-main onboarding-main">
        <header className="onboarding-topbar">
          <div>
            <strong>Configuración inicial</strong>
            <span>Completa tu perfil para comenzar</span>
          </div>
          <div
            className="onboarding-topbar-actions"
            aria-label="Ayuda de configuración"
          >
            <button type="button" aria-label="Ayuda">
              ?
            </button>
            <span>ES</span>
          </div>
        </header>

        <div className="onboarding-content">
          <section className="onboarding-page-heading">
            <div>
              <p>PASO {pasoVista} DE 4</p>
              <h1>{titulosPaso[vista].titulo}</h1>
              <span>{titulosPaso[vista].descripcion}</span>
            </div>
            <div className="onboarding-progress-summary">
              <strong>{progresoVista}%</strong>
              <span>Perfil completado</span>
            </div>
          </section>

          <ol
            className="onboarding-stepper"
            aria-label="Progreso de la configuración"
          >
            {(
              [
                "empresa",
                "etiquetas",
                "preferencias",
                "resumen",
              ] as PasoPerfil[]
            ).map((paso, indice) => {
              const numero = indice + 1;
              const disponible = numero <= pasoDisponible;
              const completado = numero < pasoDisponible || estado.completado;
              const activo = paso === vista;

              return (
                <li
                  key={paso}
                  className={`${activo ? "is-active" : ""}${completado ? " is-complete" : ""}`}
                >
                  <button
                    type="button"
                    disabled={!disponible}
                    onClick={() => disponible && setVista(paso)}
                  >
                    <span>{completado && !activo ? "✓" : numero}</span>
                    <strong>{titulosPaso[paso].titulo}</strong>
                  </button>
                </li>
              );
            })}
          </ol>

          {vista === "empresa" && (
            <form
              className="onboarding-panel onboarding-company-form"
              onSubmit={guardarEmpresa}
            >
              <div className="onboarding-panel-header">
                <span className="panel-icon" aria-hidden="true">
                  01
                </span>
                <div>
                  <h2>Datos generales</h2>
                  <p>
                    La información será visible únicamente para los integrantes
                    de tu empresa.
                  </p>
                </div>
              </div>

              <div className="onboarding-panel-layout">
                <div className="onboarding-form-body">
                  <div className="onboarding-fields onboarding-fields--two">
                    <label>
                      RUT de la empresa <b>*</b>
                      <input
                        value={rut}
                        onChange={(evento) => setRut(evento.target.value)}
                        placeholder="76.123.456-7"
                        required
                      />
                      <small>Puedes escribirlo con o sin puntos.</small>
                    </label>
                    <label>
                      Razón social <b>*</b>
                      <input
                        value={razonSocial}
                        onChange={(evento) =>
                          setRazonSocial(evento.target.value)
                        }
                        placeholder="Empresa Ejemplo SpA"
                        autoComplete="organization"
                        required
                      />
                    </label>
                    <label>
                      Nombre de fantasía
                      <input
                        value={nombreFantasia}
                        onChange={(evento) =>
                          setNombreFantasia(evento.target.value)
                        }
                        placeholder="Nombre comercial de la empresa"
                      />
                    </label>
                    <label>
                      Sitio web
                      <input
                        value={sitioWeb}
                        onChange={(evento) => setSitioWeb(evento.target.value)}
                        placeholder="www.empresa.cl"
                        inputMode="url"
                      />
                    </label>
                    <label className="field-span-two">
                      Descripción de la empresa <b>*</b>
                      <textarea
                        value={descripcion}
                        onChange={(evento) =>
                          setDescripcion(evento.target.value)
                        }
                        placeholder="Describe brevemente los servicios, productos y experiencia de tu empresa."
                        minLength={20}
                        maxLength={1000}
                        rows={4}
                        required
                      />
                      <small>{descripcion.length}/1000 caracteres</small>
                    </label>
                  </div>

                  <div className="onboarding-form-section">
                    <h3>Ubicación y tamaño</h3>
                    <div className="onboarding-fields onboarding-fields--two">
                      <label>
                        Región principal <b>*</b>
                        <select
                          value={regionPrincipal}
                          onChange={(evento) =>
                            setRegionPrincipal(evento.target.value)
                          }
                          required
                        >
                          <option value="">Selecciona una región</option>
                          {regionesChile.map((region) => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Comuna <b>*</b>
                        <input
                          value={comuna}
                          onChange={(evento) => setComuna(evento.target.value)}
                          placeholder="Ej.: Santiago"
                          required
                        />
                      </label>
                      <label>
                        Tamaño de empresa <b>*</b>
                        <select
                          value={tamanioEmpresa}
                          onChange={(evento) =>
                            setTamanioEmpresa(
                              evento.target.value as typeof tamanioEmpresa,
                            )
                          }
                          required
                        >
                          <option value="">Selecciona una alternativa</option>
                          <option value="micro">
                            Microempresa (1 a 9 personas)
                          </option>
                          <option value="pequena">
                            Pequeña empresa (10 a 49 personas)
                          </option>
                          <option value="mediana">
                            Mediana empresa (50 a 199 personas)
                          </option>
                          <option value="grande">
                            Gran empresa (200 o más personas)
                          </option>
                        </select>
                      </label>
                      <label>
                        Año de fundación
                        <input
                          type="number"
                          min="1800"
                          max={new Date().getFullYear()}
                          value={anioFundacion}
                          onChange={(evento) =>
                            setAnioFundacion(evento.target.value)
                          }
                          placeholder="Ej.: 2018"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="onboarding-form-section">
                    <h3>Datos de contacto</h3>
                    <div className="onboarding-fields onboarding-fields--two">
                      <label>
                        Correo de contacto <b>*</b>
                        <input
                          type="email"
                          value={correoContacto}
                          onChange={(evento) =>
                            setCorreoContacto(evento.target.value)
                          }
                          placeholder="contacto@empresa.cl"
                          required
                        />
                      </label>
                      <label>
                        Teléfono de contacto <b>*</b>
                        <input
                          value={telefonoContacto}
                          onChange={(evento) =>
                            setTelefonoContacto(evento.target.value)
                          }
                          placeholder="+56 9 1234 5678"
                          inputMode="tel"
                          required
                        />
                      </label>
                    </div>
                  </div>

                  {error && (
                    <p className="onboarding-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <PanelLateral
                  paso={1}
                  regiones={regiones}
                  tiposSeleccionados={tiposSeleccionados}
                  frecuenciaAlertas={frecuenciaAlertas}
                  montoMinimo={montoMinimo}
                  montoMaximo={montoMaximo}
                />
              </div>

              <div className="onboarding-form-actions">
                <span>Los campos marcados con * son obligatorios.</span>
                <button
                  className="onboarding-primary"
                  type="submit"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Guardar y continuar"}
                  {!guardando && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </form>
          )}

          {vista === "etiquetas" && (
            <form className="onboarding-panel" onSubmit={guardarEtiquetas}>
              <div className="onboarding-panel-header">
                <span className="panel-icon" aria-hidden="true">
                  02
                </span>
                <div>
                  <h2>¿Qué hace tu empresa?</h2>
                  <p>
                    {nexusActivo ? 'Selecciona tus servicios, productos u obras por rubro y especialidad.'
                      : 'Agrega servicios, tecnologías, especialidades y certificaciones.'}
                  </p>
                </div>
              </div>

              <div className="onboarding-panel-layout">
                <div className="onboarding-form-body">
                  {nexusActivo && <>
                    {!(estado.perfil?.ofertasIds?.length) && etiquetas.length > 0 && <p className="field-help">
                      Tus etiquetas se mantienen y complementan las ofertas específicas que selecciones.
                    </p>}
                    <SelectorOfertas ofertas={ofertasCatalogo} seleccionadas={ofertasIds}
                      onCambiar={setOfertasIds} cargando={cargandoCatalogo} />
                  </>}
                  <label className="tag-editor-label" htmlFor="nueva-etiqueta">
                    {nexusActivo ? "Etiquetas complementarias" : <>Etiquetas y capacidades <b>*</b></>}
                  </label>
                  <div className="tag-editor">
                    <input
                      id="nueva-etiqueta"
                      maxLength={100}
                      value={nuevaEtiqueta}
                      onChange={(evento) =>
                        setNuevaEtiqueta(evento.target.value)
                      }
                      onKeyDown={(evento) =>
                        agregarConEnter(evento, agregarEtiqueta)
                      }
                      placeholder="Escribe una etiqueta y presiona Enter"
                    />
                    <button type="button" onClick={() => agregarEtiqueta()}>
                      Agregar
                    </button>
                  </div>
                  <p className="field-help">
                    {nexusActivo
                      ? "Conserva tus etiquetas o agrega modalidades, tecnologías y certificaciones. Se combinan con tus palabras clave para priorizar las ofertas que coinciden."
                      : "Ejemplo: Desarrollo de software, ISO 9001, Microsoft Azure."}
                  </p>

                  <div className="selected-tags" aria-live="polite">
                    {etiquetas.length === 0 ? (
                      <span className="empty-tags">
                        Aún no has agregado capacidades.
                      </span>
                    ) : (
                      etiquetas.map((etiqueta) => (
                        <span key={etiqueta}>
                          {etiqueta}
                          <button
                            type="button"
                            aria-label={`Eliminar ${etiqueta}`}
                            onClick={() =>
                              setEtiquetas((actuales) =>
                                actuales.filter((valor) => valor !== etiqueta),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {!nexusActivo && <section className="suggested-tags">
                    <h3>Catálogo de rubros y capacidades</h3>
                    <p>
                      Selecciona los rubros y las capacidades que realmente
                      puede ofrecer tu empresa.
                    </p>
                    {cargandoCatalogo ? (
                      <span className="catalog-loading">
                        Cargando catálogo de capacidades...
                      </span>
                    ) : catalogoEtiquetas.length === 0 ? (
                      <span className="catalog-loading">
                        Puedes continuar agregando tus capacidades manualmente.
                      </span>
                    ) : (
                      <div className="tag-catalog">
                        {catalogoEtiquetas.map((rubro) => {
                          const rubroSeleccionado = etiquetas.some(
                            (valor) =>
                              valor.toLocaleLowerCase("es-CL") ===
                              rubro.nombre.toLocaleLowerCase("es-CL"),
                          );

                          return (
                            <section
                              key={rubro.id}
                              className="tag-catalog-group"
                            >
                              <button
                                className={
                                  rubroSeleccionado ? "is-selected" : ""
                                }
                                type="button"
                                onClick={() =>
                                  alternarEtiquetaCatalogo(
                                    rubro.nombre,
                                    rubroSeleccionado,
                                  )
                                }
                              >
                                <span>{rubroSeleccionado ? "✓" : "+"}</span>
                                {rubro.nombre}
                              </button>
                              <div>
                                {rubro.etiquetas.map((etiqueta) => {
                                  const seleccionada = etiquetas.some(
                                    (valor) =>
                                      valor.toLocaleLowerCase("es-CL") ===
                                      etiqueta.nombre.toLocaleLowerCase(
                                        "es-CL",
                                      ),
                                  );

                                  return (
                                    <button
                                      key={etiqueta.id}
                                      className={
                                        seleccionada ? "is-selected" : ""
                                      }
                                      type="button"
                                      onClick={() =>
                                        alternarEtiquetaCatalogo(
                                          etiqueta.nombre,
                                          seleccionada,
                                        )
                                      }
                                    >
                                      <span>{seleccionada ? "✓" : "+"}</span>
                                      {etiqueta.nombre}
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </section>}

                  <aside className="onboarding-info-note">
                    <strong>¿Por qué son importantes?</strong>
                    <span>
                      {nexusActivo
                        ? "Las ofertas identifican el producto o servicio solicitado. Tus etiquetas y palabras clave ayudan a priorizarlo; región y monto complementan la compatibilidad."
                        : "Estas etiquetas serán el principal criterio para calcular la compatibilidad con cada oportunidad."}
                    </span>
                  </aside>

                  {error && (
                    <p className="onboarding-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <PanelLateral
                  paso={2}
                  regiones={regiones}
                  tiposSeleccionados={tiposSeleccionados}
                  frecuenciaAlertas={frecuenciaAlertas}
                  montoMinimo={montoMinimo}
                  montoMaximo={montoMaximo}
                />
              </div>

              <div className="onboarding-form-actions">
                <button
                  className="onboarding-secondary"
                  type="button"
                  onClick={() => setVista("empresa")}
                >
                  ← Volver
                </button>
                <button
                  className="onboarding-primary"
                  type="submit"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Guardar y continuar"}
                  {!guardando && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </form>
          )}

          {vista === "preferencias" && (
            <form className="onboarding-panel" onSubmit={guardarPreferencias}>
              <div className="onboarding-panel-header">
                <span className="panel-icon" aria-hidden="true">
                  03
                </span>
                <div>
                  <h2>Define tus oportunidades ideales</h2>
                  <p>
                    Puedes modificar estas preferencias cuando quieras desde tu
                    perfil.
                  </p>
                </div>
              </div>

              <div className="onboarding-panel-layout">
                <div className="onboarding-form-body preferences-body">
                  <section className="preference-section">
                    <h3>
                      Tipos de oportunidad <b>*</b>
                    </h3>
                    <p>Selecciona los procesos que te interesa descubrir.</p>
                    <div className="opportunity-type-grid">
                      {tiposOportunidad.map((tipo) => {
                        const seleccionada = tiposSeleccionados.includes(
                          tipo.id,
                        );
                        return (
                          <button
                            key={tipo.id}
                            className={seleccionada ? "is-selected" : ""}
                            type="button"
                            onClick={() => alternarTipo(tipo.id)}
                          >
                            <span className="selection-check">
                              {seleccionada ? "✓" : ""}
                            </span>
                            <strong>{tipo.titulo}</strong>
                            <small>{tipo.detalle}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="preference-section">
                    <h3>Regiones de interés</h3>
                    <p>
                      Sin selección, buscaremos oportunidades en todo Chile.
                    </p>
                    <div className="region-selector">
                      {regionesChile.map((region) => (
                        <button
                          key={region}
                          className={
                            regiones.includes(region) ? "is-selected" : ""
                          }
                          type="button"
                          onClick={() => alternarRegion(region)}
                        >
                          <span>{regiones.includes(region) ? "✓" : "+"}</span>
                          {region
                            .replace("Región de ", "")
                            .replace("Región del ", "")}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="preference-section">
                    <h3>Rango de monto estimado</h3>
                    <p>
                      Déjalo vacío para considerar oportunidades de cualquier
                      monto.
                    </p>
                    <div className="amount-preferences">
                      <label>
                        Monto mínimo (CLP)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={montoMinimo}
                          onChange={(evento) =>
                            setMontoMinimo(evento.target.value)
                          }
                          placeholder="$ 0"
                        />
                      </label>
                      <span aria-hidden="true">—</span>
                      <label>
                        Monto máximo (CLP)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={montoMaximo}
                          onChange={(evento) =>
                            setMontoMaximo(evento.target.value)
                          }
                          placeholder="Sin límite"
                        />
                      </label>
                    </div>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={incluirSinMonto}
                        onChange={(evento) =>
                          setIncluirSinMonto(evento.target.checked)
                        }
                      />
                      <span className="switch-control" aria-hidden="true" />
                      <span>
                        <strong>
                          Incluir oportunidades sin monto informado
                        </strong>
                        <small>
                          Recomendado para no perder procesos que todavía no
                          publican presupuesto.
                        </small>
                      </span>
                    </label>
                  </section>

                  <section className="preference-section">
                    <h3>
                      Frecuencia de alertas <b>*</b>
                    </h3>
                    <p>
                      Guardaremos tu preferencia; el envío automático estará
                      disponible con Premium.
                    </p>
                    <div className="frequency-grid">
                      {frecuencias.map((frecuencia) => (
                        <label
                          key={frecuencia.id}
                          className={
                            frecuenciaAlertas === frecuencia.id
                              ? "is-selected"
                              : ""
                          }
                        >
                          <input
                            type="radio"
                            name="frecuencia"
                            value={frecuencia.id}
                            checked={frecuenciaAlertas === frecuencia.id}
                            onChange={() => setFrecuenciaAlertas(frecuencia.id)}
                          />
                          <span className="radio-mark" />
                          <strong>{frecuencia.titulo}</strong>
                          <small>{frecuencia.detalle}</small>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="preference-section preference-keywords">
                    <h3>Palabras clave adicionales</h3>
                  {nexusActivo && <p className="field-help">Estas palabras ayudan a ordenar oportunidades que ya coinciden con tus ofertas. No habilitan otros rubros.</p>}
                    <p>
                      Agrega términos específicos que suelen aparecer en las
                      licitaciones de tu interés.
                    </p>
                    <div className="tag-editor">
                      <input
                        value={nuevaPalabra}
                        onChange={(evento) =>
                          setNuevaPalabra(evento.target.value)
                        }
                        onKeyDown={(evento) =>
                          agregarConEnter(evento, agregarPalabra)
                        }
                        placeholder="Ej.: transformación digital"
                      />
                      <button type="button" onClick={() => agregarPalabra()}>
                        Agregar
                      </button>
                    </div>
                    {palabrasClave.length > 0 && (
                      <div className="selected-tags selected-tags--keywords">
                        {palabrasClave.map((palabra) => (
                          <span key={palabra}>
                            {palabra}
                            <button
                              type="button"
                              aria-label={`Eliminar ${palabra}`}
                              onClick={() =>
                                setPalabrasClave((actuales) =>
                                  actuales.filter((valor) => valor !== palabra),
                                )
                              }
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {error && (
                    <p className="onboarding-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <PanelLateral
                  paso={3}
                  regiones={regiones}
                  tiposSeleccionados={tiposSeleccionados}
                  frecuenciaAlertas={frecuenciaAlertas}
                  montoMinimo={montoMinimo}
                  montoMaximo={montoMaximo}
                />
              </div>

              <div className="onboarding-form-actions">
                <button
                  className="onboarding-secondary"
                  type="button"
                  onClick={() => setVista("etiquetas")}
                >
                  ← Volver
                </button>
                <button
                  className="onboarding-primary"
                  type="submit"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Revisar perfil"}
                  {!guardando && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </form>
          )}

          {vista === "resumen" && (
            <section className="onboarding-summary">
              <div className="summary-hero">
                <div
                  className="completion-ring"
                  aria-label="Perfil 100% completado"
                >
                  <div>
                    <strong>100%</strong>
                    <span>completado</span>
                  </div>
                </div>
                <div>
                  <p>TODO LISTO</p>
                  <h2>Tu perfil está preparado</h2>
                  <span>
                    Actívalo para comenzar a recibir oportunidades compatibles.
                  </span>
                </div>
              </div>

              <div className="summary-grid">
                <article className="summary-card summary-card--company">
                  <header>
                    <div>
                      <span>01</span>
                      <h3>Información empresarial</h3>
                    </div>
                    <button type="button" onClick={() => setVista("empresa")}>
                      Editar
                    </button>
                  </header>
                  <dl>
                    <div>
                      <dt>Empresa</dt>
                      <dd>{nombreFantasia || razonSocial}</dd>
                    </div>
                    <div>
                      <dt>Razón social</dt>
                      <dd>{razonSocial}</dd>
                    </div>
                    <div>
                      <dt>RUT</dt>
                      <dd>{rut}</dd>
                    </div>
                    <div>
                      <dt>Ubicación</dt>
                      <dd>
                        {comuna}, {regionPrincipal}
                      </dd>
                    </div>
                    <div>
                      <dt>Tamaño</dt>
                      <dd>
                        {etiquetasTamanio[tamanioEmpresa] || tamanioEmpresa}
                      </dd>
                    </div>
                    <div>
                      <dt>Contacto</dt>
                      <dd>{correoContacto}</dd>
                    </div>
                  </dl>
                </article>

                <article className="summary-card">
                  <header>
                    <div>
                      <span>02</span>
                      <h3>Etiquetas y capacidades</h3>
                    </div>
                    <button type="button" onClick={() => setVista("etiquetas")}>
                      Editar
                    </button>
                  </header>
                  <div className="summary-tags">
                    {nexusActivo && ofertasIds.map(id => (
                      <span key={id}>{ofertasCatalogo.find(o => o.id === id)?.nombre ?? id}</span>
                    ))}
                    {etiquetas.map((etiqueta) => (
                      <span key={`etiqueta:${etiqueta}`}>{etiqueta}</span>
                    ))}
                  </div>
                  <small>{nexusActivo
                    ? `${ofertasIds.length} ofertas y ${etiquetas.length} etiquetas complementarias`
                    : `${etiquetas.length} capacidades configuradas`}</small>
                </article>

                <article className="summary-card summary-card--wide">
                  <header>
                    <div>
                      <span>03</span>
                      <h3>Preferencias comerciales</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVista("preferencias")}
                    >
                      Editar
                    </button>
                  </header>
                  <div className="summary-preferences">
                    <div>
                      <span>Tipos de oportunidad</span>
                      <strong>
                        {tiposSeleccionados
                          .map(
                            (tipo) =>
                              tiposOportunidad.find(
                                (opcion) => opcion.id === tipo,
                              )?.titulo,
                          )
                          .join(", ")}
                      </strong>
                    </div>
                    <div>
                      <span>Cobertura</span>
                      <strong>
                        {regiones.length === 0
                          ? "Todo Chile"
                          : `${regiones.length} regiones seleccionadas`}
                      </strong>
                    </div>
                    <div>
                      <span>Rango de monto</span>
                      <strong>
                        {formatearMonto(
                          montoMinimo === "" ? null : Number(montoMinimo),
                        )}{" "}
                        —{" "}
                        {formatearMonto(
                          montoMaximo === "" ? null : Number(montoMaximo),
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Alertas</span>
                      <strong>
                        {
                          frecuencias.find(
                            (opcion) => opcion.id === frecuenciaAlertas,
                          )?.titulo
                        }
                      </strong>
                    </div>
                  </div>
                </article>
              </div>

              <aside className="free-plan-summary">
                <div>
                  <span className="plan-badge">PLAN GRATUITO</span>
                  <strong>Explora tus oportunidades recomendadas</strong>
                  <p>
                    Podrás revisar coincidencias y conocer el potencial de
                    GovMarket. Las funciones de gestión y postulación requieren
                    un plan Premium.
                  </p>
                </div>
                <button type="button">Ver planes Premium</button>
              </aside>

              {error && (
                <p className="onboarding-error" role="alert">
                  {error}
                </p>
              )}

              <div className="summary-actions">
                <button
                  className="onboarding-secondary"
                  type="button"
                  onClick={() => setVista("preferencias")}
                >
                  ← Volver
                </button>
                <button
                  className="onboarding-primary onboarding-primary--confirm"
                  type="button"
                  disabled={guardando}
                  onClick={() => void confirmarPerfil()}
                >
                  {guardando
                    ? "Activando perfil..."
                    : "Confirmar y ver mi dashboard"}
                  {!guardando && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
