
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
        <Card className="h-full hover:shadow-2xl dark:hover:shadow-white/5 transition-all duration-500 group flex flex-col relative overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-3xl">
            <Link to={`/product/${generateProductSlug(product.title, product.id)}`} className="block relative cursor-pointer overflow-hidden rounded-t-3xl">
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
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                    <button
                        onClick={handleToggleWishlist}
                        className="p-2.5 bg-white/80 dark:bg-black/70 backdrop-blur-xl rounded-full shadow-md hover:scale-110 active:scale-90 transition-all border border-white/20 dark:border-white/10"
                        title={isInWishlist ? "Eliminar de favoritos" : "Guardar en favoritos"}
                    >
                        <Heart
                            size={17}
                            className={`transition-colors ${isInWishlist ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-300"} ${isHeartAnimating ? "animate-heart-burst" : ""}`}
                        />
                    </button>
                    <button
                        onClick={handleShare}
                        className="p-2.5 bg-white/80 dark:bg-black/70 backdrop-blur-xl rounded-full shadow-md hover:scale-110 active:scale-90 transition-all text-ios-blue border border-white/20 dark:border-white/10"
                        title="Compartir por WhatsApp"
                    >
                        <Share2 size={17} />
                    </button>
                </div>

                {/* Badges Inteligentes */}
                <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[80%] z-20">
                    {isOutOfStock && <Badge color="red">AGOTADO</Badge>}
                    {isOnSale && !isOutOfStock && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse-slow">
                            {discountPercent > 0 ? `-${discountPercent}%` : 'OFERTA'}
                        </span>
                    )}
                    {product.isFeatured && !isOutOfStock && <Badge color="green">DESTACADO</Badge>}
                </div>
            </Link>

            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <Link to={`/product/${generateProductSlug(product.title, product.id)}`} className="block group-hover:text-ios-blue transition-colors">
                    <div className="flex justify-between items-start mb-1.5">
                        <h3 className="text-base sm:text-lg font-bold text-ios-text dark:text-white leading-tight line-clamp-2">{product.title}</h3>
                    </div>
                </Link>

                <div className="flex items-center justify-between mb-4 flex-wrap gap-1">
                    <span className="text-[11px] text-ios-subtext dark:text-gray-400 uppercase tracking-wider font-semibold">{product.category}</span>
                    <div className="text-right">
                        {isOnSale ? (
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1.5 flex-wrap justify-end">
                                    {showUsd && <span className="text-base sm:text-lg font-bold text-red-500">{activeCurrencySymbol}{finalSalePrice.toFixed(2)}</span>}
                                    {showVes && <span className="text-xs sm:text-sm font-bold text-red-500/90">{formatVes(finalSalePrice)}</span>}
                                </div>
                                <div className="flex flex-col items-end text-[11px] text-gray-400 line-through opacity-60">
                                    {showUsd && <span>{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                    {showVes && <span>{formatVes(finalPrice)}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                {showUsd && <span className="text-base sm:text-lg font-semibold text-ios-text dark:text-white">{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                {showVes && <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{formatVes(finalPrice)}</span>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto flex items-center gap-2">
                    <button 
                        onClick={() => navigate(`/product/${generateProductSlug(product.title, product.id)}`)} 
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-ios-text dark:text-white font-semibold py-2.5 px-3 rounded-2xl transition-all active:scale-95 text-xs"
                    >
                        <Eye size={14} /> Ver
                    </button>
                    <button
                        onClick={handleQuickAdd}
                        disabled={!canBuy}
                        aria-label={!canBuy ? 'Agotado' : isQuickAdded ? 'Añadido' : showOptions ? 'Ver Opciones' : 'Añadir al Carrito'}
                        title={!canBuy ? 'Agotado' : showOptions ? 'Ver Opciones' : 'Añadir al Carrito'}
                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl transition-all active:scale-90 shadow-md 
                            ${!canBuy
                                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed border dark:border-white/5'
                                : isQuickAdded
                                    ? 'bg-green-500 text-white shadow-green-500/30'
                                    : 'bg-ios-blue text-white hover:brightness-110 shadow-ios-blue/25'
                            }`
                        }
                    >
                        {isQuickAdded ? (
                            <Check size={18} className="animate-spring-scale text-white stroke-[3]" />
                        ) : showOptions ? (
                            <ListPlus size={18} />
                        ) : (
                            <Plus size={18} />
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
