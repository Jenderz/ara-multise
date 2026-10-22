
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Product, StockMovement } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { api } from '../../../services/api';
import { StatCard, CustomTooltip, PIE_COLORS } from './SharedStatsComponents';
import { StagnantStockAnalytics } from './StagnantStockAnalytics';
import { DollarSign, Package, TrendingUp, Layers, CheckCircle2, XCircle, AlertTriangle, History, RotateCcw, Search, Filter, ArrowUpCircle, ArrowDownCircle, RefreshCcw, MapPin, Clock, Calendar, LayoutList, Table as TableIcon, ChevronDown, Check, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface InventoryAnalyticsProps {
    products: Product[];
}

interface SearchableProductSelectProps {
    products: Product[];
    selectedProductId: string;
    onSelect: (productId: string) => void;
}

const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
    products,
    selectedProductId,
    onSelect,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Cerrar al hacer clic fuera del componente
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            setTimeout(() => inputRef.current?.focus(), 60);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Cerrar con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const selectedProduct = useMemo(
        () => products.find(p => p.id === selectedProductId),
        [products, selectedProductId]
    );

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) {
            return products.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }
        const q = searchTerm.toLowerCase().trim();
        return products.filter(p => {
            const matchTitle = (p.title || '').toLowerCase().includes(q);
            const matchCode = (p.code || '').toLowerCase().includes(q);
            const matchCat = (p.category || '').toLowerCase().includes(q);
            const matchVar = p.variants?.some(v => 
                (v.sku || '').toLowerCase().includes(q) ||
                (v.name || '').toLowerCase().includes(q) ||
                Object.values(v.selections || {}).some(val => (val || '').toLowerCase().includes(q))
            );
            return matchTitle || matchCode || matchCat || matchVar;
        }).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }, [products, searchTerm]);

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect('');
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Botón Disparador */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-black/20 px-3 py-2 rounded-xl text-xs outline-none dark:text-white border transition-all text-left ${
                    isOpen 
                        ? 'border-ios-blue ring-2 ring-ios-blue/10 shadow-sm' 
                        : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                title="Filtrar por producto con buscador inteligente"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Package size={14} className="text-gray-400 shrink-0" />
                    {selectedProduct ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {selectedProduct.images?.[0] && (
                                <img
                                    src={selectedProduct.images[0]}
                                    alt=""
                                    className="w-4 h-4 rounded object-cover shrink-0 border border-black/5 dark:border-white/10"
                                />
                            )}
                            <span className="font-bold truncate text-gray-900 dark:text-white text-xs">
                                {selectedProduct.title}
                            </span>
                            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shrink-0">
                                    {selectedProduct.variants.length} var
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-500 dark:text-gray-400 truncate text-xs font-medium">
                            Todos los Productos
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {selectedProduct && (
                        <span
                            role="button"
                            onClick={handleClear}
                            className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 text-gray-400 hover:text-red-500 transition-colors"
                            title="Quitar filtro de producto"
                        >
                            <X size={12} />
                        </span>
                    )}
                    <ChevronDown size={13} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-ios-blue' : ''}`} />
                </div>
            </button>

            {/* Popover Desplegable */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-full sm:w-[340px] max-w-[92vw] z-[70] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-150 dark:border-white/10 overflow-hidden flex flex-col animate-scale-in">
                    {/* Buscador Integrado */}
                    <div className="p-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 flex items-center gap-2">
                        <Search size={14} className="text-gray-400 shrink-0 ml-1" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar por nombre, código o variante..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent text-xs outline-none dark:text-white placeholder-gray-400 font-medium py-1"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-0.5"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Lista con Scroll */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5 p-1 no-scrollbar">
                        {/* Opción Todos los Productos */}
                        <button
                            type="button"
                            onClick={() => {
                                onSelect('');
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors text-xs font-semibold ${
                                !selectedProductId 
                                    ? 'bg-ios-blue/10 text-ios-blue dark:bg-ios-blue/20' 
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Package size={14} className={!selectedProductId ? 'text-ios-blue' : 'text-gray-400'} />
                                Todos los Productos
                            </span>
                            {!selectedProductId && <Check size={14} className="text-ios-blue" />}
                        </button>

                        {/* Listado de Productos Coincidentes */}
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(p => {
                                const isSelected = p.id === selectedProductId;
                                const hasVars = p.variants && p.variants.length > 0;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(p.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors gap-2 ${
                                            isSelected 
                                                ? 'bg-ios-blue/10 text-ios-blue dark:bg-ios-blue/20' 
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 shrink-0 border border-gray-200/50 dark:border-white/10 flex items-center justify-center">
                                                {p.images?.[0] ? (
                                                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package size={14} className="text-gray-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-ios-blue' : 'dark:text-white text-gray-900'}`}>
                                                    {p.title}
                                                </p>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        {p.code}
                                                    </span>
                                                    {hasVars && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                                            {p.variants.length} variantes
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-400">
                                                        • Stock: {p.stock ?? 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-ios-blue shrink-0" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1.5">
                                <Search size={20} className="text-gray-300 dark:text-gray-600 mb-1" />
                                <span>No se encontraron productos para "{searchTerm}"</span>
                            </div>
                        )}
                    </div>

                    {/* Footer con Contador */}
                    <div className="p-2 px-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                        <span>{filteredProducts.length} de {products.length} productos</span>
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="text-ios-blue hover:underline font-bold"
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({ products }) => {
    // Agregamos 'branches' del contexto para hacer el cruce de nombres sin tocar backend
    const { userRole, currentBranch, branches } = useStore();
    const isGlobalView = currentBranch?.id === 0;

    // --- ESTADOS INVENTARIO (AUDITORÍA & PAGINACIÓN) ---
    const [movements, setMovements] = useState<(StockMovement & { product_title?: string, product_code?: string, branch_id?: number, user_name?: string })[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [auditType, setAuditType] = useState('all');
    const [selectedProductId, setSelectedProductId] = useState<string>(''); // Filtro por producto
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>(isGlobalView ? 'all' : (currentBranch?.id || 1));
    const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
    const [inventorySubTab, setInventorySubTab] = useState<'movements' | 'stagnant'>('movements');

    // Estados de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize] = useState(50); // Registros por página

    // Sincronizar filtro de sede si cambia la sede activa
    useEffect(() => {
        setSelectedBranchId(isGlobalView ? 'all' : (currentBranch?.id || 1));
        setCurrentPage(1);
    }, [currentBranch?.id, isGlobalView]);

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
                const data = await api.getMovements(currentPage, pageSize, selectedProductId, auditType, debouncedSearch, selectedBranchId);

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
    }, [currentPage, selectedProductId, auditType, debouncedSearch, selectedBranchId]);

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
            // En Vista Global se usa globalStock consolidado si está disponible; en sede local, stock de la sede
            const pStock = (isGlobalView && p.globalStock !== undefined) ? Number(p.globalStock) : (Number(p.stock) || 0);
            const pCostVal = pStock * (Number(p.cost) || 0);
            const pRetailVal = pStock * (Number(p.price) || 0);

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
    }, [products, isGlobalView]);

    const resetAuditFilters = () => {
        setAuditSearch('');
        setAuditType('all');
        setSelectedProductId('');
        setSelectedBranchId(isGlobalView ? 'all' : (currentBranch?.id || 1));
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
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm min-w-0">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-6"><Layers size={18} className="text-ios-blue" /> Valor por Categoría</h3>
                    <div className="h-[300px] w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8E8E93' }} tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`} /><Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} /><Bar dataKey="value" name="value" radius={[4, 4, 0, 0]} barSize={30}>{metrics.chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Bar></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col min-w-0">
                    <h3 className="font-bold text-lg dark:text-white mb-4">Stock por Categoría</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">{metrics.chartData.map((cat, idx) => (<div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}>{idx + 1}</div><div><p className="font-bold text-sm dark:text-white">{cat.name}</p><p className="text-[10px] text-gray-500">${cat.value.toLocaleString()} en valor</p></div></div><div className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg text-xs font-bold dark:text-white shadow-sm">{cat.count} u.</div></div>))}</div>
                </div>
            </div>

            {/* SUB-NAVEGACIÓN: Auditoría vs Stock Estancado */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                        onClick={() => setInventorySubTab('movements')}
                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            inventorySubTab === 'movements'
                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200/50 dark:border-purple-800/40'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <History size={15} />
                        <span>Auditoría de Movimientos</span>
                    </button>
                    <button
                        onClick={() => setInventorySubTab('stagnant')}
                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            inventorySubTab === 'stagnant'
                                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shadow-sm border border-orange-200/50 dark:border-orange-800/40'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <AlertTriangle size={15} className="text-orange-500" />
                        <span>Stock Estancado (Baja Rotación)</span>
                    </button>
                </div>
            </div>

            {inventorySubTab === 'stagnant' ? (
                <StagnantStockAnalytics />
            ) : (
                /* SECCIÓN DE AUDITORÍA Y MERMAS CON FILTROS */
                <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm max-w-full relative">
                <div className="flex flex-col gap-4 sm:gap-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base sm:text-lg dark:text-white flex items-center gap-2">
                                <History size={20} className="text-red-500 shrink-0" /> Auditoría Real de Inventario
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            {/* Selector de Vista en Móvil */}
                            <div className="flex md:hidden items-center bg-gray-100 dark:bg-white/10 p-0.5 rounded-xl border border-gray-200/50 dark:border-white/5">
                                <button
                                    onClick={() => setMobileViewMode('cards')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${mobileViewMode === 'cards' ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                                    title="Vista Lista"
                                >
                                    <LayoutList size={13} />
                                    <span>Lista</span>
                                </button>
                                <button
                                    onClick={() => setMobileViewMode('table')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${mobileViewMode === 'table' ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                                    title="Vista Tabla"
                                >
                                    <TableIcon size={13} />
                                    <span>Tabla</span>
                                </button>
                            </div>

                            <div className="text-[11px] sm:text-xs bg-gray-100 dark:bg-white/10 px-2.5 sm:px-3 py-1 rounded-full text-gray-500 font-medium truncate">
                                {movements.length} de {totalRecords.toLocaleString()} movs (Pág. {currentPage}/{totalPages})
                            </div>
                            <button
                                onClick={resetAuditFilters}
                                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                title="Recargar y Limpiar"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                        {/* Selector Inteligente de Producto con Buscador */}
                        <SearchableProductSelect
                            products={products}
                            selectedProductId={selectedProductId}
                            onSelect={(pid) => {
                                setSelectedProductId(pid);
                                setCurrentPage(1);
                            }}
                        />

                        {/* Selector de Sede */}
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer focus:border-ios-blue transition-colors"
                                value={selectedBranchId}
                                onChange={e => {
                                    const val = e.target.value;
                                    setSelectedBranchId(val === 'all' ? 'all' : Number(val));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="all">Todas las Sedes</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selector de Tipo */}
                        <div className="relative">
                            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 appearance-none cursor-pointer focus:border-ios-blue transition-colors"
                                value={auditType}
                                onChange={e => { setAuditType(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all">Todos los Tipos</option>
                                <option value="exit">Salidas / Mermas</option>
                                <option value="sale">Ventas (Descuento Stock)</option>
                                <option value="entry">Entradas / Compras</option>
                                <option value="adjustment">Ajustes / Conteo Físico</option>
                            </select>
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                placeholder="Buscar referencia o usuario..."
                                className="w-full bg-white dark:bg-black/20 pl-9 pr-3 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/10 focus:border-ios-blue transition-colors"
                                value={auditSearch}
                                onChange={e => setAuditSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* VISTA MÓVIL: Feed de Tarjetas Elegante y Compacto */}
                <div className={`${mobileViewMode === 'cards' ? 'block md:hidden' : 'hidden'} space-y-2.5 min-h-[300px]`}>
                    {loadingMovements ? (
                        <div className="py-16 text-center text-gray-400 text-xs flex flex-col items-center justify-center">
                            <RefreshCcw size={24} className="animate-spin text-ios-blue mb-2.5" />
                            Cargando movimientos...
                        </div>
                    ) : movements.length > 0 ? (
                        movements.map((mov) => {
                            const isEntry = mov.type === 'entry' || mov.type === 'transfer_in' || mov.type === 'return';
                            const isSale = mov.type === 'sale';
                            const isExit = mov.type === 'exit' || mov.type === 'transfer_out';
                            const isAdj = mov.type === 'adjustment';

                            let isPositiveAdj = false;
                            if (isAdj && (mov.reference?.includes('+') || Number(mov.amount) > 0)) isPositiveAdj = true;

                            const rawBid = mov.branchId || mov.branch_id || 1;
                            const branchObj = branches.find(b => b.id === Number(rawBid));
                            const branchName = branchObj ? branchObj.name : 'Sede Principal';
                            const authorName = mov.userName || (mov as any).user_name || 'Sistema';

                            const dateObj = new Date(Number(mov.date) || mov.date);
                            const formattedDate = !isNaN(dateObj.getTime())
                                ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                : 'Fecha N/A';
                            const formattedTime = !isNaN(dateObj.getTime())
                                ? dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                : '';

                            return (
                                <div
                                    key={mov.id}
                                    className="p-3.5 bg-gray-50/90 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-colors space-y-2.5"
                                >
                                    {/* Fila 1: Badges de Tipo, Sede y Cantidad */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {isEntry ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                                    <ArrowUpCircle size={11} /> {mov.type === 'return' ? 'Devolución' : 'Entrada'}
                                                </span>
                                            ) : isSale ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 rounded-md">
                                                    <DollarSign size={11} /> Venta
                                                </span>
                                            ) : isExit ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 px-2 py-0.5 rounded-md">
                                                    <ArrowDownCircle size={11} /> Salida / Merma
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${isPositiveAdj ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-amber-700 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                                                    <RefreshCcw size={11} /> {isPositiveAdj ? 'Entrada (Ajuste)' : 'Salida (Ajuste)'}
                                                </span>
                                            )}

                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-white/10 px-2 py-0.5 rounded-md border border-gray-200/70 dark:border-white/10">
                                                <MapPin size={10} className="text-gray-400" /> {branchName}
                                            </span>
                                        </div>

                                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg shrink-0 ${isEntry || isPositiveAdj ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-rose-700 bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                                            {isEntry || isPositiveAdj ? '+' : '-'}{mov.amount} u.
                                        </span>
                                    </div>

                                    {/* Fila 2: Título, Código y Variante */}
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug">
                                            {mov.product_title || 'Producto Eliminado'}
                                        </p>
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                            {mov.variant_details && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
                                                    {mov.variant_details}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400 font-mono">
                                                {mov.product_code ? `Cód: ${mov.product_code}` : 'S/C'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Fila 3: Fecha/Hora y Detalle/Usuario */}
                                    <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200/60 dark:border-white/5 gap-2">
                                        <span className="font-mono flex items-center gap-1 shrink-0">
                                            <Clock size={11} className="text-gray-400" />
                                            {formattedDate} {formattedTime}
                                        </span>
                                        <span className="truncate text-right font-medium text-gray-600 dark:text-gray-300" title={`${mov.reference} (${authorName})`}>
                                            {mov.reference} <span className="opacity-60 text-[9px]">({authorName})</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-16 text-center text-gray-400 text-xs">
                            <Search size={28} className="mx-auto mb-2 opacity-20" />
                            No hay movimientos registrados.
                        </div>
                    )}
                </div>

                {/* VISTA TABLA: Completa para Escritorio o modo Tabla Móvil */}
                <div className={`${mobileViewMode === 'table' ? 'block' : 'hidden md:block'} overflow-x-auto min-h-[300px]`}>
                    <table className="w-full text-left min-w-[760px]">
                        <thead className="text-[10px] text-gray-400 uppercase font-black tracking-widest border-b border-gray-100 dark:border-white/5">
                            <tr>
                                <th className="pb-3 px-3.5 w-40">Fecha</th>
                                <th className="pb-3 px-3.5">Producto</th>
                                <th className="pb-3 px-3.5 w-32">Sede</th>
                                <th className="pb-3 px-3.5 w-32">Tipo</th>
                                <th className="pb-3 px-3.5 w-20 text-center">Cant.</th>
                                <th className="pb-3 px-3.5 text-right">Detalle / Referencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loadingMovements ? (
                                <tr><td colSpan={6} className="text-center py-12 text-xs text-gray-400">Cargando datos...</td></tr>
                            ) : movements.length > 0 ? (
                                movements.map((mov) => {
                                    const isEntry = mov.type === 'entry' || mov.type === 'transfer_in' || mov.type === 'return';
                                    const isSale = mov.type === 'sale';
                                    const isExit = mov.type === 'exit' || mov.type === 'transfer_out';
                                    const isAdj = mov.type === 'adjustment';

                                    let isPositiveAdj = false;
                                    if (isAdj && (mov.reference?.includes('+') || Number(mov.amount) > 0)) isPositiveAdj = true;

                                    const rawBid = mov.branchId || mov.branch_id || 1;
                                    const branchObj = branches.find(b => b.id === Number(rawBid));
                                    const branchName = branchObj ? branchObj.name : 'Sede Principal';
                                    const authorName = mov.userName || (mov as any).user_name || 'Sistema';

                                    const dateObj = new Date(Number(mov.date) || mov.date);
                                    const fullDateTime = !isNaN(dateObj.getTime())
                                        ? dateObj.toLocaleString('es-ES')
                                        : 'Fecha N/A';

                                    return (
                                        <tr key={mov.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-3.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                                                {fullDateTime}
                                            </td>
                                            <td className="py-3 px-3.5">
                                                <p className="text-xs font-bold dark:text-white truncate max-w-[240px]">{mov.product_title || 'Producto Eliminado'}</p>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    {mov.variant_details && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
                                                            {mov.variant_details}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-gray-400 font-mono">{mov.product_code ? `Cód: ${mov.product_code}` : 'S/C'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3.5">
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded w-fit whitespace-nowrap">
                                                    <MapPin size={10} /> {branchName}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3.5 whitespace-nowrap">
                                                {isEntry ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-1 rounded-md">
                                                        <ArrowUpCircle size={10} /> {mov.type === 'return' ? 'Devolución' : 'Entrada'}
                                                    </span>
                                                ) : isSale ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-1 rounded-md">
                                                        <DollarSign size={10} /> Venta
                                                    </span>
                                                ) : isExit ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 px-2 py-1 rounded-md">
                                                        <ArrowDownCircle size={10} /> Salida / Merma
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${isPositiveAdj ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-amber-700 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                                                        <RefreshCcw size={10} /> {isPositiveAdj ? 'Entrada (Ajuste)' : 'Salida (Ajuste)'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3.5 text-center">
                                                <span className={`text-xs font-black ${isEntry || isPositiveAdj ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {isEntry || isPositiveAdj ? '+' : '-'}{mov.amount}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3.5 text-right text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[240px]">
                                                {mov.reference} <span className="text-[9px] opacity-60">({authorName})</span>
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

                {/* Controles de Paginación 100% Responsivos */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium order-2 sm:order-1 text-center sm:text-left">
                            Página <span className="font-bold text-gray-800 dark:text-white">{currentPage}</span> de <span className="font-bold text-gray-800 dark:text-white">{totalPages}</span>
                            <span className="hidden sm:inline"> ({totalRecords.toLocaleString()} movimientos totales)</span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto order-1 sm:order-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 sm:px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                            >
                                ← Anterior
                            </button>

                            {/* Números de página solo en desktop/tablet */}
                            <div className="hidden sm:flex items-center gap-1">
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

                            {/* Indicador compacto en móvil entre botones */}
                            <span className="sm:hidden text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 sm:px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}
        </div>
    );
};
