const claveSesion = 'govmarket-access-token';
const claveLocal = 'govmarket-access-token-local';

function navegadorLocal(): boolean {
  return typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
}

function leer(almacen: 'sessionStorage' | 'localStorage', clave: string): string | null {
  try { return window[almacen].getItem(clave); } catch { return null; }
}

export function obtenerTokenSesion(): string | null {
  return leer('sessionStorage', claveSesion) ??
    (navegadorLocal() ? leer('localStorage', claveLocal) : null);
}

export function eliminarTokenSesion(): void {
  for (const [almacen, clave] of [['sessionStorage', claveSesion], ['localStorage', claveLocal]] as const) {
    try { window[almacen].removeItem(clave); } catch { /* El acceso en memoria se cierra igualmente. */ }
  }
}

export function guardarTokenSesion(accessToken: string, persistirLocal?: boolean): void {
  // Al restaurar, conserva el modo previamente autorizado por la API local.
  const persistente = navegadorLocal() && (persistirLocal ?? leer('localStorage', claveLocal) === accessToken);
  eliminarTokenSesion();
  try {
    if (persistente) window.localStorage.setItem(claveLocal, accessToken);
    else window.sessionStorage.setItem(claveSesion, accessToken);
  } catch { /* La sesión puede continuar en memoria si el almacenamiento está bloqueado. */ }
}
