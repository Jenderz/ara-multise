import { api } from '../services/api';

export const BUSINESS_TZ = 'America/Caracas';

// Diferencia de reloj estimada: serverNow - Date.now()
let skew = 0;
let lastSync = 0;
let isSyncing = false;

/**
 * Sincroniza el reloj del frontend con la hora del servidor midiendo RTT/2.
 */
export const syncServerClock = async (): Promise<number> => {
    if (isSyncing) return skew;
    isSyncing = true;
    const startReq = Date.now();

    try {
        const res = await api.getServerTime();
        const endReq = Date.now();
        const rtt = Math.max(0, endReq - startReq);
        const serverNow = Number(res.now);

        if (Number.isFinite(serverNow) && serverNow > 0) {
            // Compensación RTT/2
            skew = serverNow - (startReq + Math.round(rtt / 2));
            lastSync = Date.now();

            if (isClockSkewed()) {
                window.dispatchEvent(new CustomEvent('lyberate:clock_skewed', { detail: { skew, rtt } }));
            }
        }
    } catch (e) {
        // En caso de fallo de red, mantener el skew previo
    } finally {
        isSyncing = false;
    }

    return skew;
};

/**
 * Devuelve el timestamp en milisegundos corregido con la hora del servidor.
 */
export const now = (): number => {
    return Date.now() + skew;
};

/**
 * Devuelve si el reloj del dispositivo tiene un desfase mayor a 2 minutos con el servidor.
 */
export const isClockSkewed = (): boolean => {
    return Math.abs(skew) > 120_000;
};

/**
 * Devuelve el desfase en milisegundos entre el dispositivo y el servidor.
 */
export const getClockSkewMs = (): number => skew;

/**
 * Convierte un epoch ms en fecha 'YYYY-MM-DD' en la zona horaria de Caracas.
 */
export const toBusinessDateString = (ms: number = now()): string => {
    const d = new Date(ms);
    // Formatear en partes según BUSINESS_TZ
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d); // 'YYYY-MM-DD'
};

/**
 * Devuelve el timestamp epoch ms del inicio del día (00:00:00.000) en hora de Caracas.
 */
export const startOfBusinessDay = (ms: number = now()): number => {
    const dateStr = toBusinessDateString(ms);
    // Crear Date en el mediodía UTC y ajustar al inicio en Caracas
    // O calcular directamente a partir de la fecha string
    const [year, month, day] = dateStr.split('-').map(Number);
    // Caracas es UTC -4: 00:00:00 Caracas = 04:00:00 UTC
    return Date.UTC(year, month - 1, day, 4, 0, 0, 0);
};

/**
 * Devuelve el timestamp epoch ms del inicio del mes (día 1, 00:00:00.000) en hora de Caracas.
 */
export const startOfBusinessMonth = (ms: number = now()): number => {
    const dateStr = toBusinessDateString(ms);
    const [year, month] = dateStr.split('-').map(Number);
    return Date.UTC(year, month - 1, 1, 4, 0, 0, 0);
};

/**
 * Devuelve la hora del día (0-23) en la zona horaria de Caracas.
 */
export const getBusinessHour = (ms: number): number => {
    const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TZ,
        hour: '2-digit',
        hour12: false
    }).format(new Date(ms));
    return Number(formatted);
};

/**
 * Formatea fecha en zona de Caracas según opciones (por defecto es-VE).
 */
export const formatBusinessDate = (ms: number | string | Date, options?: Intl.DateTimeFormatOptions): string => {
    const timeMs = typeof ms === 'number' ? ms : new Date(ms).getTime();
    if (!Number.isFinite(timeMs)) return '';
    return new Intl.DateTimeFormat('es-VE', {
        timeZone: BUSINESS_TZ,
        ...options
    }).format(new Date(timeMs));
};

/**
 * Formatea hora en formato local de Caracas (HH:MM am/pm).
 */
export const formatTime = (ms: number | string | Date, options?: Intl.DateTimeFormatOptions): string => {
    const timeMs = typeof ms === 'number' ? ms : new Date(ms).getTime();
    if (!Number.isFinite(timeMs)) return '';
    return new Intl.DateTimeFormat('es-VE', {
        timeZone: BUSINESS_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...options
    }).format(new Date(timeMs));
};

/**
 * Formatea fecha en formato local de Caracas (DD/MM/YYYY o según opciones).
 */
export const formatDate = (ms: number | string | Date, options?: Intl.DateTimeFormatOptions): string => {
    const timeMs = typeof ms === 'number' ? ms : new Date(ms).getTime();
    if (!Number.isFinite(timeMs)) return '';
    return new Intl.DateTimeFormat('es-VE', {
        timeZone: BUSINESS_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options
    }).format(new Date(timeMs));
};

/**
 * Formatea fecha y hora combinadas en hora de Caracas.
 */
export const formatDateTime = (ms: number | string | Date): string => {
    const timeMs = typeof ms === 'number' ? ms : new Date(ms).getTime();
    if (!Number.isFinite(timeMs)) return '';
    return `${formatDate(timeMs)} ${formatTime(timeMs)}`;
};

// Auto-iniciar sincronización inicial y periódica
if (typeof window !== 'undefined') {
    // Sincronización al cargar
    setTimeout(() => {
        syncServerClock();
    }, 100);

    // Re-sincronizar al recuperar foco o visibilidad
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastSync > 60_000) {
            syncServerClock();
        }
    });

    // Re-sincronizar cada 10 minutos
    setInterval(() => {
        syncServerClock();
    }, 10 * 60 * 1000);
}
