
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { Button } from '../components/UIComponents';
import { ProductCard } from '../components/ProductCard';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, Leaf, Heart, Sparkles, TrendingUp, Star, Clock, Layers,
    Truck, ShieldCheck, Headphones, RefreshCw, Zap, Award, Lock, Gift, Globe,
    Percent, MessageCircle, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { SEO } from '../components/SEO';
import { HeroSlide } from '../types';

export const Home = () => {
    const { products, categories, settings, orders } = useStore();
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);
    const timeoutRef = useRef<any>(null);

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

    // Lógica AUTOMÁTICA de Más Vendidos basada en historial de órdenes
    const bestSellers = useMemo(() => {
        // 1. Calcular frecuencia de ventas por producto
        const salesMap = new Map<string, number>();

        orders.forEach(order => {
            if (order.status !== 'cancelled') { // Ignorar pedidos cancelados
                order.items.forEach(item => {
                    const current = salesMap.get(item.productId) || 0;
                    salesMap.set(item.productId, current + item.quantity);
                });
            }
        });

        // 2. Ordenar productos: Más ventas > Destacados manualmente > Más nuevos
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

                // Prioridad 1: Volumen de ventas descendente
                if (salesB !== salesA) return salesB - salesA;

                // Prioridad 2: Si tienen mismas ventas (ej. 0), usar flag manual 'Destacar'
                if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;

                // Prioridad 3: Fecha de creación (para desempatar productos nuevos)
                return b.createdAt - a.createdAt;
            })
            .slice(0, 4);
    }, [products, orders, settings.hideOutOfStock]);

    const newArrivals = useMemo(() => {
        // Ordenamos por fecha de creación para "Novedades"
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

    // Configuraciones visuales del Hero (ALTURAS RESPONSIVAS)
    const getHeroHeight = () => {
        switch (settings.homeHeroHeight) {
            case 'compact': return 'h-[50vh] min-h-[400px] md:h-[500px]';
            case 'full': return 'h-[calc(100vh-64px)]';
            default: return 'h-[65vh] min-h-[500px] md:h-[700px]';
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
                title={settings.homeHeroTitle || "Inicio"}
                description={settings.homeHeroSubtitle || settings.seoDescription}
            />

            {/* --- HERO SECTION CAROUSEL --- */}
            <section className={`relative w-full rounded-[2.5rem] overflow-hidden ${getHeroHeight()} mb-16 shadow-2xl group bg-black`}>

                {/* Slides */}
                {slides.map((slide, index) => (
                    <div
                        key={slide.id || index}
                        className={`absolute inset-0 transition-opacity duration-[1000ms] ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        // Hacer todo el slide clickeable si hay link
                        onClick={() => slide.link && navigate(slide.link)}
                        style={{ cursor: slide.link ? 'pointer' : 'default' }}
                    >
                        {/* Background Images Logic (Desktop vs Mobile) */}
                        <div className="absolute inset-0">
                            {/* Imagen de Escritorio (Siempre visible si no hay mobileImage, o solo en md+ si hay) */}
                            <img
                                src={slide.image}
                                alt={slide.title}
                                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${index === currentSlide ? 'scale-110' : 'scale-100'} ${slide.mobileImage ? 'hidden md:block' : 'block'}`}
                            />

                            {/* Imagen Móvil (Solo visible en móviles si existe) */}
                            {slide.mobileImage && (
                                <img
                                    src={slide.mobileImage}
                                    alt={slide.title}
                                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${index === currentSlide ? 'scale-110' : 'scale-100'} block md:hidden`}
                                />
                            )}

                            <div
                                className="absolute inset-0 bg-black transition-opacity duration-700"
                                style={{ opacity: settings.homeHeroOverlayOpacity || 0.3 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                        </div>

                        {/* Content */}
                        <div className={`relative z-20 w-full px-6 md:px-12 flex h-full ${getHeroAlignClass(slide.align)}`}>
                            {/* Glass Effect Condicional por Slide */}
                            <div className={`max-w-3xl animate-slide-up ${slide.glassEffect ? 'bg-white/10 backdrop-blur-md p-8 md:p-12 rounded-[2rem] border border-white/10 shadow-glass' : 'p-4'}`}>

                                {/* Dynamic Badge */}
                                {slide.badgeText && (
                                    <div className={`mb-6 flex ${getHeroAlignButtonClass(slide.align)}`}>
                                        <span className="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white text-[10px] md:text-xs font-black tracking-[0.2em] uppercase shadow-lg">
                                            <Sparkles size={14} className="text-yellow-300" /> {slide.badgeText}
                                        </span>
                                    </div>
                                )}

                                {!slide.hideText && (
                                    <>
                                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 leading-[0.9] tracking-tighter drop-shadow-xl">
                                            {slide.title}
                                        </h1>

                                        <p className="text-lg md:text-2xl text-white/90 mb-10 max-w-xl font-light leading-relaxed drop-shadow-md mx-auto md:mx-0">
                                            {slide.subtitle}
                                        </p>
                                    </>
                                )}

                                {!slide.hideButton && (
                                    <div className={`flex flex-col sm:flex-row gap-4 ${getHeroAlignButtonClass(slide.align)}`}>
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Evitar doble evento si el contenedor ya navega
                                                navigate(slide.link || '/shop');
                                            }}
                                            className="!bg-white !text-black hover:!bg-gray-100 py-4 px-12 text-lg rounded-full shadow-2xl transition-all hover:-translate-y-1 font-bold tracking-wide"
                                        >
                                            {slide.buttonText || 'Ver Más'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Navigation Dots (Solo si hay más de 1 slide) */}
                {slides.length > 1 && (
                    <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-3 pointer-events-none">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); changeSlide(idx); }}
                                className={`h-2 rounded-full transition-all duration-300 pointer-events-auto ${idx === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                                aria-label={`Ir al slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}

                {/* Navigation Arrows (Solo en Desktop y si hay más de 1) */}
                {slides.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); changeSlide(currentSlide === 0 ? slides.length - 1 : currentSlide - 1); }}
                            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); changeSlide(currentSlide === slides.length - 1 ? 0 : currentSlide + 1); }}
                            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
                        >
                            <ChevronRightIcon size={24} />
                        </button>
                    </>
                )}
            </section>

            {/* --- BEST SELLERS --- */}
            <section className="mb-24">
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 px-4 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Star size={18} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-black text-ios-blue uppercase tracking-widest">Lo más popular</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Más Vendidos</h2>
                    </div>
                    <Button variant="ghost" onClick={() => navigate('/shop')} className="gap-2 text-ios-text dark:text-gray-300 hover:text-ios-blue">
                        Explorar Catálogo <ArrowRight size={16} />
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
                    {bestSellers.length > 0 ? (
                        bestSellers.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-400 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                            Cargando productos destacados...
                        </div>
                    )}
                </div>
            </section>

            {/* --- GIFT BANNER (NUEVO) --- */}
            {settings.giftBannerImage && (
                <section className="mb-24 px-2">
                    <div className="relative w-full rounded-[3rem] overflow-hidden shadow-2xl group cursor-pointer border border-white/40 dark:border-white/5" onClick={handleGiftClick}>
                        {/* Contenedor Flex para layout adaptable */}
                        <div className="flex flex-col md:flex-row min-h-[400px]">
                            {/* Imagen */}
                            <div className="w-full md:w-1/2 relative h-64 md:h-auto overflow-hidden">
                                <img
                                    src={settings.giftBannerImage}
                                    alt={settings.giftBannerTitle}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
                            </div>

                            {/* Contenido */}
                            <div className="w-full md:w-1/2 bg-white dark:bg-zinc-900 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Gift size={120} className="text-ios-blue dark:text-white rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <span className="inline-block px-3 py-1 bg-ios-blue/10 text-ios-blue rounded-lg text-xs font-black uppercase tracking-widest mb-4 border border-ios-blue/20">
                                        Promoción Especial
                                    </span>
                                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-ios-text dark:text-white mb-4 leading-tight">
                                        {settings.giftBannerTitle}
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 leading-relaxed font-light">
                                        {settings.giftBannerDescription}
                                    </p>
                                    <button
                                        className="inline-flex items-center gap-2 bg-ios-blue hover:brightness-110 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-ios-blue/30 transition-transform active:scale-95 text-sm md:text-base uppercase tracking-wide"
                                    >
                                        <MessageCircle size={20} />
                                        {settings.giftBannerButtonText || 'Lo quiero'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* --- OFERTAS ESPECIALES SECTION --- */}
            {saleProducts.length > 0 && (
                <section className="mb-24 px-4">
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-[3rem] p-8 md:p-12 border border-red-100 dark:border-red-900/20 relative overflow-hidden">
                        {/* Decoración de Fondo */}
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                            <Percent size={200} className="text-red-500" />
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={18} className="text-red-500 fill-red-500" />
                                    <span className="text-xs font-black text-red-500 uppercase tracking-widest">Tiempo Limitado</span>
                                </div>
                                <h2 className="text-4xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Ofertas Relámpago</h2>
                            </div>
                            <Button variant="ghost" onClick={() => navigate('/shop?filter=offers')} className="gap-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30">
                                Ver todas las ofertas <ArrowRight size={16} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                            {saleProducts.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* --- FEATURED CATEGORIES CAROUSEL --- */}
            {categories.length > 0 && (
                <section className="mb-24 relative">
                    <div className="flex justify-between items-end mb-6 px-2">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Layers size={16} className="text-ios-blue" />
                                <span className="text-[10px] font-black text-ios-blue uppercase tracking-widest">Colecciones</span>
                            </div>
                            <h2 className="text-2xl md:text-4xl font-serif font-bold text-ios-text dark:text-white">Categorías</h2>
                        </div>
                        <Button variant="ghost" onClick={() => navigate('/shop')} className="hidden md:flex text-sm font-bold tracking-widest uppercase">Ver Todo</Button>
                    </div>

                    {/* Carrusel Horizontal con Scroll Snap Optimizado */}
                    <div className="flex overflow-x-auto gap-3 md:gap-6 pb-4 no-scrollbar snap-x snap-mandatory px-2 -mx-2 md:mx-0">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => navigate(`/shop?category=${cat.name}`)}
                                className="w-36 sm:w-48 md:w-64 flex-shrink-0 snap-center"
                            >
                                <div className="group relative aspect-[3/4] rounded-2xl md:rounded-[2rem] overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-500 border border-white/40 dark:border-white/5">
                                    <img
                                        src={cat.image}
                                        alt={cat.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                    <div className="absolute bottom-0 left-0 w-full p-3 md:p-5 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                                        <h3 className="text-white text-sm md:text-xl font-bold text-center leading-tight drop-shadow-md line-clamp-2">
                                            {cat.name}
                                        </h3>
                                        <div className="h-0.5 w-0 group-hover:w-1/2 bg-white/70 mx-auto mt-2 transition-all duration-700 rounded-full opacity-0 group-hover:opacity-100"></div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Tarjeta "Ver Todas" al final del carrusel móvil (Compacta) */}
                        <div className="w-24 sm:w-32 md:hidden flex-shrink-0 snap-center flex items-center justify-center">
                            <button
                                onClick={() => navigate('/shop')}
                                className="w-14 h-14 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-ios-blue shadow-lg border border-gray-100 dark:border-white/5 active:scale-95 transition-transform"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* --- NEW ARRIVALS --- */}
            <section className="mb-24">
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 px-4 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={18} className="text-ios-blue" />
                            <span className="text-xs font-black text-ios-blue uppercase tracking-widest">Recién llegados</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-serif font-bold text-ios-text dark:text-white">Novedades</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
                    {newArrivals.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </section>

            {/* --- FEATURES GRID --- */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 px-2">

                {/* Feature 1 */}
                <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        {renderIcon(settings.homeFeature1Icon || 'leaf', 120)}
                    </div>
                    <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                        {renderIcon(settings.homeFeature1Icon || 'leaf', 32)}
                    </div>
                    <h3 className="font-serif font-bold text-2xl mb-3 dark:text-white relative z-10">{settings.homeFeature1Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-light relative z-10">{settings.homeFeature1Text}</p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        {renderIcon(settings.homeFeature2Icon || 'trending', 120)}
                    </div>
                    <div className="w-20 h-20 bg-pink-50 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-inner">
                        {renderIcon(settings.homeFeature2Icon || 'trending', 32)}
                    </div>
                    <h3 className="font-serif font-bold text-2xl mb-3 dark:text-white relative z-10">{settings.homeFeature2Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-light relative z-10">{settings.homeFeature2Text}</p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        {renderIcon(settings.homeFeature3Icon || 'sparkles', 120)}
                    </div>
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-inner">
                        {renderIcon(settings.homeFeature3Icon || 'sparkles', 32)}
                    </div>
                    <h3 className="font-serif font-bold text-2xl mb-3 dark:text-white relative z-10">{settings.homeFeature3Title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-light relative z-10">{settings.homeFeature3Text}</p>
                </div>

            </section>
        </ShopLayout>
    );
};
