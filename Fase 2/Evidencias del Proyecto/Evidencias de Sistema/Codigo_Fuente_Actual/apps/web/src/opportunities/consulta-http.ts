// Solo promesas en curso, sin persistir respuestas, tokens ni datos de empresas.
// El servidor vuelve a comprobar JWT y membresia en cada solicitud HTTP.
const pendientes = new Map<string, Promise<unknown>>();
type TipoErrorConsulta = 'http' | 'tiempo' | 'conexion' | 'respuesta';
const LIMITE_CONSULTA_MS = 30_000;
const ESTADOS_TRANSITORIOS = new Set([502, 503, 504]);

function mensajeConsulta(estado: number, tipo: TipoErrorConsulta): string {
  if (tipo === 'tiempo') return 'La búsqueda tardó demasiado en responder. Espera unos segundos y vuelve a intentarlo.';
  if (tipo === 'conexion') return 'No pudimos conectar con el servicio. Revisa tu conexión y vuelve a intentar.';
  if (tipo === 'respuesta') return 'El servicio devolvió una respuesta que no pudimos procesar. Vuelve a intentarlo.';
  if (estado === 401) return 'La sesión debe validarse nuevamente.';
  if (estado === 403) return 'No tienes acceso a esta consulta. Revisa la empresa seleccionada y sus permisos.';
  if (estado === 400) return 'No pudimos realizar la consulta con los datos actuales. Revisa los filtros y el perfil de tu empresa.';
  if (estado === 429) return 'El servicio está recibiendo demasiadas consultas. Espera un momento y vuelve a intentar.';
  if (estado >= 500) return 'El servicio no pudo completar la búsqueda. Espera unos segundos y vuelve a intentar.';
  return 'No fue posible actualizar la consulta. Vuelve a intentarlo.';
}

export class ErrorConsulta extends Error {
  readonly estado: number;
  readonly tipo: TipoErrorConsulta;
  readonly referencia: string | null;
  constructor(estado: number, tipo: TipoErrorConsulta = 'http', referencia?: string | null) {
    const id = referencia && /^[a-zA-Z0-9-]{8,64}$/.test(referencia) ? referencia : null;
    super(`${mensajeConsulta(estado, tipo)}${id ? ` Referencia: ${id}.` : ''}`);
    this.name = 'ErrorConsulta';
    this.estado = estado;
    this.tipo = tipo;
    this.referencia = id;
  }
}

function esperaReintento(valor: string | null): number | null {
  if (!valor) return 400 + Math.floor(Math.random() * 400);
  const segundos = /^\d+$/.test(valor.trim()) ? Number(valor) : null;
  const espera = segundos === null ? Date.parse(valor) - Date.now() : segundos * 1000;
  // Una pausa larga se comunica al usuario; nunca se acorta Retry-After.
  return Number.isFinite(espera) && espera <= 5000 ? Math.max(0, espera) : null;
}

async function consultar<T>(url: string, token: string): Promise<T> {
  const hasta = Date.now() + LIMITE_CONSULTA_MS;
  for (let intento = 0; ; intento += 1) {
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), Math.max(1, hasta - Date.now()));
    let error: ErrorConsulta;
    let espera: number | null = null;
    let transitorio = false;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: control.signal });
      const referencia = r.headers.get('X-GMA-Request-Id');
      if (r.ok) {
        try { return await r.json() as T; }
        catch (e) {
          if (control.signal.aborted) throw e;
          throw new ErrorConsulta(r.status, 'respuesta', referencia);
        }
      }
      error = new ErrorConsulta(r.status, 'http', referencia);
      transitorio = ESTADOS_TRANSITORIOS.has(r.status);
      if (transitorio) espera = esperaReintento(r.headers.get('Retry-After'));
      await r.body?.cancel().catch(() => {});
    } catch (e: unknown) {
      if (e instanceof ErrorConsulta) error = e;
      else if (control.signal.aborted) error = new ErrorConsulta(0, 'tiempo');
      else {
        error = new ErrorConsulta(0, 'conexion');
        transitorio = e instanceof TypeError;
        if (transitorio) espera = esperaReintento(null);
      }
    } finally { clearTimeout(tiempo); }
    // Solo un reintento de lectura, con espera y dentro del presupuesto total.
    // Un timeout no dispara otra consulta pesada; tampoco se repiten 400/401/403/429/500.
    if (intento > 0 || !transitorio || espera === null || Date.now() + espera + 1000 >= hasta) throw error;
    await new Promise<void>((resolve) => setTimeout(resolve, espera));
  }
}

export function solicitarJson<T>(url: string, token: string): Promise<T> {
  const clave = JSON.stringify([token, url]);
  const anterior = pendientes.get(clave);
  if (anterior) return anterior as Promise<T>;
  const promesa = consultar<T>(url, token)
    .finally(() => { if (pendientes.get(clave) === promesa) pendientes.delete(clave); });
  if (pendientes.size < 20) pendientes.set(clave, promesa);
  return promesa;
}
