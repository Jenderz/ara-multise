import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../../context/StoreContext';
import { api } from '../../../services/api';
import { StagnantProduct, StagnantStockResponse } from '../../../types';
import { 
    AlertTriangle, 
    DollarSign, 
    Package, 
    Clock, 
    Tag, 
    Search, 
    RefreshCcw, 
    Sparkles, 
    TrendingDown, 
    X, 
    Check, 
    AlertCircle, 
    Percent, 
    ArrowRight,
    MapPin,
    Calendar,
    Layers,
    Info
} from 'lucide-react';

interface StagnantStockAnalyticsProps {
    onProductUpdated?: () => void;
}

export const StagnantStockAnalytics: React.FC<StagnantStockAnalyticsProps> = ({ onProductUpdated }) => {
    const { currentBranch, branches, userRole } = useStore();
    const isGlobalView = currentBranch?.id === 0;

    // Estados de filtrado
    const [periodDays, setPeriodDays] = useState<30 | 60 | 90>(30);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>(isGlobalView ? 'all' : (currentBranch?.id || 1));

    // Estados de datos
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<StagnantProduct[]>([]);
    const [summary, setSummary] = useState<StagnantStockResponse['summary'] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Estados del modal de descuento
    const [modalProduct, setModalProduct] = useState<StagnantProduct | null>(null);
    const [offerInput, setOfferInput] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Sincronizar sede si cambia la sede activa global
    useEffect(() => {
        setSelectedBranchId(isGlobalView ? 'all' : (currentBranch?.id || 1));
    }, [currentBranch?.id, isGlobalView]);

    // Cargar datos del backend
    const loadStagnantData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getStagnantStock(periodDays, selectedBranchId);
            if (res && res.data) {
                setItems(res.data);
                setSummary(res.summary);
            } else {
                setItems([]);
                setSummary(null);
            }
        } catch (err: any) {
            console.error("Error cargando stock estancado:", err);
            setError(err?.message || "Error al cargar la información de stock estancado.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStagnantData();
    }, [periodDays, selectedBranchId]);

    // Categorías únicas para filtro
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        items.forEach(it => {
            if (it.category) cats.add(it.category);
        });
        return Array.from(cats).sort();
    }, [items]);

    // Filtrar localmente por búsqueda y categoría
    const filteredItems = useMemo(() => {
        return items.filter(it => {
            const matchesSearch = search === '' || 
                it.title.toLowerCase().includes(search.toLowerCase()) || 
                it.code.toLowerCase().includes(search.toLowerCase());
            const matchesCat = categoryFilter === 'all' || it.category === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [items, search, categoryFilter]);

    // Abrir modal de oferta
    const openOfferModal = (prod: StagnantProduct) => {
        setModalProduct(prod);
        setOfferInput(prod.salePrice > 0 ? prod.salePrice.toString() : '');
        setSaveMessage(null);
    };

    const closeOfferModal = () => {
        setModalProduct(null);
        setOfferInput('');
        setSaveMessage(null);
    };

    // Cálculos en vivo para el modal
    const cost = modalProduct?.cost || 0;
    const price = modalProduct?.price || 0;
    const inputValNum = parseFloat(offerInput);
    const isCustomOffer = !isNaN(inputValNum) && inputValNum > 0;
    const effectiveNewPrice = isCustomOffer ? inputValNum : 0;

    const isBelowCost = isCustomOffer && cost > 0 && effectiveNewPrice < cost;
    const discountPercent = isCustomOffer && price > 0 ? Math.round(((price - effectiveNewPrice) / price) * 100) : 0;
    const profitMargin = isCustomOffer && effectiveNewPrice > 0 
        ? (((effectiveNewPrice - cost) / effectiveNewPrice) * 100) 
        : 0;
    const recoverableCapital = isCustomOffer && modalProduct ? (effectiveNewPrice * modalProduct.stock) : 0;

    // Presets rápidos
    const applyPresetPercent = (pct: number) => {
        if (!modalProduct) return;
        const discounted = Number((price * (1 - pct / 100)).toFixed(2));
        setOfferInput(discounted.toString());
    };

    const applyAtCost = () => {
        if (!modalProduct) return;
        setOfferInput(cost.toFixed(2));
    };

    const removeOffer = () => {
        setOfferInput('0');
    };

    // Guardar oferta
    const handleSaveOffer = async () => {
        if (!modalProduct) return;
        if (isBelowCost) {
            setSaveMessage({ type: 'error', text: `El precio no puede ser menor al costo ($${cost.toFixed(2)})` });
            return;
        }

        setSaving(true);
        setSaveMessage(null);
        try {
            const targetSalePrice = isNaN(inputValNum) || inputValNum <= 0 ? 0 : Number(inputValNum.toFixed(2));
            await api.updateProductOffer(modalProduct.id, targetSalePrice);

            // Actualización optimista del estado local
            setItems(prev => prev.map(p => p.id === modalProduct.id ? { ...p, salePrice: targetSalePrice } : p));
            setSaveMessage({ type: 'success', text: '¡Precio de oferta actualizado exitosamente!' });
            
            if (onProductUpdated) onProductUpdated();

            setTimeout(() => {
                closeOfferModal();
            }, 1000);
        } catch (err: any) {
            console.error("Error al actualizar precio de oferta:", err);
            setSaveMessage({ type: 'error', text: err?.message || 'Error al actualizar el precio de oferta.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Banner Informativo y Selector de Periodo */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                                Stock Estancado (Baja Rotación)
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Productos con stock disponible, más de 30 días en catálogo y ventas mínimas o nulas.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filtro de Periodo Rápido */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">Sin Ventas En:</span>
                    <div className="bg-gray-100 dark:bg-white/10 p-1 rounded-2xl flex items-center gap-1 w-full sm:w-auto">
                        <button
                            onClick={() => setPeriodDays(30)}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                periodDays === 30
                                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            30 Días
                        </button>
                        <button
                            onClick={() => setPeriodDays(60)}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                periodDays === 60
                                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            60 Días
                        </button>
                        <button
                            onClick={() => setPeriodDays(90)}
                            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                periodDays === 90
                                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            90 Días
                        </button>
                    </div>

                    <button
                        onClick={loadStagnantData}
                        disabled={loading}
                        className="p-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                        title="Recargar datos"
                    >
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* KPI Cards de Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-zinc-900 p-5 rounded-3xl border border-orange-200/60 dark:border-orange-900/30 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Capital Retenido</span>
                        <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                        ${(summary?.totalRetainedCapital || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Dinero inmovilizado calculado al costo de adquisición
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Unidades Ociosas</span>
                        <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                            <Package size={18} />
                        </div>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                        {(summary?.totalUnitsStagnant || 0).toLocaleString()} <span className="text-sm font-bold text-gray-400">uds.</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Total de artículos físicos sin movimiento en {periodDays} días
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Productos Detectados</span>
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Layers size={18} />
                        </div>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                        {filteredItems.length} <span className="text-sm font-bold text-gray-400">referencias</span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Priorizados por mayor capital retenido y menor rotación
                    </p>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-white/5 pl-10 pr-4 py-2 rounded-2xl text-xs outline-none border border-gray-200 dark:border-white/10 dark:text-white focus:border-orange-500 transition-colors"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {/* Filtro de Categoría */}
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-2xl text-xs outline-none border border-gray-200 dark:border-white/10 dark:text-white cursor-pointer"
                    >
                        <option value="all">Todas las Categorías</option>
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Filtro de Sede */}
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-2xl border border-gray-200 dark:border-white/10 text-xs">
                        <MapPin size={14} className="text-gray-400" />
                        <select
                            value={selectedBranchId}
                            onChange={e => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-transparent outline-none dark:text-white cursor-pointer text-xs font-semibold"
                        >
                            <option value="all">Todas las Sedes (Global)</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla Principal */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center">
                        <RefreshCcw size={32} className="animate-spin text-orange-500 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">Calculando capital retenido y rotación...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">
                        <AlertCircle size={32} className="mx-auto mb-2" />
                        <p className="font-bold text-sm">{error}</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">
                        <Sparkles size={36} className="mx-auto mb-2 text-green-500" />
                        <p className="font-black text-gray-800 dark:text-white text-base">¡Excelente rotación de inventario!</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                            No se encontraron productos estancados en el periodo de {periodDays} días con los filtros actuales.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-3.5 px-4">Producto</th>
                                    <th className="py-3.5 px-3 text-center">Stock</th>
                                    <th className="py-3.5 px-3 text-right">Costo Unit.</th>
                                    <th className="py-3.5 px-3 text-right">Capital Retenido</th>
                                    <th className="py-3.5 px-3 text-center">Ventas ({periodDays}d)</th>
                                    <th className="py-3.5 px-3 text-center">Tiempo sin Venta</th>
                                    <th className="py-3.5 px-3 text-right">Precio Actual</th>
                                    <th className="py-3.5 px-4 text-center">Acción Rápida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {filteredItems.map(item => {
                                    // Badge de días sin venta
                                    const daysWithoutSale = item.diasSinVenta;
                                    let badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40';
                                    let severityLabel = 'Alerta';

                                    if (daysWithoutSale >= 90) {
                                        badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/40';
                                        severityLabel = 'Crítico';
                                    } else if (daysWithoutSale >= 60) {
                                        badgeColor = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/40';
                                        severityLabel = 'Estancado';
                                    }

                                    const hasActiveOffer = item.salePrice > 0 && item.salePrice < item.price;
                                    const img = item.images && item.images.length > 0 ? item.images[0] : '';

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                                            {/* Producto */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 overflow-hidden shrink-0 border border-gray-200/50 dark:border-white/5 flex items-center justify-center">
                                                        {img ? (
                                                            <img src={img} alt={item.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package size={18} className="text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[260px]" title={item.title}>
                                                            {item.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                            <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                                                {item.code || 'S/C'}
                                                            </span>
                                                            <span className="truncate">{item.category}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Stock */}
                                            <td className="py-3 px-3 text-center">
                                                <span className="font-black text-xs text-gray-800 dark:text-white bg-gray-100 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                                                    {item.stock} u.
                                                </span>
                                            </td>

                                            {/* Costo Unitario */}
                                            <td className="py-3 px-3 text-right font-mono text-gray-600 dark:text-gray-400">
                                                ${item.cost.toFixed(2)}
                                            </td>

                                            {/* Capital Retenido */}
                                            <td className="py-3 px-3 text-right">
                                                <span className="font-black text-orange-600 dark:text-orange-400 font-mono text-xs">
                                                    ${item.capitalRetenido.toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Ventas en Periodo */}
                                            <td className="py-3 px-3 text-center">
                                                <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                                    item.unidadesVendidas === 0 
                                                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                                                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                                }`}>
                                                    {item.unidadesVendidas} vendidas
                                                </span>
                                            </td>

                                            {/* Días sin Venta */}
                                            <td className="py-3 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                                    <Clock size={11} />
                                                    {daysWithoutSale}d ({severityLabel})
                                                </span>
                                            </td>

                                            {/* Precio Actual / Oferta */}
                                            <td className="py-3 px-3 text-right">
                                                {hasActiveOffer ? (
                                                    <div>
                                                        <span className="font-bold text-green-600 dark:text-green-400 font-mono">
                                                            ${item.salePrice.toFixed(2)}
                                                        </span>
                                                        <span className="block text-[10px] line-through text-gray-400 font-mono">
                                                            ${item.price.toFixed(2)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-gray-700 dark:text-gray-300">
                                                        ${item.price.toFixed(2)}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Acción Rápida */}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => openOfferModal(item)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto shadow-sm ${
                                                        hasActiveOffer
                                                            ? 'bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                                                            : 'bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/40'
                                                    }`}
                                                >
                                                    <Tag size={13} />
                                                    <span>{hasActiveOffer ? 'Modificar Oferta' : 'Liquidar / Ofertar'}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL LIGERO DE DESCUENTO / LIQUIDACIÓN */}
            {modalProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div 
                        className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full border border-gray-100 dark:border-white/10 shadow-2xl overflow-hidden animate-scale-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cabecera Modal */}
                        <div className="p-5 border-b border-gray-100 dark:border-white/10 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl">
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h4 className="font-black text-base dark:text-white">
                                        Estrategia de Liquidación
                                    </h4>
                                    <p className="text-xs text-gray-500 truncate max-w-xs sm:max-w-sm">
                                        {modalProduct.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeOfferModal}
                                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Contenido Modal */}
                        <div className="p-5 space-y-4">
                            {/* Tarjeta de Métricas del Producto */}
                            <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-gray-400">PVP Regular</p>
                                    <p className="text-sm font-black dark:text-white font-mono">${cost > 0 ? price.toFixed(2) : '0.00'}</p>
                                </div>
                                <div className="border-x border-gray-200 dark:border-white/10 px-2">
                                    <p className="text-[10px] font-bold uppercase text-red-500 flex items-center justify-center gap-0.5">
                                        Costo (Piso)
                                    </p>
                                    <p className="text-sm font-black text-red-600 dark:text-red-400 font-mono">${cost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-purple-500">Stock Actual</p>
                                    <p className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">{modalProduct.stock} u.</p>
                                </div>
                            </div>

                            {/* Botones de Presets Rápidos (1 Clic) */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                                    Aplicar Descuento Rápido (1 Clic):
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => applyPresetPercent(15)}
                                        className="px-2 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-orange-100 dark:bg-white/5 dark:hover:bg-orange-900/30 text-gray-700 dark:text-gray-300 hover:text-orange-600 transition-all border border-transparent hover:border-orange-200"
                                    >
                                        -15%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyPresetPercent(25)}
                                        className="px-2 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-orange-100 dark:bg-white/5 dark:hover:bg-orange-900/30 text-gray-700 dark:text-gray-300 hover:text-orange-600 transition-all border border-transparent hover:border-orange-200"
                                    >
                                        -25%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyPresetPercent(35)}
                                        className="px-2 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-orange-100 dark:bg-white/5 dark:hover:bg-orange-900/30 text-gray-700 dark:text-gray-300 hover:text-orange-600 transition-all border border-transparent hover:border-orange-200"
                                    >
                                        -35%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={applyAtCost}
                                        className="px-2 py-2 rounded-xl text-xs font-black bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 transition-all"
                                        title="Liquidación inmediata recuperando exactamente la inversión (0% margen)"
                                    >
                                        Al Costo
                                    </button>
                                </div>
                            </div>

                            {/* Input de Precio de Oferta */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold dark:text-white">
                                        Precio de Oferta Final ($ USD):
                                    </label>
                                    {modalProduct.salePrice > 0 && (
                                        <button
                                            type="button"
                                            onClick={removeOffer}
                                            className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            Quitar Oferta
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={offerInput}
                                        onChange={e => setOfferInput(e.target.value)}
                                        className={`w-full bg-gray-50 dark:bg-white/5 pl-8 pr-4 py-2.5 rounded-2xl text-sm font-black outline-none border transition-colors ${
                                            isBelowCost 
                                                ? 'border-red-500 text-red-600 focus:border-red-600 bg-red-50/50 dark:bg-red-900/10' 
                                                : 'border-gray-200 dark:border-white/10 dark:text-white focus:border-orange-500'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Alerta si está por debajo del costo */}
                            {isBelowCost ? (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 font-bold">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>
                                        ¡Bloqueado! El precio de oferta (${effectiveNewPrice.toFixed(2)}) es inferior al costo (${cost.toFixed(2)}). Vender por debajo del costo causaría pérdidas financieras.
                                    </span>
                                </div>
                            ) : isCustomOffer ? (
                                /* Resumen de impacto económico de la oferta */
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 rounded-2xl space-y-1 text-xs">
                                    <div className="flex items-center justify-between text-green-700 dark:text-green-300 font-bold">
                                        <span>Descuento aplicado:</span>
                                        <span>{discountPercent}% OFF</span>
                                    </div>
                                    <div className="flex items-center justify-between text-green-700 dark:text-green-300">
                                        <span>Margen de ganancia:</span>
                                        <span className="font-bold">{profitMargin.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-green-700 dark:text-green-300 border-t border-green-200/60 dark:border-green-800/40 pt-1 mt-1">
                                        <span>Liquidez a recuperar:</span>
                                        <span className="font-black">${recoverableCapital.toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl text-[11px] text-gray-500 flex items-center gap-2">
                                    <Info size={14} className="shrink-0 text-gray-400" />
                                    <span>Coloca un precio de oferta o presiona "Quitar Oferta" para restablecer el precio original.</span>
                                </div>
                            )}

                            {/* Mensaje de feedback */}
                            {saveMessage && (
                                <div className={`p-3 rounded-2xl text-xs font-bold text-center ${
                                    saveMessage.type === 'success' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {saveMessage.text}
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/10 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeOfferModal}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveOffer}
                                disabled={saving || isBelowCost}
                                className={`px-5 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1.5 transition-all shadow-sm ${
                                    isBelowCost || saving 
                                        ? 'bg-gray-300 dark:bg-white/10 cursor-not-allowed opacity-60' 
                                        : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20 active:scale-95'
                                }`}
                            >
                                {saving ? (
                                    <>
                                        <RefreshCcw size={14} className="animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        <span>Guardar Precio de Oferta</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
