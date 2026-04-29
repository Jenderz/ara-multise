
import React, { useMemo, useState, useEffect } from 'react';
import { Product, StockMovement } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { api } from '../../../services/api';
import { StatCard, CustomTooltip, PIE_COLORS } from './SharedStatsComponents';
import { DollarSign, Package, TrendingUp, Layers, CheckCircle2, XCircle, AlertTriangle, History, RotateCcw, Search, Filter, ArrowUpCircle, ArrowDownCircle, RefreshCcw, MapPin } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface InventoryAnalyticsProps {
    products: Product[];
}

export const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({ products }) => {
    // Agregamos 'branches' del contexto para hacer el cruce de nombres sin tocar backend
    const { userRole, currentBranch, branches } = useStore();
    const isGlobalView = currentBranch?.id === 0;

    // --- ESTADOS INVENTARIO (AUDITORÍA & PAGINACIÓN) ---
    const [movements, setMovements] = useState<(StockMovement & { product_title?: string, product_code?: string, branch_id?: number })[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [auditType, setAuditType] = useState('all');
    const [selectedProductId, setSelectedProductId] = useState<string>(''); // Nuevo filtro por producto

    // Estados de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize] = useState(50); // Registros por página

    // Debounce para búsqueda de texto
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(auditSearch);
            setCurrentPage(1); // Reset a página 1 cuando cambia la búsqueda
        }, 500);
        return () => clearTimeout(timer);
    }, [auditSearch]);

    useEffect(() => {
        const loadAuditData = async () => {
            setLoadingMovements(true);
            try {
                const data = await api.getMovements(currentPage, pageSize, selectedProductId, auditType, debouncedSearch);

                // Compatibilidad con formato nuevo (paginado) y antiguo (array directo)
                if (data && data.movements && Array.isArray(data.movements)) {
                    // Formato nuevo con paginación
                    setMovements(data.movements);
                    setTotalPages(data.pagination?.totalPages || 1);
                    setTotalRecords(data.pagination?.total || 0);
                } else if (Array.isArray(data)) {
                    // Formato antiguo (array directo) - para compatibilidad
                    setMovements(data);
                    setTotalPages(1);
                    setTotalRecords(data.length);
                } else {
                    console.warn("Formato de respuesta inesperado:", data);
                    setMovements([]);
                }
            } catch (e) {
                console.error("Error loading movements", e);
            } finally {
                setLoadingMovements(false);
            }
        };
        loadAuditData();
    }, [currentPage, selectedProductId, auditType, debouncedSearch]);

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

            if (p.isVisible) activeProducts++;

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

    const resetAuditFilters = () => {
        setAuditSearch('');
        setAuditType('all');
        setSelectedProductId('');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={isGlobalView ? "Valor Global (PVP)" : "Valor Sede (PVP)"}
                    value={`$${metrics.totalRetailValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    subtitle={`${metrics.totalStockCount} unidades totales`}
                    icon={<DollarSign size={20} />}
                    color="bg-blue-600"
                />

                {userRole === 'admin' ? (
                    <>
                        <StatCard
                            title="Costo Operativo"
                            value={`$${metrics.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                            subtitle="Inversión en mercancía"
                            icon={<Package size={20} />}
                            color="bg-slate-600"
                        />
                        <StatCard
                            title="Beneficio Potencial"
                            value={`$${metrics.potentialProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                            subtitle={`Margen prom: ${metrics.profitMargin.toFixed(1)}%`}
                            icon={<TrendingUp size={20} />}
                            color="bg-green-600"
                        />
                    </>
                ) : (
                    <>
                        <StatCard
                            title="Total Unidades"
                            value={metrics.totalStockCount}
                            subtitle="Productos físicos"
                            icon={<Layers size={20} />}
                            color="bg-purple-600"
                        />
                        <StatCard
                            title="Productos Activos"
                            value={metrics.activeProducts}
                            subtitle="Visibles en tienda"
                            icon={<CheckCircle2 size={20} />}
                            color="bg-green-600"
                        />
                    </>
                )}

                <div className="grid grid-rows-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-2xl flex items-center justify-between border border-red-100 dark:border-red-900/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600"><XCircle size={16} /></div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-red-400">Agotados</p>
                                <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{metrics.outOfStockItems}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/10 px-4 py-3 rounded-2xl flex items-center justify-between border border-orange-100 dark:border-orange-900/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><AlertTriangle size={16} /></div>
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
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-6"><Layers size={18} className="text-ios-blue" /> Valor por Categoría</h3>
                    <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} tickFormatter={(val) => `$${val / 1000}k`} /><Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} /><Bar dataKey="value" name="value" radius={[4, 4, 0, 0]} barSize={30}>{metrics.chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Bar></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg dark:text-white mb-4">Top Stock (Unidades)</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">{metrics.chartData.map((cat, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}>{idx + 1}</div><div><p className="font-bold text-sm dark:text-white">{cat.name}</p><p className="text-[10px] text-gray-500">${cat.value.toLocaleString()} en valor</p></div></div><div className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg text-xs font-bold dark:text-white shadow-sm">{cat.count} u.</div></div>))}</div>
                </div>
            </div>

            {/* SECCIÓN DE AUDITORÍA Y MERMAS CON FILTROS */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex flex-col gap-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <History size={20} className="text-red-500" /> Auditoría Real de Inventario
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="text-xs bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-full text-gray-500 font-medium">
                                Mostrando {movements.length} de {totalRecords.toLocaleString()} movimientos (Página {currentPage} de {totalPages})
                            </div>
                            <button
                                onClick={resetAuditFilters}
                                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors"
                                title="Recargar y Limpiar"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                        {/* Selector de Producto */}
                        <div className="relative md:col-span-2">
                            <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer focus:border-ios-blue transition-colors"
                                value={selectedProductId}
                                onChange={e => setSelectedProductId(e.target.value)}
                            >
                                <option value="">Todos los Productos</option>
                                {products
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} ({p.code})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="md:col-span-2 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                placeholder="Buscar referencia o sede..."
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 focus:border-ios-blue transition-colors"
                                value={auditSearch}
                                onChange={e => setAuditSearch(e.target.value)}
                            />
                        </div>
                        <div className="relative md:col-span-2">
                            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                                <th className="pb-3 w-28">Sede</th> {/* NUEVA COLUMNA */}
                                <th className="pb-3 w-32">Tipo</th>
                                <th className="pb-3 w-20 text-center">Cant.</th>
                                <th className="pb-3 text-right pr-2">Detalle / Referencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loadingMovements ? (
                                <tr><td colSpan={6} className="text-center py-10">Cargando datos...</td></tr>
                            ) : movements.length > 0 ? (
                                movements.map((mov) => {
                                    const isEntry = mov.type === 'entry' || mov.type === 'transfer_in';
                                    const isSale = mov.type === 'sale';
                                    const isExit = mov.type === 'exit' || mov.type === 'transfer_out';
                                    const isAdj = mov.type === 'adjustment';

                                    // Detectar si el ajuste fue positivo o negativo por el texto de referencia si es adjustment
                                    let isPositiveAdj = false;
                                    if (isAdj && mov.reference.includes('+')) isPositiveAdj = true;

                                    // RESOLUCIÓN DE NOMBRE DE SEDE (Frontend Side)
                                    // La API devuelve 'branch_id' (snake_case) o 'branchId' según el mapper.
                                    // Usamos fallback para asegurar compatibilidad.
                                    const rawBid = mov.branchId || mov.branch_id || 1;
                                    const branchObj = branches.find(b => b.id === Number(rawBid));
                                    const branchName = branchObj ? branchObj.name : 'Sede Principal';

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
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded w-fit">
                                                    <MapPin size={10} /> {branchName}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                {isEntry ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">
                                                        <ArrowUpCircle size={10} /> Entrada
                                                    </span>
                                                ) : isSale ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                                                        <DollarSign size={10} /> Venta
                                                    </span>
                                                ) : isExit ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
                                                        <ArrowDownCircle size={10} /> Salida
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${isPositiveAdj ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                                                        <RefreshCcw size={10} /> {isPositiveAdj ? 'Entrada (Ajuste)' : 'Salida (Ajuste)'}
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
                                    <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                                        No hay movimientos registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                        >
                            ← Anterior
                        </button>

                        <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum
                                            ? 'bg-ios-blue text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                        >
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
