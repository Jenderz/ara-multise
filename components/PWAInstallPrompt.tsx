import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

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
        <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center animate-slide-up">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 max-w-sm w-full border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="bg-ios-blue/10 p-2.5 rounded-xl text-ios-blue">
                        <Download size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm dark:text-white">Instalar App</h4>
                        <p className="text-xs text-gray-500 max-w-[180px]">Mejor experiencia, uso sin conexión y notificaciones.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="px-4 py-2 bg-ios-blue text-white text-xs font-bold rounded-xl shadow-lg shadow-ios-blue/30 hover:scale-105 transition-transform"
                    >
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    );
};
