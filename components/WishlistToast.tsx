import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';

interface WishlistToastDetail {
    productTitle: string;
    action: 'added' | 'removed';
    image?: string;
    count?: number;
}

export const showWishlistToast = (detail: WishlistToastDetail) => {
    // Haptic feedback nativo si está disponible
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(detail.action === 'added' ? [8, 40, 12] : [10]);
        } catch { }
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ara:wishlist-toast', { detail }));
    }
};

export const WishlistToast: React.FC = () => {
    const [toast, setToast] = useState<WishlistToastDetail | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let timer: any;
        const handleEvent = (e: Event) => {
            const customEvent = e as CustomEvent<WishlistToastDetail>;
            setToast(customEvent.detail);
            setIsVisible(true);

            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                setIsVisible(false);
            }, 3200);
        };

        window.addEventListener('ara:wishlist-toast', handleEvent);
        return () => {
            window.removeEventListener('ara:wishlist-toast', handleEvent);
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (!toast || !isVisible) return null;

    const isAdded = toast.action === 'added';

    return (
        <div className="fixed top-3 sm:top-4 inset-x-0 flex justify-center pointer-events-none z-[9999] px-4">
            <div
                onClick={() => {
                    setIsVisible(false);
                    navigate('/wishlist');
                }}
                className="pointer-events-auto group cursor-pointer animate-toast-subtle flex items-center gap-2.5 sm:gap-3 px-3.5 py-2 sm:py-2.5 rounded-full bg-zinc-900/90 dark:bg-black/90 backdrop-blur-xl border border-white/15 text-white shadow-xl shadow-black/25 hover:bg-zinc-800/95 transition-all select-none max-w-full sm:max-w-md"
            >
                {/* Miniatura o Icono */}
                <div className="relative shrink-0 flex items-center justify-center">
                    {toast.image ? (
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-white/20 bg-zinc-800">
                            <img src={toast.image} alt={toast.productTitle} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20" />
                            <Heart
                                size={11}
                                className={`absolute inset-0 m-auto ${isAdded ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'}`}
                            />
                        </div>
                    ) : (
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${isAdded ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 text-zinc-400'}`}>
                            <Heart size={14} className={isAdded ? 'fill-rose-500 text-rose-500' : ''} />
                        </div>
                    )}
                </div>

                {/* Texto descriptivo refinado y sutil */}
                <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-[10px] text-zinc-400 font-medium tracking-wide flex items-center gap-1.5 leading-tight">
                        <span className={`w-1.5 h-1.5 rounded-full ${isAdded ? 'bg-rose-500' : 'bg-zinc-400'}`} />
                        {isAdded ? 'Añadido a favoritos' : 'Eliminado de favoritos'}
                    </span>
                    <span className="text-xs font-semibold text-zinc-100 truncate max-w-[150px] sm:max-w-[220px]">
                        {toast.productTitle}
                    </span>
                </div>

                {/* Botón rápido para ir a la lista */}
                <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-white bg-white/15 group-hover:bg-white/25 py-1 px-2.5 rounded-full transition-colors ml-1">
                    <span>Ver</span>
                    {toast.count !== undefined && toast.count > 0 && (
                        <span className="text-zinc-300 font-normal">({toast.count})</span>
                    )}
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5 text-zinc-300" />
                </div>
            </div>
        </div>
    );
};
