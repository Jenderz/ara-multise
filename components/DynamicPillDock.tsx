import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Sparkles, Zap } from 'lucide-react';

interface DynamicPillDockProps {
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    showOffersOnly?: boolean;
    onSelectOffers?: () => void;
    className?: string;
}

export const DynamicPillDock: React.FC<DynamicPillDockProps> = ({
    selectedCategory,
    onSelectCategory,
    showOffersOnly = false,
    onSelectOffers,
    className = ''
}) => {
    const { products, categories, settings } = useStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Filtrar productos visibles para conteos precisos
    const visibleProducts = useMemo(() => {
        return products.filter(p => {
            if (!p.isVisible) return false;
            if (settings.hideOutOfStock) {
                const totalStock = p.globalStock !== undefined ? p.globalStock :
                    (p.branchStock && Object.keys(p.branchStock).length > 0)
                        ? Number(Object.values(p.branchStock).reduce((acc: number, qty: any) => acc + (Number(qty) || 0), 0))
                        : (p.stock || 0);
                if (totalStock <= 0) return false;
            }
            return true;
        });
    }, [products, settings.hideOutOfStock]);

    // Conteo por categoría (normalizado a minúsculas para robustez total)
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        visibleProducts.forEach(p => {
            if (p.category) {
                const key = p.category.trim().toLowerCase();
                counts[key] = (counts[key] || 0) + 1;
            }
            (p.extraCategories ?? []).forEach(ec => {
                if (ec) {
                    const key = ec.trim().toLowerCase();
                    counts[key] = (counts[key] || 0) + 1;
                }
            });
        });
        return counts;
    }, [visibleProducts]);

    // Conteo de ofertas
    const offersCount = useMemo(() => {
        return visibleProducts.filter(p => p.salePrice && p.salePrice > 0 && p.salePrice < p.price).length;
    }, [visibleProducts]);

    // Manejador de scroll para mostrar máscaras de desvanecimiento laterales
    const checkScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        // Comprobación inicial con retardo para permitir renderizado del DOM
        const timer = setTimeout(checkScroll, 100);
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);

        return () => {
            clearTimeout(timer);
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [categories, visibleProducts]);

    // Desplazamiento al inicio si se selecciona 'Todos'
    useEffect(() => {
        if (selectedCategory === 'Todos' && !showOffersOnly && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }, [selectedCategory, showOffersOnly]);

    // Manejador con vibración háptica nativa
    const handleTap = (action: () => void) => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(8); } catch { }
        }
        action();
    };

    return (
        <div className={`w-full relative -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
            <div className="relative max-w-full">
                {/* 1. Máscara de Desvanecimiento Izquierda (Desvanece elementos al deslizar, evitando cortes rectos) */}
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-ios-bg dark:from-black via-ios-bg/80 dark:via-black/80 to-transparent z-20 transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* 2. Máscara de Desvanecimiento Derecha (Indica visualmente continuidad) */}
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-ios-bg dark:from-black via-ios-bg/80 dark:via-black/80 to-transparent z-20 transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* 3. Contenedor de Cápsulas con Desplazamiento Fluido Táctil */}
                <div
                    ref={scrollContainerRef}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 px-4 sm:px-1 scroll-smooth overscroll-x-contain touch-pan-x"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {/* PÍLDORA: TODOS */}
                    <button
                        onClick={() => handleTap(() => {
                            if (showOffersOnly && onSelectOffers) onSelectOffers();
                            onSelectCategory('Todos');
                        })}
                        className={`group relative shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all duration-300 select-none cursor-pointer active:scale-95
                            ${selectedCategory === 'Todos' && !showOffersOnly
                                ? 'bg-ios-blue text-white shadow-[0_3px_12px_rgba(0,122,255,0.3)] scale-[1.02]'
                                : 'bg-white/85 dark:bg-zinc-900/85 hover:bg-white dark:hover:bg-zinc-800 text-ios-text dark:text-zinc-300 border border-black/[0.06] dark:border-white/10 backdrop-blur-xl shadow-xs'
                            }
                        `}
                    >
                        <Sparkles size={13} className={selectedCategory === 'Todos' && !showOffersOnly ? 'text-white' : 'text-ios-blue'} />
                        <span className="whitespace-nowrap">Todo</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            selectedCategory === 'Todos' && !showOffersOnly
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                        }`}>
                            {visibleProducts.length}
                        </span>
                    </button>

                    {/* PÍLDORA ESPECIAL: OFERTAS (Si existen ofertas activas) */}
                    {offersCount > 0 && (
                        <button
                            onClick={() => handleTap(() => {
                                if (onSelectOffers) {
                                    onSelectOffers();
                                } else {
                                    onSelectCategory('Ofertas');
                                }
                            })}
                            className={`group relative shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all duration-300 select-none cursor-pointer active:scale-95
                                ${showOffersOnly
                                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-[0_3px_12px_rgba(239,68,68,0.3)] scale-[1.02]'
                                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 backdrop-blur-xl shadow-xs'
                                }
                            `}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <Zap size={13} className={showOffersOnly ? 'fill-white text-white' : 'fill-red-500 text-red-500'} />
                            <span className="whitespace-nowrap">Ofertas</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                showOffersOnly
                                    ? 'bg-white/20 text-white'
                                    : 'bg-red-500/20 text-red-600 dark:text-red-300'
                            }`}>
                                {offersCount}
                            </span>
                        </button>
                    )}

                    {/* PÍLDORAS POR CADA CATEGORÍA */}
                    {categories.map((cat) => {
                        const count = categoryCounts[cat.name.trim().toLowerCase()] || 0;
                        const isSelected = !showOffersOnly && (
                            selectedCategory.toLowerCase() === cat.name.toLowerCase()
                        );

                        return (
                            <button
                                key={cat.id || cat.name}
                                onClick={() => handleTap(() => {
                                    if (showOffersOnly && onSelectOffers) onSelectOffers();
                                    onSelectCategory(cat.name);
                                })}
                                className={`group relative shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all duration-300 select-none cursor-pointer active:scale-95
                                    ${isSelected
                                        ? 'bg-ios-blue text-white shadow-[0_3px_12px_rgba(0,122,255,0.3)] scale-[1.02]'
                                        : 'bg-white/85 dark:bg-zinc-900/85 hover:bg-white dark:hover:bg-zinc-800 text-ios-text dark:text-zinc-300 border border-black/[0.06] dark:border-white/10 backdrop-blur-xl shadow-xs'
                                    }
                                `}
                            >
                                {cat.image && (
                                    <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-white/20">
                                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <span className="whitespace-nowrap">{cat.name}</span>
                                {count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                        isSelected
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
