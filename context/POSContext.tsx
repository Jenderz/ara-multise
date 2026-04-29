
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, Customer, PaymentMethod } from '../types';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';
import { useProduct } from './ProductContext';
import { useNotification } from './NotificationContext';
import { DEFAULT_IMAGE } from '../config';

interface POSContextType {
    cart: CartItem[];
    addToCart: (product: Product, options?: Record<string, string>, price?: number, sku?: string, image?: string) => void;
    updateQuantity: (cartId: string, delta: number) => void;
    updateItemDiscount: (cartId: string, discountType: 'percent' | 'fixed', value: number) => void;
    removeFromCart: (cartId: string) => void;
    clearCart: () => void;

    parkedOrders: any[];
    parkOrder: (name: string, customer: Customer | null) => void;
    restoreOrder: (index: number) => void;
    deleteParkedOrder: (index: number) => void;

    prepareCheckout: (details: any) => void;
    confirmCheckout: () => Promise<void>;

    checkoutModalOpen: boolean;
    setCheckoutModalOpen: (v: boolean) => void;
    checkoutDetails: any;

    variantModalOpen: boolean;
    setVariantModalOpen: (v: boolean) => void;
    selectedProduct: Product | null;
    openVariantModal: (p: Product) => void;

    total: number;
    totalBs: number;

    isFullScreen: boolean;
    toggleFullScreen: () => void;
    activeTab: 'catalog' | 'cart';
    setActiveTab: (tab: 'catalog' | 'cart') => void;
    addCustomItemToCart: (title: string, price: number, quantity?: number) => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { createOrder, activeExchangeRate, refreshStoreData, currentBranch } = useStore(); // Modified useStore destructuring
    const { currentUser, userRole } = useAuth(); // Added useAuth hook
    const { adjustStockLocally } = useProduct(); // Added useProduct hook
    const { addNotification } = useNotification();

    // --- ESTADO DEL CARRITO ---
    const [cart, setCart] = useState<CartItem[]>([]);
    const [parkedOrders, setParkedOrders] = useState<any[]>(() => {
        try {
            const saved = localStorage.getItem('lyberate_pos_parked');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // --- ESTADO DE UI ---
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [variantModalOpen, setVariantModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');
    const [checkoutDetails, setCheckoutDetails] = useState<any>({});

    // Persistencia de órdenes pausadas
    useEffect(() => {
        localStorage.setItem('lyberate_pos_parked', JSON.stringify(parkedOrders));
    }, [parkedOrders]);

    // --- CÁLCULOS ---
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalBs = total * activeExchangeRate;

    // --- ACCIONES DEL CARRITO ---
    const addToCart = (product: Product, options: Record<string, string> = {}, priceOverride?: number, skuOverride?: string, imageOverride?: string) => {
        // PRECIO FINAL: Si hay override manual (ej. variante) > Descuento Global > Precio Base
        let finalPrice = product.price;
        if (priceOverride !== undefined) {
            finalPrice = priceOverride;
        } else if (product.discountPrice && product.discountPrice > 0) {
            finalPrice = product.discountPrice;
        } else if (product.salePrice && product.salePrice > 0 && product.salePrice < product.price) {
            finalPrice = product.salePrice;
        }

        const sku = skuOverride || product.code;
        const image = imageOverride || product.images[0] || DEFAULT_IMAGE;

        const cartId = `${product.id}-${JSON.stringify(options)}`;

        // Buscar la variante específica para obtener su ID
        const matchingVariant = product.variants && product.variants.length > 0
            ? product.variants.find(v => Object.entries(options).every(([k, val]) => v.selections[k] === val))
            : null;

        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing) {
                return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                cartId,
                productId: product.id,
                productTitle: product.title,
                price: finalPrice,
                quantity: 1,
                image,
                selectedOptions: options,
                variantSku: sku,
                variantId: matchingVariant?.id // FIX: Enviar ID de variante para descuento de stock
            }];
        });
    };

    const addCustomItemToCart = (title: string, price: number, quantity: number = 1) => {
        const cartId = `custom-${Date.now()}`;
        setCart(prev => [...prev, {
            cartId,
            productId: 'custom',
            productTitle: title,
            price,
            quantity,
            image: DEFAULT_IMAGE,
            selectedOptions: {},
            variantSku: 'GENERICO'
        }]);
    };

    const updateQuantity = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) return { ...item, quantity: Math.max(1, item.quantity + delta) };
            return item;
        }));
    };

    const updateItemDiscount = (cartId: string, discountType: 'percent' | 'fixed', value: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                const originalPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
                let newPrice = originalPrice;
                
                if (value > 0) {
                    if (discountType === 'percent') {
                        newPrice = originalPrice - (originalPrice * (value / 100));
                    } else {
                        newPrice = originalPrice - value;
                    }
                }
                
                return { 
                    ...item, 
                    originalPrice, 
                    price: Math.max(0, newPrice),
                    itemDiscountType: discountType,
                    itemDiscountValue: value
                };
            }
            return item;
        }));
    };

    const removeFromCart = (cartId: string) => {
        setCart(prev => prev.filter(i => i.cartId !== cartId));
    };

    const clearCart = () => setCart([]);

    // --- ACCIONES DE ÓRDENES PAUSADAS ---
    const parkOrder = (name: string, customer: Customer | null) => {
        if (cart.length === 0) return;
        setParkedOrders(prev => [...prev, { name: name || `Orden ${prev.length + 1}`, cart, date: Date.now(), customer }]);
        setCart([]);
        addNotification({ title: 'Orden Pausada', body: 'La orden se guardó temporalmente.', type: 'info' });
    };

    const restoreOrder = (index: number) => {
        const orderToRestore = parkedOrders[index];
        setCart(orderToRestore.cart);
        // Opcional: Eliminar de la lista de pausadas al restaurar
        const newParked = parkedOrders.filter((_, i) => i !== index);
        setParkedOrders(newParked);
    };

    const deleteParkedOrder = (index: number) => {
        setParkedOrders(prev => prev.filter((_, i) => i !== index));
    };

    // --- PROCESO DE PAGO ---
    const prepareCheckout = (details: any) => {
        const canCheckout = userRole === 'admin' || currentUser?.permissions?.includes('checkout_authorized');

        if (!canCheckout) {
            addNotification({ title: 'Acceso Denegado', body: 'No tienes permisos para cobrar.', type: 'warning' });
            return;
        }

        // Calcular el total final considerando un posible override en el componente POSCart (ej. descuentos)
        // Si details.totalOverride viene, lo usamos, si no, usamos el total calculado del carrito
        const finalDetails = {
            ...details,
            totalOverride: details.totalOverride !== undefined ? details.totalOverride : total
        };

        setCheckoutDetails(finalDetails);
        setCheckoutModalOpen(true);
    };

    const confirmCheckout = async () => {
        const finalTotal = checkoutDetails.totalOverride;

        await createOrder(
            checkoutDetails.name,
            checkoutDetails.phone,
            checkoutDetails.finalAddress,
            cart,
            finalTotal,
            checkoutDetails.finalPaymentMethod,
            'completed',
            undefined,
            'pos',
            currentBranch?.id || 1
        );

        addNotification({ title: 'Venta Exitosa', body: 'Recargando sistema...', type: 'success' });

        // Force full reload to update stock from server
        setTimeout(() => {
            window.location.reload();
        }, 500);

        // Fallback states in case reload is cancelled or slow
        setCart([]);
        setCheckoutModalOpen(false);
    };

    // --- UI HELPERS ---
    const openVariantModal = (product: Product) => {
        setSelectedProduct(product);
        setVariantModalOpen(true);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => console.log(e));
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullScreen(false);
            }
        }
    };

    return (
        <POSContext.Provider value={{
            cart, addToCart, updateQuantity, updateItemDiscount, removeFromCart, clearCart,
            parkedOrders, parkOrder, restoreOrder, deleteParkedOrder,
            prepareCheckout, confirmCheckout,
            checkoutModalOpen, setCheckoutModalOpen, checkoutDetails,
            variantModalOpen, setVariantModalOpen, selectedProduct, openVariantModal,
            total, totalBs,
            isFullScreen, toggleFullScreen,
            activeTab, setActiveTab,
            addCustomItemToCart
        }}>
            {children}
        </POSContext.Provider>
    );
};

export const usePOS = () => {
    const context = useContext(POSContext);
    if (!context) throw new Error("usePOS must be used within POSProvider");
    return context;
};
