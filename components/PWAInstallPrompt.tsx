import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const PWAInstallPrompt = () => {
    const { settings } = useStore();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    const appIcon = settings?.appIconUrl || settings?.logoUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";

    useEffect(() => {
        // Detectar si ya está instalada
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            // Prevenir el mini-infobar automático de Chrome
            e.preventDefault();
            // Guardar el evento para dispararlo después
            setDeferredPrompt(e);
            // Mostrar nuestra propia UI
            if (!localStorage.getItem('pwa_install_dismissed')) {
                setIsVisible(true);
            }
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsVisible(false);
            setDeferredPrompt(null);
            console.log('PWA was installed');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();

        const choiceResult = await deferredPrompt.userChoice;

        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }

        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // No volver a mostrar en esta sesión (o usar localStorage con fecha para recordatorio en X días)
        localStorage.setItem('pwa_install_dismissed', 'true');
    };

    // Si ya está instalada o no hay prompt diferido, no mostramos nada
    if (isInstalled || !isVisible) return null;

    return (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-4 right-4 z-50 flex justify-center animate-slide-up">
            <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center justify-between gap-3 max-w-sm w-full border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3">
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
                    <div>
                        <h4 className="font-bold text-sm dark:text-white leading-tight">Instalar {settings?.storeName || 'App'}</h4>
                        <p className="text-[11px] text-gray-500 max-w-[170px] leading-tight mt-0.5">Acceso rápido desde tu pantalla de inicio.</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleDismiss}
                        aria-label="Cerrar"
                        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="px-3.5 py-2 bg-ios-blue text-white text-xs font-bold rounded-xl shadow-lg shadow-ios-blue/30 hover:scale-105 active:scale-95 transition-all"
                    >
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    );
};
