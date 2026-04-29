
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AppNotification, NotificationContextType, Order } from '../types';
import { useStore } from './StoreContext';
import { api } from '../services/api';

// --- CONFIGURACIÓN VAPID ---
// IMPORTANTE: Debes generar tus propias llaves VAPID en tu servidor PHP y poner la PÚBLICA aquí.
// Puedes usar: https://web-push-codelab.glitch.me/ para generar un par de pruebas.
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'; 

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
  
  const { settings, cart, orders } = useStore();
  const prevOrdersRef = useRef<Order[]>(orders);
  const cartTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // 1. Detect Permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // 2. iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Standalone Mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // 4. Install Prompt Logic
    const hasSeenPrompt = localStorage.getItem('pwa_prompt_seen');

    // A) Android / Chrome (Event Based)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!hasSeenPrompt && !isStandaloneMode) {
         setTimeout(() => setShowInstallModal(true), 5000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // B) iOS (Manual Trigger) - iOS no dispara evento, lo forzamos si no está instalada
    if (isIosDevice && !isStandaloneMode && !hasSeenPrompt) {
        // Esperamos un poco más para que el usuario interactúe primero
        setTimeout(() => setShowInstallModal(true), 8000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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
          // --- AQUÍ OCURRE LA MAGIA REAL ---
          subscribeToPush();
          
          addNotification({
              title: '¡Notificaciones Activadas!',
              body: 'Ahora recibirás ofertas reales desde nuestro servidor.',
              type: 'success'
          });
      }
    } catch (e) {
      console.error("Error al pedir permisos:", e);
    }
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Revisar si ya existe suscripción
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Crear nueva suscripción real contra Google/Mozilla FCM
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        // Enviar el objeto de suscripción (JSON) a TU servidor PHP
        // Este objeto contiene: endpoint, keys { p256dh, auth }
        if (subscription) {
            await api.saveSubscription(subscription);
            console.log("Suscripción Web Push enviada al servidor PHP");
        }

    } catch (error) {
        console.error("Error al suscribirse al PushManager:", error);
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => removeNotification(newNotif.id), 6000);
  };

  const removeNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const installApp = async () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
              setDeferredPrompt(null);
              setShowInstallModal(false);
          }
      }
  };

  // --- AUTOMATION (Local) ---
  useEffect(() => {
    if (!settings.enableAbandonedCart) {
        if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current);
        return;
    }
    if (cart.length > 0) {
        if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current);
        cartTimeoutRef.current = setTimeout(() => {
            addNotification({
                title: '¿Olvidaste algo?',
                body: 'Tus productos te esperan en el carrito.',
                type: 'warning'
            });
        }, 30000); 
    } else {
        if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current);
    }
    return () => { if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current); };
  }, [cart, settings.enableAbandonedCart]);

  useEffect(() => {
      if (!settings.enableOrderUpdates) {
          prevOrdersRef.current = orders;
          return;
      }
      const prevOrders = prevOrdersRef.current;
      if (prevOrders.length === orders.length) {
          orders.forEach(order => {
              const oldOrder = prevOrders.find(o => o.id === order.id);
              if (oldOrder && oldOrder.status !== order.status) {
                  let msg = '';
                  let type: AppNotification['type'] = 'info';
                  if (order.status === 'completed') {
                      msg = `Tu pedido #${order.id} ha sido completado.`;
                      type = 'success';
                  } else if (order.status === 'cancelled') {
                      msg = `El pedido #${order.id} ha sido cancelado.`;
                      type = 'warning';
                  }
                  if (msg) addNotification({ title: 'Actualización de Pedido', body: msg, type });
              }
          });
      }
      prevOrdersRef.current = orders;
  }, [orders, settings.enableOrderUpdates]);

  return (
    <NotificationContext.Provider value={{
      notifications, addNotification, removeNotification,
      permission, requestPermission,
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
