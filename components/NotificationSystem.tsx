
import React, { useEffect, useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Bell, X, Check, Zap, Truck, ShoppingBag } from 'lucide-react';

export const NotificationSystem = () => {
    const { notifications, removeNotification, permission, requestPermission } = useNotification();
    const [hidePermissionBanner, setHidePermissionBanner] = useState(true);

    useEffect(() => {
        // Mostrar el banner de permiso a los 25 segundos (aproximadamente entre 20 y 30 segundos) si está en 'default' y no ha sido descartado
        if (permission === 'default' && typeof window !== 'undefined') {
            const dismissedAt = localStorage.getItem('pwa_push_dismissed');
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            if (!dismissedAt || (Date.now() - parseInt(dismissedAt, 10)) > sevenDaysMs) {
                const timer = setTimeout(() => setHidePermissionBanner(false), 25000);
                return () => clearTimeout(timer);
            }
        }
    }, [permission]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <Check size={18} className="text-green-500" />;
            case 'promo': return <Zap size={18} className="text-yellow-500" />;
            case 'warning': return <ShoppingBag size={18} className="text-orange-500" />;
            case 'info': return <Truck size={18} className="text-blue-500" />;
            default: return <Bell size={18} className="text-ios-blue" />;
        }
    };

    return (
        <>
            {/* 1. TOAST CONTAINER (Top Center) */}
            <div className="fixed top-4 left-0 right-0 z-[110] flex flex-col items-center gap-3 pointer-events-none px-4">
                {notifications.map((notif) => (
                    <div 
                        key={notif.id}
                        className="pointer-events-auto w-full max-w-sm bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 flex gap-4 animate-slide-in-top transition-all"
                        onClick={() => removeNotification(notif.id)}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                            {notif.image ? <img src={notif.image} className="w-full h-full object-cover rounded-xl" /> : getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-ios-text dark:text-white leading-tight mb-1">{notif.title}</h4>
                            <p className="text-xs text-ios-subtext leading-snug line-clamp-2">{notif.body}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">Ahora</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }} className="text-gray-400 hover:text-gray-600 self-start">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* 2. PROMPT PERMISO NOTIFICACIONES PUSH (Amigable y elegante para clientes) */}
            {permission === 'default' && !hidePermissionBanner && (
                <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[105] max-w-sm bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-[0_12px_40px_rgb(0,0,0,0.18)] rounded-2xl p-4 animate-slide-up">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue flex items-center justify-center shrink-0">
                            <Bell size={20} className="animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">¿Activar Notificaciones?</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">Entérate de ofertas relámpago, nuevos cupones y novedades de tus pedidos.</p>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={async () => {
                                        setHidePermissionBanner(true);
                                        await requestPermission();
                                    }}
                                    className="flex-1 py-2 px-3 bg-ios-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition-all"
                                >
                                    Activar
                                </button>
                                <button
                                    onClick={() => {
                                        setHidePermissionBanner(true);
                                        localStorage.setItem('pwa_push_dismissed', Date.now().toString());
                                    }}
                                    className="py-2 px-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white font-semibold transition-colors"
                                >
                                    Ahora no
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
