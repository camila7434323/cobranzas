import { type ReactNode, Component, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    console.error('🚨 ErrorBoundary capturó error:', error)
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error details:', errorInfo.componentStack)
    console.error('Error message:', error.message)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: '#eef2f8',
          fontFamily: 'Inter, sans-serif',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#fff',
            padding: '40px',
            borderRadius: '12px',
            maxWidth: '500px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '2px solid #dc2626'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ color: '#dc2626', margin: '0 0 12px 0', fontSize: '20px' }}>
              Error en la aplicación
            </h1>
            <p style={{ color: '#7a8fbb', marginBottom: '16px', lineHeight: '1.6' }}>
              {this.state.error?.message || 'Algo salió mal durante el renderizado'}
            </p>
            <details style={{
              marginBottom: '20px',
              padding: '12px',
              background: '#f8faff',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              <summary style={{ color: '#7a8fbb', fontSize: '12px', fontWeight: 600 }}>
                Detalles técnicos
              </summary>
              <pre style={{
                marginTop: '10px',
                fontSize: '11px',
                color: '#3d5278',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#2554a0',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              Recargar página
            </button>
            <p style={{
              fontSize: '12px',
              color: '#7a8fbb',
              marginTop: '16px',
              marginBottom: '0'
            }}>
              Si el problema persiste, contacta al administrador.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
