
import React from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/UIComponents';
import { Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';

export const Wishlist = () => {
    const { products, wishlist } = useStore();
    const navigate = useNavigate();

    const wishlistProducts = products.filter(p => wishlist.includes(p.id) && p.isVisible);

    return (
        <ShopLayout>
            <SEO title="Lista de Deseos" description="Tus productos favoritos guardados para comprar después." />
            
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-8">
                     <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full dark:text-white">
                         <ArrowLeft size={24} />
                     </button>
                     <h1 className="text-3xl font-bold text-ios-text dark:text-white flex items-center gap-3">
                        <Heart className="fill-red-500 text-red-500" /> Lista de Deseos
                     </h1>
                </div>

                {wishlistProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {wishlistProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <Heart size={40} className="text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-ios-text dark:text-white mb-2">Tu lista está vacía</h2>
                        <p className="text-ios-subtext mb-8 max-w-md">
                            Guarda los productos que más te gusten para verlos más tarde o compartirlos.
                        </p>
                        <Button onClick={() => navigate('/shop')}>
                            Explorar Tienda
                        </Button>
                    </div>
                )}
            </div>
        </ShopLayout>
    );
};
