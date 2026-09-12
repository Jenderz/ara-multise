import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { DEFAULT_IMAGE } from '../../config';
import {
    DollarSign, Clock, AlertTriangle, Landmark, TrendingUp, TrendingDown,
    ShoppingBag, Store, ArrowUpRight, CheckCircle2, ChevronRight, Zap,
    Package, Sparkles, Filter, RefreshCw, Layers, ShieldCheck, ArrowRight,
    Smartphone, Globe, BarChart3, HelpCircle, User, CreditCard, ExternalLink
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell
} from 'recharts';

interface DashboardModuleProps {
    orders?: any[];
    products?: any[];
    customers?: any[];
    setActiveTab?: (tab: any) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
    orders = [],
    products = [],
    customers = [],
    setActiveTab
}) => {
    const {
        exchangeRate,
        exchangeRateParalelo,
        exchangeRateEuro,
        activeCurrencySymbol,
        userRole,
        currentUser,
        currentBranch,
        settings,
        refreshStoreData
    } = useStore();

    // Rango de tiempo: 'today' | '7d' | '30d'
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
    
    // Métrica en la gráfica principal: 'revenue' | 'orders'
    const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');

    // Filtro de órdenes recientes: 'all' | 'pending' | 'completed'
    const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'completed'>('all');

    // Pestaña del panel lateral de productos: 'restock' | 'top_sellers'
    const [productTab, setProductTab] = useState<'restock' | 'top_sellers'>('restock');

    const [isRefreshing, setIsRefreshing] = useState(false);

    // Color primario configurado en la tienda
    const primaryColor = settings?.primaryColor || '#007AFF';

    // Saludo según la hora del día
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    }, []);

    // Manual Refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshStoreData();
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // =========================================================================
    // CÁLCULO DE MÉTRICAS Y DATOS DEL DASHBOARD
    // =========================================================================
    const dashboardData = useMemo(() => {
        const now = new Date();
        const nowMs = now.getTime();

        // 1. Filtrar órdenes por Rol/Permisos
        let relevantOrders = userRole === 'admin'
            ? orders
            : orders.filter((o: any) => {
                const canViewWeb = currentUser?.permissions?.includes('view_web_orders');
                const isWebOrder = o.sellerId === 'web-client' || !o.sellerId || o.sellerId === 'online';
                const isOwnOrder = o.sellerId === currentUser?.id;
                return isOwnOrder || (isWebOrder && canViewWeb);
            });

        // 2. Filtrar por Sede Activa (Multi-sede)
        if (currentBranch && currentBranch.id > 0) {
            relevantOrders = relevantOrders.filter((o: any) => Number(o.branchId || 1) === Number(currentBranch.id));
        }

        // Helper para normalizar timestamps
        const getOrderDateMs = (o: any) => {
            const raw = Number(o.date || o.created_at || 0);
            return raw < 100000000000 ? raw * 1000 : raw;
        };

        // 3. Delimitar rangos temporales
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let periodStart = todayStart;
        let prevPeriodStart = todayStart - 86400000;
        let prevPeriodEnd = todayStart;

        if (timeRange === '7d') {
            periodStart = nowMs - (7 * 86400000);
            prevPeriodStart = nowMs - (14 * 86400000);
            prevPeriodEnd = periodStart;
        } else if (timeRange === '30d') {
            periodStart = nowMs - (30 * 86400000);
            prevPeriodStart = nowMs - (60 * 86400000);
            prevPeriodEnd = periodStart;
        }

        // Órdenes en el período actual y anterior (solo completadas para ingresos)
        const periodCompletedOrders = relevantOrders.filter((o: any) => {
            const d = getOrderDateMs(o);
            return d >= periodStart && o.status === 'completed';
        });

        const prevPeriodCompletedOrders = relevantOrders.filter((o: any) => {
            const d = getOrderDateMs(o);
            return d >= prevPeriodStart && d < prevPeriodEnd && o.status === 'completed';
        });

        // Ingresos
        const periodRevenue = periodCompletedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        const prevPeriodRevenue = prevPeriodCompletedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        const revenueGrowth = prevPeriodRevenue > 0
            ? ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100
            : (periodRevenue > 0 ? 100 : 0);

        // Volumen de órdenes
        const periodOrdersCount = periodCompletedOrders.length;
        const prevPeriodOrdersCount = prevPeriodCompletedOrders.length;
        const ordersGrowth = prevPeriodOrdersCount > 0
            ? ((periodOrdersCount - prevPeriodOrdersCount) / prevPeriodOrdersCount) * 100
            : (periodOrdersCount > 0 ? 100 : 0);

        // Desglose por canal (POS vs Tienda Web)
        const posOrders = periodCompletedOrders.filter((o: any) => o.deliveryMethod === 'pos' || o.channel === 'pos');
        const posRevenue = posOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        const webOrdersCount = periodOrdersCount - posOrders.length;
        const webRevenue = Math.max(0, periodRevenue - posRevenue);

        // Ticket Promedio
        const avgTicket = periodOrdersCount > 0 ? periodRevenue / periodOrdersCount : 0;

        // Órdenes Pendientes de Despacho
        const pendingOrders = relevantOrders.filter((o: any) => o.status === 'pending');

        // Inventario y Salud de Stock
        const lowStockProducts = products.filter((p: any) => {
            if (p.trackStock === false) return false;
            const min = Number(p.minStock || 5);
            const currentStock = Number(p.stock || 0);
            return currentStock > 0 && currentStock < min;
        });

        const outOfStockProducts = products.filter((p: any) => {
            if (p.trackStock === false) return false;
            return Number(p.stock || 0) <= 0;
        });

        const totalCatalogProducts = products.length;
        const healthyProductsCount = Math.max(0, totalCatalogProducts - (lowStockProducts.length + outOfStockProducts.length));
        const stockHealthRatio = totalCatalogProducts > 0 ? Math.round((healthyProductsCount / totalCatalogProducts) * 100) : 100;

        const totalInventoryValue = products.reduce((sum: number, p: any) => {
            const qty = Math.max(0, Number(p.stock || 0));
            const price = Number(p.salePrice && p.salePrice > 0 ? p.salePrice : p.price || 0);
            return sum + (qty * price);
        }, 0);

        // Brecha cambiaria BCV vs Paralelo
        const exchangeGap = exchangeRate > 0 ? ((exchangeRateParalelo - exchangeRate) / exchangeRate) * 100 : 0;

        // 4. GENERACIÓN DE PUNTOS PARA LA GRÁFICA TEMPORAL (Recharts)
        let chartData: Array<{ label: string; revenue: number; orders: number }> = [];

        if (timeRange === 'today') {
            // Franjas horarias de 2 horas (08:00 a 22:00)
            const slots = [
                { start: 8, end: 10, label: '08:00' },
                { start: 10, end: 12, label: '10:00' },
                { start: 12, end: 14, label: '12:00' },
                { start: 14, end: 16, label: '14:00' },
                { start: 16, end: 18, label: '16:00' },
                { start: 18, end: 20, label: '18:00' },
                { start: 20, end: 22, label: '20:00' },
                { start: 22, end: 24, label: '22:00' },
            ];

            chartData = slots.map(slot => {
                const inSlot = periodCompletedOrders.filter((o: any) => {
                    const d = new Date(getOrderDateMs(o));
                    const h = d.getHours();
                    return h >= slot.start && h < slot.end;
                });
                const rev = inSlot.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
                return { label: slot.label, revenue: Math.round(rev * 100) / 100, orders: inSlot.length };
            });
        } else if (timeRange === '7d') {
            // 7 días retrospectivos
            for (let i = 6; i >= 0; i--) {
                const dayDate = new Date(nowMs - (i * 86400000));
                const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
                const dayEnd = dayStart + 86400000;
                const label = dayDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

                const inDay = relevantOrders.filter((o: any) => {
                    const d = getOrderDateMs(o);
                    return d >= dayStart && d < dayEnd && o.status === 'completed';
                });
                const rev = inDay.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
                chartData.push({ label, revenue: Math.round(rev * 100) / 100, orders: inDay.length });
            }
        } else {
            // 30 días agrupados en 6 intervalos de 5 días
            for (let i = 5; i >= 0; i--) {
                const endBlockMs = nowMs - (i * 5 * 86400000);
                const startBlockMs = endBlockMs - (5 * 86400000);
                const labelDate = new Date(endBlockMs);
                const label = `${labelDate.getDate()}/${labelDate.getMonth() + 1}`;

                const inBlock = relevantOrders.filter((o: any) => {
                    const d = getOrderDateMs(o);
                    return d >= startBlockMs && d < endBlockMs && o.status === 'completed';
                });
                const rev = inBlock.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
                chartData.push({ label, revenue: Math.round(rev * 100) / 100, orders: inBlock.length });
            }
        }

        // 5. PRODUCTOS MÁS VENDIDOS (Top Sellers)
        const productSalesMap = new Map<string, { product: any; units: number; revenue: number }>();

        periodCompletedOrders.forEach((o: any) => {
            let items: any[] = [];
            try {
                if (Array.isArray(o.items)) items = o.items;
                else if (typeof o.items === 'string') items = JSON.parse(o.items);
            } catch (e) {
                items = [];
            }

            items.forEach((item: any) => {
                const pid = String(item.productId || item.id || '');
                if (!pid) return;
                const existing = productSalesMap.get(pid);
                const q = Number(item.quantity || 1);
                const r = Number(item.price || 0) * q;

                if (existing) {
                    existing.units += q;
                    existing.revenue += r;
                } else {
                    const pObj = products.find((p: any) => String(p.id) === pid) || {
                        id: pid,
                        title: item.productTitle || item.title || 'Producto',
                        images: [item.image || DEFAULT_IMAGE],
                        code: item.variantSku || item.code || 'SKU'
                    };
                    productSalesMap.set(pid, { product: pObj, units: q, revenue: r });
                }
            });
        });

        const topSellersList = Array.from(productSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Órdenes Recientes Ordenadas
        const sortedRecentOrders = [...relevantOrders]
            .sort((a: any, b: any) => getOrderDateMs(b) - getOrderDateMs(a))
            .slice(0, 8);

        return {
            periodRevenue,
            revenueGrowth,
            periodOrdersCount,
            ordersGrowth,
            posRevenue,
            posCount: posOrders.length,
            webRevenue,
            webCount: webOrdersCount,
            avgTicket,
            pendingOrdersCount: pendingOrders.length,
            pendingOrders: pendingOrders.slice(0, 5),
            lowStockCount: lowStockProducts.length,
            outOfStockCount: outOfStockProducts.length,
            lowStockList: lowStockProducts.slice(0, 6),
            stockHealthRatio,
            totalInventoryValue,
            exchangeGap,
            chartData,
            topSellersList,
            recentOrders: sortedRecentOrders
        };
    }, [orders, products, exchangeRate, exchangeRateParalelo, userRole, currentUser, currentBranch, timeRange]);

    // Filtro de órdenes recientes
    const filteredRecentOrders = useMemo(() => {
        if (orderFilter === 'all') return dashboardData.recentOrders;
        return dashboardData.recentOrders.filter((o: any) => o.status === orderFilter);
    }, [dashboardData.recentOrders, orderFilter]);

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in max-w-7xl mx-auto">
            {/* =========================================================================
                1. HEADER EJECUTIVO CON MARCA, SALUDO Y ACCIONES RÁPIDAS
               ========================================================================= */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/10 shadow-sm p-6 sm:p-8 transition-all">
                {/* Iluminación de fondo sutil con el color primario configurado */}
                <div
                    className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none transition-all duration-700"
                    style={{ backgroundColor: primaryColor }}
                />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm"
                                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                            >
                                <Sparkles size={12} className="animate-pulse" />
                                {settings?.storeName || 'ARA Store'}
                            </span>

                            <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full flex items-center gap-1.5 ${
                                currentBranch?.id === 0
                                    ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            }`}>
                                <Store size={12} />
                                {currentBranch?.id === 0 ? 'Vista Global (Todas las Sedes)' : `Sede: ${currentBranch?.name}`}
                            </span>

                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                En línea
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                            {greeting}, {userRole === 'admin' ? 'Administrador' : (currentUser?.name || 'Vendedor')}
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Panel de operaciones y rendimiento comercial en tiempo real.
                        </p>
                    </div>

                    {/* Selector de Rango Temporal y Acciones */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        {/* Selector de Tiempo */}
                        <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl flex items-center gap-1 border border-gray-200/50 dark:border-white/5">
                            {(['today', '7d', '30d'] as const).map(period => (
                                <button
                                    key={period}
                                    onClick={() => setTimeRange(period)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                        timeRange === period
                                            ? 'bg-white dark:bg-zinc-800 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                    style={timeRange === period ? { color: primaryColor } : {}}
                                >
                                    {period === 'today' ? 'Hoy' : period === '7d' ? '7 Días' : '30 Días'}
                                </button>
                            ))}
                        </div>

                        {/* Botón Refrescar */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-white/5 transition-all active:scale-95"
                            title="Recargar datos de la tienda"
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-ios-blue' : ''} />
                        </button>

                        {/* Acceso Rápido POS */}
                        {setActiveTab && (
                            <button
                                onClick={() => setActiveTab('pos')}
                                className="px-4 py-2.5 rounded-2xl text-white text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 hover:brightness-110"
                                style={{
                                    backgroundColor: primaryColor,
                                    boxShadow: `0 8px 25px -4px ${primaryColor}40`
                                }}
                            >
                                <Zap size={15} />
                                Nueva Venta (POS)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* =========================================================================
                2. BENTO-GRID DE TARJETAS KPI EJECUTIVAS
               ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* TARJETA 1: FACTURACIÓN / INGRESOS */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                        >
                            <DollarSign size={22} />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full"
                            style={{
                                backgroundColor: dashboardData.revenueGrowth >= 0 ? '#10B98115' : '#EF444415',
                                color: dashboardData.revenueGrowth >= 0 ? '#059669' : '#DC2626'
                            }}
                        >
                            {dashboardData.revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {dashboardData.revenueGrowth >= 0 ? '+' : ''}{dashboardData.revenueGrowth.toFixed(1)}%
                        </div>
                    </div>

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Facturación ({timeRange === 'today' ? 'Hoy' : timeRange === '7d' ? '7 Días' : '30 Días'})
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">
                        {activeCurrencySymbol}{dashboardData.periodRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>

                    {/* Equivalencia en Bolívares */}
                    {exchangeRate > 0 && (
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                            ≈ Bs. {(dashboardData.periodRevenue * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}

                    {/* Canales POS vs Web */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <Smartphone size={12} style={{ color: primaryColor }} /> POS: {activeCurrencySymbol}{dashboardData.posRevenue.toFixed(0)} ({dashboardData.posCount})
                        </span>
                        <span className="flex items-center gap-1">
                            <Globe size={12} className="text-purple-500" /> Web: {activeCurrencySymbol}{dashboardData.webRevenue.toFixed(0)} ({dashboardData.webCount})
                        </span>
                    </div>
                </div>

                {/* TARJETA 2: PEDIDOS Y DESPACHO */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/30 text-orange-500 flex items-center justify-center transition-transform group-hover:scale-110">
                            <ShoppingBag size={22} />
                        </div>
                        {dashboardData.pendingOrdersCount > 0 ? (
                            <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                {dashboardData.pendingOrdersCount} Por Despachar
                            </span>
                        ) : (
                            <span className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Al Día
                            </span>
                        )}
                    </div>

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Órdenes Completadas</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">
                        {dashboardData.periodOrdersCount} <span className="text-sm font-medium text-gray-400">pedidos</span>
                    </h3>

                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Ticket Promedio: <span className="text-gray-900 dark:text-white">{activeCurrencySymbol}{dashboardData.avgTicket.toFixed(2)}</span>
                    </p>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-medium">Acción Requerida:</span>
                        <button
                            onClick={() => setActiveTab?.('orders')}
                            className="font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                        >
                            Ver Despacho <ArrowRight size={12} />
                        </button>
                    </div>
                </div>

                {/* TARJETA 3: MONITOR CAMBIARIO BCV / PARALELO */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Landmark size={22} />
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            dashboardData.exchangeGap > 10
                                ? 'bg-red-100 dark:bg-red-950/40 text-red-600'
                                : dashboardData.exchangeGap > 5
                                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700'
                                    : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700'
                        }`}>
                            Gap: {dashboardData.exchangeGap.toFixed(1)}%
                        </span>
                    </div>

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tasa Oficial BCV ($)</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            Bs. {exchangeRate.toFixed(2)}
                        </h3>
                        {exchangeRateEuro > 0 && (
                            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                € {exchangeRateEuro.toFixed(2)}
                            </span>
                        )}
                    </div>

                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Paralelo: <span className="font-extrabold text-gray-800 dark:text-gray-200">Bs. {exchangeRateParalelo.toFixed(2)}</span>
                    </p>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-medium">Margen Seguro:</span>
                        <span className={`font-bold ${dashboardData.exchangeGap > 10 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {dashboardData.exchangeGap > 10 ? 'Revisar Precios' : 'Óptimo'}
                        </span>
                    </div>
                </div>

                {/* TARJETA 4: SALUD DE INVENTARIO Y STOCK */}
                <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Package size={22} />
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            dashboardData.lowStockCount > 0 ? 'bg-red-100 dark:bg-red-950/40 text-red-600' : 'bg-green-100 dark:bg-green-950/40 text-green-700'
                        }`}>
                            {dashboardData.lowStockCount > 0 ? `${dashboardData.lowStockCount} Críticos` : 'Stock Sano'}
                        </span>
                    </div>

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Valoración de Stock</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">
                        {activeCurrencySymbol}{dashboardData.totalInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </h3>

                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                        Salud de Catálogo: <span className="font-extrabold text-purple-600 dark:text-purple-400">{dashboardData.stockHealthRatio}% disponible</span>
                    </p>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-medium">Agotados: {dashboardData.outOfStockCount}</span>
                        <button
                            onClick={() => setActiveTab?.('inventory')}
                            className="font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                            Ver Stock <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                3. GRÁFICA INTERACTIVA DE VENTAS Y VOLUMEN (Recharts)
               ========================================================================= */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-6 sm:p-8 shadow-sm transition-all">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                                {chartMetric === 'revenue' ? 'Evolución de Facturación' : 'Volumen de Órdenes'}
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Tendencia en el período seleccionado ({timeRange === 'today' ? 'Hoy' : timeRange === '7d' ? 'Últimos 7 Días' : 'Últimos 30 Días'})
                        </p>
                    </div>

                    {/* Alternador de Métrica */}
                    <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl flex items-center gap-1">
                        <button
                            onClick={() => setChartMetric('revenue')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                chartMetric === 'revenue'
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            style={chartMetric === 'revenue' ? { color: primaryColor } : {}}
                        >
                            Ingresos ({activeCurrencySymbol})
                        </button>
                        <button
                            onClick={() => setChartMetric('orders')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                chartMetric === 'orders'
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            style={chartMetric === 'orders' ? { color: primaryColor } : {}}
                        >
                            Cantidad (N)
                        </button>
                    </div>
                </div>

                {/* Contenedor del Gráfico */}
                <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="dashboardRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                stroke="#9CA3AF"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#9CA3AF"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => chartMetric === 'revenue' ? `${activeCurrencySymbol}${val}` : val}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 text-xs">
                                                <p className="font-bold text-gray-400 mb-1">{label}</p>
                                                <p className="font-black text-sm text-gray-900 dark:text-white">
                                                    Facturación: {activeCurrencySymbol}{d.revenue.toFixed(2)}
                                                </p>
                                                <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                                                    Pedidos: <span className="font-bold">{d.orders}</span>
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey={chartMetric === 'revenue' ? 'revenue' : 'orders'}
                                stroke={primaryColor}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#dashboardRevenueGrad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* =========================================================================
                4. CENTRO DE COMANDO OPERATIVO: PEDIDOS RECIENTES Y RADAR DE PRODUCTOS
               ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                {/* COLUMNA IZQUIERDA (7 COLS): ACTIVIDAD Y ÓRDENES RECIENTES */}
                <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-6 sm:p-8 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                Flujo de Pedidos Recientes
                            </h3>
                            <p className="text-xs text-gray-400">Últimas transacciones registradas</p>
                        </div>

                        {/* Filtro Rápido */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl text-xs font-bold">
                            {(['all', 'pending', 'completed'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setOrderFilter(f)}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        orderFilter === f
                                            ? 'bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-white'
                                            : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredRecentOrders.map((order: any) => {
                            const isPending = order.status === 'pending';
                            const isCompleted = order.status === 'completed';
                            const isPos = order.deliveryMethod === 'pos' || order.channel === 'pos';

                            return (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between p-3.5 bg-gray-50/70 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 shadow-xs hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                                            isPending
                                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600'
                                                : isCompleted
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600'
                                                    : 'bg-red-100 dark:bg-red-950/40 text-red-600'
                                        }`}>
                                            {isPending ? <Clock size={18} /> : isCompleted ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                    {order.customerName || 'Cliente'}
                                                </p>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                    isPos
                                                        ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                                        : 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                                                }`}>
                                                    {isPos ? 'POS' : 'Web'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                <span className="font-mono">#{String(order.id).slice(0, 8)}</span>
                                                <span>•</span>
                                                <span>{order.paymentMethod || 'Pago directo'}</span>
                                                <span>•</span>
                                                <span>{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 pl-3">
                                        <p className="font-black text-sm text-gray-900 dark:text-white">
                                            {activeCurrencySymbol}{Number(order.total || 0).toFixed(2)}
                                        </p>
                                        <span className={`text-[10px] font-bold ${
                                            isPending ? 'text-amber-500' : isCompleted ? 'text-emerald-500' : 'text-red-500'
                                        }`}>
                                            {isPending ? 'Pendiente' : isCompleted ? 'Entregado' : 'Cancelado'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredRecentOrders.length === 0 && (
                            <div className="py-12 text-center text-gray-400 space-y-2">
                                <ShoppingBag size={32} className="mx-auto opacity-40" />
                                <p className="text-xs font-bold">No hay órdenes con este filtro en el período actual.</p>
                            </div>
                        )}
                    </div>

                    {setActiveTab && (
                        <div className="pt-2">
                            <button
                                onClick={() => setActiveTab('orders')}
                                className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                Administrar Todos los Pedidos <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* COLUMNA DERECHA (5 COLS): RADAR DE PRODUCTOS (REPOSICIÓN Y TOP VENTAS) */}
                <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-6 sm:p-8 shadow-sm space-y-5">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                Radar de Productos
                            </h3>
                            <p className="text-xs text-gray-400">Control de inventario y ventas</p>
                        </div>

                        {/* Pestañas Radar */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl text-xs font-bold">
                            <button
                                onClick={() => setProductTab('restock')}
                                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                                    productTab === 'restock'
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-red-600 dark:text-red-400'
                                        : 'text-gray-400'
                                }`}
                            >
                                <AlertTriangle size={12} /> Reponer
                            </button>
                            <button
                                onClick={() => setProductTab('top_sellers')}
                                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                                    productTab === 'top_sellers'
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-yellow-600 dark:text-yellow-400'
                                        : 'text-gray-400'
                                }`}
                            >
                                <Sparkles size={12} /> Top
                            </button>
                        </div>
                    </div>

                    {/* VISTA 1: REPOSICIÓN URGENTE */}
                    {productTab === 'restock' && (
                        <div className="space-y-3">
                            {dashboardData.lowStockList.map((p: any) => {
                                const stock = Number(p.stock || 0);
                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center gap-3 p-3 bg-gray-50/70 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all"
                                    >
                                        <img
                                            src={p.images?.[0] || DEFAULT_IMAGE}
                                            alt={p.title}
                                            className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0"
                                            onError={(e) => { e.currentTarget.src = DEFAULT_IMAGE; }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                                                {p.title}
                                            </p>
                                            <p className="text-[10px] text-gray-400 uppercase font-mono mt-0.5">
                                                {p.code || 'SIN SKU'}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 px-3 py-1 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/30">
                                            <span className="font-black text-base text-red-600 dark:text-red-400 leading-none">
                                                {stock}
                                            </span>
                                            <span className="block text-[8px] font-bold text-red-400 uppercase">
                                                Quedan
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {dashboardData.lowStockList.length === 0 && (
                                <div className="py-12 text-center text-gray-400 space-y-2">
                                    <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-80" />
                                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                        ¡Inventario Óptimo!
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                        No hay productos con stock por debajo del mínimo en esta sede.
                                    </p>
                                </div>
                            )}

                            {setActiveTab && (
                                <button
                                    onClick={() => setActiveTab('inventory')}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-white/10 text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white transition-all text-center block"
                                >
                                    Ajustar Inventario y Lotes
                                </button>
                            )}
                        </div>
                    )}

                    {/* VISTA 2: TOP PRODUCTOS MÁS VENDIDOS */}
                    {productTab === 'top_sellers' && (
                        <div className="space-y-3">
                            {dashboardData.topSellersList.map((item: any, idx: number) => (
                                <div
                                    key={item.product.id || idx}
                                    className="flex items-center gap-3 p-3 bg-gray-50/70 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all"
                                >
                                    <div className="relative">
                                        <img
                                            src={item.product.images?.[0] || DEFAULT_IMAGE}
                                            alt={item.product.title}
                                            className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0"
                                            onError={(e) => { e.currentTarget.src = DEFAULT_IMAGE; }}
                                        />
                                        <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white ${
                                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-400'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                                            {item.product.title}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {item.units} {item.units === 1 ? 'unidad vendida' : 'unidades vendidas'}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                                            {activeCurrencySymbol}{item.revenue.toFixed(2)}
                                        </p>
                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                            Generado
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {dashboardData.topSellersList.length === 0 && (
                                <div className="py-12 text-center text-gray-400 space-y-2">
                                    <BarChart3 size={32} className="mx-auto opacity-40" />
                                    <p className="text-xs font-bold">Sin ventas registradas en el período seleccionado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
