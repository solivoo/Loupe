import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  readonly children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

/**
 * Red de seguridad: si algo en el árbol de React lanza durante el render,
 * mostramos un mensaje amable (en vez de una pantalla en blanco) con opción de recargar.
 * Los errores al *ejecutar el código del usuario* ya se manejan en el store; esto cubre
 * fallos inesperados de la UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Error en la UI de Loupe:', error, info)
  }

  private readonly handleReload = (): void => {
    globalThis.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div role="alert" className="ui-error">
        <h1 className="ui-error__title">Algo se rompió 😅</h1>
        <p className="ui-error__text">
          La aplicación encontró un error inesperado. Prueba recargar la página.
        </p>
        {this.state.message && (
          <pre className="ui-error__detail">{this.state.message}</pre>
        )}
        <button type="button" className="ui-error__btn" onClick={this.handleReload}>
          Recargar
        </button>
      </div>
    )
  }
}
