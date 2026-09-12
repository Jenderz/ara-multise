
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
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
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

            <button onClick={handleBack} className="mb-6 flex items-center text-ios-subtext dark:text-gray-400 hover:text-ios-text dark:hover:text-white transition gap-1 font-medium">
                <ChevronLeft size={18} /> Volver al catálogo
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-10">
                {/* Galería de Imágenes */}
                <div className="space-y-6">
                    <div
                        className="aspect-square rounded-[3rem] overflow-hidden bg-white dark:bg-zinc-900 shadow-2xl border border-white/50 dark:border-white/5 relative group cursor-zoom-in"
                        onClick={() => setIsLightboxOpen(true)}
                    >
                        <img key={currentImage} src={currentImage} alt={product.title} className="w-full h-full object-cover animate-fade-in transition-all duration-500" />
                        {displaySalePrice && <div className="absolute top-6 left-6 bg-red-500 text-white font-black text-[10px] uppercase tracking-tighter px-4 py-1.5 rounded-full shadow-lg z-10">Especial</div>}
                        {/* Botones flotantes: Favorito + Compartir por WhatsApp */}
                        <div className="absolute top-6 right-6 flex flex-col gap-3 z-10">
                            <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }} className="p-4 bg-white/90 dark:bg-black/60 backdrop-blur-xl rounded-full shadow-xl hover:scale-110 transition border border-white/20 dark:border-white/10">
                                <Heart size={24} className={isInWishlist ? "fill-red-500 text-red-500" : "text-gray-400"} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleShare(); }} title="Compartir por WhatsApp" className="p-4 bg-white/90 dark:bg-black/60 backdrop-blur-xl rounded-full shadow-xl hover:scale-110 transition border border-white/20 dark:border-white/10 text-[#25D366]">
                                <Share2 size={24} />
                            </button>
                        </div>
                    </div>
                    {/* Miniaturas */}
                    {product.images.length > 1 && (
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-2">
                            {product.images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setSelectedImageIdx(idx); setCurrentImage(img); }}
                                    className={`w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 transition-all shrink-0 shadow-sm ${currentImage === img ? 'border-ios-blue scale-95 ring-4 ring-ios-blue/10' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detalles del Producto */}
                <div className="flex flex-col pt-4">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <span className="text-ios-blue font-black uppercase tracking-[0.2em] text-[10px] bg-ios-blue/10 px-3 py-1 rounded-full">{product.category}</span>
                        {isJewelryPluginEnabled(settings) && (product.pricingType === 'by_weight' || (product as any).pricing_type === 'by_weight') && (product.weightGram ?? (product as any).weight_gram ?? 0) > 0 && (
                            <span className="text-amber-700 dark:text-amber-300 font-extrabold uppercase tracking-[0.1em] text-[10px] bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                                <Scale size={12} className="text-amber-600 dark:text-amber-400" />
                                {product.weightGram || (product as any).weight_gram}g {product.metalType || (product as any).metal_type ? `(${String(product.metalType || (product as any).metal_type).replace('gold_', 'Oro ').replace('silver_', 'Plata ')})` : ''}
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-serif font-bold text-ios-text dark:text-white mb-4 leading-tight">{product.title}</h1>

                    <div className="mb-8">
                        {displaySalePrice ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-baseline gap-3">{showUsd && <p className="text-4xl font-black text-ios-blue">{activeCurrencySymbol}{(displaySalePrice || 0).toFixed(2)}</p>}{showVes && <p className="text-2xl font-bold text-ios-blue/80">{formatVes(displaySalePrice)}</p>}</div>
                                <div className="flex items-center gap-3 text-xl text-gray-400 line-through font-light">{showUsd && <span>{activeCurrencySymbol}{(displayPrice || 0).toFixed(2)}</span>}{showVes && <span>{formatVes(displayPrice)}</span>}</div>
                            </div>
                        ) : (
                            <div className="flex items-baseline gap-3 flex-wrap">{showUsd && <p className="text-4xl font-black text-ios-text dark:text-white">{activeCurrencySymbol}{(displayPrice || 0).toFixed(2)}</p>}{showVes && <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{formatVes(displayPrice)}</p>}</div>
                        )}
                    </div>

                    {product.description && (
                        <div className="mb-8">
                            <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed font-normal whitespace-pre-line border-l-2 border-ios-blue/40 pl-5 tracking-normal">
                                {product.description}
                            </p>
                        </div>
                    )}

                    {/* --- DISPONIBILIDAD EN SEDES (MODIFICADO: SOLO AL COMPLETAR SELECCIÓN) --- */}
                    {!loadingAvailability && branchAvailability.length > 0 && (!hasVariants || isSelectionComplete) && (
                        <div className="mb-10 animate-fade-in">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Store size={14} /> Disponibilidad en Tiendas
                            </h4>
                            <div className="space-y-2">
                                {branchAvailability.map(b => (
                                    <div key={b.branchId} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className={b.stock > 0 ? "text-ios-blue" : "text-gray-400"} />
                                            <span className="text-sm font-medium dark:text-gray-200">{b.branchName}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${b.stock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                                            {b.stock > 0 ? 'Disponible' : 'Agotado'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selector de Variantes (Tonos y Tallas) */}
                    {hasVariants && (
                        <div className="space-y-8 mb-12">
                            {(product.variantOptions || []).map(option => {
                                const activeValues = option.values.filter(val =>
                                    product.variants?.some(v => v.selections && v.selections[option.name] === val)
                                );
                                if (activeValues.length === 0) return null;

                                return (
                                <div key={option.name} className="animate-fade-in">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-[10px] font-black text-ios-text dark:text-white uppercase tracking-[0.15em] opacity-40">{option.name}</label>
                                        <span className="text-xs font-bold text-ios-blue">{selections[option.name]}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
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
                                    relative transition-all flex items-center justify-center group overflow-hidden
                                    ${isColor
                                                            ? 'w-12 h-12 rounded-full border shadow-sm'
                                                            : 'min-w-[48px] h-12 rounded-2xl border-2 px-4'
                                                        }
                                    ${isSelected
                                                            ? 'border-ios-blue ring-4 ring-ios-blue/10 scale-110 z-10'
                                                            : 'border-gray-200 dark:border-white/10 hover:scale-105'
                                                        }
                                    ${!isColor && !isSelected ? 'bg-gray-50 dark:bg-white/5' : ''}
                                `}
                                                    style={isColor && !showImage ? { backgroundColor: colorHex } : {}}
                                                >
                                                    {showImage ? (
                                                        <img src={variantImage} alt={val} className="w-full h-full object-cover" />
                                                    ) : !isColor ? (
                                                        <span className={`text-xs font-bold ${isSelected ? 'text-ios-blue' : 'text-gray-600 dark:text-gray-300'}`}>{val}</span>
                                                    ) : null}

                                                    {/* Indicador de Selección */}
                                                    {isSelected && isColor && (
                                                        <div className={`absolute inset-0 flex items-center justify-center ${showImage ? 'bg-black/20 backdrop-blur-[1px]' : ''}`}>
                                                            <Check size={18} strokeWidth={3} className={!showImage && parseInt(colorHex.replace('#', ''), 16) > 0xffffff / 1.5 ? 'text-black' : 'text-white drop-shadow-md'} />
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

                    <div className="pb-16 lg:pb-0">
                        <Button
                            onClick={() => isSelectionComplete && addToCart(product, selections, 1)}
                            disabled={!isSelectionComplete || !canBuy}
                            className={`w-full py-5 text-lg font-black tracking-[0.2em] uppercase shadow-2xl rounded-[2rem] transition-all
                    ${!isSelectionComplete || !canBuy
                                    ? 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-gray-600 shadow-none cursor-not-allowed'
                                    : 'bg-ios-blue text-white shadow-ios-blue/30 hover:scale-[1.02]'
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
