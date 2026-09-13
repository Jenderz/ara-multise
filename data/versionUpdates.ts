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

export const CURRENT_SYSTEM_VERSION = '2.0.0';

export const LATEST_RELEASE: VersionRelease = {
    version: CURRENT_SYSTEM_VERSION,
    releaseDate: 'Septiembre 2026',
    title: '¡Te damos la bienvenida a ARA v2.0!',
    welcomeMessage: '¡Bienvenido! 👋 Te resumimos las principales novedades para agilizar tu gestión y cautivar a tus clientes:',
    subtitle: 'Diseño Lyberate flagship, herramientas de venta inteligente y optimizaciones de alto rendimiento.',
    features: [
        {
            id: 'dynamic-pill-dock',
            title: 'Dynamic Glass Pill Dock',
            description: 'Navegación ultrarrápida por categorías inspirada en la Dynamic Island de iOS, con conteo en vivo de artículos, píldora de ofertas y micro-vibración háptica.',
            tag: 'NUEVO',
            tagColor: 'blue',
            iconName: 'Compass',
            highlight: 'Exploración instantánea a 120 FPS'
        },
        {
            id: 'smart-wishlist',
            title: 'Favoritos de Alta Tecnología',
            description: 'Lista de deseos con 1-Tap checkout ("Mover todo al carrito"), compartir por WhatsApp, soporte para importar listas compartidas de regalos y cálculo de valor total acumulado.',
            tag: 'NUEVO',
            tagColor: 'rose',
            iconName: 'Heart',
            highlight: '1-Tap checkout y viralidad por WhatsApp'
        },
        {
            id: 'product-cards-flagship',
            title: 'Fichas de Producto Flagship',
            description: 'Transición a segunda foto en hover para PC, etiquetas automáticas con porcentaje de descuento real (-25%) y micro-confirmación háptica al agregar.',
            tag: 'MEJORA',
            tagColor: 'amber',
            iconName: 'Zap',
            highlight: 'Segunda foto en hover y % de descuento'
        },
        {
            id: 'catalog-grid-toggle',
            title: 'Selector de Vista en Catálogo Móvil',
            description: 'Alternador con 1 tap entre vista editorial inmersiva grande (1 columna) y vista rápida (2 columnas) para una visualización adaptada al cliente.',
            tag: 'MEJORA',
            tagColor: 'purple',
            iconName: 'Layers',
            highlight: '1 col inmersiva vs 2 col compactas'
        },
        {
            id: 'sellers-analytics',
            title: 'Panel de Asesores y Estadísticas',
            description: 'Ranking con podio de mejores vendedores, métricas de ticket promedio y cálculo automático de comisiones.',
            tag: 'NUEVO',
            tagColor: 'purple',
            iconName: 'Trophy',
            highlight: 'Podio mensual y comisiones automáticas'
        },
        {
            id: 'thermal-ticket',
            title: 'Tickets Térmicos (58mm / 80mm)',
            description: 'Impresión directa de recibos en POS y Pedidos, soporte multimoneda (USD / Bs) y envío directo por WhatsApp.',
            tag: 'NUEVO',
            tagColor: 'blue',
            iconName: 'Printer',
            highlight: 'Impresión física y comprobante digital'
        },
        {
            id: 'image-optimization',
            title: 'Optimización Automática de Imágenes',
            description: 'Compresión automática a formato WebP al subir fotos, logrando que el catálogo cargue al instante sin perder calidad.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'emerald',
            iconName: 'Image',
            highlight: 'Carga ultrarrápida del catálogo'
        },
        {
            id: 'executive-dashboard',
            title: 'Dashboard Ejecutivo Renovado',
            description: 'Visualiza ingresos netos, pedidos y comparativas periódicas en tiempo real con filtros por sede.',
            tag: 'MEJORA',
            tagColor: 'blue',
            iconName: 'LayoutDashboard',
            highlight: 'Métricas clave a primera vista'
        },
        {
            id: 'web-push',
            title: 'Notificaciones Push Web',
            description: 'Envío automático de alertas para recuperar carritos abandonados, mensajes de bienvenida y promociones.',
            tag: 'NUEVO',
            tagColor: 'emerald',
            iconName: 'BellRing',
            highlight: 'Recupera ventas automáticamente'
        },
        {
            id: 'sidebar-ux',
            title: 'Menú Lateral Inteligente (Modo Pin)',
            description: 'Se contrae automáticamente y se abre al pasar el cursor, con opción de fijarlo para ganar espacio.',
            tag: 'MEJORA',
            tagColor: 'purple',
            iconName: 'SlidersHorizontal',
            highlight: 'Más espacio útil en pantalla'
        },
        {
            id: 'variants-stock',
            title: 'Control de Variantes y Stock',
            description: 'Gestión precisa de tallas y colores, ajustes de existencias y sincronización ágil entre sucursales.',
            tag: 'OPTIMIZACIÓN',
            tagColor: 'amber',
            iconName: 'Boxes',
            highlight: 'Sincronización multi-sede segura'
        },
        {
            id: 'pwa-dynamic-brand',
            title: 'Marca Personalizada en la App',
            description: 'Al instalar la aplicación en móviles o PC, adopta automáticamente el nombre y logo oficial de tu tienda.',
            tag: 'NUEVO',
            tagColor: 'blue',
            iconName: 'Store',
            highlight: 'Tu propia app con identidad oficial'
        }
    ]
};
