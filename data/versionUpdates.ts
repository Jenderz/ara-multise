export interface VersionFeatureItem {
    id: string;
    title: string;
    description: string;
    tag: 'NUEVO' | 'MEJORA' | 'OPTIMIZACIÓN';
    tagColor: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
    iconName: string;
    highlight?: string;
}

export interface VersionRelease {
    version: string;
    releaseDate: string;
    title: string;
    welcomeMessage: string;
    subtitle: string;
    features: VersionFeatureItem[];
}

export const CURRENT_SYSTEM_VERSION = '2.1';

export const LATEST_RELEASE: VersionRelease = {
    version: CURRENT_SYSTEM_VERSION,
    releaseDate: 'Octubre 2026',
    title: '¡Te damos la bienvenida a ARA v2.1!',
    welcomeMessage: '¡Bienvenido! 👋 Te presentamos las principales mejoras y optimizaciones de la versión 2.1:',
    subtitle: 'Módulo de Stock Estancado, Navegación Flotante Dinámica, PWA para iOS Safari, Tickets OKLCH y Migración a Nginx.',
    features: [
        {
            id: 'stagnant-stock-module',
            title: 'Módulo de Stock Estancado y Baja Rotación',
            description: 'Identificación inteligente de productos sin rotación o con días acumulados sin venta. Cálculo instantáneo de capital retenido por sede o global, y aplicación de ofertas relámpago protegidas con piso de costo.',
            tag: 'NUEVO',
            tagColor: 'amber',
            iconName: 'Boxes',
            highlight: 'Capital retenido y ofertas con piso de costo'
        },
        {
            id: 'mobile-floating-nav',
            title: 'Navegación Móvil Flotante Dinámica',
            description: 'Barra de navegación ultraligera estilo iOS e Instagram con auto-compactación inteligente al hacer scroll hacia abajo y expansión al subir, con contador en vivo de lista de deseos.',
            tag: 'NUEVO',
            tagColor: 'purple',
            iconName: 'Compass',
            highlight: 'Auto-compactación al scroll y 60 FPS'
        },
        {
            id: 'ios-pwa-bottom-sheet',
            title: 'Instalador PWA para iPhone y iPad',
            description: 'Nuevo modal instructivo estilo Bottom Sheet para iOS Safari, guiando al usuario paso a paso para añadir la tienda a su pantalla de inicio en un solo toque.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'Smartphone',
            highlight: 'Guía paso a paso para Safari en iOS'
        },
        {
            id: 'thermal-receipt-oklch',
            title: 'Tickets Térmicos y Compartir Robusto',
            description: 'Motor de renderizado migrado a html2canvas-pro con soporte nativo de colores OKLCH. Generación y compartición directa por WhatsApp o menú nativo del móvil sin bloqueos ni distorsiones.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'Printer',
            highlight: 'Compatibilidad OKLCH y descarga en 1 toque'
        },
        {
            id: 'customers-module-cedula',
            title: 'Módulo de Clientes 360° con Cédula',
            description: 'Tarjetas táctiles ergonómicas con visualización destacada de la Cédula de Identidad, botón de 1-toque para copiar, acceso directo a llamada telefónica y chat de WhatsApp.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'Store',
            highlight: 'Cédula con 1-toque copiar y WhatsApp'
        },
        {
            id: 'nginx-vps-migration',
            title: 'Arquitectura Nginx & CloudPanel VPS',
            description: 'Infraestructura de alto rendimiento con Nginx en VPS: HTTP/2, compresión Gzip ultraveloz, control estricto de caché para Service Worker y pre-renderizado SEO para redes sociales.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'Zap',
            highlight: 'HTTP/2, velocidad extrema y estabilidad'
        },
        {
            id: 'mobile-form-controls',
            title: 'Controles Táctiles en Edición de Productos',
            description: 'Botones ergonómicos y permanentemente visibles en móvil para eliminar imágenes o designar portada en productos y categorías sin depender de eventos hover.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'SlidersHorizontal',
            highlight: 'Ergonomía táctil en móvil y tablet'
        }
    ]
};

