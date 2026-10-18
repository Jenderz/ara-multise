import React, { useState, useEffect } from 'react';
import { Download, X, ArrowDown } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useNotification } from '../context/NotificationContext';

// Icono nativo de Compartir de iOS (cuadrado con flecha hacia arriba)
const IosShareIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
);

// Icono nativo de "Agregar a inicio" de iOS (cuadrado con signo más)
const IosAddHomeIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

export const PWAInstallPrompt: React.FC = () => {
    const { settings } = useStore();
    const { deferredPrompt, isStandalone, installApp, isIOS, showInstallModal, setShowInstallModal } = useNotification();
    const [isVisible, setIsVisible] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);

    // Detección estricta de dispositivo móvil (para no mostrar en computadoras de escritorio)
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const isMobileUA = /android|iphone|ipad|ipod|mobile/i.test(ua);
        return isMobileUA || window.innerWidth < 768;
    });

    useEffect(() => {
        const handleResize = () => {
            const ua = navigator.userAgent || '';
            const isMobileUA = /android|iphone|ipad|ipod|mobile/i.test(ua);
            setIsMobile(isMobileUA || window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const appIcon = settings?.appIconUrl || settings?.logoUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";
    const storeName = settings?.storeName || 'App';

    // Sincronizar apertura manual desde Dashboard o contexto (solo si es iOS móvil)
    useEffect(() => {
        if (showInstallModal) {
            if (isIOS && isMobile) {
                setShowIosGuide(true);
            }
        }
    }, [showInstallModal, isIOS, isMobile]);

    // Control de visibilidad del banner flotante
    useEffect(() => {
        // No mostrar en computadoras de escritorio
        if (!isMobile) {
            setIsVisible(false);
            return;
        }

        // No mostrar si la app ya está instalada en modo standalone
        if (isStandalone) {
            setIsVisible(false);
            return;
        }

        // Si no es iOS ni hay evento diferido para móviles, no mostrar
        if (!isIOS && !deferredPrompt) {
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

        // Retraso no intrusivo (20 segundos): permite navegar antes de mostrar el aviso
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 20000);

        return () => clearTimeout(timer);
    }, [deferredPrompt, isStandalone, isIOS, isMobile]);

    const handleInstallClick = async () => {
        setIsVisible(false);
        if (isIOS) {
            setShowIosGuide(true);
            setShowInstallModal(true);
        } else {
            localStorage.setItem('pwa_install_dismissed', Date.now().toString());
            await installApp();
        }
    };

    const handleDismissBanner = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    const handleCloseIosGuide = () => {
        setShowIosGuide(false);
        setShowInstallModal(false);
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    const canShowBanner = isMobile && isVisible && !isStandalone && (isIOS || deferredPrompt) && !showIosGuide && !showInstallModal;
    const canShowIosModal = (showIosGuide || showInstallModal) && isIOS && isMobile && !isStandalone;

    return (
        <>
            {/* 1. BANNER FLOTANTE NO INTRUSIVO (Solo en dispositivos móviles) */}
            {canShowBanner && (
                <div className="md:hidden fixed bottom-24 left-4 right-4 z-[100] flex justify-center animate-slide-up pointer-events-auto">
                    <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center justify-between gap-3 max-w-sm w-full border border-gray-100 dark:border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-700 shadow-md border border-gray-100 dark:border-white/10 overflow-hidden p-0.5 shrink-0 flex items-center justify-center">
                                <img 
                                    src={appIcon} 
                                    alt={`Icono de ${storeName}`} 
                                    className="w-full h-full object-cover rounded-lg"
                                    onError={(e) => {
                                        if (settings?.logoUrl && e.currentTarget.src !== settings.logoUrl) {
                                            e.currentTarget.src = settings.logoUrl;
                                        }
                                    }}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-sm dark:text-white leading-tight truncate">Instalar {storeName}</h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5 truncate">
                                    {isIOS ? 'Agrega la app a tu pantalla de inicio' : 'Acceso rápido desde tu inicio'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={handleDismissBanner}
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
            )}

            {/* 2. HOJA / MODAL DE INSTRUCCIONES PASO A PASO PARA iOS */}
            {canShowIosModal && (
                <div 
                    className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
                    onClick={handleCloseIosGuide}
                >
                    <div 
                        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-[2.25rem] sm:rounded-3xl shadow-2xl p-6 sm:p-7 animate-slide-up border border-gray-100 dark:border-white/10 pb-safe"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Píldora superior tipo Bottom Sheet de iOS */}
                        <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

                        {/* Botón cerrar */}
                        <button 
                            onClick={handleCloseIosGuide}
                            aria-label="Cerrar instrucciones"
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-white/5 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>

                        {/* Encabezado */}
                        <div className="flex items-center gap-3.5 mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-md border border-gray-100 dark:border-white/10 overflow-hidden p-0.5 shrink-0 flex items-center justify-center">
                                <img 
                                    src={appIcon} 
                                    alt={`Icono de ${storeName}`} 
                                    className="w-full h-full object-cover rounded-[14px]"
                                    onError={(e) => {
                                        if (settings?.logoUrl && e.currentTarget.src !== settings.logoUrl) {
                                            e.currentTarget.src = settings.logoUrl;
                                        }
                                    }}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight">
                                    Instalar {storeName}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                    Accede en 1 toque con pantalla completa desde tu iPhone o iPad.
                                </p>
                            </div>
                        </div>

                        {/* Pasos de instalación */}
                        <div className="space-y-2.5 mb-5">
                            {/* Paso 1 */}
                            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <div className="w-10 h-10 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue flex items-center justify-center shrink-0">
                                    <IosShareIcon className="w-5 h-5 text-ios-blue animate-pulse" />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-400 block">Paso 1</span>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                        Toca el botón <span className="font-bold text-gray-900 dark:text-white">Compartir</span> en Safari.
                                    </p>
                                </div>
                            </div>

                            {/* Paso 2 */}
                            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0">
                                    <IosAddHomeIcon className="w-5 h-5" />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-400 block">Paso 2</span>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                        Desplaza y selecciona <span className="font-bold text-gray-900 dark:text-white">"Agregar a Inicio"</span>.
                                    </p>
                                </div>
                            </div>

                            {/* Paso 3 */}
                            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                                    OK
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-400 block">Paso 3</span>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                        Pulsa <span className="font-bold text-gray-900 dark:text-white">"Agregar"</span> en la esquina superior derecha.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Indicador visual hacia la barra de Safari */}
                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-[11px] mb-4 gap-1">
                            <span className="flex items-center gap-1.5 font-medium">
                                El icono de compartir <IosShareIcon className="w-3.5 h-3.5 inline text-ios-blue" /> está en la barra inferior de Safari
                            </span>
                            <div className="text-ios-blue animate-bounce">
                                <ArrowDown size={14} />
                            </div>
                        </div>

                        {/* Botón de acción */}
                        <button
                            onClick={handleCloseIosGuide}
                            className="w-full py-3 bg-ios-blue hover:brightness-110 active:scale-95 text-white text-sm font-bold rounded-xl shadow-lg shadow-ios-blue/30 transition-all"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
