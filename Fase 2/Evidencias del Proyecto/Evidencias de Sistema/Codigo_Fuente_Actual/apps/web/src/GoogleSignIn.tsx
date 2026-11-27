import { useEffect, useRef, useState } from 'react'

interface GoogleAccountsId {
  initialize(options: {
    client_id: string
    callback: (response: { credential: string }) => void
    use_fedcm_for_button?: boolean
  }): void
  renderButton(element: HTMLElement, options: {
    type: 'standard'
    theme: 'outline'
    size: 'large'
    text: 'continue_with'
    logo_alignment: 'left'
    width: number
    locale: 'es'
  }): void
  disableAutoSelect(): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

interface GoogleSignInProps {
  onCredential: (credential: string) => Promise<void>
  disabled: boolean
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function GoogleSignIn({ onCredential, disabled }: GoogleSignInProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const onCredentialActual = useRef(onCredential)
  const [falloCarga, setFalloCarga] = useState(false)

  useEffect(() => {
    onCredentialActual.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId) return

    let activo = true
    const elemento = contenedor.current

    function mostrarBoton() {
      if (!activo || !elemento || !window.google) return
      elemento.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: clientId!,
        use_fedcm_for_button: true,
        callback: (respuesta) => {
          if (activo) void onCredentialActual.current(respuesta.credential)
        },
      })
      window.google.accounts.id.renderButton(elemento, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(elemento.clientWidth || 400, 400),
        locale: 'es',
      })
    }

    function mostrarError() {
      if (activo) setFalloCarga(true)
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-govmarket-google]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.dataset.govmarketGoogle = 'true'
      document.head.appendChild(script)
    }

    if (window.google) mostrarBoton()
    else {
      script.addEventListener('load', mostrarBoton)
      script.addEventListener('error', mostrarError)
    }

    return () => {
      activo = false
      script.removeEventListener('load', mostrarBoton)
      script.removeEventListener('error', mostrarError)
      elemento?.replaceChildren()
    }
  }, [])

  if (!clientId || falloCarga) {
    return (
      <div className="google-unavailable">
        <button type="button" className="google-placeholder" disabled>
          <span aria-hidden="true" className="google-g">G</span>
          Continuar con Google
        </button>
        <small>{falloCarga ? 'No fue posible cargar Google.' : 'Acceso con Google pendiente de configurar.'}</small>
      </div>
    )
  }

  return <div className="google-button" ref={contenedor} aria-disabled={disabled} />
}
