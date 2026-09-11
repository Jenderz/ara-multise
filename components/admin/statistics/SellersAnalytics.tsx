import React, { useMemo, useState } from 'react';
import { Card, Button } from '../../UIComponents';
import { useStore } from '../../../context/StoreContext';
import { Order, Product, UserAccount, SalesAdvisor } from '../../../types';
import { StatCard, CustomTooltip, PIE_COLORS } from './SharedStatsComponents';
import { 
    Trophy, Award, DollarSign, Wallet, ShoppingBag, TrendingUp, 
    User, Search, Download, ChevronRight, X, MapPin, 
    Sparkles, Percent, Monitor, Briefcase, CheckCircle2, Store
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
    directSales?: number;
    assistedSales?: number;
    directOrderCount?: number;
    assistedOrderCount?: number;
}

export const SellersAnalytics: React.FC<SellersAnalyticsProps> = ({ orders }) => {
    const { settings, branches, currentBranch, currentUser } = useStore();
    const [activeCategory, setActiveCategory] = useState<'advisors' | 'cashiers'>('advisors');
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItemDetail, setSelectedItemDetail] = useState<SellerPerformance | null>(null);
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

    // 3. Procesar datos independientes para ASESORES DE VENTA (PISO)
    const advisorsAnalytics = useMemo(() => {
        const salesAdvisors: SalesAdvisor[] = settings.salesAdvisors || [];
        const advisorsMap = new Map<string, SellerPerformance>();

        // Inicializar con asesores registrados en ajustes
        salesAdvisors.forEach(a => {
            const branchObj = branches.find(b => b.id === a.branchId);
            const branchName = branchObj ? branchObj.name : 'Todas las Sedes';

            advisorsMap.set(a.id, {
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

        let totalAdvisorSales = 0;
        let totalAdvisorCommissions = 0;
        let totalAdvisorOrders = 0;

        periodOrders.forEach(o => {
            const orderTotal = Number(o.total) || 0;

            // Identificar si la orden tiene asesor de venta asignado
            let advisorId = o.advisorId;
            let advisorName = o.advisorName;

            // Retrocompatibilidad con órdenes donde el asesor fue guardado en sellerId
            if (!advisorId && o.sellerId) {
                const matchedAdvisor = salesAdvisors.find(a => a.id === o.sellerId || a.name.toLowerCase() === (o.sellerName || '').toLowerCase());
                if (matchedAdvisor) {
                    advisorId = matchedAdvisor.id;
                    advisorName = matchedAdvisor.name;
                }
            }

            // Si no tiene asesor asignado (venta directa en caja), no computa en asesores
            if (!advisorId || advisorId === 'direct') {
                return;
            }

            let advisorPerf = advisorsMap.get(advisorId);

            // Si no existe en el mapa (asesor desactivado o antiguo), crear entrada dinámica
            if (!advisorPerf) {
                const matchedByName = Array.from(advisorsMap.values()).find(a => a.name.toLowerCase() === (advisorName || '').toLowerCase());
                if (matchedByName) {
                    advisorPerf = matchedByName;
                } else {
                    advisorPerf = {
                        id: advisorId,
                        name: advisorName || 'Asesor No Registrado',
                        username: '',
                        role: 'Asesor',
                        assignedBranchName: 'General',
                        commissionRate: o.advisorRate || o.commissionRate || 0,
                        sales: 0,
                        orderCount: 0,
                        averageTicket: 0,
                        totalCommission: 0,
                        orders: [],
                        percentageOfTotal: 0
                    };
                    advisorsMap.set(advisorId, advisorPerf);
                }
            }

            advisorPerf.sales += orderTotal;
            advisorPerf.orderCount += 1;
            advisorPerf.orders.push(o);

            // Cálculo de comisión para el asesor
            let comm = 0;
            if (o.advisorCommission !== undefined && o.advisorCommission > 0) {
                comm = Number(o.advisorCommission);
            } else if (o.sellerCommission !== undefined && o.sellerCommission > 0) {
                comm = Number(o.sellerCommission);
            } else {
                const rate = o.advisorRate !== undefined && o.advisorRate > 0
                    ? o.advisorRate
                    : (advisorPerf.commissionRate || 0);
                comm = rate > 0 ? (orderTotal * (rate / 100)) : 0;
            }

            advisorPerf.totalCommission += comm;
            totalAdvisorSales += orderTotal;
            totalAdvisorCommissions += comm;
            totalAdvisorOrders += 1;
        });

        // Calcular promedios y porcentajes
        const list = Array.from(advisorsMap.values()).map(a => {
            a.averageTicket = a.orderCount > 0 ? (a.sales / a.orderCount) : 0;
            a.percentageOfTotal = totalAdvisorSales > 0 ? (a.sales / totalAdvisorSales) * 100 : 0;
            return a;
        });

        list.sort((a, b) => b.sales - a.sales);

        const eligibleBest = list.filter(a => a.sales > 0);
        const bestAdvisor = eligibleBest.length > 0 ? eligibleBest[0] : null;

        return {
            advisorsList: list,
            totalAdvisorSales,
            totalAdvisorCommissions,
            totalAdvisorOrders,
            bestAdvisor
        };
    }, [periodOrders, settings.salesAdvisors, branches]);

    // 4. Procesar datos independientes para CAJAS / FACTURACIÓN (SISTEMA)
    const cashiersAnalytics = useMemo(() => {
        const systemUsers: UserAccount[] = settings.users || [];
        const cashiersMap = new Map<string, SellerPerformance>();

        // Inicializar con usuarios del sistema (cajeras, administradores)
        systemUsers.forEach(u => {
            const branchObj = branches.find(b => b.id === u.assignedBranchId);
            const branchName = branchObj ? branchObj.name : 'Todas las Sedes';

            cashiersMap.set(u.id, {
                id: u.id,
                name: u.name,
                username: u.username,
                role: u.role === 'admin' ? 'Administrador' : 'Caja de Sistema',
                assignedBranchName: branchName,
                commissionRate: 0,
                sales: 0,
                orderCount: 0,
                averageTicket: 0,
                totalCommission: 0,
                orders: [],
                percentageOfTotal: 0,
                directSales: 0,
                assistedSales: 0,
                directOrderCount: 0,
                assistedOrderCount: 0
            });
        });

        let totalGlobalSales = 0;
        let totalDirectSales = 0;
        let totalAssistedSales = 0;
        let totalCashierOrders = 0;

        periodOrders.forEach(o => {
            const orderTotal = Number(o.total) || 0;
            totalGlobalSales += orderTotal;
            totalCashierOrders += 1;

            const cid = o.sellerId || 'unknown';
            const cname = o.sellerName || 'Caja Mostrador';
            const hasAdvisor = Boolean(o.advisorId && o.advisorId !== 'direct');

            if (hasAdvisor) {
                totalAssistedSales += orderTotal;
            } else {
                totalDirectSales += orderTotal;
            }

            let cashierPerf = cashiersMap.get(cid);

            // Si la caja no está en usuarios de sistema (ej: web-client o usuario borrado), crear entrada dinámica
            if (!cashierPerf) {
                const matchedByName = Array.from(cashiersMap.values()).find(c => c.name.toLowerCase() === cname.toLowerCase());
                if (matchedByName) {
                    cashierPerf = matchedByName;
                } else {
                    cashierPerf = {
                        id: cid,
                        name: cname,
                        username: cid === 'web-client' ? 'tienda.online' : cid,
                        role: cid === 'web-client' ? 'Tienda Online' : 'Caja Mostrador',
                        assignedBranchName: 'General',
                        commissionRate: 0,
                        sales: 0,
                        orderCount: 0,
                        averageTicket: 0,
                        totalCommission: 0,
                        orders: [],
                        percentageOfTotal: 0,
                        directSales: 0,
                        assistedSales: 0,
                        directOrderCount: 0,
                        assistedOrderCount: 0
                    };
                    cashiersMap.set(cid, cashierPerf);
                }
            }

            cashierPerf.sales += orderTotal;
            cashierPerf.orderCount += 1;
            cashierPerf.orders.push(o);

            if (hasAdvisor) {
                cashierPerf.assistedSales = (cashierPerf.assistedSales || 0) + orderTotal;
                cashierPerf.assistedOrderCount = (cashierPerf.assistedOrderCount || 0) + 1;
            } else {
                cashierPerf.directSales = (cashierPerf.directSales || 0) + orderTotal;
                cashierPerf.directOrderCount = (cashierPerf.directOrderCount || 0) + 1;
            }
        });

        // Calcular promedios y porcentajes
        const list = Array.from(cashiersMap.values()).map(c => {
            c.averageTicket = c.orderCount > 0 ? (c.sales / c.orderCount) : 0;
            c.percentageOfTotal = totalGlobalSales > 0 ? (c.sales / totalGlobalSales) * 100 : 0;
            return c;
        });

        list.sort((a, b) => b.sales - a.sales);

        const eligibleBest = list.filter(c => c.id !== 'web-client' && c.sales > 0);
        const bestCashier = eligibleBest.length > 0 ? eligibleBest[0] : (list[0]?.sales > 0 ? list[0] : null);

        return {
            cashiersList: list,
            totalGlobalSales,
            totalDirectSales,
            totalAssistedSales,
            totalCashierOrders,
            bestCashier
        };
    }, [periodOrders, settings.users, branches]);

    // Determinar dataset según la pestaña activa
    const currentDataset = activeCategory === 'advisors' ? advisorsAnalytics.advisorsList : cashiersAnalytics.cashiersList;
    const currentBest = activeCategory === 'advisors' ? advisorsAnalytics.bestAdvisor : cashiersAnalytics.bestCashier;

    // Filtrar según búsqueda del usuario
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return currentDataset;
        const q = searchQuery.toLowerCase();
        return currentDataset.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.username.toLowerCase().includes(q) ||
            s.assignedBranchName.toLowerCase().includes(q)
        );
    }, [currentDataset, searchQuery]);

    // Datos para gráfico de barras (Top 7)
    const barChartData = useMemo(() => {
        return currentDataset
            .filter(s => s.sales > 0)
            .slice(0, 7)
            .map(s => ({
                name: (s.name || 'Asesor').split(' ')[0] || s.name,
                fullName: s.name,
                sales: s.sales,
                commission: s.totalCommission
            }));
    }, [currentDataset]);

    // Datos para gráfico de dona
    const pieChartData = useMemo(() => {
        return currentDataset
            .filter(s => s.sales > 0)
            .slice(0, 6)
            .map(s => ({
                name: s.name,
                value: s.sales
            }));
    }, [currentDataset]);

    // Exportar a CSV según la categoría activa
    const exportToCSV = () => {
        if (activeCategory === 'advisors') {
            const headers = ["ID", "Asesor de Venta", "Sede", "Ventas Asistidas ($)", "Pedidos Asistidos", "Ticket Promedio ($)", "% Comision", "Total Comision ($)"];
            const rows = advisorsAnalytics.advisorsList.map(s => [
                `"${(s.id || '').replace(/"/g, '""')}"`,
                `"${(s.name || '').replace(/"/g, '""')}"`,
                `"${(s.assignedBranchName || '').replace(/"/g, '""')}"`,
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
            link.setAttribute("download", `comisiones_asesores_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const headers = ["ID", "Caja / Facturó", "Usuario", "Rol", "Sede", "Facturacion Total ($)", "Transacciones", "Ticket Promedio ($)", "Ventas Directas ($)", "Ventas con Asesor ($)"];
            const rows = cashiersAnalytics.cashiersList.map(s => [
                `"${(s.id || '').replace(/"/g, '""')}"`,
                `"${(s.name || '').replace(/"/g, '""')}"`,
                `"${(s.username || '').replace(/"/g, '""')}"`,
                `"${(s.role || '').replace(/"/g, '""')}"`,
                `"${(s.assignedBranchName || '').replace(/"/g, '""')}"`,
                s.sales.toFixed(2),
                s.orderCount,
                s.averageTicket.toFixed(2),
                (s.directSales || 0).toFixed(2),
                (s.assistedSales || 0).toFixed(2)
            ]);

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `facturacion_cajas_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-8">
            {/* Barra Superior: Selector de Categoría (Asesores vs Cajas) y Filtros */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={24} />
                        <h3 className="font-black text-xl dark:text-white">
                            {activeCategory === 'advisors' ? 'Rendimiento y Comisiones de Asesores' : 'Facturación y Auditoría por Cajas'}
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {isGlobalView ? 'Consolidado de todas las sedes' : `Sede actual: ${currentBranch?.name}`} • {activeCategory === 'advisors' ? 'Solo personal de piso con ventas asistidas' : 'Cuentas de usuario y cajas que emitieron comprobantes'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
                    {/* Selector de Pestaña: Asesores vs Cajas */}
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-2xl border border-gray-200 dark:border-white/5 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveCategory('advisors');
                                setSearchQuery('');
                            }}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeCategory === 'advisors'
                                    ? 'bg-ios-blue text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Briefcase size={14} />
                            <span>Asesores de Piso</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeCategory === 'advisors' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                            }`}>
                                {advisorsAnalytics.advisorsList.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveCategory('cashiers');
                                setSearchQuery('');
                            }}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeCategory === 'cashiers'
                                    ? 'bg-ios-blue text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Monitor size={14} />
                            <span>Cajas / Facturación</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeCategory === 'cashiers' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                            }`}>
                                {cashiersAnalytics.cashiersList.length}
                            </span>
                        </button>
                    </div>

                    {/* Toggle de comisiones (visible solo para asesores) */}
                    {activeCategory === 'advisors' && (
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
                    )}

                    <Button 
                        variant="secondary" 
                        onClick={exportToCSV}
                        className="text-xs font-bold gap-2 py-2 px-3 border border-gray-200 dark:border-white/10"
                    >
                        <Download size={14} /> Exportar CSV
                    </Button>

                    {/* Selector de Rango de Fecha */}
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl border border-gray-200 dark:border-white/5 overflow-x-auto no-scrollbar max-w-full">
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

            {/* SECCIÓN PODIO (HERO SPOTLIGHT) */}
            {currentBest ? (
                <div className={`relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-xl p-5 sm:p-8 border ${
                    activeCategory === 'advisors'
                        ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 shadow-orange-500/20 border-amber-300/30'
                        : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-700 shadow-blue-500/20 border-sky-300/30'
                }`}>
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                    {/* Barra Superior Integrada del Hero (Evita colisiones de posición absoluta) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/15 relative z-10">
                        <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-amber-200">
                            <Trophy size={16} className="text-yellow-300 shrink-0" />
                            <span>{activeCategory === 'advisors' ? 'Mejor Asesor del Período' : 'Caja con Mayor Facturación'}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-black/25 backdrop-blur-md text-amber-200 text-xs font-black border border-white/15 shadow-sm">
                            <Sparkles size={14} className="text-yellow-300 shrink-0" />
                            <span>{activeCategory === 'advisors' ? '1º LUGAR EN VENTAS ASISTIDAS' : '1º LUGAR EN FACTURACIÓN'}</span>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 relative z-10">
                        {/* Info del Destacado */}
                        <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-2xl">
                                    {currentBest.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-yellow-400 text-amber-950 flex items-center justify-center shadow-lg border-2 border-white">
                                    <Trophy size={15} strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="space-y-1 min-w-0 flex-1">
                                <h3 className="text-xl sm:text-2xl md:text-3xl font-black leading-tight truncate">
                                    {currentBest.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/85 font-medium">
                                    {currentBest.username && <span>@{currentBest.username} •</span>}
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} className="shrink-0" /> {currentBest.assignedBranchName}
                                    </span>
                                </div>
                                <div className="pt-0.5">
                                    {activeCategory === 'advisors' ? (
                                        showCommissions && currentBest.commissionRate > 0 ? (
                                            <span className="inline-block text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                                Tasa Asignada: {currentBest.commissionRate}%
                                            </span>
                                        ) : (
                                            <span className="inline-block text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                                Asesor de Piso
                                            </span>
                                        )
                                    ) : (
                                        <span className="inline-block text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                            {currentBest.role}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Métricas Destacadas: Se adaptan en 2 columnas en pantallas estrechas y 4 columnas en medianas/amplias */}
                        <div className="w-full xl:w-auto grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 bg-black/25 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/15 shrink-0">
                            <div className="p-2.5 sm:p-3 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">
                                    {activeCategory === 'advisors' ? 'Ventas Asistidas' : 'Total Facturado'}
                                </p>
                                <p className="text-xl sm:text-2xl font-black mt-0.5 truncate">
                                    ${currentBest.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                    {currentBest.percentageOfTotal.toFixed(1)}% del total
                                </p>
                            </div>

                            <div className="p-2.5 sm:p-3 min-w-0 border-l border-white/15">
                                {activeCategory === 'advisors' ? (
                                    showCommissions ? (
                                        <>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">Comisión</p>
                                            <p className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-300 truncate">
                                                ${currentBest.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                                {currentBest.totalCommission > 0 ? 'Generado a liquidar' : 'Sin comisión (0%)'}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">Cuota</p>
                                            <p className="text-xl sm:text-2xl font-black mt-0.5 text-amber-100 truncate">
                                                {currentBest.percentageOfTotal.toFixed(1)}%
                                            </p>
                                            <p className="text-[10px] text-white/70 mt-0.5 truncate">Participación</p>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">Venta Directa</p>
                                        <p className="text-xl sm:text-2xl font-black mt-0.5 text-sky-200 truncate">
                                            ${(currentBest.directSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                            {currentBest.directOrderCount || 0} tickets sin asesor
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="p-2.5 sm:p-3 min-w-0 border-t md:border-t-0 md:border-l border-white/15">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">Transacciones</p>
                                <p className="text-xl sm:text-2xl font-black mt-0.5 truncate">{currentBest.orderCount}</p>
                                <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                    {activeCategory === 'advisors' ? 'Atendidas en piso' : 'Cobradas en caja'}
                                </p>
                            </div>

                            <div className="p-2.5 sm:p-3 min-w-0 border-t md:border-t-0 border-l border-white/15">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 truncate">Ticket Prom.</p>
                                <p className="text-xl sm:text-2xl font-black mt-0.5 truncate">${currentBest.averageTicket.toFixed(2)}</p>
                                <p className="text-[10px] text-white/70 mt-0.5 truncate">Por comprobante</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 text-center">
                    <Trophy size={48} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
                    <h4 className="text-lg font-bold dark:text-white">
                        {activeCategory === 'advisors' ? 'Sin ventas asistidas registradas en este período' : 'Sin transacciones de caja registradas en este período'}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                        {activeCategory === 'advisors' 
                            ? 'Cuando un cajero asigne a un asesor de piso en el POS, las ventas y comisiones se computarán aquí automáticamente.' 
                            : 'Las operaciones de cobro realizadas en cada terminal o caja aparecerán auditadas aquí.'}
                    </p>
                </div>
            )}

            {/* KPI CARDS GLOBALES */}
            {activeCategory === 'advisors' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Ventas Asistidas" 
                        value={`$${advisorsAnalytics.totalAdvisorSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                        icon={<Briefcase size={24}/>} 
                        color="bg-gradient-to-br from-blue-500 to-blue-700" 
                        subtitle="Total asistido por asesores de piso" 
                    />
                    {showCommissions ? (
                        <StatCard 
                            title="Comisiones a Pagar" 
                            value={`$${advisorsAnalytics.totalAdvisorCommissions.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                            icon={<Wallet size={24}/>} 
                            color="bg-gradient-to-br from-emerald-500 to-emerald-700" 
                            subtitle={advisorsAnalytics.totalAdvisorCommissions > 0 ? "Total liquidable del período" : "Sin comisiones pendientes"} 
                        />
                    ) : (
                        <StatCard 
                            title="Asesores Activos" 
                            value={`${advisorsAnalytics.advisorsList.filter(s => s.sales > 0).length} de ${advisorsAnalytics.advisorsList.length}`} 
                            icon={<User size={24}/>} 
                            color="bg-gradient-to-br from-emerald-500 to-emerald-700" 
                            subtitle="Con ventas registradas" 
                        />
                    )}
                    <StatCard 
                        title="Pedidos Asistidos" 
                        value={advisorsAnalytics.totalAdvisorOrders} 
                        icon={<ShoppingBag size={24}/>} 
                        color="bg-gradient-to-br from-orange-400 to-orange-600" 
                        subtitle="Tickets con asesor asignado" 
                    />
                    <StatCard 
                        title="Ticket Promedio Asesor" 
                        value={`$${advisorsAnalytics.totalAdvisorOrders > 0 ? (advisorsAnalytics.totalAdvisorSales / advisorsAnalytics.totalAdvisorOrders).toFixed(2) : '0.00'}`} 
                        icon={<TrendingUp size={24}/>} 
                        color="bg-gradient-to-br from-purple-500 to-purple-700" 
                        subtitle="Promedio por venta asistida" 
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Total Facturado" 
                        value={`$${cashiersAnalytics.totalGlobalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                        icon={<DollarSign size={24}/>} 
                        color="bg-gradient-to-br from-indigo-500 to-indigo-700" 
                        subtitle="Facturado por todas las cajas" 
                    />
                    <StatCard 
                        title="Venta Directa de Caja" 
                        value={`$${cashiersAnalytics.totalDirectSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
                        icon={<CheckCircle2 size={24}/>} 
                        color="bg-gradient-to-br from-emerald-500 to-teal-700" 
                        subtitle="Facturado sin asesor asignado" 
                    />
                    <StatCard 
                        title="Total Transacciones" 
                        value={cashiersAnalytics.totalCashierOrders} 
                        icon={<ShoppingBag size={24}/>} 
                        color="bg-gradient-to-br from-orange-400 to-orange-600" 
                        subtitle="Comprobantes procesados en cajas" 
                    />
                    <StatCard 
                        title="Ticket Promedio Caja" 
                        value={`$${cashiersAnalytics.totalCashierOrders > 0 ? (cashiersAnalytics.totalGlobalSales / cashiersAnalytics.totalCashierOrders).toFixed(2) : '0.00'}`} 
                        icon={<TrendingUp size={24}/>} 
                        color="bg-gradient-to-br from-purple-500 to-purple-700" 
                        subtitle="Promedio general por transacción" 
                    />
                </div>
            )}

            {/* GRÁFICOS: RANKING Y PARTICIPACIÓN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ranking Bar Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <Award className="text-ios-blue" size={20} /> 
                                {activeCategory === 'advisors' ? 'Ranking de Asesores por Venta' : 'Ranking de Facturación por Caja'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {activeCategory === 'advisors' ? 'Ingresos generados por asesor de piso' : 'Volumen facturado por cada caja / usuario'}
                            </p>
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
                                    <Bar dataKey="sales" name="sales" fill={activeCategory === 'advisors' ? '#007AFF' : '#6366F1'} radius={[8, 8, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 text-xs">
                            No hay suficientes datos para graficar en este período.
                        </div>
                    )}
                </div>

                {/* Cuota / Participación Pie Chart */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                    <h3 className="font-bold text-lg dark:text-white mb-1">
                        {activeCategory === 'advisors' ? 'Cuota de Asesores' : 'Cuota de Facturación'}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                        {activeCategory === 'advisors' ? 'Participación relativa en ventas de piso' : 'Distribución del cobro entre cajas'}
                    </p>

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
                                        <p className="text-sm font-black dark:text-white">
                                            ${(activeCategory === 'advisors' ? advisorsAnalytics.totalAdvisorSales : cashiersAnalytics.totalGlobalSales).toLocaleString('en-US', { notation: 'compact' })}
                                        </p>
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

            {/* TABLA DE RENDIMIENTO Y LIQUIDACIÓN */}
            <Card className="p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            {activeCategory === 'advisors' ? (
                                <>
                                    <Briefcase className="text-ios-blue" size={20} /> Liquidación y Rendimiento por Asesor
                                </>
                            ) : (
                                <>
                                    <Monitor className="text-indigo-500" size={20} /> Auditoría de Facturación por Caja
                                </>
                            )}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {activeCategory === 'advisors' 
                                ? 'Listado de asesores de piso, tickets asistidos y comisiones acumuladas' 
                                : 'Detalle de transacciones cobradas por cada caja (con y sin asesor)'}
                        </p>
                    </div>

                    <div className="w-full sm:w-64 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder={activeCategory === 'advisors' ? "Buscar asesor..." : "Buscar caja o usuario..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs dark:text-white outline-none focus:ring-1 focus:ring-ios-blue font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[760px]">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-white/5 text-[10px] text-gray-400 uppercase font-black">
                                <th className="py-3 px-3"># Pos</th>
                                <th className="py-3 px-3">{activeCategory === 'advisors' ? 'Asesor de Venta' : 'Caja / Facturó'}</th>
                                <th className="py-3 px-3">Sede</th>
                                <th className="py-3 px-3 text-right">{activeCategory === 'advisors' ? 'Ventas Asistidas' : 'Facturación Total'}</th>
                                <th className="py-3 px-3 text-center">{activeCategory === 'advisors' ? 'Tickets Asistidos' : 'Transacciones'}</th>
                                <th className="py-3 px-3 text-right">Ticket Prom.</th>

                                {activeCategory === 'advisors' ? (
                                    showCommissions && (
                                        <>
                                            <th className="py-3 px-3 text-center">% Comisión</th>
                                            <th className="py-3 px-3 text-right">Comisión a Pagar</th>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <th className="py-3 px-3 text-right">Venta Directa</th>
                                        <th className="py-3 px-3 text-right">Con Asesor</th>
                                    </>
                                )}
                                <th className="py-3 px-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5 font-medium">
                            {filteredItems.map((item, idx) => {
                                const isTop = idx === 0 && item.sales > 0;
                                const isSecond = idx === 1 && item.sales > 0;
                                const isThird = idx === 2 && item.sales > 0;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors group">
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
                                                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shadow-sm ${
                                                    activeCategory === 'advisors'
                                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                                        : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                                                }`}>
                                                    {item.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                                        {item.name}
                                                        {item.id === currentUser?.id && (
                                                            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.2 rounded font-bold">Tu Cuenta</span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                                            activeCategory === 'advisors'
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
                                                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/30'
                                                        }`}>
                                                            {item.role}
                                                        </span>
                                                        {item.username && (
                                                            <span className="text-[10px] text-gray-400 font-mono">@{item.username}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400">
                                            <span className="text-[11px] font-bold">{item.assignedBranchName}</span>
                                        </td>

                                        <td className="py-3.5 px-3 text-right">
                                            <p className="font-black text-gray-800 dark:text-white">${item.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] text-gray-400">{item.percentageOfTotal.toFixed(1)}% cuota</p>
                                        </td>

                                        <td className="py-3.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-bold">
                                                {item.orderCount}
                                            </span>
                                        </td>

                                        <td className="py-3.5 px-3 text-right font-bold text-gray-600 dark:text-gray-300">
                                            ${item.averageTicket.toFixed(2)}
                                        </td>

                                        {activeCategory === 'advisors' ? (
                                            showCommissions && (
                                                <>
                                                    <td className="py-3.5 px-3 text-center">
                                                        {item.commissionRate > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                                                {item.commissionRate}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px] font-medium">0%</span>
                                                        )}
                                                    </td>

                                                    <td className="py-3.5 px-3 text-right">
                                                        <span className={`font-black text-sm ${item.totalCommission > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            ${item.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                </>
                                            )
                                        ) : (
                                            <>
                                                <td className="py-3.5 px-3 text-right">
                                                    <p className="font-bold text-gray-700 dark:text-gray-200">
                                                        ${(item.directSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400">
                                                        {item.sales > 0 ? (((item.directSales || 0) / item.sales) * 100).toFixed(0) : 0}% directa
                                                    </p>
                                                </td>

                                                <td className="py-3.5 px-3 text-right">
                                                    <p className="font-bold text-gray-700 dark:text-gray-200">
                                                        ${(item.assistedSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[9px] text-ios-blue">
                                                        {item.sales > 0 ? (((item.assistedSales || 0) / item.sales) * 100).toFixed(0) : 0}% con asesor
                                                    </p>
                                                </td>
                                            </>
                                        )}

                                        <td className="py-3.5 px-3 text-center">
                                            <button
                                                onClick={() => setSelectedItemDetail(item)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-ios-blue hover:text-white text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 mx-auto"
                                            >
                                                Ver Detalle <ChevronRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* MODAL DE AUDITORÍA Y DETALLE DE COMPROBANTES */}
            {selectedItemDetail && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItemDetail(null)} />
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative p-6 sm:p-8 animate-slide-up border border-white/10 flex flex-col max-h-[90vh] z-10">
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-xl shadow-lg ${
                                    activeCategory === 'advisors' ? 'bg-ios-blue' : 'bg-indigo-600'
                                }`}>
                                    {selectedItemDetail.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black dark:text-white flex items-center gap-2">
                                        {selectedItemDetail.name}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        {activeCategory === 'advisors'
                                            ? `Auditoría de ventas asistidas (${selectedItemDetail.orders.length} pedidos)`
                                            : `Auditoría de comprobantes emitidos en caja (${selectedItemDetail.orders.length} pedidos)`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItemDetail(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition dark:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* KPI Bar en Modal */}
                        {activeCategory === 'advisors' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 mb-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Ventas Asistidas</p>
                                    <p className="text-lg font-black dark:text-white">${selectedItemDetail.sales.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Tasa Asignada</p>
                                    <p className="text-lg font-black text-ios-blue">{selectedItemDetail.commissionRate}%</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Comisión Acumulada</p>
                                    <p className="text-lg font-black text-emerald-500">${selectedItemDetail.totalCommission.toFixed(2)}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 mb-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Facturación Total</p>
                                    <p className="text-lg font-black dark:text-white">${selectedItemDetail.sales.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Venta Directa (Sin Asesor)</p>
                                    <p className="text-lg font-black text-emerald-600">${(selectedItemDetail.directSales || 0).toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Venta con Asesor</p>
                                    <p className="text-lg font-black text-ios-blue">${(selectedItemDetail.assistedSales || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        {/* Lista Scrollable de Pedidos */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {selectedItemDetail.orders.length === 0 ? (
                                <p className="text-center py-8 text-gray-400 text-xs">No hay comprobantes registrados en el período seleccionado.</p>
                            ) : (
                                selectedItemDetail.orders.map(ord => {
                                    const dateStr = new Date(Number(ord.date)).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                                    const ordComm = ord.advisorCommission !== undefined && ord.advisorCommission > 0
                                        ? ord.advisorCommission
                                        : (ord.sellerCommission !== undefined && ord.sellerCommission > 0
                                            ? ord.sellerCommission
                                            : (selectedItemDetail.commissionRate > 0 ? (ord.total * (selectedItemDetail.commissionRate / 100)) : 0));

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

                                                {/* Auditoría cruzada: si estamos en asesor, mostrar qué caja cobró. Si estamos en caja, mostrar qué asesor asistió */}
                                                <div className="mt-1 flex items-center gap-2">
                                                    {activeCategory === 'advisors' ? (
                                                        <span className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
                                                            <Monitor size={11} className="text-gray-400" />
                                                            Caja de Cobro: <strong className="text-gray-700 dark:text-gray-300">{ord.sellerName || 'Caja Principal'}</strong>
                                                        </span>
                                                    ) : (
                                                        ord.advisorName ? (
                                                            <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-bold">
                                                                <Briefcase size={11} />
                                                                Asistido por: {ord.advisorName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                                                <CheckCircle2 size={11} />
                                                                Venta Directa de Caja (Sin Asesor)
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="font-black dark:text-white">${Number(ord.total).toFixed(2)}</p>
                                                {activeCategory === 'advisors' && (
                                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                        Comisión: +${ordComm.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="pt-4 border-t border-gray-100 dark:border-white/5 mt-4 flex justify-end">
                            <Button variant="secondary" onClick={() => setSelectedItemDetail(null)}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
