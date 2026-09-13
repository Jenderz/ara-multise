import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/UIComponents';
import { 
    Heart, ArrowLeft, ShoppingBag, Share2, Trash2, 
    Copy, Check, Sparkles, Gift, ArrowRight, Zap 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { showWishlistToast } from '../components/WishlistToast';

export const Wishlist = () => {
    const { products, wishlist, setWishlist, addToCart, setIsCartOpen, settings, activeExchangeRate, activeCurrencySymbol } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [copied, setCopied] = useState(false);
    const [isMovingAll, setIsMovingAll] = useState(false);

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

    // Cálculo del Valor Total Acumulado y Ahorro en Ofertas
    const { totalUsd, totalSavings, inStockCount } = useMemo(() => {
        let total = 0;
        let savings = 0;
        let inStock = 0;

        wishlistProducts.forEach(p => {
            const hasStock = p.globalStock !== undefined ? p.globalStock > 0 :
                (p.branchStock && Object.keys(p.branchStock).length > 0)
                    ? Number(Object.values(p.branchStock).reduce((acc: number, qty: any) => acc + (Number(qty) || 0), 0)) > 0
                    : (p.stock || 0) > 0;

            if (hasStock) inStock++;

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
    const totalVes = totalUsd * rate;
    const formatVes = (usd: number) => `Bs ${(usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    // 1-Tap: Mover todos los productos en stock al carrito
    const handleMoveAllToCart = () => {
        if (wishlistProducts.length === 0 || inStockCount === 0) return;

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([15, 60, 20]); } catch { }
        }

        setIsMovingAll(true);

        wishlistProducts.forEach(product => {
            const hasStock = product.globalStock !== undefined ? product.globalStock > 0 :
                (product.branchStock && Object.keys(product.branchStock).length > 0)
                    ? Number(Object.values(product.branchStock).reduce((acc: number, qty: any) => acc + (Number(qty) || 0), 0)) > 0
                    : (product.stock || 0) > 0;

            if (hasStock) {
                addToCart(product, {}, 1);
            }
        });

        setTimeout(() => {
            setIsMovingAll(false);
            setIsCartOpen(true);
        }, 500);
    };

    // Generar enlace compartible adaptado a HashRouter
    const getShareableUrl = () => {
        const idsToShare = isSharedMode ? sharedIds : wishlist;
        return `${window.location.origin}/#/wishlist?shared=${idsToShare.join(',')}`;
    };

    // Compartir por WhatsApp
    const handleShareWhatsApp = () => {
        const shareUrl = getShareableUrl();
        const storeTitle = settings.storeName || 'ARA';
        
        let message = `🎁 *¡Hola! Te comparto mi lista de deseos en ${storeTitle}*\n\n`;
        wishlistProducts.slice(0, 5).forEach(p => {
            const price = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
            message += `• *${p.title}* (${activeCurrencySymbol}${price.toFixed(2)})\n`;
        });

        if (wishlistProducts.length > 5) {
            message += `... y ${wishlistProducts.length - 5} artículos más.\n\n`;
        } else {
            message += `\n`;
        }

        message += `👉 *Mírala completa aquí:* ${shareUrl}`;

        // Usar api.whatsapp.com en lugar de wa.me para preservar codificación UTF-8 sin fallos de redirección 302
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
        setWishlist(merged);
        showWishlistToast({
            productTitle: `${sharedIds.length} artículos importados`,
            action: 'added',
            count: merged.length
        });
        navigate('/wishlist');
    };

    // Vaciar lista
    const handleClearWishlist = () => {
        if (window.confirm('¿Deseas vaciar tu lista de deseos?')) {
            setWishlist([]);
        }
    };

    return (
        <ShopLayout>
            <SEO title="Lista de Deseos" description="Tus productos favoritos guardados para comprar después." />

            <div className="mb-16 max-w-7xl mx-auto px-2">
                {/* Header con botón de retorno y título */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full border border-gray-200 dark:border-white/10 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-ios-text dark:text-white" />
                        </button>
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-ios-text dark:text-white flex items-center gap-2.5">
                                <Heart className="fill-red-500 text-red-500 animate-heart-burst" size={28} />
                                {isSharedMode ? 'Lista Compartida' : 'Lista de Deseos'}
                            </h1>
                            <p className="text-xs text-ios-subtext dark:text-gray-400 mt-0.5">
                                {wishlistProducts.length} {wishlistProducts.length === 1 ? 'artículo guardado' : 'artículos guardados'}
                            </p>
                        </div>
                    </div>

                    {!isSharedMode && wishlistProducts.length > 0 && (
                        <button
                            onClick={handleClearWishlist}
                            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                            <Trash2 size={14} /> <span className="hidden sm:inline">Vaciar</span>
                        </button>
                    )}
                </div>

                {/* BANNER ESPECIAL: MODO LISTA COMPARTIDA */}
                {isSharedMode && (
                    <div className="mb-8 p-5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-ios-blue/20 rounded-3xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-center sm:text-left">
                            <div className="w-12 h-12 rounded-2xl bg-ios-blue text-white flex items-center justify-center shrink-0 shadow-lg shadow-ios-blue/30">
                                <Gift size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-ios-text dark:text-white">¡Alguien compartió sus deseos contigo!</h3>
                                <p className="text-xs text-ios-subtext dark:text-gray-400">Puedes comprar estos artículos para un regalo o guardarlos en tus propios favoritos.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button onClick={handleImportShared} className="!py-2.5 !px-4 text-xs font-bold rounded-2xl">
                                Guardar en mis Favoritos
                            </Button>
                        </div>
                    </div>
                )}

                {wishlistProducts.length > 0 ? (
                    <>
                        {/* PANEL DE CONTROL DE ALTA TECNOLOGÍA (Resumen de Valor y Acciones 1-Tap) */}
                        <div className="mb-8 p-5 sm:p-6 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                            {/* Valor Estimado */}
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-ios-subtext dark:text-gray-400 block mb-1">
                                        Valor Total Estimado
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-3xl font-black text-ios-text dark:text-white">
                                            {activeCurrencySymbol}{totalUsd.toFixed(2)}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-400">
                                            {formatVes(totalUsd)}
                                        </span>
                                    </div>
                                    {totalSavings > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 mt-1">
                                            <Zap size={12} className="fill-red-500" /> Ahorras {activeCurrencySymbol}{totalSavings.toFixed(2)} en ofertas activas
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Botones de Acción Masiva */}
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                                {/* Mover todo al carrito */}
                                <button
                                    onClick={handleMoveAllToCart}
                                    disabled={isMovingAll || inStockCount === 0}
                                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all active:scale-95
                                        ${inStockCount === 0 
                                            ? 'bg-gray-400 cursor-not-allowed opacity-60'
                                            : 'bg-ios-blue hover:brightness-110 shadow-ios-blue/30'
                                        }
                                    `}
                                >
                                    <ShoppingBag size={16} />
                                    <span>{isMovingAll ? 'Añadiendo...' : `Mover Todo al Carrito (${inStockCount})`}</span>
                                </button>

                                {/* Compartir por WhatsApp */}
                                <button
                                    onClick={handleShareWhatsApp}
                                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-green-500/20 transition-all active:scale-95"
                                    title="Compartir por WhatsApp"
                                >
                                    <Share2 size={16} />
                                    <span className="hidden sm:inline">Mandar indirecta</span>
                                </button>

                                {/* Copiar Enlace */}
                                <button
                                    onClick={handleCopyLink}
                                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-ios-text dark:text-white rounded-2xl font-semibold text-xs transition-all active:scale-95 border border-black/5 dark:border-white/5"
                                    title="Copiar enlace de mi lista"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Copiar link'}</span>
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
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                        <div className="w-24 h-24 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6 shadow-inner animate-pulse-slow">
                            <Heart size={44} className="fill-red-500/20" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ios-text dark:text-white mb-2">
                            Tu lista de deseos está vacía
                        </h2>
                        <p className="text-ios-subtext dark:text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
                            Guarda los productos que más te gusten tocando el corazón ❤️ en cualquier tarjeta para no perderlos de vista o compartirlos con amigos.
                        </p>
                        <Button 
                            onClick={() => navigate('/shop')}
                            className="!px-8 !py-4 rounded-full font-bold shadow-xl shadow-ios-blue/20 gap-2 flex items-center"
                        >
                            Explorar Catálogo <ArrowRight size={16} />
                        </Button>
                    </div>
                )}
            </div>
        </ShopLayout>
    );
};
