import React, { useMemo, useState } from 'react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Card, Input } from '../UIComponents';
import { Package, AlertTriangle, TrendingUp, DollarSign, Layers, CheckCircle2, XCircle, History, User, ClipboardList, ArrowDownCircle, ArrowUpCircle, Filter, Search, Calendar, RefreshCcw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';

const StatCard = ({ title, value, subtitle, icon, color }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-gray-100 dark:border-white/5 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-2 relative z-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${color}`}>
                {icon}
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-2xl font-black text-ios-text dark:text-white tracking-tight">{value}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.05] ${color} group-hover:scale-150 transition-transform duration-500`}></div>
    </div>
);

export const InventoryAnalyticsModule = ({ products }: { products: Product[] }) => {
    const { logs, settings, userRole } = useStore(); 
    
    // --- ESTADOS DE FILTRO ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterUser, setFilterUser] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

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
            const hasVariants = p.variants && p.variants.length > 0;
            const pStock = hasVariants 
                ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
                : (p.stock || 0);

            let pCostVal = 0;
            let pRetailVal = 0;

            if (hasVariants) {
                p.variants.forEach(v => {
                    const variantStock = v.stock || 0;
                    pCostVal += variantStock * (p.cost || 0);
                    pRetailVal += variantStock * (v.price || p.price);
                });
            } else {
                pCostVal = pStock * (p.cost || 0);
                pRetailVal = pStock * (p.price || 0);
            }

            totalCost += pCostVal;
            totalRetailValue += pRetailVal;
            totalStockCount += pStock;

            if (p.isVisible) activeProducts++;
            if (pStock === 0) outOfStockItems++;
            else if (pStock < 5) lowStockItems++;

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
            profitMargin: totalRetailValue > 0 ? ((totalRetailValue - totalCost) / totalRetailValue) * 100 : 0
        };
    }, [products]);

    // LÓGICA DE FILTRADO DE LOGS (FIX INCLUDES ERROR)
    const stockLogs = useMemo(() => {
        return (logs || []).filter(log => {
            const actionStr = (log.action || '');
            const isStockRelated = ['update_product', 'create_product', 'delete_product'].includes(actionStr);
            if (!isStockRelated) return false;

            const detailsStr = (log.details || '').toLowerCase();
            const userNameStr = (log.userName || '').toLowerCase();

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!detailsStr.includes(query) && !userNameStr.includes(query)) return false;
            }

            if (filterUser !== 'all' && log.userId !== filterUser) return false;

            if (filterType !== 'all') {
                const isExit = detailsStr.includes('exit') || detailsStr.includes('salida');
                const isEntry = detailsStr.includes('entry') || detailsStr.includes('entrada');
                const isAdjustment = detailsStr.includes('adjustment') || detailsStr.includes('ajuste');
                
                if (filterType === 'exit' && !isExit) return false;
                if (filterType === 'entry' && !isEntry) return false;
                if (filterType === 'adjustment' && !isAdjustment) return false;
                if (filterType === 'create' && actionStr !== 'create_product') return false;
                if (filterType === 'delete' && actionStr !== 'delete_product') return false;
            }

            if (dateStart) {
                const start = new Date(dateStart).getTime();
                if (log.timestamp < start) return false;
            }
            if (dateEnd) {
                const end = new Date(dateEnd).getTime() + 86400000; 
                if (log.timestamp > end) return false;
            }

            return true;
        }).slice(0, 100); 
    }, [logs, searchQuery, filterUser, filterType, dateStart, dateEnd]);

    const COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#34C759', '#5AC8FA', '#8E8E93'];

    const usersList = useMemo(() => {
        const uniqueUsers = new Map();
        (logs || []).forEach(l => {
            if (['update_product', 'create_product', 'delete_product'].includes(l.action || '')) {
                uniqueUsers.set(l.userId, l.userName);
            }
        });
        return Array.from(uniqueUsers.entries());
    }, [logs]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Valor Inventario (PVP)" 
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
                            title="Beneficio Proyectado" 
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
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <Layers size={18} className="text-ios-blue"/> Distribución de Valor por Categoría
                        </h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.chartData} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8E8E93'}} tickFormatter={(val) => `$${val/1000}k`} />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                                    {metrics.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg dark:text-white mb-4">Top Categorías (Unidades)</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {metrics.chartData.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: COLORS[idx % COLORS.length]}}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{cat.name}</p>
                                        <p className="text-[10px] text-gray-500">${cat.value.toLocaleString()} en valor</p>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg text-xs font-bold dark:text-white shadow-sm">
                                    {cat.count} u.
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex flex-col gap-6 mb-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <History size={20} className="text-red-500"/> Auditoría de Movimientos y Mermas
                        </h3>
                        <div className="text-xs bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full text-gray-500 font-medium">
                            {stockLogs.length} registros encontrados
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                        <div className="md:col-span-2 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            <input 
                                placeholder="Buscar detalle..." 
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            <select 
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer"
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                            >
                                <option value="all">Todo Tipo</option>
                                <option value="entry">Entradas</option>
                                <option value="exit">Salidas / Mermas</option>
                                <option value="adjustment">Ajustes</option>
                                <option value="create">Creaciones</option>
                                <option value="delete">Eliminaciones</option>
                            </select>
                        </div>

                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            <select 
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer"
                                value={filterUser}
                                onChange={e => setFilterUser(e.target.value)}
                            >
                                <option value="all">Todo Usuario</option>
                                {usersList.map(([uid, uname]) => (
                                    <option key={uid} value={uid}>{uname}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <input type="date" className="w-full bg-white dark:bg-black/20 px-2 py-2 rounded-xl text-[10px] outline-none dark:text-white border border-gray-200 dark:border-white/10" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                            <input type="date" className="w-full bg-white dark:bg-black/20 px-2 py-2 rounded-xl text-[10px] outline-none dark:text-white border border-gray-200 dark:border-white/10" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] text-gray-400 uppercase font-black tracking-widest border-b border-gray-100 dark:border-white/5">
                            <tr>
                                <th className="pb-3 pl-2">Fecha</th>
                                <th className="pb-3">Responsable</th>
                                <th className="pb-3">Acción</th>
                                <th className="pb-3 text-right pr-2">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {stockLogs.length > 0 ? (
                                stockLogs.map((log) => {
                                    const logDetails = (log.details || '').toLowerCase();
                                    const isExit = logDetails.includes('exit') || logDetails.includes('salida');
                                    const isAdjustment = logDetails.includes('ajuste') || logDetails.includes('adjustment');
                                    const isEntry = logDetails.includes('entry') || logDetails.includes('entrada');
                                    const isDelete = log.action === 'delete_product';
                                    const isCreate = log.action === 'create_product';
                                    
                                    return (
                                        <tr key={log.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-3 pl-2 text-xs text-gray-500 font-mono whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('es-ES')}
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                        <User size={12}/>
                                                    </div>
                                                    <span className="text-xs font-bold dark:text-white">{log.userName}</span>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                {isExit ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                                                        <ArrowDownCircle size={12}/> Salida / Merma
                                                    </span>
                                                ) : isAdjustment ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
                                                        <ClipboardList size={12}/> Ajuste
                                                    </span>
                                                ) : isEntry ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                                                        <ArrowUpCircle size={12}/> Entrada
                                                    </span>
                                                ) : isCreate ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-md">
                                                        <Package size={12}/> Nuevo Producto
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                                        <RefreshCcw size={12}/> Actualización
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right pr-2 text-xs text-gray-600 dark:text-gray-400">
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-400 text-xs">
                                        <Search size={24} className="mx-auto mb-2 opacity-20"/>
                                        No hay movimientos que coincidan con los filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};