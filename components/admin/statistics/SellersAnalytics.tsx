import React, { useMemo, useState } from 'react';
import { Card, Button } from '../../UIComponents';
import { useStore } from '../../../context/StoreContext';
import { Order, Product, UserAccount, SalesAdvisor } from '../../../types';
import { StatCard, CustomTooltip, PIE_COLORS } from './SharedStatsComponents';
import { 
    Trophy, Award, DollarSign, Wallet, ShoppingBag, TrendingUp, 
    User, Search, Download, Calendar, ArrowUpRight, CheckCircle2, 
    ChevronRight, X, Printer, Store, MapPin, Sparkles, Percent
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

interface SellersAnalyticsProps {
    orders: Order[];
    products: Product[];
}

export interface SellerPerformance {
    id: string;
    name: string;
    username: string;
    role: string;
    assignedBranchName: string;
    commissionRate: number;
    sales: number;
    orderCount: number;
    averageTicket: number;
    totalCommission: number;
    orders: Order[];
    percentageOfTotal: number;
}

export const SellersAnalytics: React.FC<SellersAnalyticsProps> = ({ orders }) => {
    const { settings, branches, currentBranch, userRole, currentUser } = useStore();
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSellerDetail, setSelectedSellerDetail] = useState<SellerPerformance | null>(null);
    const [showCommissions, setShowCommissions] = useState<boolean>(true);

    const isGlobalView = currentBranch?.id === 0;

    // 1. Filtrar órdenes por sede y por estado 'completed'
    const completedOrders = useMemo(() => {
        let result = orders.filter(o => o.status === 'completed');
        if (currentBranch && currentBranch.id > 0) {
            result = result.filter(o => Number(o.branchId || 1) === Number(currentBranch.id));
        }
        return result;
    }, [orders, currentBranch]);

    // 2. Filtrar órdenes por rango temporal
    const periodOrders = useMemo(() => {
        if (timeRange === 'all') return completedOrders;

        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;
        let startTimestamp = now - (30 * msPerDay);

        if (timeRange === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startTimestamp = today.getTime();
        } else if (timeRange === '7d') {
            startTimestamp = now - (7 * msPerDay);
        } else if (timeRange === '90d') {
            startTimestamp = now - (90 * msPerDay);
        } else if (timeRange === 'year') {
            startTimestamp = now - (365 * msPerDay);
        }

        return completedOrders.filter(o => Number(o.date) >= startTimestamp);
    }, [completedOrders, timeRange]);

    // 3. Procesar datos por cada vendedor
    const { sellersData, totalTeamSales, totalTeamCommissions, totalTeamOrders, bestSeller } = useMemo(() => {
        const systemUsers: UserAccount[] = settings.users || [];
        const salesAdvisors: SalesAdvisor[] = settings.salesAdvisors || [];
        const sellersMap = new Map<string, SellerPerformance>();

        // 1. Inicializar con Asesores de Venta de Piso (sin clave de sistema)
        salesAdvisors.forEach(a => {
            const branchObj = branches.find(b => b.id === a.branchId);
            const branchName = branchObj ? branchObj.name : 'Todas las Sedes';

            sellersMap.set(a.id, {
                id: a.id,
                name: a.name,
                username: '',
                role: 'Asesor',
                assignedBranchName: branchName,
                commissionRate: a.commissionRate || 0,
                sales: 0,
                orderCount: 0,
                averageTicket: 0,
                totalCommission: 0,
                orders: [],
                percentageOfTotal: 0
            });
        });

        // 2. Inicializar con Usuarios del Sistema (cajeras / administradores)
        systemUsers.forEach(u => {
            const branchObj = branches.find(b => b.id === u.assignedBranchId);
            const branchName = branchObj ? branchObj.name : 'Todas las Sedes';

            if (!sellersMap.has(u.id)) {
                sellersMap.set(u.id, {
                    id: u.id,
                    name: u.name,
                    username: u.username,
                    role: u.role === 'admin' ? 'Administrador' : 'Cajera / Sistema',
                    assignedBranchName: branchName,
                    commissionRate: u.commissionRate || 0,
                    sales: 0,
                    orderCount: 0,
                    averageTicket: 0,
                    totalCommission: 0,
                    orders: [],
                    percentageOfTotal: 0
                });
            }
        });

        // Sumar ventas y calcular comisiones
        let globalPeriodSales = 0;

        periodOrders.forEach(o => {
            const orderTotal = Number(o.total) || 0;
            globalPeriodSales += orderTotal;

            const sid = o.sellerId || 'unknown';
            const sname = o.sellerName || 'Sin Asignar';

            let sellerPerf = sellersMap.get(sid);

            // Si la orden tiene un vendedor que no está en systemUsers (ej: antiguo o borrado), crear entrada dinámica
            if (!sellerPerf) {
                // Si coincide por nombre con alguno
                const matchedByName = Array.from(sellersMap.values()).find(s => s.name.toLowerCase() === sname.toLowerCase());
                if (matchedByName) {
                    sellerPerf = matchedByName;
                } else {
                    sellerPerf = {
                        id: sid,
                        name: sname,
                        username: sid === 'web-client' ? 'tienda.online' : sid,
                        role: sid === 'web-client' ? 'online' : 'seller',
                        assignedBranchName: 'General',
                        commissionRate: o.commissionRate || 0,
                        sales: 0,
                        orderCount: 0,
                        averageTicket: 0,
                        totalCommission: 0,
                        orders: [],
                        percentageOfTotal: 0
                    };
                    sellersMap.set(sid, sellerPerf);
                }
            }

            sellerPerf.sales += orderTotal;
            sellerPerf.orderCount += 1;
            sellerPerf.orders.push(o);

            // Cálculo de comisión de la orden
            let comm = 0;
            if (o.sellerCommission !== undefined && o.sellerCommission > 0) {
                comm = Number(o.sellerCommission);
            } else {
                const rate = o.commissionRate !== undefined && o.commissionRate > 0 
                    ? o.commissionRate 
                    : (sellerPerf.commissionRate || 0);
                comm = rate > 0 ? (orderTotal * (rate / 100)) : 0;
            }
            sellerPerf.totalCommission += comm;
        });

        // Calcular promedios y porcentajes
        let teamSales = 0;
        let teamCommissions = 0;
        let teamOrders = 0;

        const list = Array.from(sellersMap.values()).map(s => {
            s.averageTicket = s.orderCount > 0 ? (s.sales / s.orderCount) : 0;
            s.percentageOfTotal = globalPeriodSales > 0 ? (s.sales / globalPeriodSales) * 100 : 0;

            if (s.id !== 'web-client' && s.role !== 'online') {
                teamSales += s.sales;
                teamCommissions += s.totalCommission;
                teamOrders += s.orderCount;
            }

            return s;
        });

        // Ordenar desc por volumen de ventas
        list.sort((a, b) => b.sales - a.sales);

        // Identificar el mejor vendedor (excluyendo ventas web automáticas)
        const eligibleBest = list.filter(s => s.id !== 'web-client' && s.sales > 0);
        const top = eligibleBest.length > 0 ? eligibleBest[0] : (list[0]?.sales > 0 ? list[0] : null);

        return {
            sellersData: list,
            totalTeamSales: teamSales,
            totalTeamCommissions: teamCommissions,
            totalTeamOrders: teamOrders,
            bestSeller: top
        };
    }, [periodOrders, settings.users, settings.salesAdvisors, branches]);

    // Filtrar según búsqueda del usuario
    const filteredSellers = useMemo(() => {
        if (!searchQuery.trim()) return sellersData;
        const q = searchQuery.toLowerCase();
        return sellersData.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.username.toLowerCase().includes(q) ||
            s.assignedBranchName.toLowerCase().includes(q)
        );
    }, [sellersData, searchQuery]);

    // Datos para gráfico de barras (Top 6 vendedores con ventas)
    const barChartData = useMemo(() => {
        return sellersData
            .filter(s => s.sales > 0)
            .slice(0, 7)
            .map(s => ({
                name: s.name.split(' ')[0] || s.name,
                fullName: s.name,
                sales: s.sales,
                commission: s.totalCommission
            }));
    }, [sellersData]);

    // Datos para gráfico de dona (participación)
    const pieChartData = useMemo(() => {
        return sellersData
            .filter(s => s.sales > 0)
            .slice(0, 6)
            .map(s => ({
                name: s.name,
                value: s.sales
            }));
    }, [sellersData]);

    // Exportar a CSV para liquidación
    const exportCommissionsToCSV = () => {
        const headers = ["ID", "Vendedor", "Usuario", "Sede", "Ventas Totales ($)", "Pedidos Realizados", "Ticket Promedio ($)", "% Comision", "Total Comision ($)"];
        const rows = sellersData.map(s => [
            `"${s.id}"`,
            `"${s.name}"`,
            `"${s.username}"`,
            `"${s.assignedBranchName}"`,
            s.sales.toFixed(2),
            s.orderCount,
            s.averageTicket.toFixed(2),
            s.commissionRate,
            s.totalCommission.toFixed(2)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `comisiones_vendedores_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-8">
            {/* Barra de Filtros y Rango de Tiempo */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div>
                    <h3 className="font-black text-lg dark:text-white flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={22} />
                        Rendimiento de Vendedores y Comisiones
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {isGlobalView ? 'Consolidado de todas las sedes' : `Sede actual: ${currentBranch?.name}`}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                    {/* Toggle para alternar vista de comisiones */}
                    <button
                        type="button"
                        onClick={() => setShowCommissions(!showCommissions)}
                        className={`text-xs font-bold gap-1.5 py-2 px-3 rounded-xl transition-all flex items-center border ${
                            showCommissions
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40 shadow-sm'
                                : 'bg-gray-100 dark:bg-white/10 text-gray-500 border-gray-200 dark:border-white/10 hover:text-gray-800 dark:hover:text-white'
                        }`}
                        title="Alternar cálculo de comisiones"
                    >
                        <Percent size={13} />
                        <span>{showCommissions ? 'Comisiones: Activas' : 'Comisiones: Ocultas'}</span>
                    </button>

                    <Button 
                        variant="secondary" 
                        onClick={exportCommissionsToCSV}
                        className="text-xs font-bold gap-2 py-2 px-3 border border-gray-200 dark:border-white/10"
                    >
                        <Download size={14} /> Exportar CSV
                    </Button>

                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl border border-gray-200 dark:border-white/5">
                        {(['today', '7d', '30d', '90d', 'year', 'all'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${
                                    timeRange === range 
                                        ? 'bg-ios-blue text-white shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                                }`}
                            >
                                {range === 'today' ? 'Hoy' : range === '7d' ? '7D' : range === '30d' ? 'Mes' : range === '90d' ? '3M' : range === 'year' ? 'Año' : 'Todo'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECCIÓN PODIO / MEJOR VENDEDOR (HERO SPOTLIGHT) */}
            {bestSeller ? (
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 p-8 text-white shadow-xl shadow-orange-500/20 border border-amber-300/30">
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute top-4 right-6 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md text-amber-200 text-xs font-black border border-white/10">
                        <Sparkles size={14} /> 1º LUGAR EN VENTAS
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                        {/* Info del Asesor */}
                        <div className="lg:col-span-5 flex items-center gap-5">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                                    {bestSeller.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-yellow-400 text-amber-950 flex items-center justify-center shadow-lg border-2 border-white">
                                    <Trophy size={18} strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-black tracking-widest uppercase text-amber-200">
                                    🏆 Mejor Vendedor del Periodo
                                </span>
                                <h3 className="text-2xl sm:text-3xl font-black leading-tight">
                                    {bestSeller.name}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
                                    <span>@{bestSeller.username}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} /> {bestSeller.assignedBranchName}
                                    </span>
                                </div>
                                {showCommissions && bestSeller.commissionRate > 0 ? (
                                    <span className="inline-block mt-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                        Tasa de Comisión: {bestSeller.commissionRate}%
                                    </span>
                                ) : (
                                    <span className="inline-block mt-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                        Líder de Ventas
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Métricas Destacadas del Mejor Vendedor */}
                        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                            <div className="p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Facturado</p>
                                <p className="text-2xl font-black mt-1">${bestSeller.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                <p className="text-[10px] text-white/70 mt-1">{bestSeller.percentageOfTotal.toFixed(1)}% del total</p>
                            </div>

                            <div className="p-3 border-l border-white/10">
                                {showCommissions ? (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Comisión</p>
                                        <p className="text-2xl font-black mt-1 text-emerald-300">${bestSeller.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        <p className="text-[10px] text-white/70 mt-1">{bestSeller.totalCommission > 0 ? 'Generado a liquidar' : 'Sin comisión (0%)'}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Cuota</p>
                                        <p className="text-2xl font-black mt-1 text-amber-100">{bestSeller.percentageOfTotal.toFixed(1)}%</p>
                                        <p className="text-[10px] text-white/70 mt-1">Participación</p>
                                    </>
                                )}
                            </div>

                            <div className="p-3 border-l border-white/10">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Ventas</p>
                                <p className="text-2xl font-black mt-1">{bestSeller.orderCount}</p>
                                <p className="text-[10px] text-white/70 mt-1">Pedidos cerrados</p>
                            </div>

                            <div className="p-3 border-l border-white/10">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Ticket Prom.</p>
                                <p className="text-2xl font-black mt-1">${bestSeller.averageTicket.toFixed(2)}</p>
                                <p className="text-[10px] text-white/70 mt-1">Por transacción</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 text-center">
                    <Trophy size={48} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
                    <h4 className="text-lg font-bold dark:text-white">Sin ventas de vendedores registradas en este período</h4>
                    <p className="text-xs text-gray-400 mt-1">Cuando los vendedores procesen ventas en el POS, aparecerán clasificados aquí con sus comisiones.</p>
                </div>
            )}

            {/* KPI CARDS GLOBALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Ventas de Asesores" 
                    value={`$${totalTeamSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                    icon={<DollarSign size={24}/>} 
                    color="bg-gradient-to-br from-blue-500 to-blue-700" 
                    subtitle="Facturado por el equipo" 
                />
                {showCommissions ? (
                    <StatCard 
                        title="Comisiones a Pagar" 
                        value={`$${totalTeamCommissions.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                        icon={<Wallet size={24}/>} 
                        color="bg-gradient-to-br from-emerald-500 to-emerald-700" 
                        subtitle={totalTeamCommissions > 0 ? "Total acumulado del período" : "Sin comisiones pendientes"} 
                    />
                ) : (
                    <StatCard 
                        title="Asesores Activos" 
                        value={`${sellersData.filter(s => s.sales > 0 && s.id !== 'web-client').length} de ${sellersData.filter(s => s.id !== 'web-client').length}`} 
                        icon={<User size={24}/>} 
                        color="bg-gradient-to-br from-emerald-500 to-emerald-700" 
                        subtitle="Con ventas en el período" 
                    />
                )}
                <StatCard 
                    title="Pedidos Atendidos" 
                    value={totalTeamOrders} 
                    icon={<ShoppingBag size={24}/>} 
                    color="bg-gradient-to-br from-orange-400 to-orange-600" 
                    subtitle="Transacciones completadas" 
                />
                <StatCard 
                    title="Ticket Promedio" 
                    value={`$${totalTeamOrders > 0 ? (totalTeamSales / totalTeamOrders).toFixed(2) : '0.00'}`} 
                    icon={<TrendingUp size={24}/>} 
                    color="bg-gradient-to-br from-purple-500 to-purple-700" 
                    subtitle="Promedio por venta atendida" 
                />
            </div>

            {/* GRÁFICOS: RANKING DE VENTAS Y CUOTA DE MERCADO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ranking de Ventas por Vendedor */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <Award className="text-ios-blue" size={20} /> Ranking de Ventas
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Comparativa de ingresos generados por cada asesor</p>
                        </div>
                    </div>

                    {barChartData.length > 0 ? (
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:opacity-10" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8E8E93', fontWeight: 'bold' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} tickFormatter={(v) => `$${v}`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="sales" name="sales" fill="#007AFF" radius={[8, 8, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-xs">
                            No hay suficientes datos para graficar en este período.
                        </div>
                    )}
                </div>

                {/* Cuota de Ventas / Distribución */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                    <h3 className="font-bold text-lg dark:text-white mb-2">Cuota de Ventas</h3>
                    <p className="text-xs text-gray-400 mb-4">Participación del equipo sobre el total</p>

                    {pieChartData.length > 0 ? (
                        <>
                            <div className="flex-1 min-h-[200px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={pieChartData} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={55} 
                                            outerRadius={80} 
                                            paddingAngle={4} 
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Total</p>
                                        <p className="text-sm font-black dark:text-white">${totalTeamSales.toLocaleString('en-US', { notation: 'compact' })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {pieChartData.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="text-gray-600 dark:text-gray-300 font-medium truncate">{item.name}</span>
                                        </div>
                                        <span className="font-bold dark:text-white shrink-0">${item.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                            Sin datos disponibles.
                        </div>
                    )}
                </div>
            </div>

            {/* TABLA DE DETALLE Y LIQUIDACIÓN POR VENDEDOR */}
            <Card className="p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <User className="text-ios-blue" size={20} /> Liquidación y Rendimiento por Asesor
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">Listado de asesores y comisiones devengadas</p>
                    </div>

                    <div className="w-full sm:w-64 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar vendedor..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs dark:text-white outline-none focus:ring-1 focus:ring-ios-blue font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-white/5 text-[10px] text-gray-400 uppercase font-black">
                                <th className="py-3 px-3"># Pos</th>
                                <th className="py-3 px-3">Vendedor</th>
                                <th className="py-3 px-3">Sede</th>
                                <th className="py-3 px-3 text-right">Ventas Totales</th>
                                <th className="py-3 px-3 text-center">Pedidos</th>
                                <th className="py-3 px-3 text-right">Ticket Prom.</th>
                                {showCommissions && (
                                    <>
                                        <th className="py-3 px-3 text-center">% Comisión</th>
                                        <th className="py-3 px-3 text-right">Comisión a Pagar</th>
                                    </>
                                )}
                                <th className="py-3 px-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5 font-medium">
                            {filteredSellers.map((seller, idx) => {
                                const isTop = idx === 0 && seller.sales > 0;
                                const isSecond = idx === 1 && seller.sales > 0;
                                const isThird = idx === 2 && seller.sales > 0;

                                return (
                                    <tr key={seller.id} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors group">
                                        <td className="py-3.5 px-3">
                                            {isTop ? (
                                                <span className="w-7 h-7 rounded-full bg-yellow-400 text-amber-950 font-black flex items-center justify-center text-xs shadow-sm">1º</span>
                                            ) : isSecond ? (
                                                <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-black flex items-center justify-center text-xs shadow-sm">2º</span>
                                            ) : isThird ? (
                                                <span className="w-7 h-7 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-xs shadow-sm">3º</span>
                                            ) : (
                                                <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-bold flex items-center justify-center text-xs">{idx + 1}</span>
                                            )}
                                        </td>

                                        <td className="py-3.5 px-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shadow-sm ${seller.role === 'Asesor' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                                                    {seller.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                                        {seller.name}
                                                        {seller.id === currentUser?.id && (
                                                            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.2 rounded font-bold">Tú</span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {seller.role === 'Asesor' ? (
                                                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-100 dark:border-emerald-800/30">
                                                                Asesor
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-bold px-1.5 py-0.2 rounded border border-purple-100 dark:border-purple-800/30">
                                                                {seller.role}
                                                            </span>
                                                        )}
                                                        {seller.username && seller.username !== 'piso' && (
                                                            <span className="text-[10px] text-gray-400 font-mono">@{seller.username}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400">
                                            <span className="text-[11px] font-bold">{seller.assignedBranchName}</span>
                                        </td>

                                        <td className="py-3.5 px-3 text-right">
                                            <p className="font-black text-gray-800 dark:text-white">${seller.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] text-gray-400">{seller.percentageOfTotal.toFixed(1)}% cuota</p>
                                        </td>

                                        <td className="py-3.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-bold">
                                                {seller.orderCount}
                                            </span>
                                        </td>

                                        <td className="py-3.5 px-3 text-right font-bold text-gray-600 dark:text-gray-300">
                                            ${seller.averageTicket.toFixed(2)}
                                        </td>

                                        {showCommissions && (
                                            <>
                                                <td className="py-3.5 px-3 text-center">
                                                    {seller.commissionRate > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                                            {seller.commissionRate}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-[10px] font-medium">Opcional (0%)</span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3 text-right">
                                                    <span className={`font-black text-sm ${seller.totalCommission > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                        ${seller.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                            </>
                                        )}

                                        <td className="py-3.5 px-3 text-center">
                                            <button
                                                onClick={() => setSelectedSellerDetail(seller)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-ios-blue hover:text-white text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 mx-auto"
                                            >
                                                Ver Ventas <ChevronRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* MODAL DE AUDITORÍA Y DETALLE DE VENTAS DEL VENDEDOR */}
            {selectedSellerDetail && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSellerDetail(null)} />
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative p-6 sm:p-8 animate-slide-up border border-white/10 flex flex-col max-h-[90vh] z-10">
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-ios-blue text-white flex items-center justify-center font-black text-xl shadow-lg">
                                    {selectedSellerDetail.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black dark:text-white flex items-center gap-2">
                                        {selectedSellerDetail.name}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        Desglose de ventas en el período ({selectedSellerDetail.orders.length} pedidos)
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSellerDetail(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition dark:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* KPI Bar en Modal */}
                        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 mb-4">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Ventas Totales</p>
                                <p className="text-lg font-black dark:text-white">${selectedSellerDetail.sales.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Tasa Asignada</p>
                                <p className="text-lg font-black text-ios-blue">{selectedSellerDetail.commissionRate}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Comisión Total</p>
                                <p className="text-lg font-black text-emerald-500">${selectedSellerDetail.totalCommission.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Lista Scrollable de Pedidos */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {selectedSellerDetail.orders.length === 0 ? (
                                <p className="text-center py-8 text-gray-400 text-xs">No hay pedidos registrados para este asesor en el período seleccionado.</p>
                            ) : (
                                selectedSellerDetail.orders.map(ord => {
                                    const dateStr = new Date(Number(ord.date)).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                                    const ordComm = ord.sellerCommission !== undefined && ord.sellerCommission > 0
                                        ? ord.sellerCommission
                                        : (selectedSellerDetail.commissionRate > 0 ? (ord.total * (selectedSellerDetail.commissionRate / 100)) : 0);

                                    return (
                                        <div key={ord.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-black/20 border border-gray-100 dark:border-white/5 text-xs hover:border-ios-blue/30 transition-all">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-ios-blue">#{ord.id}</span>
                                                    <span className="text-[10px] text-gray-400">{dateStr}</span>
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-green-100 text-green-700">Completado</span>
                                                </div>
                                                <p className="font-medium dark:text-white mt-1">
                                                    Cliente: {ord.customerName || 'Cliente Mostrador'} • {ord.paymentMethod}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="font-black dark:text-white">${Number(ord.total).toFixed(2)}</p>
                                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    Comisión: +${ordComm.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="pt-4 border-t border-gray-100 dark:border-white/5 mt-4 flex justify-end">
                            <Button variant="secondary" onClick={() => setSelectedSellerDetail(null)}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
