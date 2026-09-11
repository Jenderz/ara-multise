
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, Customer, PaymentMethod, Order } from '../types';
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
    parkOrder: (name: string, customer: Customer | null, advisorId?: string | null, advisorName?: string | null) => void;
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

    ticketModalOpen: boolean;
    setTicketModalOpen: (v: boolean) => void;
    lastCompletedOrder: any;
    setLastCompletedOrder: (o: any) => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { createOrder, activeExchangeRate, refreshStoreData, currentBranch, settings } = useStore(); // Modified useStore destructuring
    const { currentUser, userRole } = useAuth(); // Added useAuth hook
    const { adjustStockLocally, products } = useProduct(); // Added useProduct hook
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
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [lastCompletedOrder, setLastCompletedOrder] = useState<any>(null);

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

        // Buscar la variante específica para obtener su ID y stock
        const matchingVariant = product.variants && product.variants.length > 0
            ? product.variants.find(v => Object.entries(options).every(([k, val]) => v.selections[k] === val))
            : null;

        const maxStock = matchingVariant 
            ? (Number(matchingVariant.stock) ?? 0) 
            : (Number(product.stock) ?? 0);
        const tracks = product.trackStock !== false;
        const allowNegative = settings?.allowNegativeStock === true;

        const existing = cart.find(i => i.cartId === cartId);
        const currentQty = existing ? existing.quantity : 0;

        // Validar stock disponible
        if (!allowNegative && tracks && (currentQty + 1 > maxStock)) {
            addNotification({
                title: 'Límite de Stock',
                body: `Solo hay ${maxStock} unidades disponibles de "${product.title}" en esta sede.`,
                type: 'warning'
            });
            return;
        }

        setCart(prev => {
            const exists = prev.find(i => i.cartId === cartId);
            if (exists) {
                return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1, maxStock, trackStock: tracks } : i);
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
                variantId: matchingVariant?.id, // FIX: Enviar ID de variante para descuento de stock
                maxStock,
                trackStock: tracks
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
            variantSku: 'GENERICO',
            trackStock: false
        }]);
    };

    const updateQuantity = (cartId: string, delta: number) => {
        const allowNegative = settings?.allowNegativeStock === true;

        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                if (delta > 0 && !allowNegative) {
                    const tracks = item.trackStock !== false;
                    let maxStock = item.maxStock;

                    // Fallback si no estaba en item
                    if (maxStock === undefined) {
                        const prod = products.find(p => p.id === item.productId);
                        if (prod) {
                            maxStock = prod.stock;
                            if (item.variantId && prod.variants) {
                                const v = prod.variants.find(vr => vr.id === item.variantId);
                                if (v) maxStock = v.stock;
                            }
                        }
                    }

                    if (tracks && maxStock !== undefined && (item.quantity + delta > maxStock)) {
                        addNotification({
                            title: 'Límite de Stock',
                            body: `Solo hay ${maxStock} unidades disponibles en esta sede.`,
                            type: 'warning'
                        });
                        return item;
                    }
                }
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
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
    const parkOrder = (name: string, customer: Customer | null, advisorId?: string | null, advisorName?: string | null) => {
        if (cart.length === 0) return;
        setParkedOrders(prev => [...prev, { name: name || `Orden ${prev.length + 1}`, cart, date: Date.now(), customer, advisorId, advisorName }]);
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
        const finalTotal = checkoutDetails.totalOverride !== undefined ? checkoutDetails.totalOverride : total;
        const subtotalCalc = cart.reduce((sum, item) => sum + ((item.originalPrice !== undefined && item.originalPrice > item.price ? item.originalPrice : item.price) * (item.quantity || 1)), 0);
        const discountAmount = Math.max(0, subtotalCalc - finalTotal);

        // Pre-validar stock en frontend si no se permite stock negativo
        const allowNegative = settings?.allowNegativeStock === true;
        if (!allowNegative) {
            for (const item of cart) {
                if (item.trackStock !== false && item.maxStock !== undefined && item.quantity > item.maxStock) {
                    addNotification({
                        title: 'Stock Insuficiente',
                        body: `No hay suficiente stock de "${item.productTitle}". Disponible: ${item.maxStock}, Solicitado: ${item.quantity}.`,
                        type: 'warning'
                    });
                    return;
                }
            }
        }

        try {
            const cashierId = currentUser?.id || 'web-client';
            const cashierName = currentUser?.name || 'Venta Mostrador';

            const orderId = await createOrder(
                checkoutDetails.name,
                checkoutDetails.phone,
                checkoutDetails.finalAddress,
                cart,
                finalTotal,
                checkoutDetails.finalPaymentMethod,
                'completed',
                discountAmount,
                'pos',
                currentBranch?.id || 1,
                cashierId,
                cashierName,
                checkoutDetails.sellerCommission || 0,
                checkoutDetails.commissionRate || 0,
                undefined, // couponCode
                checkoutDetails.advisorId || undefined,
                checkoutDetails.advisorName || undefined,
                checkoutDetails.advisorCommission || 0,
                checkoutDetails.advisorRate || 0
            );

            // 1. Descontar optimistamente el stock en la memoria local
            cart.forEach(item => {
                if (item.productId && !item.productId.startsWith('custom') && !item.productId.startsWith('manual-')) {
                    adjustStockLocally(item.productId, -(item.quantity || 1), item.variantId);
                }
            });

            // 2. Guardar orden para emitir ticket térmico
            const completedOrder: Order = {
                id: orderId,
                customerName: checkoutDetails.name || 'Cliente Mostrador',
                customerPhone: checkoutDetails.phone || '',
                customerAddress: checkoutDetails.finalAddress || '',
                items: [...cart],
                total: finalTotal,
                subtotal: subtotalCalc,
                discount: discountAmount,
                paymentMethod: checkoutDetails.finalPaymentMethod,
                deliveryMethod: 'pos',
                sellerId: cashierId,
                sellerName: cashierName,
                sellerCommission: checkoutDetails.sellerCommission || 0,
                commissionRate: checkoutDetails.commissionRate || 0,
                advisorId: checkoutDetails.advisorId || undefined,
                advisorName: checkoutDetails.advisorName || undefined,
                advisorCommission: checkoutDetails.advisorCommission || 0,
                advisorRate: checkoutDetails.advisorRate || 0,
                branchId: currentBranch?.id || 1,
                date: Date.now(),
                status: 'completed'
            };
            setLastCompletedOrder(completedOrder);
            setTicketModalOpen(true);

            addNotification({ title: 'Venta Exitosa', body: `Ticket #${orderId} registrado.`, type: 'success' });

            // 3. Limpiar carrito y cerrar modal de pago sin recargar página
            setCart([]);
            setCheckoutModalOpen(false);
        } catch (error: any) {
            const msg = error.message || 'No se pudo procesar la venta.';
            const isConcurrencyIssue = msg.toLowerCase().includes('stock insuficiente') || 
                                       msg.toLowerCase().includes('concurrencia') || 
                                       msg.toLowerCase().includes('cambió durante la venta');

            if (isConcurrencyIssue) {
                // Auto-recuperación: sincronizar stock real del servidor sin perder la orden en curso ni recargar pantalla
                refreshStoreData().catch(console.error);
                addNotification({ 
                    title: 'Conflicto de Stock Concurrente', 
                    body: `${msg} Se han actualizado las existencias en pantalla automáticamente. Revisa las cantidades en el carrito.`, 
                    type: 'warning' 
                });
            } else {
                addNotification({ 
                    title: 'Error en la venta', 
                    body: msg, 
                    type: 'warning' 
                });
            }
        }
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
            addCustomItemToCart,
            ticketModalOpen, setTicketModalOpen,
            lastCompletedOrder, setLastCompletedOrder
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
