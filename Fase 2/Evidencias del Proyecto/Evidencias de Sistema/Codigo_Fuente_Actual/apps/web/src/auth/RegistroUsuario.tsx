import { useEffect, useRef, useState, type FormEvent } from "react";
import "./RegistroUsuario.css";

interface Props {
  emailInicial: string;
  onRegistrado: (accessToken: string, persistirLocal?: boolean) => Promise<void>;
  onVolver: () => void;
}

export function RegistroUsuario({
  emailInicial,
  onRegistrado,
  onVolver,
}: Props) {
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [email, setEmail] = useState(emailInicial);
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cuentaCreada, setCuentaCreada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef<AbortController | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const mensaje = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    titulo.current?.focus();
    return () => solicitud.current?.abort();
  }, []);

  useEffect(() => {
    if (error) mensaje.current?.focus();
  }, [error]);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (solicitud.current || cuentaCreada) return;
    setError(null);

    if (!nombres.trim() || !apellidoPaterno.trim()) {
      setError("Ingresa tus nombres y tu primer apellido.");
      return;
    }
    if (password.length < 15 || password.length > 128) {
      setError(
        "Utiliza una contraseña de entre 15 y 128 caracteres. Puede ser una frase.",
      );
      return;
    }
    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const controller = new AbortController();
    solicitud.current = controller;
    setCargando(true);
    let creada = false;
    try {
      const respuesta = await fetch("/api/v1/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          nombres: nombres.trim(),
          apellidoPaterno: apellidoPaterno.trim(),
          apellidoMaterno: apellidoMaterno.trim() || null,
          email: email.trim().toLowerCase(),
          password,
          confirmarPassword,
        }),
      });
      if (controller.signal.aborted) return;
      if (respuesta.status === 409) {
        throw new Error(
          "Ya existe una cuenta con ese correo. Inicia sesión con el método que utilizaste al registrarte.",
        );
      }
      if (respuesta.status === 429) {
        throw new Error(
          "Hay muchos registros en este momento. Espera un minuto y vuelve a intentar.",
        );
      }
      if (respuesta.status === 400) {
        throw new Error(
          "Revisa tus nombres, correo y contraseña antes de continuar.",
        );
      }
      if (!respuesta.ok)
        throw new Error(
          "No fue posible crear tu cuenta. Intenta nuevamente más tarde.",
        );
      const datos = (await respuesta.json()) as { accessToken?: string; expiresIn?: number | null };
      if (!datos.accessToken)
        throw new Error(
          "No recibimos una sesión válida. Prueba iniciar sesión con tu correo y contraseña.",
        );

      creada = true;
      setCuentaCreada(true);
      setPassword("");
      setConfirmarPassword("");
      await onRegistrado(datos.accessToken, datos.expiresIn === null);
    } catch (errorDesconocido) {
      if (!controller.signal.aborted) {
        setError(
          creada
            ? "Tu cuenta fue creada, pero no pudimos abrir la sesión. Vuelve al inicio de sesión e ingresa con tu correo y contraseña."
            : errorDesconocido instanceof TypeError
              ? "No pudimos conectar con la API. Si el registro ya se procesó, intenta iniciar sesión antes de repetirlo."
              : errorDesconocido instanceof Error
                ? errorDesconocido.message
                : "No fue posible crear tu cuenta.",
        );
      }
    } finally {
      solicitud.current = null;
      if (!controller.signal.aborted) setCargando(false);
    }
  }

  return (
    <div className="registro-usuario">
      <h2 id="titulo-login" ref={titulo} tabIndex={-1}>
        Crea tu cuenta
      </h2>
      <p className="login-subtitle">
        Comienza gratis. Después podrás registrar tu empresa.
      </p>
      <form onSubmit={(evento) => void registrar(evento)} aria-busy={cargando}>
        <fieldset disabled={cargando || cuentaCreada}>
          <div className="registro-campo">
            <label htmlFor="registro-nombres">Nombres</label>
            <input
              id="registro-nombres"
              name="nombres"
              autoComplete="given-name"
              value={nombres}
              onChange={(evento) => setNombres(evento.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="registro-apellidos">
            <div className="registro-campo">
              <label htmlFor="registro-apellido">Primer apellido</label>
              <input
                id="registro-apellido"
                name="apellidoPaterno"
                autoComplete="family-name"
                value={apellidoPaterno}
                onChange={(evento) => setApellidoPaterno(evento.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="registro-campo">
              <label htmlFor="registro-apellido-materno">
                Segundo apellido <span>(opcional)</span>
              </label>
              <input
                id="registro-apellido-materno"
                name="apellidoMaterno"
                value={apellidoMaterno}
                onChange={(evento) => setApellidoMaterno(evento.target.value)}
                maxLength={80}
              />
            </div>
          </div>
          <div className="registro-campo">
            <label htmlFor="registro-email">Correo electrónico</label>
            <input
              id="registro-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              maxLength={254}
              placeholder="ejemplo@empresa.cl"
              required
            />
          </div>
          <div className="registro-campo">
            <label htmlFor="registro-password">Contraseña</label>
            <input
              id="registro-password"
              name="password"
              type={mostrarPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              minLength={15}
              maxLength={128}
              aria-describedby="registro-ayuda-password"
              required
            />
            <small id="registro-ayuda-password">
              Mínimo 15 caracteres. Puedes usar una frase fácil de recordar.
            </small>
          </div>
          <div className="registro-campo">
            <label htmlFor="registro-confirmar">Confirmar contraseña</label>
            <input
              id="registro-confirmar"
              name="confirmarPassword"
              type={mostrarPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmarPassword}
              onChange={(evento) => setConfirmarPassword(evento.target.value)}
              minLength={15}
              maxLength={128}
              required
            />
          </div>
          <label className="registro-mostrar">
            <input
              type="checkbox"
              checked={mostrarPassword}
              onChange={(evento) => setMostrarPassword(evento.target.checked)}
            />
            Mostrar contraseñas
          </label>
        </fieldset>
        {error && (
          <p className="error-message" role="alert" ref={mensaje} tabIndex={-1}>
            {error}
          </p>
        )}
        {!cuentaCreada && (
          <button className="primary-action" type="submit" disabled={cargando}>
            {cargando ? "Creando cuenta..." : "Crear cuenta gratis"}
          </button>
        )}
      </form>
      <p className="registro-aviso">
        Tu cuenta no incluye una suscripción ni acceso a empresas de otras
        personas.
      </p>
      <p className="access-note">
        ¿Ya tienes cuenta?{" "}
        <button
          className="registro-enlace"
          type="button"
          onClick={onVolver}
          disabled={cargando}
        >
          Iniciar sesión
        </button>
      </p>
    </div>
  );
}
