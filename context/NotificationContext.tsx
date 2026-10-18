
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppNotification, NotificationContextType } from '../types';
import { useStore } from './StoreContext';
import { api } from '../services/api';
import { now } from '../utils/serverClock';

// --- CONFIGURACIÓN VAPID OFICIAL ARA V 2.0 ---
const VAPID_PUBLIC_KEY = 'BMS4ALXFLZGF2W_KYT9Gf8ZbmA8r4RjyEgyikAZO3j56is92_0XyddxO75G9VWDBY9wfG3YUUPPawtYdr-0GpFI'; 

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Helper para convertir la VAPID Key de String Base64 a Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  
  const { settings, currentBranch } = useStore();

  useEffect(() => {
    // 1. Detect Permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        // Refrescar token / actualizar actividad en el servidor
        subscribeToPush().catch(() => {});
      }
    }

    // 2. iOS Detection (iPhone, iPad, iPod y iPadOS con desktop user-agent)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (typeof navigator !== 'undefined' && (navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // 3. Standalone Mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone);
    setIsStandalone(isStandaloneMode);

    // 4. Install Prompt Logic (Se centraliza el evento para la app completa)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [currentBranch]);

  // --- FUNCIÓN PRINCIPAL DE SUSCRIPCIÓN ---
  const requestPermission = async () => {
    if (!('Notification' in window)) {
        alert("Tu navegador no soporta notificaciones.");
        return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
          // Suscribir al Web Push real en el servidor forzando sincronización limpia
          await subscribeToPush(true);
      }
    } catch (e) {
      console.error("Error al pedir permisos:", e);
    }
  };

  const subscribeToPush = async (forceRenew = false): Promise<PushSubscription | null> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

    try {
        const registration = await navigator.serviceWorker.ready;
        if (!registration) return null;
        
        // Revisar si ya existe suscripción
        let subscription = await registration.pushManager.getSubscription();

        if (subscription && forceRenew) {
            try {
                await subscription.unsubscribe();
                subscription = null;
            } catch (unsubErr) {
                console.warn("No se pudo desuscribir endpoint previo:", unsubErr);
            }
        }

        if (!subscription) {
            // Crear nueva suscripción real contra FCM / Web Push Service
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        if (subscription) {
            localStorage.setItem('ara_push_endpoint', subscription.endpoint);
            const subJson = subscription.toJSON();
            const branchId = currentBranch?.id || 1;
            await api.saveSubscription({
                ...subJson,
                endpoint: subscription.endpoint,
                branchId: branchId,
            });
            console.log("Suscripción Web Push vinculada en el servidor ARA V 2.0 (Sede: " + branchId + ")");
        }

    } catch (error) {
        console.error("Error al suscribirse al PushManager:", error);
        return null;
    }
  };

  // Escuchar desalineación de reloj entre cliente y servidor
  useEffect(() => {
    let warned = false;
    const handleSkewed = (e: any) => {
      if (warned) return;
      warned = true;
      const skewMs = Math.abs(e.detail?.skew || 0);
      const minutes = Math.max(1, Math.round(skewMs / 60000));
      addNotification({
        title: 'Reloj desincronizado',
        body: `El reloj de tu dispositivo tiene un desfase de aprox. ${minutes} min con el servidor. Las operaciones usarán la hora oficial del sistema.`,
        type: 'warning'
      });
    };
    window.addEventListener('lyberate:clock_skewed', handleSkewed);
    return () => window.removeEventListener('lyberate:clock_skewed', handleSkewed);
  }, []);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: now()
    };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => removeNotification(newNotif.id), 6000);
  };

  const removeNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const installApp = async () => {
      if (deferredPrompt) {
          try {
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === 'accepted') {
                  setShowInstallModal(false);
              }
              localStorage.setItem('pwa_install_dismissed', Date.now().toString());
          } catch (err) {
              console.debug('Error en install prompt:', err);
          } finally {
              setDeferredPrompt(null);
          }
      } else if (isIOS) {
          setShowInstallModal(true);
      }
  };


  return (
    <NotificationContext.Provider value={{
      notifications, addNotification, removeNotification,
      permission, requestPermission, subscribeToPush,
      deferredPrompt, isIOS, isStandalone, installApp,
      showInstallModal, setShowInstallModal
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within NotificationProvider");
  return context;
};
