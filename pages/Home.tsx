import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { Button } from '../components/UIComponents';
import { ProductCard } from '../components/ProductCard';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, Leaf, Sparkles, TrendingUp, Star, Clock, Layers,
    Truck, ShieldCheck, Headphones, RefreshCw, Zap, Award, Lock, Gift, Globe,
    Percent, MessageCircle, ChevronLeft, ChevronRight as ChevronRightIcon, Eye
} from 'lucide-react';
import { SEO } from '../components/SEO';
import { HeroSlide } from '../types';
import { DynamicPillDock } from '../components/DynamicPillDock';

// ------- HOOK: Vistos Recientemente -------
const RECENTLY_VIEWED_KEY = 'recently_viewed_products';
const MAX_RECENT = 8;

const getRecentlyViewed = (): string[] => {
    try { return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]'); } catch { return []; }
};

export const trackProductView = (productId: string) => {
    const current = getRecentlyViewed().filter(id => id !== productId);
    const updated = [productId, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
};

export const Home = () => {
    const { products, categories, settings, orders } = useStore();
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);
    const timeoutRef = useRef<any>(null);

    // Gesto táctil swipe para el carrusel en móviles (Mobile-First UX)
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);

    // --- Visto Recientemente (desde localStorage) ---
    const [recentIds, setRecentIds] = useState<string[]>([]);
    useEffect(() => {
        setRecentIds(getRecentlyViewed());
    }, []);

    const recentlyViewed = useMemo(() => {
        return recentIds
            .map(id => products.find(p => p.id === id && p.isVisible))
            .filter(Boolean)
            .slice(0, 4) as typeof products;
    }, [recentIds, products]);

    // Preparar slides (con fallback a la configuración legacy si no hay array)
    const slides: HeroSlide[] = useMemo(() => {
        if (settings.heroSlides && settings.heroSlides.length > 0) {
            return settings.heroSlides;
        }
        // Fallback Legacy
        return [{
            id: 'legacy',
            title: settings.homeHeroTitle || 'Bienvenido',
            subtitle: settings.homeHeroSubtitle || '',
            image: settings.homeHeroImage || '',
            align: settings.homeHeroAlign || 'center',
            buttonText: 'Comprar Ahora',
            link: '/shop',
            badgeText: 'Nueva Colección',
            glassEffect: settings.homeHeroGlassEffect !== false // Default true if legacy
        }];
    }, [settings]);

    // Auto-play Logic
    useEffect(() => {
        if (slides.length <= 1) return;

        const nextSlide = () => {
            setCurrentSlide(prev => (prev === slides.length - 1 ? 0 : prev + 1));
        };

        timeoutRef.current = setTimeout(nextSlide, 6000); // 6 segundos por slide

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentSlide, slides.length]);

    const changeSlide = (idx: number) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCurrentSlide(idx);
    };

    // Manejo de gestos táctiles para deslizar el carrusel con el dedo en celulares
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const diff = touchStartX.current - touchEndX.current;
        const swipeThreshold = 45; // 45px de umbral para evitar cambios accidentales al scrollear verticalmente

        if (diff > swipeThreshold) {
            // Deslizamiento a la izquierda -> siguiente slide
            changeSlide(currentSlide === slides.length - 1 ? 0 : currentSlide + 1);
        } else if (diff < -swipeThreshold) {
            // Deslizamiento a la derecha -> slide anterior
            changeSlide(currentSlide === 0 ? slides.length - 1 : currentSlide - 1);
        }

        touchStartX.current = 0;
        touchEndX.current = 0;
    };

    // Lógica AUTOMÁTICA de Más Vendidos basada en historial de órdenes
    const bestSellers = useMemo(() => {
        const salesMap = new Map<string, number>();

        orders.forEach(order => {
            if (order.status !== 'cancelled') {
                order.items.forEach(item => {
                    const current = salesMap.get(item.productId) || 0;
                    salesMap.set(item.productId, current + item.quantity);
                });
            }
        });

        return [...products]
            .filter(p => {
                if (!p.isVisible) return false;
                if (settings.hideOutOfStock) {
                    const totalStock = p.globalStock !== undefined ? p.globalStock :
                        (p.branchStock && Object.keys(p.branchStock).length > 0)
                            ? Object.values(p.branchStock).reduce((acc: number, qty: number) => acc + qty, 0)
                            : (p.stock || 0);
                    if (totalStock <= 0) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const salesA = salesMap.get(a.id) || 0;
                const salesB = salesMap.get(b.id) || 0;

                if (salesB !== salesA) return salesB - salesA;
                if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
                return b.createdAt - a.createdAt;
            })
            .slice(0, 4);
    }, [products, orders, settings.hideOutOfStock]);

    const newArrivals = useMemo(() => {
        return [...products]
            .filter(p => {
                if (!p.isVisible) return false;
                if (settings.hideOutOfStock) {
                    const totalStock = p.globalStock !== undefined ? p.globalStock :
                        (p.branchStock && Object.keys(p.branchStock).length > 0)
                            ? Object.values(p.branchStock).reduce((acc: number, qty: number) => acc + qty, 0)
                            : (p.stock || 0);
                    if (totalStock <= 0) return false;
                }
                return true;
            })
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 4);
    }, [products, settings.hideOutOfStock]);

    // Lógica para sección de Ofertas
    const saleProducts = useMemo(() => {
        return products.filter(p => {
            if (!(p.isVisible && p.salePrice && p.salePrice > 0 && p.salePrice < p.price)) return false;
            
            if (settings.hideOutOfStock) {
                const totalStock = p.globalStock !== undefined ? p.globalStock :
                    (p.branchStock && Object.keys(p.branchStock).length > 0)
                        ? Object.values(p.branchStock).reduce((acc: number, qty: number) => acc + qty, 0)
                        : (p.stock || 0);
                if (totalStock <= 0) return false;
            }
            return true;
        }).slice(0, 4);
    }, [products, settings.hideOutOfStock]);

    // Configuraciones visuales del Hero (ALTURAS RESPONSIVAS OPTIMIZADAS MOBILE-FIRST)
    const getHeroHeight = () => {
        switch (settings.homeHeroHeight) {
            case 'compact': return 'h-[44vh] min-h-[320px] sm:h-[48vh] sm:min-h-[380px] md:h-[500px]';
            case 'full': return 'h-[calc(100vh-70px)] min-h-[480px]';
            default: return 'h-[50vh] min-h-[360px] max-h-[540px] sm:h-[56vh] sm:min-h-[440px] md:h-[65vh] md:min-h-[520px] md:max-h-none';
        }
    };

    const getHeroAlignClass = (align: string) => {
        switch (align) {
            case 'left': return 'justify-start text-left items-center';
            case 'right': return 'justify-end text-right items-center';
            default: return 'justify-center text-center items-center';
        }
    };

    const getHeroAlignButtonClass = (align: string) => {
        switch (align) {
            case 'left': return 'justify-start';
            case 'right': return 'justify-end';
            default: return 'justify-center';
        }
    };

    // Handler para el Banner Gift (WhatsApp Link)
    const handleGiftClick = () => {
        const phone = String(settings.giftBannerWhatsApp || settings.whatsappNumber || '').replace(/\D/g, '');
        const message = encodeURIComponent(`Hola, me interesa la promoción: ${settings.giftBannerTitle}`);
        if (phone) {
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        } else {
            alert("No hay un número de WhatsApp configurado.");
        }
    };

    // Mapping de Iconos para Features
    const renderIcon = (iconName: string | undefined, size: number) => {
        const props = { size };
        switch (iconName) {
            case 'truck': return <Truck {...props} />;
            case 'shield': return <ShieldCheck {...props} />;
            case 'headphones': return <Headphones {...props} />;
            case 'return': return <RefreshCw {...props} />;
            case 'star': return <Star {...props} />;
            case 'zap': return <Zap {...props} />;
            case 'leaf': return <Leaf {...props} />;
            case 'award': return <Award {...props} />;
            case 'lock': return <Lock {...props} />;
            case 'gift': return <Gift {...props} />;
            case 'globe': return <Globe {...props} />;
            case 'trending': return <TrendingUp {...props} />;
            case 'sparkles': return <Sparkles {...props} />;
            case 'clock': return <Clock {...props} />;
            default: return <Sparkles {...props} />;
        }
    };

    return (
        <ShopLayout>
            <SEO
                title={settings.homeHeroTitle && settings.homeHeroTitle !== "Inicio" ? settings.homeHeroTitle : undefined}
                description={settings.homeHeroSubtitle || settings.seoDescription}
            />

            {/* --- HERO SECTION CAROUSEL (CON SOPORTE TÁCTIL Y MOBILE FIRST) --- */}
            <section 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`relative w-full rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] overflow-hidden ${getHeroHeight()} mb-4 sm:mb-6 md:mb-8 shadow-xl sm:shadow-2xl group bg-black touch-pan-y select-none`}
            >
                {/* Slides */}
                {slides.map((slide, index) => (
                    <div
                        key={slide.id || index}
                        className={`absolute inset-0 transition-opacity duration-[800ms] ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                        onClick={() => slide.link && navigate(slide.link)}
                        style={{ cursor: slide.link ? 'pointer' : 'default' }}
                    >
                        {/* Background Images Logic (Desktop vs Mobile) */}
                        <div className="absolute inset-0">
                            {/* Imagen de Escritorio */}
                            <img
                                src={slide.image}
                                alt={slide.title}
                                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${index === currentSlide ? 'scale-105 sm:scale-110' : 'scale-100'} ${slide.mobileImage ? 'hidden md:block' : 'block'}`}
                            />

                            {/* Imagen Móvil específica */}
                            {slide.mobileImage && (
                                <img
                                    src={slide.mobileImage}
                                    alt={slide.title}
                                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${index === currentSlide ? 'scale-105' : 'scale-100'} block md:hidden`}
                                />
                            )}

                            {/* Capa de contraste equilibrada */}
                            <div
                                className="absolute inset-0 bg-black transition-opacity duration-700"
                                style={{ opacity: settings.homeHeroOverlayOpacity !== undefined ? settings.homeHeroOverlayOpacity : 0.35 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
                        </div>

                        {/* Content */}
                        <div className={`relative z-20 w-full px-4 sm:px-8 md:px-12 flex h-full ${getHeroAlignClass(slide.align)}`}>
                            {/* Panel contenedor tipográfico adaptable */}
                            <div className={`w-full max-w-2xl animate-slide-up ${slide.glassEffect ? 'bg-black/30 sm:bg-white/10 backdrop-blur-md p-4 sm:p-7 md:p-12 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-white/10 shadow-glass' : 'p-2 sm:p-4'}`}>

                                {/* Dynamic Badge */}
                                {slide.badgeText && (
                                    <div className={`mb-2 sm:mb-4 flex ${getHeroAlignButtonClass(slide.align)}`}>
                                        <span className="inline-flex items-center gap-1.5 py-1 px-3 sm:py-1.5 sm:px-4 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 text-white text-[9px] sm:text-[10px] md:text-xs font-black tracking-[0.16em] uppercase shadow-md">
                                            <Sparkles size={12} className="text-yellow-300" /> {slide.badgeText}
                                        </span>
                                    </div>
                                )}

                                {!slide.hideText && !settings.heroSliderOnlyImages && (
                                    <>
                                        <h1 className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-serif text-white mb-1.5 sm:mb-3 md:mb-5 leading-[1.08] tracking-tight drop-shadow-lg">
                                            {slide.title}
                                        </h1>

                                        <p className="text-xs sm:text-base md:text-xl text-white/90 mb-3 sm:mb-6 md:mb-8 font-light leading-relaxed drop-shadow-md mx-auto md:mx-0 line-clamp-2 sm:line-clamp-3 md:line-clamp-none max-w-lg">
                                            {slide.subtitle}
                                        </p>
                                    </>
                                )}

                                {!slide.hideButton && !settings.heroSliderOnlyImages && (
                                    <div className={`flex flex-col sm:flex-row gap-3 ${getHeroAlignButtonClass(slide.align)}`}>
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(slide.link || '/shop');
                                            }}
                                            className="!bg-white !text-black hover:!bg-gray-100 py-2.5 px-6 sm:py-3.5 sm:px-10 text-xs sm:text-base rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 font-bold tracking-wide"
                                        >
                                            {slide.buttonText || 'Ver Colección'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Navigation Dots (Píldoras interactivas ultra-smooth) */}
                {slides.length > 1 && (
                    <div className="absolute bottom-3 sm:bottom-6 md:bottom-8 left-0 right-0 z-30 flex justify-center gap-1.5 sm:gap-2.5 pointer-events-none">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); changeSlide(idx); }}
                                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 pointer-events-auto ${idx === currentSlide ? 'w-6 sm:w-8 bg-white shadow-md' : 'w-1.5 sm:w-2 bg-white/40 hover:bg-white/70'}`}
                                aria-label={`Ir al slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}

                {/* Navigation Arrows (Visibles en pantallas medianas y de escritorio) */}
                {slides.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); changeSlide(currentSlide === 0 ? slides.length - 1 : currentSlide - 1); }}
                            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-white/25 transition-all active:scale-90"
                            aria-label="Slide anterior"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); changeSlide(currentSlide === slides.length - 1 ? 0 : currentSlide + 1); }}
                            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-white/25 transition-all active:scale-90"
                            aria-label="Siguiente slide"
                        >
                            <ChevronRightIcon size={22} />
                        </button>
                    </>
                )}
            </section>

            {/* --- DYNAMIC GLASS PILL DOCK (ACCESO RÁPIDO ERGONÓMICO CON MARGEN AMPLIO) --- */}
            <div className="mt-6 sm:mt-8 md:mt-10 mb-8 sm:mb-12 md:mb-16 px-1 sm:px-3 relative z-30">
                <DynamicPillDock
                    selectedCategory="Todos"
                    onSelectCategory={(cat) => {
                        navigate(cat === 'Todos' ? '/shop' : `/shop?category=${encodeURIComponent(cat)}`);
                    }}
                    onSelectOffers={() => navigate('/shop?filter=offers')}
                />
            </div>

            {/* --- BEST SELLERS (CUADRÍCULA MOBILE-FIRST 2 COLUMNAS) --- */}
            {settings.showBestSellers !== false && (
            <section className="mb-12 sm:mb-16 md:mb-24">
                <div className="flex justify-between items-center mb-4 sm:mb-8 px-1 sm:px-4">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-[10px] sm:text-xs font-black text-ios-blue uppercase tracking-widest">Lo más vendido</span>
                        </div>
                        <h2 className="text-xl sm:text-3xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Más Vendidos</h2>
                    </div>
                    <Button 
                        variant="ghost" 
                        onClick={() => navigate('/shop')} 
                        className="text-xs sm:text-sm font-bold text-ios-blue hover:text-blue-600 gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5"
                    >
                        <span>Ver Todo</span>
                        <ArrowRight size={14} />
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 px-1 sm:px-2">
                    {bestSellers.length > 0 ? (
                        bestSellers.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))
                    ) : (
                        <div className="col-span-full py-16 text-center text-gray-400 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 text-sm">
                            Cargando productos destacados...
                        </div>
                    )}
                </div>
            </section>
            )}

            {/* --- GIFT / WHATSAPP PROMO BANNER --- */}
            {settings.giftBannerImage && (
                <section className="mb-12 sm:mb-16 md:mb-24 px-1 sm:px-2">
                    <div 
                        className="relative w-full rounded-2xl sm:rounded-3xl md:rounded-[3rem] overflow-hidden shadow-xl sm:shadow-2xl group cursor-pointer border border-white/40 dark:border-white/5" 
                        onClick={handleGiftClick}
                    >
                        <div className="flex flex-col md:flex-row min-h-[300px] md:min-h-[400px]">
                            {/* Imagen */}
                            <div className="w-full md:w-1/2 relative h-48 sm:h-64 md:h-auto overflow-hidden">
                                <img
                                    src={settings.giftBannerImage}
                                    alt={settings.giftBannerTitle}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
                            </div>

                            {/* Contenido */}
                            <div className="w-full md:w-1/2 bg-white dark:bg-zinc-900 p-6 sm:p-10 md:p-12 lg:p-16 flex flex-col justify-center relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10 hidden sm:block">
                                    <Gift size={120} className="text-ios-blue dark:text-white rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <span className="inline-block px-2.5 py-1 bg-ios-blue/10 text-ios-blue rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest mb-3 sm:mb-4 border border-ios-blue/20">
                                        Promoción Especial
                                    </span>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-ios-text dark:text-white mb-2 sm:mb-4 leading-tight">
                                        {settings.giftBannerTitle}
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base md:text-lg mb-6 leading-relaxed font-light line-clamp-3">
                                        {settings.giftBannerDescription}
                                    </p>
                                    <button
                                        className="inline-flex items-center gap-2 bg-ios-blue hover:brightness-110 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold shadow-lg shadow-ios-blue/30 transition-transform active:scale-95 text-xs sm:text-sm md:text-base uppercase tracking-wide"
                                    >
                                        <MessageCircle size={18} />
                                        {settings.giftBannerButtonText || 'Lo quiero'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* --- OFERTAS RELÁMPAGO (FLASH SALES MOBILE-FIRST) --- */}
            {settings.showSaleSection !== false && saleProducts.length > 0 && (
                <section className="mb-12 sm:mb-16 md:mb-24 px-1 sm:px-4">
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl sm:rounded-3xl md:rounded-[3rem] p-4 sm:p-8 md:p-12 border border-red-100 dark:border-red-900/30 relative overflow-hidden">
                        {/* Decoración sutil de Fondo */}
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none hidden sm:block">
                            <Percent size={180} className="text-red-500" />
                        </div>

                        <div className="flex justify-between items-center mb-4 sm:mb-8 gap-2 relative z-10">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Zap size={14} className="text-red-500 fill-red-500" />
                                    <span className="text-[10px] sm:text-xs font-black text-red-500 uppercase tracking-widest">Tiempo Limitado</span>
                                </div>
                                <h2 className="text-xl sm:text-3xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Ofertas Relámpago</h2>
                            </div>
                            <Button 
                                variant="ghost" 
                                onClick={() => navigate('/shop?filter=offers')} 
                                className="text-xs sm:text-sm font-bold text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5"
                            >
                                <span>Ver Todas</span>
                                <ArrowRight size={14} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 relative z-10">
                            {saleProducts.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* --- FEATURED CATEGORIES CAROUSEL (HISTORIAS Y CATÁLOGO TÁCTIL) --- */}
            {settings.showCategoriesSection !== false && categories.length > 0 && (
                <section className="mb-12 sm:mb-16 md:mb-24 relative">
                    <div className="flex justify-between items-center mb-4 sm:mb-6 px-1 sm:px-2">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Layers size={14} className="text-ios-blue" />
                                <span className="text-[10px] sm:text-xs font-black text-ios-blue uppercase tracking-widest">Colecciones</span>
                            </div>
                            <h2 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold text-ios-text dark:text-white">Categorías</h2>
                        </div>
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate('/shop')} 
                            className="text-xs sm:text-sm font-bold text-ios-blue hover:text-blue-600 gap-1 px-2.5 sm:px-4 py-1.5"
                        >
                            <span>Ver Todo</span>
                            <ArrowRight size={14} />
                        </Button>
                    </div>

                    {/* Carrusel Horizontal con Scroll Snap Optimizado para Celulares */}
                    <div className="flex overflow-x-auto gap-2.5 sm:gap-4 md:gap-6 pb-3 no-scrollbar snap-x snap-mandatory px-1 sm:px-2 -mx-1 sm:mx-0 overscroll-x-contain touch-pan-x">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => navigate(`/shop?category=${encodeURIComponent(cat.name)}`)}
                                className="w-28 sm:w-40 md:w-56 flex-shrink-0 snap-center select-none"
                            >
                                <div className="group relative aspect-[3/4] rounded-2xl md:rounded-[2rem] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-white/40 dark:border-white/5 active:scale-95">
                                    <img
                                        src={cat.image}
                                        alt={cat.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-70 group-hover:opacity-85 transition-opacity" />

                                    <div className="absolute bottom-0 left-0 w-full p-2.5 sm:p-4 text-center">
                                        <h3 className="text-white text-xs sm:text-sm md:text-lg font-bold leading-tight drop-shadow-md line-clamp-2">
                                            {cat.name}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Tarjeta "Explorar Catálogo Completo" al final del carrusel */}
                        <div className="w-24 sm:w-32 flex-shrink-0 snap-center flex items-center justify-center">
                            <button
                                onClick={() => navigate('/shop')}
                                aria-label="Ver todas las categorías"
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-ios-blue shadow-lg border border-gray-100 dark:border-white/10 active:scale-90 transition-transform"
                            >
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* --- NEW ARRIVALS (NOVEDADES EN 2 COLUMNAS) --- */}
            {settings.showNewArrivals !== false && (
            <section className="mb-12 sm:mb-16 md:mb-24">
                <div className="flex justify-between items-center mb-4 sm:mb-8 px-1 sm:px-4">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Clock size={14} className="text-ios-blue" />
                            <span className="text-[10px] sm:text-xs font-black text-ios-blue uppercase tracking-widest">Recién llegados</span>
                        </div>
                        <h2 className="text-xl sm:text-3xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Novedades</h2>
                    </div>
                    <Button 
                        variant="ghost" 
                        onClick={() => navigate('/shop')} 
                        className="text-xs sm:text-sm font-bold text-ios-blue hover:text-blue-600 gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5"
                    >
                        <span>Ver Todo</span>
                        <ArrowRight size={14} />
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 px-1 sm:px-2">
                    {newArrivals.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </section>
            )}

            {/* --- VISTO RECIENTEMENTE (2 COLUMNAS) --- */}
            {recentlyViewed.length > 0 && (
            <section className="mb-12 sm:mb-16 md:mb-24">
                <div className="flex justify-between items-center mb-4 sm:mb-8 px-1 sm:px-4">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Eye size={14} className="text-ios-blue" />
                            <span className="text-[10px] sm:text-xs font-black text-ios-blue uppercase tracking-widest">Tus visitas</span>
                        </div>
                        <h2 className="text-xl sm:text-3xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Visto Recientemente</h2>
                    </div>
                    <Button 
                        variant="ghost" 
                        onClick={() => navigate('/shop')} 
                        className="text-xs sm:text-sm font-bold text-ios-blue hover:text-blue-600 gap-1 px-2.5 sm:px-4 py-1.5"
                    >
                        <span>Ver Tienda</span>
                        <ArrowRight size={14} />
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 px-1 sm:px-2">
                    {recentlyViewed.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </section>
            )}

            {/* --- FEATURES GRID (ADAPTABLE MOBILE-FIRST) --- */}
            {settings.showFeaturesSection !== false && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mb-12 sm:mb-20 px-1 sm:px-2">
                {/* Feature 1 */}
                <div className="bg-white dark:bg-zinc-900 p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xs hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                        {renderIcon(settings.homeFeature1Icon || 'leaf', 24)}
                    </div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl md:text-2xl mb-1.5 sm:mb-3 dark:text-white relative z-10">{settings.homeFeature1Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed font-light relative z-10">{settings.homeFeature1Text}</p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white dark:bg-zinc-900 p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xs hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-pink-50 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                        {renderIcon(settings.homeFeature2Icon || 'trending', 24)}
                    </div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl md:text-2xl mb-1.5 sm:mb-3 dark:text-white relative z-10">{settings.homeFeature2Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed font-light relative z-10">{settings.homeFeature2Text}</p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white dark:bg-zinc-900 p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xs hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                        {renderIcon(settings.homeFeature3Icon || 'sparkles', 24)}
                    </div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl md:text-2xl mb-1.5 sm:mb-3 dark:text-white relative z-10">{settings.homeFeature3Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed font-light relative z-10">{settings.homeFeature3Text}</p>
                </div>
            </section>
            )}
        </ShopLayout>
    );
};
