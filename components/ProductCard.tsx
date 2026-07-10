
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Card, Badge, LazyImage } from './UIComponents';
import { ShoppingBag, Eye, Heart, ListPlus, Share2, Globe } from 'lucide-react';
import { Product } from '../types';
import { DEFAULT_IMAGE } from '../config';

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

    // Permitir compra si hay stock en cualquier parte de la empresa
    const canBuy = totalStock > 0;
    const isOutOfStock = totalStock === 0;
    const isRemoteStock = localStock === 0 && totalStock > 0;

    const isOnSale = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.price);
    const isInWishlist = wishlist.includes(product.id);
    const hasVariants = product.variantOptions && product.variantOptions.length > 0;
    const showOptions = hasVariants;

    const handleQuickAdd = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!canBuy) return;

        // Si tiene opciones, ir al detalle
        if (showOptions) {
            navigate(`/product/${product.id}`);
            return;
        }

        addToCart(product, {}, 1);
    };

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(product.id);
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const productUrl = `${window.location.origin}${window.location.pathname}#/product/${product.id}`;
        const message = `Mira este producto: ${product.title} - ${productUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    };

    const showUsd = settings.priceDisplayMode === 'usd' || settings.priceDisplayMode === 'both';
    const showVes = settings.priceDisplayMode === 'ves' || settings.priceDisplayMode === 'both';
    const finalPrice = product.price;
    const finalSalePrice = product.salePrice || 0;

    const formatVes = (usd: number) => `Bs ${(usd * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const displayImage = product.images[0] || DEFAULT_IMAGE;

    return (
        <Card className="h-full hover:shadow-xl dark:hover:shadow-white/5 transition-all duration-300 group flex flex-col relative overflow-hidden bg-white dark:bg-zinc-900 border-white/40 dark:border-white/5">
            <Link to={`/product/${product.id}`} className="block relative cursor-pointer">
                <LazyImage
                    src={displayImage}
                    alt={product.title}
                    aspectRatio="square"
                    className={`group-hover:scale-110 transition-transform duration-700 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}
                />

                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={handleToggleWishlist} className="p-2 bg-white/80 dark:bg-black/60 backdrop-blur rounded-full shadow-sm hover:scale-110 transition border border-white/20 dark:border-white/10">
                        <Heart size={18} className={isInWishlist ? "fill-red-500 text-red-500" : "text-gray-400"} />
                    </button>
                    <button onClick={handleShare} className="p-2 bg-white/80 dark:bg-black/60 backdrop-blur rounded-full shadow-sm hover:scale-110 transition text-ios-blue border border-white/20 dark:border-white/10">
                        <Share2 size={18} />
                    </button>
                </div>

                <div className="absolute top-4 left-4 flex gap-2 flex-wrap max-w-[80%] z-20">
                    {isOutOfStock && <Badge color="red">AGOTADO</Badge>}
                    {/* {isRemoteStock && <Badge color="gray">BAJO PEDIDO</Badge>} ELIMINADO POR SOLICITUD */}
                    {isOnSale && !isOutOfStock && <Badge color="blue">OFERTA</Badge>}
                    {product.isFeatured && !isOutOfStock && <Badge color="green">DESTACADO</Badge>}
                </div>
            </Link>

            <div className="p-5 flex-1 flex flex-col">
                <Link to={`/product/${product.id}`} className="block group-hover:text-ios-blue transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-ios-text dark:text-white leading-tight line-clamp-2">{product.title}</h3>
                    </div>
                </Link>

                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <span className="text-xs text-ios-subtext dark:text-gray-400 uppercase tracking-wide">{product.category}</span>
                    <div className="text-right">
                        {isOnSale ? (
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1.5 flex-wrap justify-end">
                                    {showUsd && <span className="text-lg font-bold text-red-500">{activeCurrencySymbol}{finalSalePrice.toFixed(2)}</span>}
                                    {showVes && <span className="text-sm font-bold text-red-500/80">{formatVes(finalSalePrice)}</span>}
                                </div>
                                <div className="flex flex-col items-end text-xs text-gray-400 line-through opacity-60">
                                    {showUsd && <span>{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                    {showVes && <span>{formatVes(finalPrice)}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                {showUsd && <span className="text-lg font-semibold text-ios-text dark:text-white">{activeCurrencySymbol}{finalPrice.toFixed(2)}</span>}
                                {showVes && <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{formatVes(finalPrice)}</span>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                    <button onClick={() => navigate(`/product/${product.id}`)} className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-ios-text dark:text-white font-medium py-2.5 px-2 rounded-xl transition-colors text-xs">
                        <Eye size={14} /> Ver
                    </button>
                    <button
                        onClick={handleQuickAdd}
                        disabled={!canBuy}
                        className={`flex items-center justify-center gap-2 font-medium py-2.5 px-2 rounded-xl transition-colors text-xs 
                            ${!canBuy
                                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed border dark:border-white/5'
                                : isRemoteStock
                                    ? 'bg-ios-blue text-white hover:brightness-110 shadow-lg' // Igualamos estilo
                                    : 'bg-ios-blue text-white hover:brightness-110 shadow-lg shadow-black/10'
                            }`
                        }
                    >
                        {showOptions
                            ? <ListPlus size={14} />
                            : <ShoppingBag size={14} /> // Icono uniforme
                        }
                        {canBuy ? (showOptions ? 'Opciones' : 'Añadir') : 'Agotado'}
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
            <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                <div className="h-10 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
                <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-xl" />
            </div>
        </div>
    </div>
);
