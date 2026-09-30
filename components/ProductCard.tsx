
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Card, Badge, LazyImage } from './UIComponents';
import { ShoppingBag, Eye, Heart, ListPlus, Share2, Globe, Plus, Check } from 'lucide-react';
import { Product } from '../types';
import { DEFAULT_IMAGE } from '../config';
import { generateProductSlug } from '../utils/slugify';
import { showWishlistToast } from './WishlistToast';

interface ProductCardProps {
    product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const { addToCart, wishlist, toggleWishlist, settings, activeExchangeRate, activeCurrencySymbol } = useStore();
    const navigate = useNavigate();

    // --- LÓGICA DE STOCK GLOBAL ---
    // Calculamos el stock total sumando todas las sedes disponibles
    const totalStock = React.useMemo(() => {
        if (product.globalStock !== undefined) return product.globalStock;

        if (product.branchStock && Object.keys(product.branchStock).length > 0) {
            return Object.values(product.branchStock).reduce((acc: number, qty: number) => acc + qty, 0);
        }

        return product.stock || 0;
    }, [product]);

    // Calcular si hay stock local para diferenciar visualmente (opcional)
    const localStock = product.stock || 0;

    const [isHeartAnimating, setIsHeartAnimating] = useState(false);
    const [isQuickAdded, setIsQuickAdded] = useState(false);

    // Permitir compra si hay stock en cualquier parte de la empresa
    const canBuy = totalStock > 0;
    const isOutOfStock = totalStock === 0;
    const isRemoteStock = localStock === 0 && totalStock > 0;

    const isOnSale = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.price);
    const discountPercent = isOnSale && product.price > 0
        ? Math.round(((product.price - (product.salePrice || 0)) / product.price) * 100)
        : 0;

    const isInWishlist = wishlist.includes(product.id);
    const hasVariants = Boolean(
        product.variantOptions &&
        product.variantOptions.length > 0 &&
        product.variants &&
        product.variants.length > 0
    );
    const showOptions = hasVariants;

    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!canBuy) return;

        // Si tiene opciones, ir al detalle
        if (showOptions) {
            navigate(`/product/${generateProductSlug(product.title, product.id)}`);
            return;
        }

        // Feedback háptico nativo
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(10); } catch { }
        }

        setIsQuickAdded(true);
        setTimeout(() => setIsQuickAdded(false), 1200);

        addToCart(product, {}, 1);
    };

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsHeartAnimating(true);
        setTimeout(() => setIsHeartAnimating(false), 500);

        toggleWishlist(product.id);

        showWishlistToast({
            productTitle: product.title,
            action: isInWishlist ? 'removed' : 'added',
            image: product.images[0] || DEFAULT_IMAGE,
            count: wishlist.length + (isInWishlist ? -1 : 1)
        });
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const slug = generateProductSlug(product.title, product.id);
        const productUrl = `${window.location.origin}/product/${slug}`;
        const message = `🛒 *${product.title}*\n${productUrl}`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };

    const showUsd = settings.priceDisplayMode === 'usd' || settings.priceDisplayMode === 'both';
    const showVes = settings.priceDisplayMode === 'ves' || settings.priceDisplayMode === 'both';
    const finalPrice = product.price;
    const finalSalePrice = product.salePrice || 0;

    const formatVes = (usd: number) => `Bs ${(usd * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const displayImage = product.images[0] || DEFAULT_IMAGE;
    const secondaryImage = product.images && product.images.length > 1 ? product.images[1] : null;

    return (
        <Card className="h-full hover:shadow-2xl dark:hover:shadow-white/5 transition-all duration-500 group flex flex-col relative overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl sm:rounded-3xl">
            <Link to={`/product/${generateProductSlug(product.title, product.id)}`} className="block relative cursor-pointer overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
                {/* Imagen Principal */}
                <LazyImage
                    src={displayImage}
                    alt={product.title}
                    aspectRatio="square"
                    className={`transition-transform duration-700 ease-out group-hover:scale-105 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}
                />

                {/* Segunda Foto en Hover (Desktop) */}
                {secondaryImage && !isOutOfStock && (
                    <img
                        src={secondaryImage}
                        alt={`${product.title} vista`}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out hidden sm:block z-10"
                    />
                )}

                {/* Botones Flotantes Superiores */}
                <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 flex flex-col gap-1 sm:gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                    <button
                        onClick={handleToggleWishlist}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/85 dark:bg-black/70 backdrop-blur-md rounded-full shadow-xs hover:scale-110 active:scale-90 transition-all border border-white/20 dark:border-white/10"
                        title={isInWishlist ? "Eliminar de favoritos" : "Guardar en favoritos"}
                    >
                        <Heart
                            size={14}
                            className={`transition-colors sm:w-4 sm:h-4 ${isInWishlist ? "fill-red-500 text-red-500" : "text-gray-500 dark:text-gray-300"} ${isHeartAnimating ? "animate-heart-burst" : ""}`}
                        />
                    </button>
                    <button
                        onClick={handleShare}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/85 dark:bg-black/70 backdrop-blur-md rounded-full shadow-xs hover:scale-110 active:scale-90 transition-all text-ios-blue border border-white/20 dark:border-white/10"
                        title="Compartir por WhatsApp"
                    >
                        <Share2 size={13} className="sm:w-3.5 sm:h-3.5" />
                    </button>
                </div>

                {/* Badges Inteligentes */}
                <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex gap-1 sm:gap-1.5 flex-wrap max-w-[70%] sm:max-w-[85%] z-20">
                    {isOutOfStock && <Badge color="red">AGOTADO</Badge>}
                    {isOnSale && !isOutOfStock && (
                        <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider bg-red-500 text-white shadow-xs animate-pulse-slow">
                            {discountPercent > 0 ? `-${discountPercent}%` : 'OFERTA'}
                        </span>
                    )}
                    {product.isFeatured && !isOutOfStock && <Badge color="green">DESTACADO</Badge>}
                </div>
            </Link>

            <div className="p-2.5 sm:p-4 md:p-5 flex-1 flex flex-col">
                <Link to={`/product/${generateProductSlug(product.title, product.id)}`} className="block group-hover:text-ios-blue transition-colors mb-1">
                    <h3 className="text-xs sm:text-sm md:text-base font-semibold sm:font-bold text-ios-text dark:text-white leading-snug sm:leading-tight line-clamp-2 min-h-[2.4em]">{product.title}</h3>
                </Link>

                <div className="flex items-center justify-between mb-2.5 sm:mb-3 flex-wrap gap-1">
                    <span className="text-[9.5px] sm:text-[11px] text-ios-subtext dark:text-gray-400 uppercase tracking-wider font-semibold truncate max-w-[75px] sm:max-w-none">{product.category}</span>
                    <div className="text-right ml-auto">
                        {isOnSale ? (
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap justify-end">
                                    {showUsd && <span className="text-xs sm:text-sm md:text-base font-bold text-red-500">{activeCurrencySymbol}{finalSalePrice.toFixed(2)}</span>}
                                    {showVes && <span className="text-[9px] sm:text-xs md:text-sm font-bold text-red-500/90">{formatVes(finalSalePrice)}</span>}
                                </div>
                                <div className="flex items-center gap-1 text-[8.5px] sm:text-[10px] text-gray-400 line-through opacity-60">
                                    {showUsd && <span>{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                    {showVes && <span>{formatVes(finalPrice)}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                {showUsd && <span className="text-xs sm:text-sm md:text-base font-bold text-ios-text dark:text-white">{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                {showVes && <span className="text-[9px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{formatVes(finalPrice)}</span>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto flex items-center gap-1.5 sm:gap-2">
                    <button 
                        onClick={() => navigate(`/product/${generateProductSlug(product.title, product.id)}`)} 
                        className="flex-1 flex items-center justify-center gap-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-ios-text dark:text-white font-semibold h-8 sm:h-9 md:h-10 px-2 sm:px-3 rounded-xl sm:rounded-2xl transition-all active:scale-95 text-[11px] sm:text-xs"
                    >
                        <Eye size={13} className="sm:w-[14px] sm:h-[14px]" /> Ver
                    </button>
                    <button
                        onClick={handleQuickAdd}
                        disabled={!canBuy}
                        aria-label={!canBuy ? 'Agotado' : isQuickAdded ? 'Añadido' : showOptions ? 'Ver Opciones' : 'Añadir al Carrito'}
                        title={!canBuy ? 'Agotado' : showOptions ? 'Ver Opciones' : 'Añadir al Carrito'}
                        className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl transition-all active:scale-90 shadow-2xs sm:shadow-md 
                            ${!canBuy
                                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed border dark:border-white/5'
                                : isQuickAdded
                                    ? 'bg-green-500 text-white shadow-green-500/30'
                                    : 'bg-ios-blue text-white hover:brightness-110 shadow-ios-blue/25'
                            }`
                        }
                    >
                        {isQuickAdded ? (
                            <Check size={15} className="animate-spring-scale text-white stroke-[3] sm:w-[17px] sm:h-[17px]" />
                        ) : showOptions ? (
                            <ListPlus size={14} className="sm:w-4 sm:h-4" />
                        ) : (
                            <Plus size={15} className="sm:w-4 sm:h-4" />
                        )}
                    </button>
                </div>
            </div>
        </Card>
    );
};

// =====================================================
// SKELETON CARD — Se muestra mientras los productos cargan
// =====================================================
export const ProductCardSkeleton: React.FC = () => (
    <div className="h-full rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 flex flex-col animate-pulse">
        {/* Imagen */}
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        {/* Contenido */}
        <div className="p-5 flex-1 flex flex-col gap-3">
            <div className="h-5 bg-gray-100 dark:bg-zinc-800 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-100 dark:bg-zinc-800 rounded-xl w-1/2" />
            <div className="mt-auto flex items-center gap-2 pt-2">
                <div className="h-10 flex-1 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
                <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-700 rounded-xl shrink-0" />
            </div>
        </div>
    </div>
);
