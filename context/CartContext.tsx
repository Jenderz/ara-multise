
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Order, Customer, Coupon, Product } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { DEFAULT_IMAGE } from '../config';

interface CartContextType {
    cart: CartItem[];
    orders: Order[];
    setOrders: (o: Order[]) => void;
    customers: Customer[];
    setCustomers: (c: Customer[]) => void;
    coupons: Coupon[];
    setCoupons: (c: Coupon[]) => void;
    wishlist: string[];
    setWishlist: (w: string[]) => void;

    addToCart: (product: Product, selectedOptions: Record<string, string>, quantity: number) => void;
    removeFromCart: (cartId: string) => void;
    updateCartQuantity: (cartId: string, delta: number) => void;
    clearCart: () => void;

    createOrder: (customerName: string, customerPhone: string, customerAddress: string, items?: CartItem[], total?: number, paymentMethod?: string, status?: 'pending' | 'completed' | 'cancelled', discount?: number, deliveryMethod?: 'delivery' | 'pickup' | 'pos', pickupBranchId?: number, sellerId?: string, sellerName?: string, sellerCommission?: number, commissionRate?: number) => Promise<string>;
    updateOrder: (order: Order, processStock?: boolean) => Promise<void>;
    deleteOrder: (id: string) => void;

    updateCustomer: (customer: Customer) => Promise<void>;
    deleteCustomer: (phone: string) => void;

    addCoupon: (coupon: Coupon) => void;
    toggleCoupon: (code: string) => void;
    deleteCoupon: (code: string) => void;

    toggleWishlist: (productId: string) => void;

    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const OFFLINE_DATA_KEY = 'lyberate_api_offline_cache';

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser, logActivity } = useAuth();

    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem('lyberate_cart');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [wishlist, setWishlist] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('lyberate_wishlist');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => localStorage.setItem('lyberate_cart', JSON.stringify(cart)), [cart]);
    useEffect(() => localStorage.setItem('lyberate_wishlist', JSON.stringify(wishlist)), [wishlist]);

    const updateLocalCache = (key: 'orders' | 'customers', data: any[]) => {
        try {
            const cache = localStorage.getItem(OFFLINE_DATA_KEY);
            if (cache) {
                const parsed = JSON.parse(cache);
                parsed[key] = data;
                localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(parsed));
            }
        } catch (e) { console.warn("Cache update failed", e); }
    };

    const addToCart = (product: Product, selectedOptions: Record<string, string>, quantity: number) => {
        const matchingVariant = product.variants.find(v =>
            Object.entries(selectedOptions).every(([k, val]) => v.selections[k] === val)
        );
        const finalPrice = matchingVariant ? matchingVariant.price : (product.salePrice && product.salePrice > 0 ? product.salePrice : product.price);
        const cartId = `${product.id}-${JSON.stringify(selectedOptions)}`;
        const itemImage = matchingVariant?.image || product.images[0] || DEFAULT_IMAGE;

        setCart(prev => {
            const existing = prev.find(item => item.cartId === cartId);
            if (existing) {
                return prev.map(item => item.cartId === cartId ? { ...item, quantity: item.quantity + quantity } : item);
            }
            return [...prev, {
                cartId, productId: product.id, productTitle: product.title,
                variantSku: matchingVariant?.sku || product.code,
                variantId: matchingVariant?.id,
                price: finalPrice, image: itemImage, selectedOptions, quantity
            }];
        });
        setIsCartOpen(true);
    };

    const removeFromCart = (cartId: string) => setCart(prev => prev.filter(item => item.cartId !== cartId));
    const updateCartQuantity = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
    };
    const clearCart = () => setCart([]);
    const toggleWishlist = (productId: string) => setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);

    const createOrder = async (
        customerName: string,
        customerPhone: string,
        customerAddress: string,
        items?: CartItem[],
        total?: number,
        paymentMethod?: string,
        status: 'pending' | 'completed' | 'cancelled' = 'pending',
        discount?: number,
        deliveryMethod?: 'delivery' | 'pickup' | 'pos',
        pickupBranchId?: number,
        sellerId?: string,
        sellerName?: string,
        sellerCommission?: number,
        commissionRate?: number
    ): Promise<string> => {
        const finalItems = items && items.length > 0 ? items : [...cart];

        // Calcular subtotal real (usando originalPrice si hubo descuento individual en el item)
        const subtotalCalc = finalItems.reduce((sum, item) => sum + ((item.originalPrice !== undefined && item.originalPrice > item.price ? item.originalPrice : item.price) * (item.quantity || 1)), 0);
        
        let orderTotal: number;
        let orderDiscount: number;

        if (total !== undefined && discount !== undefined) {
            orderTotal = total;
            orderDiscount = discount;
        } else if (total !== undefined) {
            orderTotal = total;
            orderDiscount = Math.max(0, subtotalCalc - orderTotal);
        } else if (discount !== undefined) {
            orderDiscount = discount;
            orderTotal = Math.max(0, subtotalCalc - orderDiscount);
        } else {
            orderTotal = subtotalCalc;
            orderDiscount = 0;
        }

        const activeSellerId = sellerId || (currentUser ? currentUser.id : 'web-client');
        const activeSellerName = sellerName || (currentUser ? currentUser.name : 'Tienda Online');
        
        // Calcular comisiones si no fueron enviadas explícitamente
        let finalRate = commissionRate;
        if (finalRate === undefined) {
            const foundUser = (settings?.users || []).find((u: any) => u.id === activeSellerId);
            const foundAdvisor = (settings?.salesAdvisors || []).find((a: any) => a.id === activeSellerId);
            finalRate = foundUser?.commissionRate ?? foundAdvisor?.commissionRate ?? 0;
        }

        let finalCommission = sellerCommission;
        if (finalCommission === undefined) {
            finalCommission = finalRate > 0 ? (orderTotal * (finalRate / 100)) : 0;
        }

        const finalPaymentMethod = paymentMethod || 'Por Definir';

        // Lógica de Sede:
        // - Si es Pickup, usamos la sede seleccionada.
        // - Si es Delivery (o no definido), usamos 0 (Global) para que aparezca en todas las sedes con permisos.
        // - Si es un pedido creado desde el POS (sin deliveryMethod explícito), mantiene el comportamiento actual (localStorage).
        let activeBranchId = parseInt(localStorage.getItem('lyberate_branch_id') || '1');

        if ((deliveryMethod === 'pickup' || deliveryMethod === 'pos') && pickupBranchId) {
            activeBranchId = pickupBranchId;
        } else if (deliveryMethod === 'delivery') {
            activeBranchId = 0; // Global
        }

        const newOrder: Order = {
            id: Math.random().toString(36).substr(2, 9).toUpperCase(),
            branchId: activeBranchId,
            customerName, customerPhone, customerAddress,
            items: finalItems,
            subtotal: subtotalCalc,
            discount: orderDiscount,
            total: orderTotal,
            status: status,
            date: Date.now(),
            paymentMethod: finalPaymentMethod,
            sellerId: activeSellerId,
            sellerName: activeSellerName,
            sellerCommission: finalCommission,
            commissionRate: finalRate,
            deliveryMethod,
            pickupBranchId
        };

        setOrders(prev => {
            const newState = [newOrder, ...prev];
            updateLocalCache('orders', newState);
            return newState;
        });

        try {
            logActivity('sale', `Creó pedido #${newOrder.id} ($${orderTotal.toFixed(2)})`);
        } catch (e) { }

        // Await order persistence to ensure data reaches server before any potential reload
        await api.saveOrder(newOrder, true);

        const safePhone = customerPhone.replace(/\s/g, '').trim();
        setCustomers(prev => {
            const existingIndex = prev.findIndex(c => c.phone.replace(/\s/g, '') === safePhone);
            let newState: Customer[];
            if (existingIndex >= 0) {
                const existing = prev[existingIndex];
                const updatedCustomer = { ...existing, name: customerName, address: customerAddress, totalSpent: (Number(existing.totalSpent) || 0) + orderTotal, orderCount: (Number(existing.orderCount) || 0) + 1, lastOrderDate: newOrder.date, orderIds: [newOrder.id, ...(existing.orderIds || [])] };
                newState = [...prev];
                newState[existingIndex] = updatedCustomer;
                api.saveCustomer(updatedCustomer).catch(console.error);
            } else {
                const newCustomer = { phone: customerPhone, name: customerName, address: customerAddress, totalSpent: orderTotal, orderCount: 1, lastOrderDate: newOrder.date, orderIds: [newOrder.id] };
                api.saveCustomer(newCustomer).catch(console.error);
                newState = [newCustomer, ...prev];
            }
            updateLocalCache('customers', newState);
            return newState;
        });
        return newOrder.id;
    };

    const updateOrder = async (updatedOrder: Order, processStock = false): Promise<void> => {
        // --- AUDITORÍA DE CAMBIOS ---
        const oldOrder = orders.find(o => o.id === updatedOrder.id);
        if (oldOrder) {
            const changes: string[] = [];

            // Detectar cambios clave
            if (oldOrder.status !== updatedOrder.status) {
                changes.push(`Estado: ${oldOrder.status} -> ${updatedOrder.status}`);
            }
            if (oldOrder.total !== updatedOrder.total) {
                changes.push(`Total: $${oldOrder.total} -> $${updatedOrder.total}`);
            }
            if (oldOrder.paymentMethod !== updatedOrder.paymentMethod) {
                changes.push(`Pago: ${oldOrder.paymentMethod} -> ${updatedOrder.paymentMethod}`);
            }
            if (JSON.stringify(oldOrder.items) !== JSON.stringify(updatedOrder.items)) {
                changes.push(`Items modificados (${updatedOrder.items.length} items)`);
            }

            const details = changes.length > 0 ? changes.join('. ') : 'Actualización general de datos';
            try {
                logActivity('other', `Editó Pedido #${updatedOrder.id.slice(0, 8)}. ${details}`);
            } catch (e) { }
        }

        setOrders(prev => {
            const newState = prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
            updateLocalCache('orders', newState);
            return newState;
        });
        await api.saveOrder(updatedOrder, processStock);
    };

    const deleteOrder = (id: string) => {
        // --- AUDITORÍA DE ELIMINACIÓN ---
        try {
            logActivity('other', `Eliminó Pedido #${id.slice(0, 8)}`);
        } catch (e) { }

        setOrders(prev => {
            const newState = prev.filter(o => o.id !== id);
            updateLocalCache('orders', newState);
            return newState;
        });
        api.deleteOrder(id).catch(console.error);
    };

    const updateCustomer = async (customer: Customer) => {
        setCustomers(prev => {
            const exists = prev.some(c => c.phone === customer.phone);
            let newState: Customer[];
            if (exists) {
                newState = prev.map(c => c.phone === customer.phone ? customer : c);
            } else {
                newState = [customer, ...prev];
            }
            updateLocalCache('customers', newState);
            return newState;
        });
        try {
            logActivity('other', `Actualizó datos del cliente: ${customer.name}`);
        } catch (e) { }
        await api.saveCustomer(customer);
    };

    const deleteCustomer = (phone: string) => {
        setCustomers(prev => {
            const newState = prev.filter(c => c.phone !== phone);
            updateLocalCache('customers', newState);
            return newState;
        });
        api.deleteCustomer(phone).catch(console.error);
    };

    const addCoupon = (coupon: Coupon) => {
        const cleanCoupon: Coupon = {
            code: coupon.code.toUpperCase().replace(/\s/g, ''),
            discountType: coupon.discountType || 'percentage',
            value: Number(coupon.value) || 0,
            active: coupon.active !== undefined ? Boolean(coupon.active) : true
        };
        setCoupons(prev => [...prev.filter(c => c.code !== cleanCoupon.code), cleanCoupon]);
        api.saveCoupon(cleanCoupon).catch(console.error);
    };
    const toggleCoupon = (code: string) => {
        setCoupons(prev => prev.map(c => {
            if (c.code === code) {
                const updated = { ...c, active: !c.active };
                api.saveCoupon(updated).catch(console.error);
                return updated;
            }
            return c;
        }));
    };
    const deleteCoupon = (code: string) => {
        setCoupons(prev => prev.filter(c => c.code !== code));
        api.deleteCoupon(code).catch(console.error);
    };

    return (
        <CartContext.Provider value={{
            cart, orders, setOrders, customers, setCustomers, coupons, setCoupons, wishlist, setWishlist,
            addToCart, removeFromCart, updateCartQuantity, clearCart,
            createOrder, updateOrder, deleteOrder, updateCustomer, deleteCustomer,
            addCoupon, toggleCoupon, deleteCoupon, toggleWishlist,
            isCartOpen, setIsCartOpen, isSearchOpen, setIsSearchOpen
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart must be used within CartProvider");
    return context;
};
