
import React, { createContext, useContext, useEffect, ReactNode, useRef, useState, useCallback } from 'react';
import { StoreContextType, Order, Product, Category, Branch, Coupon, ActivityLog } from '../types';
import { api } from '../services/api';

import { SettingsProvider, useSettings } from './SettingsContext';
import { AuthProvider, useAuth } from './AuthContext';
import { ProductProvider, useProduct } from './ProductContext';
import { CartProvider, useCart } from './CartContext';

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const OFFLINE_DATA_KEY = 'lyberate_api_offline_cache';

const INITIAL_CATEGORIES: Category[] = [
    { id: 'c1', name: 'General', image: '' }
];

// Componente Sincronizador
const DataSynchronizer = ({ children }: { children?: ReactNode }) => {
    // FIX: Capturar todo el contexto para evitar errores de acceso a propiedades indefinidas
    const settingsContext = useSettings();
    const { setSettings, setLoading, setIsOffline, settings } = settingsContext;

    const { setProducts, setCategories } = useProduct();
    const { setOrders, setCustomers, setCoupons } = useCart();
    const { currentUser, userRole } = useAuth(); // Need current user to restrict branch switching

    // Estados Multi-Sede
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

    const hasInitialLoad = useRef(false);
    const hasEnforcedBranch = useRef(false); // FIX SEGURIDAD: flag anti-bucle

    // --- GESTIÓN DE SEDES ---
    const switchBranch = async (branchId: number) => {
        // SEGURIDAD: Si el usuario tiene sede asignada y no es admin, no permitir cambio
        if (currentUser && userRole !== 'admin' && currentUser.assignedBranchId && currentUser.assignedBranchId > 0) {
            if (branchId !== currentUser.assignedBranchId) {
                console.warn("Intento de cambio de sede no autorizado.");
                return;
            }
        }

        // 1. Guardar localmente
        localStorage.setItem('lyberate_branch_id', branchId.toString());

        // 2. Actualizar estado visual inmediato (si ya tenemos la lista)
        // Nota: Permitir branchId=0 si es admin
        let target = branches.find(b => b.id === branchId);
        if (!target && branchId === 0) {
            target = { id: 0, name: 'Vista Global', isActive: true, address: 'Todas las Sedes' };
        }

        setCurrentBranch(target || branches[0]);

        // 3. RECARGAR DATOS (Esto disparará fetchApi con el nuevo header)
        setLoading(true);
        try {
            await refreshStoreData();
        } finally {
            setLoading(false);
        }
    };

    const saveBranch = async (branch: Partial<Branch>) => {
        try {
            await api.saveBranch(branch);
            await refreshStoreData(); // Recargar para obtener IDs o estados actualizados
        } catch (e) {
            console.error("Error saving branch", e);
            throw e;
        }
    };

    const deleteBranch = async (id: number) => {
        try {
            await api.deleteBranch(id);
            // Si la sede actual es la que se borró, cambiar a la principal
            if (currentBranch && currentBranch.id === id) {
                switchBranch(1);
            } else {
                await refreshStoreData();
            }
        } catch (e) {
            console.error("Error deleting branch", e);
            throw e;
        }
    };

    // --- NUEVAS FUNCIONES DE LOGÍSTICA ---
    const getStockBreakdown = async (productId: string) => {
        try {
            return await api.getStockBreakdown(productId);
        } catch (e) {
            console.error("Breakdown error", e);
            return [];
        }
    };

    const transferStock = async (productId: string, toBranchId: number, amount: number, variantSku?: string, variantName?: string) => {
        if (!currentUser) return;
        const currentBid = currentBranch?.id || 1;
        if (currentBid <= 0) throw new Error("No se puede transferir desde Vista Global.");

        await api.transferStock(productId, currentBid, toBranchId, amount, currentUser.id, currentUser.name, variantSku, variantName);
        await refreshStoreData(); // Recargar para actualizar stocks locales
    };

    const processSettings = (settingsData: any) => {
        if (!settingsData || Object.keys(settingsData).length === 0) return;
        setSettings({ ...settings, ...settingsData });
    };

    const processHeavyData = async (data: any) => {
        // 0. Procesar Sedes (Recibidas del backend)
        let incomingBranches = data.branches || [];

        // FALLBACK: Si no hay sedes en BD (inicio limpio), creamos la Principal virtualmente
        if (incomingBranches.length === 0) {
            incomingBranches = [{ id: 1, name: 'Sede Principal', address: 'Matriz', isActive: true }];
        }

        setBranches(incomingBranches);

        // Determinar ID activo
        let savedId = parseInt(localStorage.getItem('lyberate_branch_id') || '1');

        // RESTRICCIÓN DE USUARIO: Si tiene sede asignada, FORZARLA.
        if (currentUser && userRole !== 'admin' && currentUser.assignedBranchId && currentUser.assignedBranchId > 0) {
            savedId = currentUser.assignedBranchId;
            localStorage.setItem('lyberate_branch_id', savedId.toString());
        }

        // Validar que el ID guardado existe, si no, usar el primero (Principal). 
        // Excepción: 0 (Global) es válido si es admin.
        let active = incomingBranches.find((b: Branch) => b.id === savedId);

        if (!active && savedId === 0 && userRole === 'admin') {
            active = { id: 0, name: 'Vista Global', isActive: true, address: 'Todas las Sedes' };
        } else if (!active) {
            active = incomingBranches[0];
            savedId = active.id;
        }

        // Si cambió el ID (ej: el guardado no existe o forzado por usuario), actualizar localStorage
        if (active.id !== savedId) {
            localStorage.setItem('lyberate_branch_id', active.id.toString());
        }

        setCurrentBranch(active);

        // 1. Categorías
        const rawCategories = data.categories || INITIAL_CATEGORIES;
        const uniqueCategories = new Map<string, Category>();
        rawCategories.forEach((cat: Category) => {
            if (!cat.name) return;
            const key = cat.name.trim().toLowerCase();
            uniqueCategories.set(key, cat);
        });
        setCategories(Array.from(uniqueCategories.values()).map(c => ({
            ...c, name: c.name.charAt(0).toUpperCase() + c.name.slice(1)
        })));

        // 2. Productos
        setProducts(data.products || []);

        // 3. Órdenes
        const normalizeOrders = (rawOrders: any[]) => {
            return rawOrders.map((o: any) => {
                let parsedItems = [];
                try {
                    if (Array.isArray(o.items)) parsedItems = o.items;
                    else if (typeof o.items === 'string') {
                        parsedItems = JSON.parse(o.items.replace(/\\"/g, '"').replace(/^"|"$/g, ''));
                        if (typeof parsedItems === 'string') parsedItems = JSON.parse(parsedItems);
                    }
                } catch (e) { parsedItems = []; }

                return {
                    id: o.id,
                    branchId: parseInt(o.branchId || o.branch_id || '1'),
                    date: Number(o.date || o.created_at || Date.now()),
                    status: o.status || 'pending',
                    total: Number(o.total || o.order_total || 0),
                    customerName: o.customerName || o.customer_name || 'Cliente',
                    customerPhone: o.customerPhone || o.customer_phone || '',
                    customerAddress: o.customerAddress || o.customer_address || '',
                    paymentMethod: o.paymentMethod || o.payment_method || 'Por Definir',
                    sellerId: o.sellerId || o.seller_id || 'web-client',
                    sellerName: o.sellerName || o.seller_name || 'Tienda',
                    deliveryMethod: o.deliveryMethod || o.delivery_method,
                    pickupBranchId: parseInt(o.pickupBranchId || o.pickup_branch_id || '0'),
                    stockDeducted: Boolean(o.stockDeducted || o.stock_deducted),
                    items: Array.isArray(parsedItems) ? parsedItems : []
                };
            }).sort((a: Order, b: Order) => b.date - a.date);
        };

        const normalizeCoupons = (rawCoupons: any[]): Coupon[] => {
            return (rawCoupons || []).map(c => ({
                code: String(c.code || '').toUpperCase().trim(),
                discountType: (c.discountType === 'fixed' || c.discount_type === 'fixed') ? 'fixed' : 'percentage',
                value: Number(c.value) || 0,
                active: c.active !== undefined ? Boolean(c.active) : true
            }));
        };

        setOrders(normalizeOrders(data.orders || []));
        setCustomers(data.customers || []);
        setCoupons(normalizeCoupons(data.coupons || []));
    };

    // --- GESTIÓN DE LOGS CENTRALIZADA (SQL BACKEND) ---
    const [logs, setLogs] = useState<ActivityLog[]>([]);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.getLogs(1, 100);
            if (res && Array.isArray(res.data)) {
                setLogs(res.data);
            }
        } catch (e) {
            console.error("Error al obtener logs de auditoría:", e);
        }
    }, []);

    const clearLogs = useCallback(async () => {
        try {
            await api.clearLogs();
            setLogs([]);
        } catch (e) {
            console.error("Error al vaciar logs:", e);
        }
    }, []);

    const refreshStoreData = async () => {
        try {
            const freshData = await api.getAllData();
            if (freshData) {
                processSettings(freshData.settings);
                await processHeavyData(freshData);
                localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(freshData));
                setIsOffline(false);
            }
            // Si el usuario es staff/admin, sincronizar también registros de auditoría
            if (currentUser && (userRole === 'admin' || userRole === 'seller')) {
                fetchLogs();
            }
        } catch (e) {
            console.error("Refresh failed", e);
            setIsOffline(true);
        }
    };

    useEffect(() => {
        const initStore = async () => {
            setLoading(true);
            try {
                // Cache First Strategy
                const cachedData = localStorage.getItem(OFFLINE_DATA_KEY);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    processSettings(parsed.settings);
                }
                await refreshStoreData();
                hasInitialLoad.current = true;
            } finally {
                setTimeout(() => setLoading(false), 200);
            }
        };
        initStore();
    }, []);

    // Sincronizar datos completos de staff inmediatamente tras detectar autenticación
    const hasSyncedStaff = useRef(false);
    useEffect(() => {
        if (currentUser && !hasSyncedStaff.current) {
            hasSyncedStaff.current = true;
            refreshStoreData();
        } else if (!currentUser) {
            hasSyncedStaff.current = false;
        }
    }, [currentUser]);

    // Re-check user restrictions on mount or user change
    // FIX SEGURIDAD: Solo ejecutar UNA VEZ para evitar re-disparar refreshStoreData() en bucle.
    // El problema era: currentUser cambia → switchBranch() → refreshStoreData() → re-render → repeat.
    // FIX BUG: Se resetea el flag al hacer logout (currentUser = null) para que funcione
    // correctamente si el mismo usuario cierra sesión e inicia sesión con una cuenta diferente.
    useEffect(() => {
        if (!currentUser) {
            // Logout: resetear el flag para que el próximo login aplique la restricción correctamente
            hasEnforcedBranch.current = false;
            return;
        }
        if (hasEnforcedBranch.current) return;
        if (currentUser.assignedBranchId && currentUser.assignedBranchId > 0) {
            const currentId = parseInt(localStorage.getItem('lyberate_branch_id') || '0');
            if (currentId !== currentUser.assignedBranchId) {
                console.log("Enforcing branch restriction for user (once)...");
                hasEnforcedBranch.current = true;
                switchBranch(currentUser.assignedBranchId);
            } else {
                hasEnforcedBranch.current = true; // Ya está en la sede correcta, marcar como resuelto
            }
        }
    }, [currentUser]);


    // Exponer todo el contexto combinado
    return (
        <StoreContext.Provider value={{
            // Settings (Usando el contexto completo, no el objeto settings destructurado)
            loading: settingsContext.loading,
            isOffline: settingsContext.isOffline,
            settings: settings, // Aquí pasamos el objeto settings real
            exchangeRate: settingsContext.exchangeRate,
            exchangeRateParalelo: settingsContext.exchangeRateParalelo,
            exchangeRateEuro: settingsContext.exchangeRateEuro,
            activeExchangeRate: settingsContext.activeExchangeRate,
            activeCurrencySymbol: settingsContext.activeCurrencySymbol,
            updateSettings: settingsContext.updateSettings,
            localDarkMode: settingsContext.localDarkMode,
            toggleLocalDarkMode: settingsContext.toggleLocalDarkMode,

            // Branches (NUEVO)
            branches,
            currentBranch,
            switchBranch,
            saveBranch,
            deleteBranch,

            // Auth (Proxy)
            // @ts-ignore
            userRole: useAuth().userRole,
            // @ts-ignore
            currentUser: useAuth().currentUser,
            login: useAuth().login,
            logout: useAuth().logout,
            addUser: useAuth().addUser,
            updateUser: useAuth().updateUser,
            deleteUser: useAuth().deleteUser,
            logs,
            clearLogs,

            // Product (Proxy)
            // @ts-ignore
            products: useProduct().products,
            // @ts-ignore
            categories: useProduct().categories,
            addProduct: useProduct().addProduct,
            updateProduct: useProduct().updateProduct,
            updateMultipleProducts: useProduct().updateMultipleProducts,
            deleteProduct: useProduct().deleteProduct,
            addCategory: useProduct().addCategory,
            updateCategory: useProduct().updateCategory,
            deleteCategory: useProduct().deleteCategory,
            getProductHistory: useProduct().getProductHistory,
            adjustStock: useProduct().adjustStock,
            transferStock, // NUEVO
            getStockBreakdown, // NUEVO

            // Cart (Proxy)
            // @ts-ignore
            cart: useCart().cart,
            orders: useCart().orders,
            customers: useCart().customers,
            coupons: useCart().coupons,
            wishlist: useCart().wishlist,
            addToCart: useCart().addToCart,
            removeFromCart: useCart().removeFromCart,
            updateCartQuantity: useCart().updateCartQuantity,
            clearCart: useCart().clearCart,
            createOrder: useCart().createOrder,
            updateOrder: useCart().updateOrder,
            deleteOrder: useCart().deleteOrder,
            updateCustomer: useCart().updateCustomer,
            deleteCustomer: useCart().deleteCustomer,
            addCoupon: useCart().addCoupon,
            toggleCoupon: useCart().toggleCoupon,
            deleteCoupon: useCart().deleteCoupon,
            toggleWishlist: useCart().toggleWishlist,
            isCartOpen: useCart().isCartOpen,
            setIsCartOpen: useCart().setIsCartOpen,
            isSearchOpen: useCart().isSearchOpen,
            setIsSearchOpen: useCart().setIsSearchOpen,

            resetStore: async (opts) => { await api.resetDatabase(opts); refreshStoreData(); },
            refreshStoreData
        }}>
            {children}
        </StoreContext.Provider>
    );
};

const CombinedStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <SettingsProvider>
            <AuthProvider>
                <ProductProvider>
                    <CartProvider>
                        <DataSynchronizer>
                            {children}
                        </DataSynchronizer>
                    </CartProvider>
                </ProductProvider>
            </AuthProvider>
        </SettingsProvider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error("useStore must be used within StoreProvider");
    return context;
};

export const StoreProvider = CombinedStoreProvider;
