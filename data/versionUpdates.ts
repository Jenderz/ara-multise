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
    releaseDate: 'Septiembre 2026',
    title: '¡Te damos la bienvenida a ARA v2.1!',
    welcomeMessage: '¡Bienvenido! 👋 Te presentamos las principales mejoras y optimizaciones de la versión 2.1:',
    subtitle: 'Experiencia Mobile-First refinada, migración a servidor Nginx en VPS, nuevo preloader de Tecnología Lyberate y navegación ampliada.',
    features: [
        {
            id: 'nginx-vps-migration',
            title: 'Migración a Servidor Nginx en VPS',
            description: 'Nueva arquitectura de alto rendimiento con Nginx en servidor VPS: soporte HTTP/2, compresión Gzip ultraveloz, proxy inverso optimizado y pre-renderizado automático para bots de redes sociales (SEO dinámico).',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'Server',
            highlight: 'Velocidad extrema, HTTP/2 y máxima estabilidad'
        },
        {
            id: 'product-detail-mobile-first',
            title: 'Ficha de Producto Mobile-First',
            description: 'Rediseño completo de la vista de producto optimizado para teléfonos: tipografía balanceada, precios jerarquizados en dólares y bolívares, galería de fotos con esquinas suaves y botones de compra ergonómicos sin solapes.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'Smartphone',
            highlight: 'Títulos balanceados y ergonomía táctil'
        },
        {
            id: 'catalog-search-mobile-first',
            title: 'Catálogo & Búsqueda Mobile-First',
            description: 'Optimizada la cuadrícula a 2 columnas con títulos legibles. El buscador inteligente previene el auto-zoom accidental en navegadores móviles (iOS Safari) para una navegación ágil y continua.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'Layers',
            highlight: 'Sin auto-zoom y lectura fluida'
        },
        {
            id: 'preloader-lyberate',
            title: 'Preloader Minimalista Lyberate',
            description: 'Nueva pantalla de bienvenida instantánea con el isotipo oficial de Tecnología Lyberate, micro-reflejo de luz (shimmer) y barra milimétrica de progreso. Carga en 0ms y desaparece con suavidad.',
            tag: 'NUEVO',
            tagColor: 'purple',
            iconName: 'Zap',
            highlight: 'Identidad oficial Lyberate y 0ms de espera'
        },
        {
            id: 'pill-dock-spacing',
            title: 'Dock de Categorías Expandido',
            description: 'Márgenes superiores, inferiores y laterales holgados en el selector flotante de categorías, permitiendo un desplazamiento táctil suave sin recortes visuales ni botones apretados.',
            tag: 'MEJORA',
            tagColor: 'amber',
            iconName: 'Compass',
            highlight: 'Mayor respiro visual y táctil'
        },
        {
            id: 'home-streamlined',
            title: 'Portada Principal Depurada',
            description: 'Limpieza de bloques estáticos redundantes en el inicio, acelerando la carga inicial y dando protagonismo directo a los productos destacados, colecciones y ofertas.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'LayoutDashboard',
            highlight: 'Foco directo en productos y conversión'
        },
        {
            id: 'dynamic-pill-dock',
            title: 'Dynamic Glass Pill Dock',
            description: 'Navegación ultrarrápida por categorías inspirada en la Dynamic Island, con conteo en vivo de artículos y píldora de promociones activas.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'Compass',
            highlight: 'Exploración instantánea a 120 FPS'
        },
        {
            id: 'smart-wishlist',
            title: 'Favoritos de Alta Tecnología',
            description: 'Lista de deseos con 1-Tap checkout ("Mover todo al carrito"), compartir por WhatsApp, soporte para importar listas compartidas de regalos y cálculo de valor total acumulado.',
            tag: 'MEJORA',
            tagColor: 'rose',
            iconName: 'Heart',
            highlight: '1-Tap checkout y viralidad por WhatsApp'
        },
        {
            id: 'sellers-analytics',
            title: 'Panel de Asesores y Estadísticas',
            description: 'Ranking con podio de mejores vendedores, métricas de ticket promedio y cálculo automático de comisiones.',
            tag: 'MEJORA',
            tagColor: 'purple',
            iconName: 'Trophy',
            highlight: 'Podio mensual y comisiones automáticas'
        },
        {
            id: 'thermal-ticket',
            title: 'Tickets Térmicos (58mm / 80mm)',
            description: 'Impresión directa de recibos en POS y Pedidos, soporte multimoneda (USD / Bs) y envío directo por WhatsApp.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'Printer',
            highlight: 'Impresión física y comprobante digital'
        }
    ]
};
