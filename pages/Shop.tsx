
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShopLayout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { Search, X, ArrowDown, Filter, Zap, LayoutGrid, Square, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';
import { DynamicPillDock } from '../components/DynamicPillDock';

const ITEMS_PER_PAGE = 12;

export const Shop = () => {
    const { products, settings } = useStore();
    const location = useLocation();
    const navigate = useNavigate();

    // Hydrate initial state directly from URL to avoid re-renders that break scroll restoration
    const [selectedCategory, setSelectedCategory] = useState<string>(() => {
        const params = new URLSearchParams(location.search);
        return params.get('category') || 'Todos';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [showOffersOnly, setShowOffersOnly] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('filter') === 'offers';
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded]);

    // --- RESTAURACIÓN DE ESTADO Y SCROLL ---
    // Inicializamos visibleCount leyendo de sessionStorage si existe
    const [visibleCount, setVisibleCount] = useState(() => {
        const saved = sessionStorage.getItem('ara_shop_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.visibleCount || ITEMS_PER_PAGE;
            } catch (e) { }
        }
        return ITEMS_PER_PAGE;
    });

    const isInitialMount = React.useRef(true);
    const isRestoringScroll = React.useRef(false);

    // Efecto para restaurar el scroll exacto inicial
    useEffect(() => {
        const saved = sessionStorage.getItem('ara_shop_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.scrollY > 0) {
                    isRestoringScroll.current = true;
                    // Pequeño timeout para permitir que el DOM renderice los productos restaurados
                    setTimeout(() => {
                        window.scrollTo({ top: parsed.scrollY, behavior: 'instant' });
                        // Permitimos guardar nuevos scrolls después de restaurar
                        setTimeout(() => { isRestoringScroll.current = false; }, 100);
                    }, 50);
                }
            } catch (e) { }
        }
    }, []);

    // Guardar estado en sessionStorage cada vez que cambia visibleCount o el scroll
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Lógica visual del header
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setIsHeaderVisible(false);
            } else {
                setIsHeaderVisible(true);
            }
            setLastScrollY(currentScrollY);

            // Guardado en memoria (throttle natural del scroll)
            if (!isRestoringScroll.current) {
                sessionStorage.setItem('ara_shop_state', JSON.stringify({
                    visibleCount,
                    scrollY: currentScrollY
                }));
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        // Guardar inmediatamente si solo cambia el count sin hacer scroll
        if (!isRestoringScroll.current) {
            sessionStorage.setItem('ara_shop_state', JSON.stringify({
                visibleCount,
                scrollY: window.scrollY
            }));
        }

        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY, visibleCount]);

    // Sincronización URL -> Estado
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const cat = params.get('category');
        const filter = params.get('filter');

        setSelectedCategory(cat || 'Todos');
        setShowOffersOnly(filter === 'offers');
    }, [location.search]);

    // Resetear Cargar Más SOLO cuando cambian los filtros explícitamente (No en el render inicial)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Si cambia un filtro, reiniciamos la vista y borramos la memoria de scroll
        setVisibleCount(ITEMS_PER_PAGE);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        sessionStorage.removeItem('ara_shop_state');

        if (!searchTerm) setIsSearchExpanded(false);
    }, [selectedCategory, searchTerm, showOffersOnly]);

    // Lista de categorías única y normalizada (incluye categorías extra de productos multi-categoría)
    const categories = useMemo(() => {
        const unique = new Set<string>(['Todos']);
        products.forEach(p => {
            if (!p.isVisible) return;
            // Agregar categoría primaria
            if (p.category) {
                const clean = p.category.trim().toLowerCase();
                unique.add(clean.charAt(0).toUpperCase() + clean.slice(1));
            }
            // Agregar categorías extra (multi-categoría)
            (p.extraCategories ?? []).forEach(ec => {
                if (ec) {
                    const clean = ec.trim().toLowerCase();
                    unique.add(clean.charAt(0).toUpperCase() + clean.slice(1));
                }
            });
        });
        return Array.from(unique).sort();
    }, [products]);

    const filteredProducts = useMemo(() => {
        const visible = products.filter(p => {
            if (!p.isVisible) return false;

            if (settings.hideOutOfStock) {
                const totalStock = p.globalStock !== undefined ? p.globalStock :
                    (p.branchStock && Object.keys(p.branchStock).length > 0)
                        ? Object.values(p.branchStock).reduce((acc: number, qty: number) => acc + qty, 0)
                        : (p.stock || 0);

                if (totalStock <= 0) return false;
            }

            return true;
        });
        const lowerSearch = searchTerm.toLowerCase().trim();

        return visible.filter(p => {
            // 1. Filtro de Categoría (Insensible a mayúsculas, incluye categorías extra)
            const productCatNormalized = p.category.trim().toLowerCase();
            const selectedCatNormalized = selectedCategory.trim().toLowerCase();
            const matchesCategory =
                selectedCategory === 'Todos' ||
                productCatNormalized === selectedCatNormalized ||
                (p.extraCategories ?? []).some(
                    ec => ec.trim().toLowerCase() === selectedCatNormalized
                );

            // 2. Filtro de Búsqueda Profunda (Título, Categoría, SKU, Variantes)
            let matchesSearch = true;
            if (lowerSearch) {
                const matchTitle = p.title.toLowerCase().includes(lowerSearch);
                const matchCategory = p.category.toLowerCase().includes(lowerSearch);
                const matchCode = p.code.toLowerCase().includes(lowerSearch);

                // Buscar dentro de las opciones de variantes (ej: buscar "Rojo" o "XL")
                const matchVariants = p.variantOptions?.some(opt =>
                    opt.values.some(val => val.toLowerCase().includes(lowerSearch))
                );

                matchesSearch = matchTitle || matchCategory || matchCode || matchVariants || false;
            }

            // 3. Filtro de Ofertas
            const matchesOffer = !showOffersOnly || (p.salePrice && p.salePrice > 0 && p.salePrice < p.price);

            return matchesCategory && matchesSearch && matchesOffer;
        }).sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));
    }, [products, selectedCategory, searchTerm, showOffersOnly, settings.hideOutOfStock]);

    const visibleProducts = filteredProducts.slice(0, visibleCount);
    const [mobileColumns, setMobileColumns] = useState<1 | 2>(2);
    const hasMore = visibleCount < filteredProducts.length;

    // Manejador Inteligente de Categorías: Actualiza la URL para persistencia
    const handleCategoryChange = (cat: string) => {
        const params = new URLSearchParams(location.search);
        if (cat === 'Todos') {
            params.delete('category');
        } else {
            params.set('category', cat);
        }
        navigate({ pathname: '/shop', search: params.toString() }, { replace: true });
    };

    const handleToggleOffers = () => {
        const params = new URLSearchParams(location.search);
        if (showOffersOnly) {
            params.delete('filter');
        } else {
            params.set('filter', 'offers');
        }
        navigate({ pathname: '/shop', search: params.toString() }, { replace: true });
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        navigate('/shop');
    };

    return (
        <ShopLayout>
            <SEO
                title={showOffersOnly ? 'Ofertas Especiales' : (selectedCategory === 'Todos' ? 'Catálogo Completo' : `Productos de ${selectedCategory}`)}
                description={`Explora nuestra colección de ${selectedCategory === 'Todos' ? 'todos los productos' : selectedCategory}. Encuentra las mejores ofertas y calidad garantizada.`}
            />
            <div className="mb-20">
                {/* Cabecera del Catálogo */}
                <div className="flex justify-between items-end mb-6 px-2">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ios-text dark:text-white flex items-center gap-3">
                            {showOffersOnly ? (
                                <>
                                    <span className="text-red-500">Ofertas</span>
                                    <Zap className="fill-red-500 text-red-500" size={30} />
                                </>
                            ) : (
                                selectedCategory === 'Todos' ? 'Explorar' : selectedCategory
                            )}
                        </h1>
                        <p className="text-[10px] text-ios-subtext dark:text-gray-500 uppercase tracking-widest font-black mt-1">
                            {filteredProducts.length} Artículos Disponibles
                        </p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Botón de Búsqueda Compacto en Catálogo */}
                        <button
                            onClick={() => setIsSearchExpanded(prev => !prev)}
                            className={`p-2 sm:px-3 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-semibold shadow-xs active:scale-95 ${
                                isSearchExpanded || searchTerm
                                    ? 'bg-ios-blue text-white border-ios-blue shadow-ios-blue/20'
                                    : 'bg-white/80 dark:bg-zinc-900/80 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-ios-blue hover:border-ios-blue/40'
                            }`}
                            aria-label="Buscar productos en catálogo"
                            title="Buscar productos"
                        >
                            <Search size={16} />
                            <span className="hidden sm:inline">{searchTerm ? 'Filtrando' : 'Buscar'}</span>
                        </button>

                        {/* Selector de Cuadrícula en Móvil (1 Columna Grande vs 2 Columnas) */}
                        <div className="flex md:hidden items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl p-1 shadow-sm">
                            <button
                                onClick={() => setMobileColumns(1)}
                                className={`p-2 rounded-xl transition-all ${mobileColumns === 1 ? 'bg-ios-blue text-white shadow-sm scale-105' : 'text-gray-400'}`}
                                aria-label="Vista 1 columna grande"
                            >
                                <Square size={16} />
                            </button>
                            <button
                                onClick={() => setMobileColumns(2)}
                                className={`p-2 rounded-xl transition-all ${mobileColumns === 2 ? 'bg-ios-blue text-white shadow-sm scale-105' : 'text-gray-400'}`}
                                aria-label="Vista 2 columnas"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>

                        {(showOffersOnly || searchTerm || selectedCategory !== 'Todos') && (
                            <button onClick={handleClearFilters} className="text-xs font-bold text-ios-blue hover:underline hidden sm:block">
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Buscador Desplegable Compacto (Solo visible cuando se pulsa Buscar o hay término activo) */}
                {(isSearchExpanded || searchTerm) && (
                    <div className="mb-4 animate-fade-in">
                        <div className="relative flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm px-3.5 py-1">
                            <Search className="text-gray-400 shrink-0 mr-2.5" size={16} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar por nombre, categoría, variante o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent outline-none text-xs font-medium text-ios-text dark:text-white placeholder-gray-400 py-1.5"
                            />
                            {searchTerm ? (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                    aria-label="Limpiar texto"
                                >
                                    <X size={14} />
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setIsSearchExpanded(false)} 
                                    className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 px-1.5 py-0.5"
                                >
                                    Cerrar
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* DYNAMIC GLASS PILL DOCK (Flujo natural sin sticky invasivo que tape productos) */}
                <div className="mb-4 sm:mb-5">
                    <DynamicPillDock
                        selectedCategory={selectedCategory}
                        onSelectCategory={handleCategoryChange}
                        showOffersOnly={showOffersOnly}
                        onSelectOffers={handleToggleOffers}
                    />
                </div>

                {/* PÍLDORAS DE FILTROS ACTIVOS DESMAYABLES */}
                {(showOffersOnly || searchTerm || selectedCategory !== 'Todos') && (
                    <div className="flex items-center gap-2 flex-wrap mb-6 px-1 animate-fade-in">
                        {selectedCategory !== 'Todos' && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-ios-blue text-white shadow-sm">
                                <span>{selectedCategory}</span>
                                <button onClick={() => handleCategoryChange('Todos')} className="hover:opacity-75">
                                    <X size={13} />
                                </button>
                            </span>
                        )}
                        {showOffersOnly && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-red-500 text-white shadow-sm">
                                <span>Solo Ofertas</span>
                                <button onClick={handleToggleOffers} className="hover:opacity-75">
                                    <X size={13} />
                                </button>
                            </span>
                        )}
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-gray-200 dark:bg-zinc-800 text-ios-text dark:text-white">
                                <span>"{searchTerm}"</span>
                                <button onClick={() => setSearchTerm('')} className="hover:text-red-500">
                                    <X size={13} />
                                </button>
                            </span>
                        )}
                        <button onClick={handleClearFilters} className="text-xs font-bold text-gray-400 hover:text-red-500 underline ml-1">
                            Limpiar todo
                        </button>
                    </div>
                )}

                {/* Cuadrícula de Productos Adaptable */}
                <div className={`grid ${mobileColumns === 1 ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-2'} lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 transition-all duration-300`}>
                    {visibleProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                {hasMore && (
                    <div className="py-16 flex justify-center">
                        <button
                            onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                            className="group flex flex-col items-center gap-2 text-gray-400 hover:text-ios-blue transition-all"
                        >
                            <div className="w-12 h-12 rounded-full border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex items-center justify-center group-hover:bg-ios-blue/10 group-hover:border-ios-blue/30 group-hover:scale-110 transition-all shadow-sm">
                                <ArrowDown size={18} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cargar más</span>
                        </button>
                    </div>
                )}

                {filteredProducts.length === 0 && (
                    <div className="text-center py-24 px-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-ios-subtext font-medium italic mb-4">No se encontraron productos con estos filtros.</p>
                        <button onClick={handleClearFilters} className="text-ios-blue font-black text-xs uppercase tracking-widest underline decoration-2 underline-offset-4">
                            Restablecer todos los filtros
                        </button>
                    </div>
                )}
            </div>
        </ShopLayout>
    );
};
