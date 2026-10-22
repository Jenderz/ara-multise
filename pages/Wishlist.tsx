import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/UIComponents';
import { 
    Heart, ArrowLeft, ShoppingBag, Share2, Trash2, 
    Copy, Check, Gift, ArrowRight, Zap, X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { showWishlistToast } from '../components/WishlistToast';
import { isOutOfStock } from '../utils/stock';

export const Wishlist = () => {
    const { 
        products, 
        wishlist, 
        setWishlist, 
        clearWishlist, 
        addToCart, 
        setIsCartOpen, 
        settings, 
        activeExchangeRate, 
        activeCurrencySymbol 
    } = useStore();
    
    const navigate = useNavigate();
    const location = useLocation();

    const [copied, setCopied] = useState(false);
    const [isMovingAll, setIsMovingAll] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);

    // Detección Ultra-Robusta de Lista Compartida (soporta hash router, search params y window location)
    const sharedParam = useMemo(() => {
        const fromLocation = new URLSearchParams(location.search).get('shared');
        if (fromLocation) return fromLocation;
        if (typeof window !== 'undefined') {
            const fromWindowSearch = new URLSearchParams(window.location.search).get('shared');
            if (fromWindowSearch) return fromWindowSearch;
            const hashParts = window.location.hash.split('?');
            if (hashParts[1]) {
                const fromHash = new URLSearchParams(hashParts[1]).get('shared');
                if (fromHash) return fromHash;
            }
        }
        return null;
    }, [location.search]);

    const isSharedMode = Boolean(sharedParam);
    const sharedIds = useMemo(() => sharedParam ? sharedParam.split(',').filter(Boolean) : [], [sharedParam]);

    // Productos a mostrar: Los de la URL compartida O los favoritos guardados del usuario
    const activeIds = isSharedMode ? sharedIds : wishlist;
    const wishlistProducts = useMemo(() => {
        return products.filter(p => activeIds.includes(p.id) && p.isVisible);
    }, [products, activeIds]);

    // Cálculo del Valor Total Acumulado, Ahorro en Ofertas y Disponibilidad Real
    const { totalUsd, totalSavings, inStockCount } = useMemo(() => {
        let total = 0;
        let savings = 0;
        let inStock = 0;

        wishlistProducts.forEach(p => {
            const available = !isOutOfStock(p);
            if (available) inStock++;

            const regularPrice = p.price || 0;
            const salePrice = (p.salePrice && p.salePrice > 0 && p.salePrice < p.price) ? p.salePrice : regularPrice;

            total += salePrice;
            if (regularPrice > salePrice) {
                savings += (regularPrice - salePrice);
            }
        });

        return { totalUsd: total, totalSavings: savings, inStockCount: inStock };
    }, [wishlistProducts]);

    const rate = Number(activeExchangeRate) || 1;
    const formatVes = (usd: number) => `Bs ${(usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 1-Tap: Mover todos los productos con stock disponible al carrito
    const handleMoveAllToCart = () => {
        if (wishlistProducts.length === 0 || inStockCount === 0) return;

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([15, 60, 20]); } catch { }
        }

        setIsMovingAll(true);

        wishlistProducts.forEach(product => {
            if (!isOutOfStock(product)) {
                addToCart(product, {}, 1);
            }
        });

        setTimeout(() => {
            setIsMovingAll(false);
            setIsCartOpen(true);
        }, 400);
    };

    // Generar enlace compartible adaptado a HashRouter
    const getShareableUrl = () => {
        const idsToShare = isSharedMode ? sharedIds : wishlist;
        return `${window.location.origin}/#/wishlist?shared=${idsToShare.join(',')}`;
    };

    // Compartir por WhatsApp con texto elegante y conciso
    const handleShareWhatsApp = () => {
        const shareUrl = getShareableUrl();
        const storeTitle = settings.storeName || 'ARA';
        
        let message = `✨ *Mi lista de deseos en ${storeTitle}*\n\n`;
        wishlistProducts.slice(0, 5).forEach(p => {
            const price = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
            message += `• *${p.title}* (${activeCurrencySymbol}${price.toFixed(2)})\n`;
        });

        if (wishlistProducts.length > 5) {
            message += `... y ${wishlistProducts.length - 5} artículo(s) más.\n\n`;
        } else {
            message += `\n`;
        }

        message += `👉 *Mírala completa aquí:* ${shareUrl}`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    };

    // Copiar enlace al portapapeles con fallback seguro
    const fallbackCopy = (text: string) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    const handleCopyLink = () => {
        const shareUrl = getShareableUrl();
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                fallbackCopy(shareUrl);
            });
        } else {
            fallbackCopy(shareUrl);
        }
    };

    // Importar lista compartida a mis propios favoritos
    const handleImportShared = () => {
        const merged = Array.from(new Set([...wishlist, ...sharedIds]));
        if (setWishlist) {
            setWishlist(merged);
        }
        showWishlistToast({
            productTitle: `${sharedIds.length} artículos importados`,
            action: 'added',
            count: merged.length
        });
        navigate('/wishlist');
    };

    // Confirmación y vaciado seguro de la lista
    const handleConfirmClear = () => {
        if (clearWishlist) {
            clearWishlist();
        } else if (setWishlist) {
            setWishlist([]);
        }
        setShowClearModal(false);
        showWishlistToast({
            productTitle: 'Lista de deseos vaciada',
            action: 'removed',
            count: 0
        });
    };

    return (
        <ShopLayout>
            <SEO title="Lista de Deseos" description="Tus productos favoritos guardados para comprar después." noindex={true} />

            <div className="mb-16 max-w-7xl mx-auto px-2 sm:px-4">
                {/* Header Superior Ergonómico */}
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full border border-gray-200 dark:border-white/10 transition-colors shadow-sm"
                            title="Regresar"
                        >
                            <ArrowLeft size={18} className="text-ios-text dark:text-white" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-3xl font-serif font-bold text-ios-text dark:text-white flex items-center gap-2">
                                <Heart className="fill-rose-500 text-rose-500 animate-heart-burst" size={24} />
                                {isSharedMode ? 'Lista Compartida' : 'Lista de Deseos'}
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-ios-subtext dark:text-gray-400 mt-0.5">
                                <span>{wishlistProducts.length} {wishlistProducts.length === 1 ? 'producto' : 'productos'}</span>
                                {wishlistProducts.length > 0 && inStockCount > 0 && (
                                    <>
                                        <span>•</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                            {inStockCount} con stock
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Botón Vaciar Lista Visible y Accesible */}
                    {!isSharedMode && wishlistProducts.length > 0 && (
                        <button
                            onClick={() => setShowClearModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200/60 dark:border-rose-500/20 rounded-xl transition-all active:scale-95 shadow-sm"
                            title="Vaciar toda la lista de deseos"
                        >
                            <Trash2 size={14} />
                            <span>Vaciar</span>
                        </button>
                    )}
                </div>

                {/* BANNER ESPECIAL: MODO LISTA COMPARTIDA */}
                {isSharedMode && (
                    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-ios-blue/20 rounded-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-center sm:text-left">
                            <div className="w-10 h-10 rounded-xl bg-ios-blue text-white flex items-center justify-center shrink-0 shadow-md shadow-ios-blue/30">
                                <Gift size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-ios-text dark:text-white">¡Alguien compartió sus deseos contigo!</h3>
                                <p className="text-xs text-ios-subtext dark:text-gray-400">Puedes agregarlos al carrito para regalarlos o guardarlos en tus propios favoritos.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button onClick={handleImportShared} className="!py-2 !px-4 text-xs font-bold rounded-xl shadow-sm">
                                Guardar en mis favoritos
                            </Button>
                        </div>
                    </div>
                )}

                {wishlistProducts.length > 0 ? (
                    <>
                        {/* PANEL DE CONTROL REDISEÑADO: Ergonomía, Tipografía Equilibrada y Acciones Directas */}
                        <div className="mb-8 p-4 sm:p-5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-gray-200/70 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                            {/* Resumen de Valor Económico */}
                            <div className="w-full lg:w-auto">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ios-subtext dark:text-gray-400 block mb-0.5">
                                    Valor estimado de tu lista
                                </span>
                                <div className="flex items-baseline gap-2.5 flex-wrap">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-ios-text dark:text-white tracking-tight">
                                        {activeCurrencySymbol}{totalUsd.toFixed(2)}
                                    </span>
                                    <span className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-400">
                                        {formatVes(totalUsd)}
                                    </span>
                                </div>
                                {totalSavings > 0 && (
                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-500/20">
                                        <Zap size={12} className="fill-rose-500" /> Ahorras {activeCurrencySymbol}{totalSavings.toFixed(2)} en ofertas
                                    </div>
                                )}
                            </div>

                            {/* Barra de Acciones con Botones Armoniosos */}
                            <div className="w-full lg:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
                                {/* Botón Primario: Añadir al Carrito */}
                                <button
                                    onClick={handleMoveAllToCart}
                                    disabled={isMovingAll || inStockCount === 0}
                                    className={`flex-1 sm:flex-none h-11 px-4 sm:px-5 inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95
                                        ${inStockCount === 0 
                                            ? 'bg-gray-400 dark:bg-zinc-700 cursor-not-allowed opacity-60'
                                            : 'bg-ios-blue hover:brightness-105 shadow-ios-blue/25'
                                        }
                                    `}
                                    title="Añadir los productos disponibles al carrito"
                                >
                                    <ShoppingBag size={16} />
                                    <span>{isMovingAll ? 'Añadiendo...' : 'Añadir al carrito'}</span>
                                    {inStockCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold">
                                            {inStockCount}
                                        </span>
                                    )}
                                </button>

                                {/* Botón Secundario: WhatsApp */}
                                <button
                                    onClick={handleShareWhatsApp}
                                    className="h-11 px-3.5 sm:px-4 inline-flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-[#25D366]/20 transition-all active:scale-95"
                                    title="Compartir lista por WhatsApp"
                                >
                                    <Share2 size={15} />
                                    <span>Compartir</span>
                                </button>

                                {/* Botón Terciario: Copiar Enlace */}
                                <button
                                    onClick={handleCopyLink}
                                    className="h-11 px-3.5 sm:px-4 inline-flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-ios-text dark:text-white rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm transition-all active:scale-95 border border-black/5 dark:border-white/10"
                                    title="Copiar enlace para compartir"
                                >
                                    {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                                    <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Grid de Productos */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                            {wishlistProducts.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                ) : (
                    /* Estado Vacío de Alta Estética */
                    <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 text-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-5 shadow-inner animate-pulse-slow">
                            <Heart size={38} className="fill-rose-500/20" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-serif font-bold text-ios-text dark:text-white mb-2">
                            Tu lista de deseos está vacía
                        </h2>
                        <p className="text-ios-subtext dark:text-gray-400 text-xs sm:text-sm max-w-sm mb-6 leading-relaxed">
                            Guarda los artículos que más te gusten tocando el corazón ❤️ en las tarjetas para no perderlos de vista o compartirlos con amigos.
                        </p>
                        <Button 
                            onClick={() => navigate('/shop')}
                            className="!px-6 !py-3 rounded-xl font-bold shadow-lg shadow-ios-blue/20 gap-2 flex items-center text-xs sm:text-sm"
                        >
                            Explorar catálogo <ArrowRight size={15} />
                        </Button>
                    </div>
                )}
            </div>

            {/* MODAL DE CONFIRMACIÓN ULTRA-ELEGANTE PARA VACIAR */}
            {showClearModal && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowClearModal(false)}
                >
                    <div 
                        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-scale-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Ícono de Alerta */}
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-500/20">
                            <Trash2 size={22} />
                        </div>

                        <h3 className="text-lg font-bold text-ios-text dark:text-white mb-1.5">
                            ¿Vaciar lista de deseos?
                        </h3>
                        <p className="text-xs text-ios-subtext dark:text-gray-400 mb-6 leading-relaxed">
                            Se quitarán todos los artículos guardados ({wishlistProducts.length}). Podrás volver a agregarlos cuando quieras desde el catálogo.
                        </p>

                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-ios-text dark:text-gray-300 font-semibold text-xs hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmClear}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition-all active:scale-95"
                            >
                                Sí, vaciar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ShopLayout>
    );
};
