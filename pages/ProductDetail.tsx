
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { extractProductIdFromSlug } from '../utils/slugify';
import { ShopLayout } from '../components/Layout';
import { Button } from '../components/UIComponents';
import { ChevronLeft, Heart, Check, X, AlertCircle, Store, MapPin, Globe, Share2, Scale } from 'lucide-react';
import { SEO } from '../components/SEO';
import { DEFAULT_IMAGE } from '../config';
import { trackProductView } from './Home';
import { generateProductSlug } from '../utils/slugify';
import { isJewelryPluginEnabled } from '../plugins/jewelry';

export const ProductDetail = () => {
    const { id: slugParam } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, wishlist, toggleWishlist, settings, activeExchangeRate, activeCurrencySymbol, getStockBreakdown } = useStore();
    
    // Soporta tanto el formato nuevo "titulo-del-producto--ID" como el formato legacy "ID"
    const id = extractProductIdFromSlug(slugParam || '');
    const product = products.find(p => p.id === id);

    const [selections, setSelections] = useState<Record<string, string>>({});
    const [currentImage, setCurrentImage] = useState<string>('');
    const [selectedImageIdx, setSelectedImageIdx] = useState(0);

    // Estado para la disponibilidad en otras sedes
    const [branchAvailability, setBranchAvailability] = useState<{ branchId: number, branchName: string, stock: number }[]>([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Lightbox
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    // Referencia para controlar el cambio de imagen automático al cargar
    const isFirstRun = useRef(true);

    // Inicialización: Solo Foto de Portada, SIN pre-seleccionar variante y Scroll Arriba
    useEffect(() => {
        if (product) {
            // SIEMPRE mostrar la foto de portada (index 0) al entrar
            setCurrentImage(product.images[0] || DEFAULT_IMAGE);
            setSelectedImageIdx(0);

            // Limpiamos selecciones al cambiar de producto
            setSelections({});

            // Registrar visita para "Visto Recientemente"
            trackProductView(product.id);

            // Forzar vista al principio de la página al cargar el producto
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [product, id]);

    // Derivar la variante seleccionada actualmente
    const selectedVariant = useMemo(() => {
        if (!product || !product.variants || product.variants.length === 0) return null;
        return product.variants.find(v => Object.entries(selections).every(([k, val]) => v.selections[k] === val));
    }, [product, selections]);

    // Consulta de Disponibilidad (Dinámica: Producto Padre o Variante)
    // FIX SEGURIDAD: Debounce de 400ms para evitar GETs por cada click en variante.
    // Se usan IDs primitivos como dependencias (no objetos completos) para evitar
    // re-renders espurios cuando el objeto cambia por referencia sin cambiar su valor.
    useEffect(() => {
        if (!product) return;
        const targetId = selectedVariant ? selectedVariant.id : product.id;
        const timer = setTimeout(() => {
            setLoadingAvailability(true);
            getStockBreakdown(targetId)
                .then(data => setBranchAvailability(data || []))
                .catch(console.error)
                .finally(() => setLoadingAvailability(false));
        }, 400); // Esperar 400ms — el usuario puede estar navegando entre variantes
        return () => clearTimeout(timer);
    }, [product?.id, selectedVariant?.id]); // Solo IDs, no objetos completos


    // Actualizar imagen SOLO si el usuario interactúa (no en la primera carga)
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        if (selectedVariant && selectedVariant.image) {
            setCurrentImage(selectedVariant.image);
        }
    }, [selectedVariant]);

    // Lógica de disponibilidad visual (Opcional, no usado para ocultar temporalmente debido a sincronización multi-sede)
    const isOptionInStock = (optionName: string, value: string) => {
        if (!product || !product.variants) return true;
        
        const matchingVariants = product.variants.filter(v => v.selections[optionName] === value);
        if (matchingVariants.length === 0) return false;
        
        let totalValStock = 0;
        matchingVariants.forEach(v => {
            const vStock = v.branchStock && Object.keys(v.branchStock).length > 0
                ? Object.values(v.branchStock).reduce((acc: number, qty: any) => acc + Number(qty), 0)
                : (v.stock || 0);
            totalValStock += vStock;
        });
        
        return totalValStock > 0;
    };

    // Obtener imagen específica para una opción
    const getOptionImage = (optionName: string, value: string) => {
        if (!product || !product.variants) return null;
        const variant = product.variants.find(v => v.selections[optionName] === value && v.image);
        return variant ? variant.image : null;
    };

    const handleSelection = (optionName: string, value: string) => {
        setSelections(prev => ({ ...prev, [optionName]: value }));
    };

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            const category = product?.category || 'Todos';
            navigate(`/shop?category=${encodeURIComponent(category)}`);
        }
    };

    if (!product) return <div className="p-10 text-center dark:text-white font-serif">Producto no encontrado</div>;

    const hasVariants = Boolean(
        product.variantOptions &&
        product.variantOptions.length > 0 &&
        product.variants &&
        product.variants.length > 0
    );

    // Función para compartir el producto por WhatsApp
    const handleShare = () => {
        const slug = generateProductSlug(product.title, product.id);
        const productUrl = `${window.location.origin}/product/${slug}`;
        const message = `\uD83D\uDED2 *${product.title}*\n${productUrl}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    };

    // Validar si el usuario ya completó todas las selecciones requeridas
    const isSelectionComplete = hasVariants
        ? product.variantOptions.every(opt => selections[opt.name])
        : true;

    // --- LOGICA DE COMPRA (Multi-Sede) ---
    const effectiveTotalStock = useMemo(() => {
        if (branchAvailability.length === 0) {
            // Fallback mejorado: Usar branchStock estático del producto o variante si existe
            const source = selectedVariant || product;
            if (source.branchStock && Object.keys(source.branchStock).length > 0) {
                return Object.values(source.branchStock).reduce((acc: number, val: number) => acc + val, 0);
            }

            if (selectedVariant) return selectedVariant.stock;
            return product.globalStock !== undefined ? product.globalStock : product.stock;
        }
        return branchAvailability.reduce((acc, curr) => acc + curr.stock, 0);
    }, [branchAvailability, selectedVariant, product]);

    const canBuy = isSelectionComplete && effectiveTotalStock > 0;

    const displayPrice = selectedVariant && selectedVariant.price > 0 ? selectedVariant.price : product.price;
    const displaySalePrice = product.salePrice && product.salePrice > 0 ? product.salePrice : null;
    const isInWishlist = wishlist.includes(product.id);

    const showUsd = settings.priceDisplayMode === 'usd' || settings.priceDisplayMode === 'both';
    const showVes = settings.priceDisplayMode === 'ves' || settings.priceDisplayMode === 'both';

    const formatVes = (usd: number) => `Bs ${(usd * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    return (
        <ShopLayout>
            <SEO title={product.title} description={product.description.substring(0, 160)} image={product.images[0] || DEFAULT_IMAGE} type="product" price={displaySalePrice || displayPrice} availability={canBuy} />

            <button onClick={handleBack} className="mb-3 sm:mb-5 inline-flex items-center text-xs sm:text-sm font-semibold text-ios-subtext dark:text-gray-400 hover:text-ios-text dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2.5 -ml-1 rounded-full transition-all active:scale-95 gap-1">
                <ChevronLeft size={16} /> Volver al catálogo
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 lg:gap-12 mb-8 sm:mb-12">
                {/* Galería de Imágenes */}
                <div className="space-y-3 sm:space-y-5">
                    <div
                        className="aspect-square rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] overflow-hidden bg-white dark:bg-zinc-900 shadow-lg sm:shadow-2xl border border-white/50 dark:border-white/5 relative group cursor-zoom-in"
                        onClick={() => setIsLightboxOpen(true)}
                    >
                        <img key={currentImage} src={currentImage} alt={product.title} className="w-full h-full object-cover animate-fade-in transition-all duration-500" />
                        {displaySalePrice && (
                            <div className="absolute top-3 left-3 sm:top-5 sm:left-5 bg-red-500 text-white font-black text-[9px] sm:text-[10px] uppercase tracking-wider px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-md z-10">
                                Especial
                            </div>
                        )}
                        {/* Botones flotantes: Favorito + Compartir por WhatsApp */}
                        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex flex-col gap-2 sm:gap-2.5 z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                                className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center bg-white/90 dark:bg-black/60 backdrop-blur-xl rounded-full shadow-md sm:shadow-xl hover:scale-105 active:scale-90 transition border border-white/30 dark:border-white/10"
                                title={isInWishlist ? "Eliminar de favoritos" : "Guardar en favoritos"}
                            >
                                <Heart size={18} className={`sm:w-5 sm:h-5 transition-colors ${isInWishlist ? "fill-red-500 text-red-500" : "text-gray-500 dark:text-gray-300"}`} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                                title="Compartir por WhatsApp"
                                className="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center bg-white/90 dark:bg-black/60 backdrop-blur-xl rounded-full shadow-md sm:shadow-xl hover:scale-105 active:scale-90 transition border border-white/30 dark:border-white/10 text-[#25D366]"
                            >
                                <Share2 size={18} className="sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Miniaturas */}
                    {product.images.length > 1 && (
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 no-scrollbar px-1">
                            {product.images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setSelectedImageIdx(idx); setCurrentImage(img); }}
                                    className={`w-14 h-14 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl overflow-hidden border-2 transition-all shrink-0 shadow-xs ${currentImage === img ? 'border-ios-blue scale-95 ring-2 sm:ring-4 ring-ios-blue/15' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detalles del Producto */}
                <div className="flex flex-col pt-1 sm:pt-4">
                    <div className="flex justify-between items-center mb-2.5 sm:mb-3.5 flex-wrap gap-2">
                        <span className="text-ios-blue font-extrabold uppercase tracking-widest text-[10px] sm:text-xs bg-ios-blue/10 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">{product.category}</span>
                        {isJewelryPluginEnabled(settings) && (product.pricingType === 'by_weight' || (product as any).pricing_type === 'by_weight') && (product.weightGram ?? (product as any).weight_gram ?? 0) > 0 && (
                            <span className="text-amber-700 dark:text-amber-300 font-extrabold uppercase tracking-[0.1em] text-[10px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                                <Scale size={12} className="text-amber-600 dark:text-amber-400" />
                                {product.weightGram || (product as any).weight_gram}g {product.metalType || (product as any).metal_type ? `(${String(product.metalType || (product as any).metal_type).replace('gold_', 'Oro ').replace('silver_', 'Plata ')})` : ''}
                            </span>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-ios-text dark:text-white mb-2 sm:mb-3.5 leading-snug tracking-tight text-balance">{product.title}</h1>

                    <div className="mb-4 sm:mb-6">
                        {displaySalePrice ? (
                            <div className="flex flex-col gap-0.5 sm:gap-1">
                                <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                                    {showUsd && <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-ios-blue">{activeCurrencySymbol}{(displaySalePrice || 0).toFixed(2)}</p>}
                                    {showVes && <p className="text-base sm:text-xl lg:text-2xl font-bold text-ios-blue/80">{formatVes(displaySalePrice)}</p>}
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base lg:text-lg text-gray-400 line-through font-light">
                                    {showUsd && <span>{activeCurrencySymbol}{(displayPrice || 0).toFixed(2)}</span>}
                                    {showVes && <span>{formatVes(displayPrice)}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                                {showUsd && <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-ios-text dark:text-white">{activeCurrencySymbol}{(displayPrice || 0).toFixed(2)}</p>}
                                {showVes && <p className="text-base sm:text-xl lg:text-2xl font-bold text-gray-500 dark:text-gray-400">{formatVes(displayPrice)}</p>}
                            </div>
                        )}
                    </div>

                    {product.description && (
                        <div className="mb-5 sm:mb-7">
                            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed font-normal whitespace-pre-line border-l-2 border-ios-blue/40 pl-3.5 sm:pl-4 tracking-normal">
                                {product.description}
                            </p>
                        </div>
                    )}

                    {/* --- DISPONIBILIDAD EN SEDES (MODIFICADO: SOLO AL COMPLETAR SELECCIÓN) --- */}
                    {!loadingAvailability && branchAvailability.length > 0 && (!hasVariants || isSelectionComplete) && (
                        <div className="mb-5 sm:mb-8 animate-fade-in">
                            <h4 className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 sm:mb-3 flex items-center gap-1.5">
                                <Store size={14} /> Disponibilidad en Tiendas
                            </h4>
                            <div className="space-y-1.5 sm:space-y-2">
                                {branchAvailability.map(b => (
                                    <div key={b.branchId} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={15} className={b.stock > 0 ? "text-ios-blue" : "text-gray-400"} />
                                            <span className="text-xs sm:text-sm font-medium dark:text-gray-200">{b.branchName}</span>
                                        </div>
                                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded-lg ${b.stock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                                            {b.stock > 0 ? 'Disponible' : 'Agotado'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selector de Variantes (Tonos y Tallas) */}
                    {hasVariants && (
                        <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
                            {(product.variantOptions || []).map(option => {
                                const activeValues = option.values.filter(val =>
                                    product.variants?.some(v => v.selections && v.selections[option.name] === val)
                                );
                                if (activeValues.length === 0) return null;

                                return (
                                <div key={option.name} className="animate-fade-in">
                                    <div className="flex justify-between items-center mb-2.5 sm:mb-3">
                                        <label className="text-[10px] font-black text-ios-text dark:text-white uppercase tracking-wider opacity-50">{option.name}</label>
                                        <span className="text-xs font-bold text-ios-blue">{selections[option.name]}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 sm:gap-3">
                                        {activeValues.map(val => {
                                            const isColor = option.type === 'color';
                                            const colorHex = option.colorValues?.[val] || '#ccc';
                                            const isSelected = selections[option.name] === val;
                                            // Siempre disponible visualmente si hay stock global
                                            const variantImage = getOptionImage(option.name, val);
                                            const showImage = !!variantImage;

                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => handleSelection(option.name, val)}
                                                    className={`
                                    relative transition-all flex items-center justify-center group overflow-hidden active:scale-95
                                    ${isColor
                                                            ? 'w-10 h-10 sm:w-12 sm:h-12 rounded-full border shadow-2xs'
                                                            : 'min-w-[42px] h-10 sm:min-w-[48px] sm:h-12 rounded-xl sm:rounded-2xl border-2 px-3 sm:px-4'
                                                        }
                                    ${isSelected
                                                            ? 'border-ios-blue ring-3 sm:ring-4 ring-ios-blue/15 scale-105 z-10'
                                                            : 'border-gray-200 dark:border-white/10 hover:scale-105'
                                                        }
                                    ${!isColor && !isSelected ? 'bg-gray-50 dark:bg-white/5' : ''}
                                `}
                                                    style={isColor && !showImage ? { backgroundColor: colorHex } : {}}
                                                >
                                                    {showImage ? (
                                                        <img src={variantImage} alt={val} className="w-full h-full object-cover" />
                                                    ) : !isColor ? (
                                                        <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-ios-blue' : 'text-gray-600 dark:text-gray-300'}`}>{val}</span>
                                                    ) : null}

                                                    {/* Indicador de Selección */}
                                                    {isSelected && isColor && (
                                                        <div className={`absolute inset-0 flex items-center justify-center ${showImage ? 'bg-black/20 backdrop-blur-[1px]' : ''}`}>
                                                            <Check size={16} strokeWidth={3} className={!showImage && parseInt(colorHex.replace('#', ''), 16) > 0xffffff / 1.5 ? 'text-black' : 'text-white drop-shadow-md'} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="pb-28 lg:pb-0">
                        <Button
                            onClick={() => isSelectionComplete && addToCart(product, selections, 1)}
                            disabled={!isSelectionComplete || !canBuy}
                            className={`w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold sm:font-black tracking-wider sm:tracking-[0.15em] uppercase shadow-lg sm:shadow-2xl rounded-xl sm:rounded-2xl transition-all active:scale-[0.98]
                    ${!isSelectionComplete || !canBuy
                                    ? 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 shadow-none cursor-not-allowed'
                                    : 'bg-ios-blue text-white shadow-ios-blue/30 hover:brightness-105'
                                }`}
                        >
                            {!isSelectionComplete
                                ? 'Selecciona Opciones'
                                : (!canBuy
                                    ? 'Agotado Totalmente'
                                    : 'Añadir a la Bolsa' // Texto Unificado
                                )
                            }
                        </Button>
                        {/* {isSelectionComplete && isRemoteStock && (
                            <p className="text-center text-xs text-gray-500 font-medium mt-3 flex items-center justify-center gap-1">
                                <Globe size={12} /> Este producto se enviará desde nuestra sede principal.
                            </p>
                        )} ELIMINADO POR SOLICITUD */}
                        {isSelectionComplete && !canBuy && (
                            <p className="text-center text-xs text-red-500 font-bold mt-3 flex items-center justify-center gap-1">
                                <AlertCircle size={12} /> Producto agotado en todas las sucursales.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* LIGHTBOX OVERLAY */}
            {
                isLightboxOpen && (
                    <div
                        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in"
                        onClick={() => setIsLightboxOpen(false)}
                    >
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="absolute top-6 right-6 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition z-50"
                        >
                            <X size={24} />
                        </button>

                        <img
                            src={currentImage}
                            alt={product.title}
                            className="max-h-[90vh] max-w-full object-contain rounded-2xl shadow-2xl animate-scale-up"
                            onClick={(e) => e.stopPropagation()} // Evitar cerrar al hacer clic en la imagen
                        />
                    </div>
                )
            }
        </ShopLayout >
    );
};
