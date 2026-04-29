
import React from 'react';
import { usePOS } from '../../../context/POSContext';
import { POSProductGrid } from './POSProductGrid';
import { POSCart } from './POSCart';
import { VariantSelectorModal, CheckoutModal } from './POSModals';
import { ShoppingCart, LayoutDashboard } from 'lucide-react';

export const POSLayout = () => {
    const {
        isFullScreen,
        variantModalOpen,
        setVariantModalOpen,
        selectedProduct,
        addToCart,
        checkoutModalOpen,
        setCheckoutModalOpen,
        confirmCheckout,
        total,
        checkoutDetails,
        cart,
        activeTab,
        setActiveTab
    } = usePOS();

    return (
        <div className={`flex flex-col md:flex-row h-full relative ${isFullScreen ? 'fixed inset-0 z-[50] bg-white dark:bg-black' : 'rounded-[2rem] overflow-hidden border border-gray-100 dark:border-white/5 shadow-xl'}`}>
            {/* Panel Izquierdo: Productos */}
            <div className={`flex-1 flex-col h-full ${activeTab === 'catalog' ? 'flex' : 'hidden md:flex'}`}>
                <POSProductGrid />
            </div>

            {/* Panel Derecho: Carrito */}
            <div className={`h-full ${activeTab === 'cart' ? 'flex flex-1 md:flex-none' : 'hidden md:flex'}`}>
                <POSCart />
            </div>

            {/* Selector de Pestañas Móvil (Floating) */}
            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-1 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl z-[100] scale-110">
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'catalog' ? 'bg-ios-blue text-white shadow-lg' : 'text-gray-500'}`}
                >
                    <LayoutDashboard size={16} />
                    Catálogo
                </button>
                <button
                    onClick={() => setActiveTab('cart')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative ${activeTab === 'cart' ? 'bg-ios-blue text-white shadow-lg' : 'text-gray-500'}`}
                >
                    <ShoppingCart size={16} />
                    Carrito
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900 animate-in zoom-in">
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Modales */}
            <VariantSelectorModal
                product={selectedProduct}
                isOpen={variantModalOpen}
                onClose={() => setVariantModalOpen(false)}
                onConfirm={addToCart}
            />

            <CheckoutModal
                isOpen={checkoutModalOpen}
                onClose={() => setCheckoutModalOpen(false)}
                onConfirm={confirmCheckout}
                total={checkoutDetails.totalOverride !== undefined ? checkoutDetails.totalOverride : total}
                cart={cart}
                customerName={checkoutDetails.name}
            />
        </div>
    );
};
