import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface NavItem {
    path: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    hasBadge?: boolean;
}

export const MobileFloatingNav: React.FC = () => {
    const location = useLocation();
    const { wishlist } = useStore();
    const [isCompact, setIsCompact] = useState(false);

    // Referencias para control de scroll optimizado
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    // Número de elementos en lista de deseos para badge
    const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;

    useEffect(() => {
        const SCROLL_THRESHOLD = 15; // Threshold de 15px requerido para evitar parpadeos
        const TOP_EXPAND_THRESHOLD = 35; // Cerca del tope siempre expandido

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (!ticking.current) {
                window.requestAnimationFrame(() => {
                    // 1. En la parte superior de la página, siempre tamaño completo
                    if (currentScrollY <= TOP_EXPAND_THRESHOLD) {
                        setIsCompact(false);
                        lastScrollY.current = currentScrollY;
                        ticking.current = false;
                        return;
                    }

                    const diff = currentScrollY - lastScrollY.current;

                    // 2. Scroll hacia abajo mayor a 15px -> compactar píldora
                    if (diff > SCROLL_THRESHOLD) {
                        setIsCompact(true);
                        lastScrollY.current = currentScrollY;
                    }
                    // 3. Scroll hacia arriba mayor a 15px -> expandir tamaño completo
                    else if (diff < -SCROLL_THRESHOLD) {
                        setIsCompact(false);
                        lastScrollY.current = currentScrollY;
                    }

                    ticking.current = false;
                });
                ticking.current = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Haptic feedback nativo para interacción táctil de alta gama
    const triggerHaptic = () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(8); } catch { }
        }
    };

    const navItems: NavItem[] = [
        { path: '/', label: 'Inicio', icon: Home },
        { path: '/shop', label: 'Tienda', icon: LayoutGrid },
        { path: '/wishlist', label: 'Deseos', icon: Heart, hasBadge: wishlistCount > 0 },
    ];

    return (
        <aside 
            aria-label="Navegación inferior móvil" 
            className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full flex justify-center px-4"
        >
            <nav
                className={`pointer-events-auto flex items-center justify-around rounded-full bg-white/75 dark:bg-zinc-900/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
                    isCompact
                        ? 'h-[46px] w-[58%] max-w-[210px] px-2 py-1 gap-1'
                        : 'h-[58px] w-[86%] max-w-[320px] px-3 py-1.5 gap-1.5'
                }`}
            >
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const IconComponent = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={triggerHaptic}
                            aria-label={item.label}
                            aria-current={isActive ? 'page' : undefined}
                            className={`relative flex flex-col items-center justify-center flex-1 h-full rounded-full transition-all duration-300 active:scale-90 ${
                                isActive
                                    ? 'text-ios-blue dark:text-blue-400 font-extrabold bg-ios-blue/10 dark:bg-ios-blue/20'
                                    : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 font-medium'
                            } ${isCompact ? 'py-1' : 'py-1'}`}
                        >
                            {/* Icono con escalado suave según el modo */}
                            <div className="relative flex items-center justify-center">
                                <IconComponent
                                    size={isCompact ? 18 : 20}
                                    strokeWidth={isActive ? 2.5 : 1.75}
                                    className={`transition-all duration-300 ${
                                        isActive && item.path === '/wishlist' ? 'fill-ios-blue dark:fill-blue-400' : ''
                                    }`}
                                />
                                
                                {/* Badge de notificación para Lista de Deseos */}
                                {item.hasBadge && (
                                    <span
                                        className={`absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm ${
                                            isCompact 
                                                ? 'w-2 h-2 text-[0px]' 
                                                : 'min-w-[14px] h-[14px] px-0.5 text-[9px] leading-none'
                                        }`}
                                    >
                                        {!isCompact && (wishlistCount > 9 ? '9+' : wishlistCount)}
                                    </span>
                                )}
                            </div>

                            {/* Label animado: colapsa y desaparece al compactar */}
                            <span
                                className={`text-[10px] tracking-tight leading-none transition-all duration-300 ease-in-out origin-top ${
                                    isCompact
                                        ? 'max-h-0 opacity-0 scale-75 mt-0 pointer-events-none -translate-y-1 overflow-hidden'
                                        : 'max-h-4 opacity-100 scale-100 mt-0.5'
                                }`}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
};
