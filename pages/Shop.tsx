
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShopLayout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { Search, X, ArrowDown, Filter, Zap } from 'lucide-react';
import { SEO } from '../components/SEO';

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
    const hasMore = visibleCount < filteredProducts.length;

    // Manejador Inteligente de Categorías: Actualiza la URL para persistencia
    const handleCategoryChange = (cat: string) => {
        const params = new URLSearchParams(location.search);
        if (cat === 'Todos') {
            params.delete('category');
        } else {
            params.set('category', cat);
        }

        // Usamos 'replace' para que el botón "Atrás" del navegador no te haga pasar por cada categoría que clickeaste
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
                <div className="flex justify-between items-end mb-6 px-2">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-ios-text dark:text-white flex items-center gap-3">
                            {showOffersOnly ? (
                                <>
                                    <span className="text-red-500">Ofertas</span>
                                    <Zap className="fill-red-500 text-red-500" size={32} />
                                </>
                            ) : 'Explorar'}
                        </h1>
                        <p className="text-[10px] text-ios-subtext dark:text-gray-500 uppercase tracking-widest font-black mt-1">{filteredProducts.length} Artículos</p>
                    </div>

                    {(showOffersOnly || searchTerm || selectedCategory !== 'Todos') && (
                        <button onClick={handleClearFilters} className="text-xs font-bold text-ios-blue hover:underline">
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className={`sticky top-20 z-30 mb-8 transition-all duration-500 ease-ios ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0 pointer-events-none'}`}>
                    <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl p-1.5 rounded-[2rem] border border-white/40 dark:border-white/5 shadow-glass flex items-center gap-1.5">

                        <div className={`relative flex items-center transition-all duration-500 ease-ios ${isSearchExpanded ? 'flex-1' : 'w-11'}`}>
                            <button
                                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                                className={`absolute left-0 w-11 h-11 flex items-center justify-center rounded-full z-10 transition-colors ${isSearchExpanded ? 'text-ios-blue' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                            >
                                <Search size={18} />
                            </button>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full h-11 bg-gray-100/50 dark:bg-black/40 rounded-full pl-11 pr-10 outline-none text-xs font-medium transition-all duration-500 ${isSearchExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            />
                            {searchTerm && isSearchExpanded && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 text-gray-400 hover:text-red-500">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {!isSearchExpanded && (
                            <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1 py-1">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => handleCategoryChange(cat)}
                                        className={`whitespace-nowrap px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${selectedCategory === cat
                                            ? 'bg-ios-blue text-white shadow-sm'
                                            : 'text-gray-400 hover:text-ios-blue'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-11 h-11 flex items-center justify-center rounded-full bg-ios-blue/5 text-ios-blue hover:bg-ios-blue/10 transition-colors shrink-0"
                        >
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="mb-8 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/20 dark:border-white/10 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-[10px] text-ios-text dark:text-white uppercase tracking-[0.2em] opacity-40">Filtrar Colección</h3>
                            <button onClick={() => setIsFilterOpen(false)} className="text-[10px] font-black text-red-500 uppercase tracking-widest">Cerrar</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { handleCategoryChange(cat); setIsFilterOpen(false); }}
                                    className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${selectedCategory === cat ? 'bg-ios-blue text-white border-ios-blue' : 'bg-gray-50 dark:bg-white/5 text-gray-400 border-transparent hover:border-ios-blue/30'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {visibleProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                {hasMore && (
                    <div className="py-20 flex justify-center">
                        <button
                            onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                            className="group flex flex-col items-center gap-2 text-gray-400 hover:text-ios-blue transition-all"
                        >
                            <div className="w-11 h-11 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center group-hover:bg-ios-blue/5 group-hover:border-ios-blue/30 transition-all">
                                <ArrowDown size={18} />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Cargar más</span>
                        </button>
                    </div>
                )}

                {filteredProducts.length === 0 && (
                    <div className="text-center py-24 px-6 bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-ios-subtext font-medium italic mb-4">No se encontraron productos.</p>
                        <button onClick={handleClearFilters} className="text-ios-blue font-black text-[10px] uppercase tracking-widest underline decoration-2 underline-offset-4">
                            Limpiar Filtros
                        </button>
                    </div>
                )}
            </div>
        </ShopLayout>
    );
};
