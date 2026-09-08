
import React, { useMemo, useState } from 'react';
import { Card } from '../../UIComponents';
import { useStore } from '../../../context/StoreContext';
import { Order, Product, UserAccount } from '../../../types';
import { StatCard, CustomTooltip, PIE_COLORS } from './SharedStatsComponents';
import { DollarSign, Wallet, PieChart, ShoppingBag, Star, CreditCard, User } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart as RePieChart, Pie, Cell, BarChart as ReBarChart, Bar } from 'recharts';

interface FinancialAnalyticsProps {
    orders: Order[];
    products: Product[];
}

export const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({ orders, products }) => {
    const { userRole, currentUser, settings, branches, currentBranch } = useStore();
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'year'>('30d');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    
    const isGlobalView = currentBranch?.id === 0;

    const filteredOrders = useMemo(() => {
        let result = orders;
        if (currentBranch && currentBranch.id > 0) {
            result = result.filter(o => Number(o.branchId || 1) === Number(currentBranch.id));
        }
        if (userRole === 'seller' && currentUser) {
            result = result.filter(o => o.sellerId === currentUser.id);
        } else if (userRole === 'admin') {
            if (selectedUser !== 'all') {
                if (selectedUser === 'web') result = result.filter(o => o.sellerId === 'web-client' || !o.sellerId);
                else result = result.filter(o => o.sellerId === selectedUser);
            }
        }
        return result;
    }, [orders, userRole, currentUser, selectedUser, currentBranch]);

    const financialStats = useMemo(() => {
        const now = Date.now();
        let days = 30;
        if (timeRange === 'today') days = 1;
        if (timeRange === '7d') days = 7;
        if (timeRange === '90d') days = 90;
        if (timeRange === 'year') days = 365;

        const msPerDay = 24 * 60 * 60 * 1000;
        let currentPeriodStart = now - (days * msPerDay);
        
        if (timeRange === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            currentPeriodStart = today.getTime();
        }

        const previousPeriodStart = currentPeriodStart - (days * msPerDay);
        
        const currentOrders = filteredOrders.filter(o => Number(o.date) >= currentPeriodStart && o.status === 'completed');
        const prevOrders = filteredOrders.filter(o => Number(o.date) >= previousPeriodStart && Number(o.date) < currentPeriodStart && o.status === 'completed');

        // Helper para resolver producto (incluso si el ítem refiere a una variante o sku)
        const findProduct = (item: { productId: string, variantId?: string, variantSku?: string }) => {
            let prod = products.find(p => p.id === item.productId);
            if (!prod && item.variantId) {
                prod = products.find(p => p.variants?.some(v => v.id === item.variantId || v.sku === item.variantSku));
            }
            return prod;
        };

        const calculateFinancials = (ords: Order[]) => {
            let revenue = 0;
            let cost = 0;
            ords.forEach(o => {
                revenue += (Number(o.total) || 0);
                (o.items || []).forEach(item => {
                    const product = findProduct(item);
                    const itemCost = product ? ((Number(product.cost) || 0) * (Number(item.quantity) || 1)) : 0;
                    cost += itemCost;
                });
            });
            return { revenue, cost, profit: revenue - cost };
        };

        const currentFin = calculateFinancials(currentOrders);
        const prevFin = calculateFinancials(prevOrders);

        const revenueGrowth = prevFin.revenue === 0
            ? (currentFin.revenue > 0 ? 100 : 0)
            : ((currentFin.revenue - prevFin.revenue) / prevFin.revenue) * 100;

        const profitGrowth = prevFin.profit === 0
            ? (currentFin.profit > 0 ? 100 : 0)
            : ((currentFin.profit - prevFin.profit) / Math.abs(prevFin.profit || 1)) * 100;

        const profitMargin = currentFin.revenue > 0 ? (currentFin.profit / currentFin.revenue) * 100 : 0;

        // Construcción del Gráfico de Ventas según el rango de tiempo seleccionado
        let salesChartData: { date: string, sales: number, profit: number, cost: number, orders: number }[] = [];

        if (timeRange === 'today') {
            // Desglose intradiario cada 2 horas para un gráfico fluido y útil
            const hourIntervals = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
            const hourMap = new Map<number, { date: string, sales: number, profit: number, cost: number, orders: number }>();
            
            hourIntervals.forEach(h => {
                const label = `${h.toString().padStart(2, '0')}:00`;
                hourMap.set(h, { date: label, sales: 0, profit: 0, cost: 0, orders: 0 });
            });

            currentOrders.forEach(o => {
                const orderDate = new Date(Number(o.date));
                const orderHour = orderDate.getHours();
                const bucketHour = Math.floor(orderHour / 2) * 2;
                const entry = hourMap.get(bucketHour);
                if (entry) {
                    entry.sales += Number(o.total) || 0;
                    entry.orders += 1;
                    let orderCost = 0;
                    (o.items || []).forEach(item => {
                        const product = findProduct(item);
                        orderCost += product ? ((Number(product.cost) || 0) * (Number(item.quantity) || 1)) : 0;
                    });
                    entry.cost += orderCost;
                    entry.profit += ((Number(o.total) || 0) - orderCost);
                }
            });

            salesChartData = Array.from(hourMap.values());
        } else if (timeRange === 'year') {
            // Desglose de los últimos 12 meses
            const monthMap = new Map<string, { date: string, sales: number, profit: number, cost: number, orders: number }>();
            const monthDate = new Date(now);

            for (let i = 11; i >= 0; i--) {
                const d = new Date(monthDate.getFullYear(), monthDate.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                monthMap.set(key, { date: label, sales: 0, profit: 0, cost: 0, orders: 0 });
            }

            currentOrders.forEach(o => {
                const d = new Date(Number(o.date));
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (monthMap.has(key)) {
                    const entry = monthMap.get(key)!;
                    entry.sales += Number(o.total) || 0;
                    entry.orders += 1;
                    let orderCost = 0;
                    (o.items || []).forEach(item => {
                        const product = findProduct(item);
                        orderCost += product ? ((Number(product.cost) || 0) * (Number(item.quantity) || 1)) : 0;
                    });
                    entry.cost += orderCost;
                    entry.profit += ((Number(o.total) || 0) - orderCost);
                }
            });

            salesChartData = Array.from(monthMap.values());
        } else {
            // Desglose diario para 7d, 30d, 90d
            const chartMap = new Map<string, { date: string, sales: number, profit: number, cost: number, orders: number }>();
            for (let i = 0; i < days; i++) {
                const d = new Date(now - (i * msPerDay));
                const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                chartMap.set(key, { date: key, sales: 0, profit: 0, cost: 0, orders: 0 });
            }

            currentOrders.forEach(o => {
                const d = new Date(Number(o.date));
                const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                if (chartMap.has(key)) {
                    const entry = chartMap.get(key)!;
                    entry.sales += Number(o.total) || 0;
                    entry.orders += 1;
                    let orderCost = 0;
                    (o.items || []).forEach(item => {
                        const product = findProduct(item);
                        orderCost += product ? ((Number(product.cost) || 0) * (Number(item.quantity) || 1)) : 0;
                    });
                    entry.cost += orderCost;
                    entry.profit += ((Number(o.total) || 0) - orderCost);
                }
            });

            salesChartData = Array.from(chartMap.values()).reverse();
        }

        // Métodos de pago
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
                const cleanName = methodStr.split('(')[0].trim() || 'Otros';
                paymentStats[cleanName] = (paymentStats[cleanName] || 0) + (Number(o.total) || 0); 
            }
        });
        
        const paymentChartData = Object.entries(paymentStats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);

        // Rendimiento por Producto (evitando colisiones en ítems 'custom' o manuales)
        const productPerformance: Record<string, { name: string, revenue: number, profit: number, qty: number }> = {};
        currentOrders.forEach(o => {
            (o.items || []).forEach(i => {
                const prod = findProduct(i);
                const cost = prod ? (Number(prod.cost) || 0) : 0;
                const qty = Number(i.quantity) || 1;
                const price = Number(i.price) || 0;
                const revenue = price * qty;
                const profit = revenue - (cost * qty);
                const perfKey = (i.productId === 'custom' || !i.productId) ? `custom-${i.productTitle}` : i.productId;

                if (!productPerformance[perfKey]) {
                    productPerformance[perfKey] = { name: i.productTitle, revenue: 0, profit: 0, qty: 0 };
                }
                productPerformance[perfKey].revenue += revenue;
                productPerformance[perfKey].profit += profit;
                productPerformance[perfKey].qty += qty;
            });
        });
        const topProducts = Object.values(productPerformance).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Ventas por Categoría
        const catSales: Record<string, number> = {};
        let totalCatSales = 0;
        currentOrders.forEach(o => {
            (o.items || []).forEach(i => {
                const prod = findProduct(i);
                const cat = prod?.category || 'General'; 
                const value = (Number(i.price) || 0) * (Number(i.quantity) || 1);
                catSales[cat] = (catSales[cat] || 0) + value;
                totalCatSales += value;
            });
        });
        const categoryData = Object.entries(catSales).map(([name, value]) => ({
            name,
            value,
            percent: totalCatSales > 0 ? (value / totalCatSales) * 100 : 0
        })).sort((a, b) => b.value - a.value);

        // Ventas por Sede
        const branchSales: Record<number, number> = {};
        currentOrders.forEach(o => {
            const bid = Number(o.branchId) || 1;
            branchSales[bid] = (branchSales[bid] || 0) + (Number(o.total) || 0);
        });
        const branchData = Object.entries(branchSales).map(([bid, total]) => ({
            name: branches.find(b => b.id === Number(bid))?.name || `Sede ${bid}`,
            value: total
        })).sort((a, b) => b.value - a.value);

        return { 
            revenue: currentFin.revenue, 
            revenueGrowth, 
            profit: currentFin.profit, 
            profitGrowth, 
            margin: profitMargin, 
            orderCount: currentOrders.length,
            salesChartData, 
            paymentChartData, 
            topProducts, 
            categoryData,
            branchData
        };
    }, [filteredOrders, products, timeRange, branches]);

    return (
        <div className="space-y-8 animate-fade-in">
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
                <StatCard title="Transacciones" value={financialStats.orderCount} icon={<ShoppingBag size={24}/>} color="bg-gradient-to-br from-orange-400 to-orange-600" subtitle="Pedidos completados" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-8"><h3 className="font-bold text-lg dark:text-white">Flujo de Caja</h3><div className="flex gap-4"><div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Ventas</div><div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 rounded-full bg-green-500"></div> Ganancia</div></div></div>
                    <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={financialStats.salesChartData} margin={{top: 10, right: 10, left: 0, bottom: 0}}><defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:opacity-10"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} minTickGap={30} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} tickFormatter={(val) => `$${val}`}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="sales" name="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)"/><Area type="monotone" dataKey="profit" name="profit" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)"/></AreaChart></ResponsiveContainer></div>
                </div>
                
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
    );
};
