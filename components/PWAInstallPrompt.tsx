import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useNotification } from '../context/NotificationContext';

export const PWAInstallPrompt: React.FC = () => {
    const { settings } = useStore();
    const { deferredPrompt, isStandalone, installApp } = useNotification();
    const [isVisible, setIsVisible] = useState(false);

    const appIcon = settings?.appIconUrl || settings?.logoUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";

    useEffect(() => {
        // No mostrar si ya está instalada o no hay evento diferido
        if (isStandalone || !deferredPrompt) {
            setIsVisible(false);
            return;
        }

        // Revisar si ya fue descartado en los últimos 7 días
        const dismissedAt = localStorage.getItem('pwa_install_dismissed');
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (dismissedAt && (Date.now() - parseInt(dismissedAt, 10)) < sevenDaysMs) {
            setIsVisible(false);
            return;
        }

        // Retraso no intrusivo (45 segundos): nunca aparecer de golpe al entrar a la página
        // Permite que el usuario navegue primero con tranquilidad y no colisione con el aviso de notificaciones
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 45000);

        return () => clearTimeout(timer);
    }, [deferredPrompt, isStandalone]);

    const handleInstallClick = async () => {
        setIsVisible(false);
        // Guardar para que nunca vuelva a salir de manera repetitiva
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
        await installApp();
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Descartar permanentemente por 7 días
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    // Si ya está instalada, no hay evento capturado o está oculta, no renderizar nada
    if (isStandalone || !deferredPrompt || !isVisible) return null;

    return (
        <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[100] flex justify-center animate-slide-up pointer-events-auto">
            <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center justify-between gap-3 max-w-sm w-full border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-700 shadow-md border border-gray-100 dark:border-white/10 overflow-hidden p-0.5 shrink-0 flex items-center justify-center">
                        <img 
                            src={appIcon} 
                            alt="Icono de la App" 
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                                if (settings?.logoUrl && e.currentTarget.src !== settings.logoUrl) {
                                    e.currentTarget.src = settings.logoUrl;
                                }
                            }}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm dark:text-white leading-tight truncate">Instalar {settings?.storeName || 'App'}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5 truncate">Acceso rápido desde tu inicio</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={handleDismiss}
                        aria-label="Cerrar aviso de instalación"
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="px-3.5 py-2 bg-ios-blue text-white text-xs font-bold rounded-xl shadow-lg shadow-ios-blue/30 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        <Download size={14} />
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    );
};
