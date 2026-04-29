import React, { useMemo, useState, useEffect } from 'react';
import { Card, LazyImage } from '../UIComponents';
import { useStore } from '../../context/StoreContext'; 
import { DollarSign, CreditCard, Activity, Package, TrendingUp, TrendingDown, Star, Users, ShoppingBag, ArrowUpRight, ArrowDownRight, User, Wallet, PieChart, BarChart, Layers, AlertTriangle, XCircle, History, ArrowDownCircle, ArrowUpCircle, ClipboardList, RefreshCcw, Filter, Search, Calendar, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Store, MapPin } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart as RePieChart, Pie, Cell, BarChart as ReBarChart, Bar, ComposedChart, Line } from 'recharts';
import { Order, Product, Customer, UserAccount, StockMovement } from '../../types';
import { DEFAULT_IMAGE } from '../../config';
import { api } from '../../services/api';

// Componente de Tarjeta de Estadística Premium (Reutilizable)
const StatCard = ({ title, value, icon, color, trend, trendValue, subtitle }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${color} transition-transform group-hover:scale-110 duration-500`}>
                {icon}
            </div>
            {trend && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    trend === 'up' 
                    ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                    : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                }`}>
                    {trend === 'up' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                    {trendValue}%
                </div>
            )}
        </div>
        <div className="relative z-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black text-ios-text dark:text-white tracking-tight">{value}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-2 font-medium">{subtitle}</p>}
        </div>
        
        {/* Decoración de Fondo Abstracta */}
        <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.03] dark:opacity-[0.05] ${color} group-hover:scale-150 transition-transform duration-700 ease-out`}></div>
    </div>
);

// Custom Tooltip para los Gráficos
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 rounded-2xl shadow-xl text-xs z-50">
                <p className="font-bold text-gray-800 dark:text-white mb-2 border-b border-gray-100 dark:border-white/10 pb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-500 dark:text-gray-400 capitalize">
                                {entry.name === 'sales' ? 'Venta Bruta' : entry.name === 'profit' ? 'Ganancia Neta' : entry.name === 'orders' ? 'Pedidos' : entry.name === 'value' ? 'Valor' : entry.name}:
                            </span>
                        </div>
                        <span className="font-bold dark:text-white font-mono">
                            {entry.name === 'sales' || entry.name === 'profit' || entry.name === 'cost' || entry.name === 'value' || entry.name === 'total' 
                                ? `$${Number(entry.value).toFixed(2)}` 
                                : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export const StatisticsModule = ({ orders, products, customers, categories }: { orders: Order[], products: Product[], customers: Customer[], categories: any[] }) => {
    const { userRole, currentUser, settings, branches, currentBranch } = useStore();
    
    // --- ESTADO GENERAL ---
    const [viewMode, setViewMode] = useState<'financial' | 'inventory'>('financial');

    // --- ESTADOS FINANCIEROS ---
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'year'>('30d');
    const [selectedUser, setSelectedUser] = useState<string>('all');

    // --- ESTADOS INVENTARIO (AUDITORÍA & PAGINACIÓN) ---
    const [movements, setMovements] = useState<(StockMovement & { product_title?: string, product_code?: string })[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    
    const [auditSearch, setAuditSearch] = useState('');
    const [auditType, setAuditType] = useState('all');
    
    const ITEMS_PER_PAGE = 20;

    // Detectar si estamos en modo global (solo Admin)
    const isGlobalView = currentBranch?.id === 0;

    // Cargar movimientos al entrar en modo Inventario
    useEffect(() => {
        if (viewMode === 'inventory') {
            loadAuditData();
        }
    }, [viewMode, currentBranch]); // Recargar si cambia la sede

    const loadAuditData = async () => {
        setLoadingMovements(true);
        try {
            // Traer últimos 300 movimientos
            const data = await api.getMovements(300);
            if (Array.isArray(data)) {
                setMovements(data);
            }
        } catch (e) {
            console.error("Error loading movements", e);
        } finally {
            setLoadingMovements(false);
        }
    };

    // ==========================================
    // LÓGICA FINANCIERA (VENTAS)
    // ==========================================
    const filteredOrders = useMemo(() => {
        let result = orders;
        if (userRole === 'seller' && currentUser) {
            result = result.filter(o => o.sellerId === currentUser.id);
        } else if (userRole === 'admin') {
            if (selectedUser !== 'all') {
                if (selectedUser === 'web') result = result.filter(o => o.sellerId === 'web-client' || !o.sellerId);
                else result = result.filter(o => o.sellerId === selectedUser);
            }
        }
        return result;
    }, [orders, userRole, currentUser, selectedUser]);

    const financialStats = useMemo(() => {
        const now = Date.now();
        let days = 30;
        if(timeRange === 'today') days = 1;
        if(timeRange === '7d') days = 7;
        if(timeRange === '90d') days = 90;
        if(timeRange === 'year') days = 365;

        const msPerDay = 24 * 60 * 60 * 1000;
        let currentPeriodStart = now - (days * msPerDay);
        
        if (timeRange === 'today') {
            const today = new Date();
            today.setHours(0,0,0,0);
            currentPeriodStart = today.getTime();
        }

        const previousPeriodStart = currentPeriodStart - (days * msPerDay);
        
        // SOLO PEDIDOS COMPLETADOS PARA FINANZAS
        const currentOrders = filteredOrders.filter(o => o.date >= currentPeriodStart && o.status === 'completed');
        const prevOrders = filteredOrders.filter(o => o.date >= previousPeriodStart && o.date < currentPeriodStart && o.status === 'completed');

        const calculateFinancials = (ords: Order[]) => {
            let revenue = 0;
            let cost = 0;
            ords.forEach(o => {
                revenue += o.total;
                o.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    const itemCost = product ? (product.cost * item.quantity) : 0;
                    cost += itemCost;
                });
            });
            return { revenue, cost, profit: revenue - cost };
        };

        const currentFin = calculateFinancials(currentOrders);
        const prevFin = calculateFinancials(prevOrders);

        const revenueGrowth = prevFin.revenue === 0 ? 100 : ((currentFin.revenue - prevFin.revenue) / prevFin.revenue) * 100;
        const profitGrowth = prevFin.profit === 0 ? 100 : ((currentFin.profit - prevFin.profit) / prevFin.profit) * 100;
        const profitMargin = currentFin.revenue > 0 ? (currentFin.profit / currentFin.revenue) * 100 : 0;

        const chartMap = new Map<string, {date: string, sales: number, profit: number, cost: number, orders: number}>();
        for(let i=0; i<days; i++) {
             const d = new Date(now - (i * msPerDay));
             const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); 
             chartMap.set(key, { date: key, sales: 0, profit: 0, cost: 0, orders: 0 });
        }

        currentOrders.forEach(o => {
            const d = new Date(o.date);
            const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            if (chartMap.has(key)) {
                const entry = chartMap.get(key)!;
                entry.sales += o.total;
                entry.orders += 1;
                let orderCost = 0;
                o.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    orderCost += product ? (product.cost * item.quantity) : 0;
                });
                entry.cost += orderCost;
                entry.profit += (o.total - orderCost);
            }
        });

        const salesChartData = Array.from(chartMap.values()).reverse();

        // --- PAYMENT METHODS ---
        const paymentStats: Record<string, number> = {};
        currentOrders.forEach(o => {
            const methodStr = o.paymentMethod || 'Otros';
            if (methodStr.includes('+')) {
                const parts = methodStr.split('+');
                parts.forEach(part => {
                    const amountMatch = part.match(/[\$]\s*([0-9,.]+)/);
                    if (amountMatch && amountMatch[1]) {
                        let name = part.substring(0, amountMatch.index).replace(/[()]/g, '').trim();
                        if (!name) name = 'Otros'; 
                        const amountStr = amountMatch[1].replace(/,/g, ''); 
                        const amount = parseFloat(amountStr);
                        if (!isNaN(amount)) paymentStats[name] = (paymentStats[name] || 0) + amount;
                    } else {
                        paymentStats['Otros'] = (paymentStats['Otros'] || 0); 
                    }
                });
            } else {
                const cleanName = methodStr.split('(')[0].trim();
                paymentStats[cleanName] = (paymentStats[cleanName] || 0) + o.total; 
            }
        });
        
        const paymentChartData = Object.entries(paymentStats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);

        // Top Products
        const productPerformance: Record<string, {name: string, revenue: number, profit: number, qty: number}> = {};
        currentOrders.forEach(o => {
            o.items.forEach(i => {
                const prod = products.find(p => p.id === i.productId);
                const cost = prod ? prod.cost : 0;
                const revenue = i.price * i.quantity;
                const profit = revenue - (cost * i.quantity);
                if (!productPerformance[i.productId]) { productPerformance[i.productId] = { name: i.productTitle, revenue: 0, profit: 0, qty: 0 }; }
                productPerformance[i.productId].revenue += revenue;
                productPerformance[i.productId].profit += profit;
                productPerformance[i.productId].qty += i.quantity;
            });
        });
        const topProducts = Object.values(productPerformance).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Categories
        const catSales: Record<string, number> = {};
        let totalCatSales = 0;
        currentOrders.forEach(o => {
            o.items.forEach(i => {
                const prod = products.find(p => p.id === i.productId);
                const cat = prod?.category || 'General'; 
                const value = i.price * i.quantity;
                catSales[cat] = (catSales[cat] || 0) + value;
                totalCatSales += value;
            });
        });
        const categoryData = Object.entries(catSales).map(([name, value]) => ({ name, value, percent: (value/totalCatSales)*100 })).sort((a,b) => b.value - a.value);

        // --- BRANCH PERFORMANCE (MULTI-SEDE) ---
        // Calcula ventas por sede usando branchId de la orden
        const branchSales: Record<number, number> = {};
        currentOrders.forEach(o => {
            const bid = o.branchId || 1;
            branchSales[bid] = (branchSales[bid] || 0) + o.total;
        });
        const branchData = Object.entries(branchSales).map(([bid, total]) => ({
            name: branches.find(b => b.id === Number(bid))?.name || `Sede ${bid}`,
            value: total
        })).sort((a,b) => b.value - a.value);

        return { 
            revenue: currentFin.revenue, 
            revenueGrowth, 
            profit: currentFin.profit, 
            profitGrowth, 
            margin: profitMargin, 
            salesChartData, 
            paymentChartData, 
            topProducts, 
            categoryData,
            branchData // Nueva métrica
        };
    }, [filteredOrders, products, timeRange, branches]);

    // ==========================================
    // LÓGICA INVENTARIO (STOCK & AUDIT)
    // ==========================================
    const metrics = useMemo(() => {
        let totalCost = 0;
        let totalRetailValue = 0;
        let totalStockCount = 0;
        let lowStockItems = 0;
        let outOfStockItems = 0;
        let activeProducts = 0;
        
        const categoryCounts: Record<string, number> = {};
        const categoryValue: Record<string, number> = {};
        
        products.forEach(p => {
            const pStock = p.stock || 0;
            const pCostVal = pStock * (p.cost || 0);
            const pRetailVal = pStock * (p.price || 0);

            totalCost += pCostVal;
            totalRetailValue += pRetailVal;
            totalStockCount += pStock;

            if(p.isVisible) activeProducts++;

            if (pStock === 0) {
                outOfStockItems++;
            } else if (pStock < 5) {
                lowStockItems++;
            }

            const cat = p.category || 'General';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + pStock;
            categoryValue[cat] = (categoryValue[cat] || 0) + pRetailVal;
        });

        const chartData = Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, count, value: categoryValue[name] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); 

        return { 
            totalCost, 
            totalRetailValue, 
            potentialProfit: totalRetailValue - totalCost, 
            totalStockCount, 
            lowStockItems, 
            outOfStockItems, 
            activeProducts, 
            chartData, 
            profitMargin: totalRetailValue > 0 ? ((totalRetailValue - totalCost) / totalRetailValue) * 100 : 0,
        };
    }, [products]);

    // Filtrado de Movimientos Reales
    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            if (auditSearch) {
                const q = auditSearch.toLowerCase();
                const matchRef = m.reference.toLowerCase().includes(q);
                const matchProd = (m.product_title || '').toLowerCase().includes(q);
                if (!matchRef && !matchProd) return false;
            }
            if (auditType !== 'all') {
                if (m.type !== auditType) return false;
            }
            return true;
        });
    }, [movements, auditSearch, auditType]);

    const resetAuditFilters = () => {
        setAuditSearch('');
        setAuditType('all');
        loadAuditData(); // Refrescar
    };

    const PIE_COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#34C759', '#5AC8FA'];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header con Indicador de Sede */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                        {viewMode === 'financial' ? <Activity className="text-ios-blue" size={24}/> : <Package className="text-purple-500" size={24}/>}
                        {viewMode === 'financial' ? 'Inteligencia Financiera' : 'Valoración de Inventario'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isGlobalView ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isGlobalView ? <Store size={10}/> : <MapPin size={10}/>}
                            {isGlobalView ? 'VISTA GLOBAL (Todas las Sedes)' : `VISTA LOCAL: ${currentBranch?.name}`}
                        </span>
                        <span className="text-xs text-gray-500">
                            {viewMode === 'financial' ? 'Análisis de ventas completadas.' : 'Auditoría y costos de stock actual.'}
                        </span>
                    </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl flex gap-1 w-full xl:w-auto">
                    <button onClick={() => setViewMode('financial')} className={`flex-1 xl:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'financial' ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                        <DollarSign size={16}/> Ventas
                    </button>
                    <button onClick={() => setViewMode('inventory')} className={`flex-1 xl:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'inventory' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                        <Package size={16}/> Stock
                    </button>
                </div>
            </div>

            {/* VISTA FINANCIERA */}
            {viewMode === 'financial' && (
                <div className="space-y-8 animate-fade-in">
                    {/* Filtros Financieros */}
                    <div className="flex justify-end gap-3 flex-wrap">
                        {userRole === 'admin' && (
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="appearance-none pl-9 pr-8 py-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/10 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-ios-blue/20 shadow-sm">
                                    <option value="all">Todo el Equipo</option>
                                    <option value="web">Ventas Web</option>
                                    {settings.users?.map((u: UserAccount) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
                            {(['today', '7d', '30d', '90d', 'year'] as const).map(range => (
                                <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${timeRange === range ? 'bg-ios-blue text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                                    {range === 'today' ? 'Hoy' : range === '7d' ? '7D' : range === '30d' ? 'Mes' : range === '90d' ? '3M' : 'Año'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Venta Bruta" value={`$${financialStats.revenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`} icon={<DollarSign size={24}/>} color="bg-gradient-to-br from-blue-500 to-blue-700" trend={financialStats.revenueGrowth >= 0 ? 'up' : 'down'} trendValue={Math.abs(financialStats.revenueGrowth).toFixed(1)} subtitle="Facturado (Completados)" />
                        <StatCard title="Ganancia Neta" value={`$${financialStats.profit.toLocaleString('en-US', {minimumFractionDigits: 2})}`} icon={<Wallet size={24}/>} color="bg-gradient-to-br from-green-500 to-green-700" trend={financialStats.profitGrowth >= 0 ? 'up' : 'down'} trendValue={Math.abs(financialStats.profitGrowth).toFixed(1)} subtitle="Ingresos - Costos" />
                        <StatCard title="Margen Utilidad" value={`${financialStats.margin.toFixed(1)}%`} icon={<PieChart size={24}/>} color="bg-gradient-to-br from-purple-500 to-purple-700" subtitle="Rentabilidad" />
                        <StatCard title="Transacciones" value={financialStats.salesChartData.reduce((acc:any, curr:any) => acc + curr.orders, 0)} icon={<ShoppingBag size={24}/>} color="bg-gradient-to-br from-orange-400 to-orange-600" subtitle="Pedidos completados" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
                            <div className="flex justify-between items-center mb-8"><h3 className="font-bold text-lg dark:text-white">Flujo de Caja</h3><div className="flex gap-4"><div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Ventas</div><div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 rounded-full bg-green-500"></div> Ganancia</div></div></div>
                            <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={financialStats.salesChartData} margin={{top: 10, right: 10, left: 0, bottom: 0}}><defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:opacity-10"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} minTickGap={30} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} tickFormatter={(val) => `$${val}`}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="sales" name="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)"/><Area type="monotone" dataKey="profit" name="profit" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)"/></AreaChart></ResponsiveContainer></div>
                        </div>
                        
                        {/* CHART: VENTAS POR SEDE (Solo visible en Modo Global) */}
                        {isGlobalView && financialStats.branchData.length > 0 ? (
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                                <h3 className="font-bold text-lg dark:text-white mb-4">Rendimiento por Sede</h3>
                                <div className="flex-1 min-h-[250px] relative"><ResponsiveContainer width="100%" height="100%"><RePieChart><Pie data={financialStats.branchData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{financialStats.branchData.map((entry, index) => (<Cell key={`cell-b-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip content={<CustomTooltip />}/></RePieChart></ResponsiveContainer><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center"><p className="text-xs text-gray-400 uppercase">Sedes</p><p className="text-lg font-black dark:text-white">{financialStats.branchData.length}</p></div></div></div>
                                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">{financialStats.branchData.map((b, idx) => (<div key={idx} className="flex justify-between items-center text-xs"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} /><span className="text-gray-600 dark:text-gray-300 font-medium truncate max-w-[100px]">{b.name}</span></div><span className="font-bold dark:text-white">${b.value.toLocaleString()}</span></div>))}</div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                                <h3 className="font-bold text-lg dark:text-white mb-4">Ventas por Categoría</h3>
                                <div className="flex-1 min-h-[250px] relative"><ResponsiveContainer width="100%" height="100%"><RePieChart><Pie data={financialStats.categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{financialStats.categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip content={<CustomTooltip />}/></RePieChart></ResponsiveContainer><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center"><p className="text-xs text-gray-400 uppercase">Total</p><p className="text-lg font-black dark:text-white">${financialStats.revenue.toLocaleString('en-US', { notation: "compact" })}</p></div></div></div>
                                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">{financialStats.categoryData.map((cat, idx) => (<div key={idx} className="flex justify-between items-center text-xs"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} /><span className="text-gray-600 dark:text-gray-300 font-medium truncate max-w-[100px]">{cat.name}</span></div><span className="font-bold dark:text-white">{cat.percent.toFixed(1)}%</span></div>))}</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6">
                            <h3 className="font-bold text-lg dark:text-white mb-6 flex items-center gap-2"><Star className="text-yellow-500 fill-yellow-500" size={18} /> Top Productos (Este Periodo)</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-12 text-[10px] text-gray-400 uppercase font-bold border-b border-gray-100 dark:border-white/5 pb-2"><div className="col-span-6">Producto</div><div className="col-span-2 text-center">Cant.</div><div className="col-span-2 text-right">Venta</div><div className="col-span-2 text-right">Ganancia</div></div>
                                {financialStats.topProducts.map((prod, idx) => (<div key={idx} className="grid grid-cols-12 items-center text-xs py-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"><div className="col-span-6 flex items-center gap-3 overflow-hidden pr-2"><div className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-white dark:bg-black/20 rounded-full font-bold text-[10px] text-gray-400 shadow-sm border border-gray-100 dark:border-white/5">{idx + 1}</div><div className="font-medium dark:text-white truncate">{prod.name}</div></div><div className="col-span-2 text-center font-bold text-gray-500 bg-gray-100 dark:bg-white/10 rounded px-1">{prod.qty}</div><div className="col-span-2 text-right font-bold text-gray-700 dark:text-gray-300">${prod.revenue.toLocaleString('en-US', {notation: "compact"})}</div><div className="col-span-2 text-right font-black text-green-600 dark:text-green-400">${prod.profit.toLocaleString('en-US', {notation: "compact"})}</div></div>))}
                            </div>
                        </Card>
                        <Card className="p-6">
                            <h3 className="font-bold text-lg dark:text-white mb-6 flex items-center gap-2"><CreditCard className="text-blue-500" size={18} /> Métodos de Pago</h3>
                            <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><ReBarChart data={financialStats.paymentChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:opacity-10"/><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 10, fill: '#8E8E93', fontWeight: 'bold'}}/><Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} /><Bar dataKey="total" barSize={16} radius={[0, 4, 4, 0]}>{financialStats.paymentChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Bar></ReBarChart></ResponsiveContainer></div>
                        </Card>
                    </div>
                </div>
            )}

            {/* VISTA INVENTARIO */}
            {viewMode === 'inventory' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title={isGlobalView ? "Valor Global (PVP)" : "Valor Sede (PVP)"}
                            value={`$${metrics.totalRetailValue.toLocaleString('en-US', {maximumFractionDigits: 0})}`} 
                            subtitle={`${metrics.totalStockCount} unidades totales`}
                            icon={<DollarSign size={20}/>} 
                            color="bg-blue-600" 
                        />
                        
                        {userRole === 'admin' ? (
                            <>
                                <StatCard 
                                    title="Costo Operativo" 
                                    value={`$${metrics.totalCost.toLocaleString('en-US', {maximumFractionDigits: 0})}`} 
                                    subtitle="Inversión en mercancía"
                                    icon={<Package size={20}/>} 
                                    color="bg-slate-600" 
                                />
                                <StatCard 
                                    title="Beneficio Potencial" 
                                    value={`$${metrics.potentialProfit.toLocaleString('en-US', {maximumFractionDigits: 0})}`} 
                                    subtitle={`Margen prom: ${metrics.profitMargin.toFixed(1)}%`}
                                    icon={<TrendingUp size={20}/>} 
                                    color="bg-green-600" 
                                />
                            </>
                        ) : (
                            <>
                                <StatCard 
                                    title="Total Unidades" 
                                    value={metrics.totalStockCount} 
                                    subtitle="Productos físicos"
                                    icon={<Layers size={20}/>} 
                                    color="bg-purple-600" 
                                />
                                <StatCard 
                                    title="Productos Activos" 
                                    value={metrics.activeProducts} 
                                    subtitle="Visibles en tienda"
                                    icon={<CheckCircle2 size={20}/>} 
                                    color="bg-green-600" 
                                />
                            </>
                        )}

                        <div className="grid grid-rows-2 gap-4">
                            <div className="bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-2xl flex items-center justify-between border border-red-100 dark:border-red-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600"><XCircle size={16}/></div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-red-400">Agotados</p>
                                        <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{metrics.outOfStockItems}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/10 px-4 py-3 rounded-2xl flex items-center justify-between border border-orange-100 dark:border-orange-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><AlertTriangle size={16}/></div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-orange-400">Stock Bajo</p>
                                        <p className="text-lg font-black text-orange-600 dark:text-orange-400 leading-none">{metrics.lowStockItems}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-6"><Layers size={18} className="text-ios-blue"/> Valor por Categoría</h3>
                            <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><ReBarChart data={metrics.chartData} margin={{top: 10, right: 30, left: 0, bottom: 0}}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} tickFormatter={(val) => `$${val/1000}k`} /><Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} /><Bar dataKey="value" name="value" radius={[4, 4, 0, 0]} barSize={30}>{metrics.chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Bar></ReBarChart></ResponsiveContainer></div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
                            <h3 className="font-bold text-lg dark:text-white mb-4">Top Stock (Unidades)</h3>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">{metrics.chartData.map((cat, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]}}>{idx + 1}</div><div><p className="font-bold text-sm dark:text-white">{cat.name}</p><p className="text-[10px] text-gray-500">${cat.value.toLocaleString()} en valor</p></div></div><div className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg text-xs font-bold dark:text-white shadow-sm">{cat.count} u.</div></div>))}</div>
                        </div>
                    </div>
                    
                    {/* SECCIÓN DE AUDITORÍA Y MERMAS CON FILTROS */}
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                        <div className="flex flex-col gap-6 mb-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                    <History size={20} className="text-red-500"/> Auditoría Real de Inventario
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full text-gray-500 font-medium">
                                        Mostrando últimos {filteredMovements.length} movimientos
                                    </div>
                                    <button 
                                        onClick={resetAuditFilters} 
                                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors" 
                                        title="Recargar y Limpiar"
                                    >
                                        <RotateCcw size={16}/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Filtros */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                                <div className="md:col-span-2 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                    <input 
                                        placeholder="Buscar producto o referencia..." 
                                        className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 focus:border-ios-blue transition-colors"
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                    />
                                </div>
                                <div className="relative md:col-span-2">
                                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                    <select 
                                        className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer focus:border-ios-blue transition-colors"
                                        value={auditType}
                                        onChange={e => setAuditType(e.target.value)}
                                    >
                                        <option value="all">Todos los Tipos</option>
                                        <option value="entry">Entradas</option>
                                        <option value="exit">Salidas</option>
                                        <option value="sale">Ventas</option>
                                        <option value="adjustment">Ajustes / Variantes</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left">
                                <thead className="text-[10px] text-gray-400 uppercase font-black tracking-widest border-b border-gray-100 dark:border-white/5">
                                    <tr>
                                        <th className="pb-3 pl-2 w-32">Fecha</th>
                                        <th className="pb-3 w-40">Producto</th>
                                        <th className="pb-3 w-32">Tipo</th>
                                        <th className="pb-3 w-20 text-center">Cant.</th>
                                        <th className="pb-3 text-right pr-2">Detalle / Referencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {loadingMovements ? (
                                        <tr><td colSpan={5} className="text-center py-10">Cargando datos...</td></tr>
                                    ) : filteredMovements.length > 0 ? (
                                        filteredMovements.map((mov) => {
                                            const isEntry = mov.type === 'entry' || mov.type === 'transfer_in';
                                            const isSale = mov.type === 'sale';
                                            const isExit = mov.type === 'exit' || mov.type === 'transfer_out';
                                            const isAdj = mov.type === 'adjustment';
                                            
                                            // Detectar si el ajuste fue positivo o negativo por el texto de referencia si es adjustment
                                            let isPositiveAdj = false;
                                            if (isAdj && mov.reference.includes('+')) isPositiveAdj = true;
                                            
                                            return (
                                                <tr key={mov.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="py-3 pl-2 text-xs text-gray-500 font-mono whitespace-nowrap">
                                                        {new Date(mov.date).toLocaleString('es-ES')}
                                                    </td>
                                                    <td className="py-3">
                                                        <p className="text-xs font-bold dark:text-white truncate max-w-[200px]">{mov.product_title || 'Producto Eliminado'}</p>
                                                        <p className="text-[9px] text-gray-400 font-mono">{mov.product_code}</p>
                                                    </td>
                                                    <td className="py-3">
                                                        {isEntry ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">
                                                                <ArrowUpCircle size={10}/> Entrada
                                                            </span>
                                                        ) : isSale ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                                                                <DollarSign size={10}/> Venta
                                                            </span>
                                                        ) : isExit ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
                                                                <ArrowDownCircle size={10}/> Salida
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${isPositiveAdj ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                                                                <RefreshCcw size={10}/> {isPositiveAdj ? 'Entrada (Ajuste)' : 'Salida (Ajuste)'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <span className={`text-xs font-bold ${isEntry || isPositiveAdj ? 'text-green-600' : 'text-red-500'}`}>
                                                            {isEntry || isPositiveAdj ? '+' : '-'}{mov.amount}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right pr-2 text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[250px]">
                                                        {mov.reference} <span className="text-[9px] opacity-60">({mov.userName})</span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-gray-400 text-xs">
                                                <Search size={24} className="mx-auto mb-2 opacity-20"/>
                                                No hay movimientos registrados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
