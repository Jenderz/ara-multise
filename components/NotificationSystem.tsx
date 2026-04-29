
import React, { useEffect, useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { useStore } from '../context/StoreContext';
import { Bell, X, Download, Share, PlusSquare, Smartphone, Check, Zap, Truck, ShoppingBag, Upload, ArrowDown } from 'lucide-react';

export const NotificationSystem = () => {
    const { notifications, removeNotification, permission, requestPermission, isIOS, isStandalone, deferredPrompt, installApp, showInstallModal, setShowInstallModal } = useNotification();
    const { settings } = useStore();
    const [hidePermissionBanner, setHidePermissionBanner] = useState(false);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <Check size={18} className="text-green-500" />;
            case 'promo': return <Zap size={18} className="text-yellow-500" />;
            case 'warning': return <ShoppingBag size={18} className="text-orange-500" />;
            case 'info': return <Truck size={18} className="text-blue-500" />;
            default: return <Bell size={18} className="text-ios-blue" />;
        }
    };

    const handleCloseInstall = () => {
        setShowInstallModal(false);
        localStorage.setItem('pwa_prompt_seen', 'true');
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

            {/* 3. INSTALL PROMPT MODAL (Smart Logic) */}
            {showInstallModal && !isStandalone && (
                <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={handleCloseInstall}></div>
                    
                    <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-8 animate-slide-up border-t border-white/20">
                         <div className="absolute top-4 right-4">
                            <button onClick={handleCloseInstall} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                                <X size={20} />
                            </button>
                         </div>

                         <div className="text-center mb-6 pt-2">
                             <div className="w-20 h-20 bg-gray-100 dark:bg-white/10 rounded-[1.2rem] mx-auto mb-4 flex items-center justify-center shadow-lg overflow-hidden">
                                {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover" /> : <Smartphone size={40} className="text-ios-blue"/>}
                             </div>
                             <h3 className="text-2xl font-black text-ios-text dark:text-white mb-2">Instalar App</h3>
                             <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Experiencia completa, sin descargas lentas.</p>
                         </div>

                         {isIOS ? (
                             // iOS Instructions (High Fidelity)
                             <div className="space-y-4">
                                 <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-1 overflow-hidden border border-gray-100 dark:border-white/5">
                                     <div className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-white/5">
                                         <div className="text-ios-blue animate-pulse">
                                             <Upload size={24} /> 
                                         </div>
                                         <div className="text-left">
                                             <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Paso 1</p>
                                             <p className="text-sm font-medium dark:text-gray-200">Toca el botón <span className="font-bold">Compartir</span> en la barra.</p>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-4 p-4">
                                         <div className="text-gray-500 dark:text-gray-300">
                                             <PlusSquare size={24} />
                                         </div>
                                         <div className="text-left">
                                             <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Paso 2</p>
                                             <p className="text-sm font-medium dark:text-gray-200">Selecciona <span className="font-bold">Agregar a Inicio</span>.</p>
                                         </div>
                                     </div>
                                 </div>
                                 
                                 {/* Animated Arrow Pointing Down */}
                                 <div className="flex flex-col items-center justify-center text-ios-blue animate-bounce pt-2">
                                     <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Empieza aquí</span>
                                     <ArrowDown size={24} />
                                 </div>
                             </div>
                         ) : (
                             // Android / Desktop Button
                             <button 
                                onClick={installApp}
                                className="w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all"
                             >
                                <Download size={22} /> Instalar Ahora
                             </button>
                         )}
                         
                         <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400 font-medium">
                             <Zap size={12} className="text-yellow-500 fill-yellow-500"/>
                             <span>Tecnología Ultra Rápida (PWA)</span>
                         </div>
                    </div>
                </div>
            )}
        </>
    );
};
