
import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HelmetProvider } from 'react-helmet-async';

// Tipado para las propiedades del componente ErrorBoundary
interface ErrorBoundaryProps {
  children?: ReactNode; // Made optional to satisfy certain JSX type checking environments
}

// Tipado para el estado del componente ErrorBoundary
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary para capturar crashes de la aplicación.
 * Se extiende React.Component explícitamente para asegurar que TypeScript reconozca props y state.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Definición explícita de la propiedad props para resolver errores de "Property 'props' does not exist" (Fixes line 83 error)
  public props: ErrorBoundaryProps;
  // Definición explícita de la propiedad state para resolver errores de "Property 'state' does not exist"
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Asignación explícita de props para el compilador en este entorno
    this.props = props;
    // Inicialización del estado en el constructor
    this.state = { hasError: false, error: null };
  }

  // Método estático requerido para actualizar el estado cuando ocurre un error
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Captura el error para logging y depuración
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Error:", error, errorInfo);
  }

  render() {
    // Verificación del estado en el método render
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: '#F2F2F7', 
          fontFamily: '-apple-system, sans-serif',
          padding: '20px',
          textAlign: 'center',
          color: '#1C1C1E'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Algo salió mal</h1>
          <p style={{ color: '#8E8E93', marginBottom: '24px', maxWidth: '300px' }}>La aplicación ha encontrado un error inesperado.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,122,255,0.3)'
            }}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);

// --- GESTIÓN AVANZADA DE SERVICE WORKER (PWA UPDATE) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos './sw.js' (relativo) para soportar subdirectorios (cPanel/Netlify).
    // Esto es seguro porque usamos HashRouter, por lo que la ruta del navegador siempre está "al nivel" del sw.js.
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('PWA ServiceWorker registered with scope: ', registration.scope);

      // Detectar actualizaciones mientras la app está abierta
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Nuevo contenido disponible: Emitir evento para que App.tsx muestre el botón
              console.log('Nueva versión disponible. Lanzando evento.');
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            } else {
              console.log('Contenido cacheado para uso offline.');
            }
          }
        };
      };
      
      // Buscar actualizaciones periódicamente (cada 1 hora)
      setInterval(() => {
          registration.update();
      }, 60 * 60 * 1000);

    }).catch(err => {
      console.log('PWA ServiceWorker registration failed: ', err);
    });
  });
  
  // Recargar la página si el SW toma el control (post-update)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
  });
}
