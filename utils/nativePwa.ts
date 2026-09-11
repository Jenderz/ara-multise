import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Actualiza el contador de insignia (Badge) en el icono de la aplicación instalada.
 * Compatible con: Android (PWA instalada), iOS 16.4+ (Agregada a Inicio), macOS y Windows (Desktop PWA).
 */
export const updateAppBadge = async (count: number): Promise<void> => {
  if (typeof navigator === 'undefined') return;

  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
  } catch (error) {
    console.debug('Badging API no disponible o no permitida en este contexto:', error);
  }
};

/**
 * Solicita almacenamiento persistente en el navegador.
 * Evita que el sistema operativo purgue la caché de la tienda y de imágenes cuando el almacenamiento esté bajo.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    return await navigator.storage.persist();
  } catch (error) {
    console.debug('Error solicitando persistencia de almacenamiento:', error);
    return false;
  }
};

/**
 * Hook para mantener la pantalla encendida (Screen Wake Lock API).
 * Muy útil en la pantalla de resumen del pedido, pasarela de pago o mostrar código QR en caja.
 */
export const useWakeLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const requestLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      setIsLocked(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsLocked(false);
        wakeLockRef.current = null;
      });
      return true;
    } catch (err) {
      console.debug('No se pudo adquirir Wake Lock:', err);
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.debug('Error liberando Wake Lock:', err);
      }
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  // Liberar el bloqueo al desmontar
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return { isLocked, requestLock, releaseLock };
};

/**
 * Helper para compartir contenido mediante el menú nativo del dispositivo (Web Share API).
 * Si no está disponible, copia el enlace al portapapeles.
 */
export const shareNativeContent = async (data: {
  title: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.debug('Error al compartir nativamente:', error);
      }
      return false;
    }
  }

  // Fallback: Copiar al portapapeles si hay URL
  if (data.url && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(data.url);
      return true;
    } catch (e) {
      console.debug('Error copiando al portapapeles:', e);
    }
  }
  return false;
};
