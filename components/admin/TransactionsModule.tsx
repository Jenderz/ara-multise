
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, PaymentMethod } from '../../types';
import { OrderDetailsModal } from './OrderDetailsModal';
import { Search, User, Filter, Wallet, CreditCard, DollarSign, ChevronRight, ChevronLeft, ChevronDown, Calendar, Globe, X, CalendarDays, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, UserCircle, Banknote, Smartphone, Download } from 'lucide-react';
import { api } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';

interface GroupedTransaction {
    dateLabel: string;
    dateKey: string;
    totalAmount: number;
    count: number;
    orders: Order[];
}

const STATUS_FILTER = [
    { id: 'all', label: 'Todos los Estados' },
    { id: 'completed', label: 'Completados (Ingresos)' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'cancelled', label: 'Cancelados / Anulados' }
];

export const TransactionsModule = () => {
    const { settings, userRole, currentUser, currentBranch } = useStore();

    // --- ESTADOS DE FILTRO ---
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedSeller, setSelectedSeller] = useState('all');
    const [selectedMethod, setSelectedMethod] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dateStart, setDateStart] = useState(thirtyDaysAgoStr);
    const [dateEnd, setDateEnd] = useState(todayStr);

    const [showFilters, setShowFilters] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

    const [serverOrders, setServerOrders] = useState<Order[]>([]);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Estados de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize] = useState(50);

    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const sellerFilter = userRole === 'seller' ? currentUser?.id : selectedSeller;

                const response = await api.getOrders({
                    page: currentPage,
                    limit: pageSize,
                    startDate: dateStart,
                    endDate: dateEnd,
                    method: selectedMethod,
                    seller: sellerFilter,
                    status: selectedStatus,
                    search: debouncedSearch
                });

                if (response && Array.isArray(response.data)) {
                    setServerOrders(response.data);
                    setTotalPages(response.pagination?.totalPages || 1);
                    setTotalRecords(response.pagination?.total || 0);

                    const localTotal = response.data.reduce((sum, o) => {
                        return o.status !== 'cancelled' ? sum + o.total : sum;
                    }, 0);
                    setTotalRevenue(localTotal);
                } else {
                    setServerOrders([]);
                    setTotalRevenue(0);
                    setTotalPages(1);
                    setTotalRecords(0);
                }
            } catch (e) {
                console.error("Error fetching transactions", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    // FIX SEGURIDAD: Se cambiaron currentUser y currentBranch (objetos) por sus IDs (strings/numbers).
    // Los objetos completos como dependencias de useEffect causan re-ejecuciones cuando el objeto
    // cambia por referencia durante la hidratación del contexto, aunque el valor sea el mismo.
    // Esto generaba 2-3 fetches automáticos al cargar el módulo de Transacciones.
    }, [currentPage, debouncedSearch, selectedSeller, selectedMethod,
        selectedStatus, dateStart, dateEnd,
        currentUser?.id,     // Solo el ID, no el objeto completo
        currentBranch?.id]); // Solo el ID, no el objeto completo


    const transactionGroups = useMemo(() => {
        const groups: Record<string, GroupedTransaction> = {};

        serverOrders.forEach(order => {
            const date = new Date(order.date);
            const dateKey = date.toISOString().split('T')[0];
            const dateLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    dateLabel,
                    dateKey,
                    totalAmount: 0,
                    count: 0,
                    orders: []
                };
            }

            groups[dateKey].orders.push(order);
            if (order.status === 'completed') {
                groups[dateKey].totalAmount += order.total;
            }
            groups[dateKey].count += 1;
        });

        return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    }, [serverOrders]);

    const getPaymentIcon = (method: string) => {
        const m = (method || '').toLowerCase();
        if (m.includes('efectivo')) return <Banknote size={18} className="text-green-600" />;
        if (m.includes('zelle') || m.includes('binance')) return <DollarSign size={18} className="text-blue-600" />;
        if (m.includes('pago movil') || m.includes('móvil')) return <Smartphone size={18} className="text-purple-600" />;
        return <CreditCard size={18} className="text-gray-600" />;
    };

    const handlePresetDate = (type: 'today' | 'yesterday' | 'week' | 'month') => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        let start = today;

        if (type === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            start = y.toISOString().split('T')[0];
            setDateEnd(start);
        } else if (type === 'week') {
            const w = new Date(now);
            w.setDate(w.getDate() - 7);
            start = w.toISOString().split('T')[0];
            setDateEnd(today);
        } else if (type === 'month') {
            const m = new Date(now);
            m.setDate(m.getDate() - 30);
            start = m.toISOString().split('T')[0];
            setDateEnd(today);
        } else {
            setDateEnd(today);
        }
        setDateStart(start);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedSeller('all');
        setSelectedMethod('all');
        setSelectedStatus('all');
        setCurrentPage(1);
        handlePresetDate('month');
    };

    const exportToExcel = () => {
        // Crear CSV con todas las transacciones actuales
        const headers = ['Fecha', 'Hora', 'ID', 'Cliente', 'Monto', 'Método de Pago', 'Estado', 'Caja / Facturación', 'Asesor de Piso', 'Productos'];
        const rows = serverOrders.map(order => [
            new Date(order.date).toLocaleDateString('es-ES'),
            new Date(order.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            order.id.slice(0, 8),
            order.customerName || 'Cliente General',
            `$${order.total.toFixed(2)}`,
            order.paymentMethod || 'N/A',
            order.status === 'completed' ? 'Completado' : order.status === 'pending' ? 'Pendiente' : 'Cancelado',
            order.sellerName || 'Sistema',
            order.advisorName || 'Venta directa (Sin asesor)',
            order.items.length.toString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transacciones_${dateStart}_${dateEnd}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paymentOptions = useMemo(() => {
        return (settings.paymentMethods || []).map((m: PaymentMethod) => ({
            id: m.name,
            label: m.name
        }));
    }, [settings.paymentMethods]);

    const primaryColor = settings?.primaryColor || '#007AFF';

    const handlePageChange = (newPage: number) => {
        if (newPage === currentPage) return;
        setCurrentPage(newPage);
        const mainEl = document.querySelector('main');
        if (mainEl) {
            mainEl.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | 'ellipsis')[] = [];
        pages.push(1);

        if (currentPage > 3) {
            pages.push('ellipsis');
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push('ellipsis');
        }

        pages.push(totalPages);
        return pages;
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12 sm:pb-8">
            {/* Header Superior */}
            <div className="sticky -top-3 sm:-top-4 lg:-top-8 z-20 bg-ios-bg/95 dark:bg-black/95 backdrop-blur-md pt-2 pb-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 sm:px-2">
                    <div className="flex items-center justify-between w-full sm:w-auto">
                        <h2 className="text-xl sm:text-2xl font-black dark:text-white flex items-center gap-2">
                            <Wallet className="text-ios-blue" size={24} /> Transacciones
                        </h2>
                        <button
                            onClick={exportToExcel}
                            disabled={serverOrders.length === 0}
                            className="sm:hidden px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
                            title="Exportar a Excel"
                        >
                            <Download size={14} />
                            <span>Exportar</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto bg-white dark:bg-zinc-900 p-2.5 sm:p-0 sm:bg-transparent rounded-2xl border border-gray-100 dark:border-white/5 sm:border-0 shadow-sm sm:shadow-none">
                        <button
                            onClick={exportToExcel}
                            disabled={serverOrders.length === 0}
                            className="hidden sm:flex px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold items-center gap-2 transition-colors shadow-sm"
                            title="Exportar a Excel"
                        >
                            <Download size={14} />
                            <span>Exportar</span>
                        </button>

                        <div className="flex items-center justify-between w-full sm:w-auto sm:text-right">
                            <div className="sm:hidden flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                                    Total Completado
                                </span>
                            </div>
                            <div className="text-right">
                                <p className="hidden sm:block text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                    Volumen (Completados)
                                </p>
                                {isLoading ? (
                                    <div className="h-6 w-24 bg-gray-200 dark:bg-white/10 rounded animate-pulse ml-auto"></div>
                                ) : (
                                    <p className="text-base sm:text-lg font-black leading-none text-emerald-600 dark:text-emerald-400 sm:text-black sm:dark:text-white">
                                        ${totalRevenue.toFixed(2)}
                                    </p>
                                )}
                                <p className="text-[9px] text-gray-400 mt-0.5">
                                    {totalRecords.toLocaleString()} registros
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Indicador de Sede */}
                {currentBranch && (
                    <div className="px-1 sm:px-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <Globe size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate">
                                {currentBranch.id === 0 ? 'Vista Global (Todas las Sedes)' : `Sede: ${currentBranch.name}`}
                            </span>
                        </div>
                    </div>
                )}

                {/* Buscador y Filtros (Igual que antes) */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            placeholder="Buscar ID, cliente o monto..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-white/10 pl-9 pr-4 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 outline-none text-sm font-medium dark:text-white transition-all focus:ring-2 focus:ring-ios-blue/20"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 dark:bg-white/20 rounded-full text-gray-500 dark:text-white">
                                <X size={10} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`h-11 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs ${showFilters ? 'bg-ios-blue text-white shadow-lg' : 'bg-white dark:bg-white/10 text-gray-500 dark:text-gray-300 shadow-sm'}`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filtros</span>
                    </button>
                </div>

                {showFilters && (
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5 animate-slide-up space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filtros Avanzados</h4>
                            <button onClick={clearFilters} className="text-[10px] text-red-500 font-bold hover:underline">Restablecer</button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button onClick={() => handlePresetDate('today')} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold hover:bg-ios-blue hover:text-white transition-colors">Hoy</button>
                            <button onClick={() => handlePresetDate('yesterday')} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold hover:bg-ios-blue hover:text-white transition-colors">Ayer</button>
                            <button onClick={() => handlePresetDate('week')} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold hover:bg-ios-blue hover:text-white transition-colors">7 Días</button>
                            <button onClick={() => handlePresetDate('month')} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold hover:bg-ios-blue hover:text-white transition-colors">Este Mes</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold">Desde</label>
                                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 px-2 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/5" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold">Hasta</label>
                                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 px-2 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/5" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold">Estado</label>
                                <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 px-2 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/5">
                                    {STATUS_FILTER.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold">Método</label>
                                <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 px-2 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/5">
                                    <option value="all">Todos</option>
                                    {paymentOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold">Caja / Asesor</label>
                                <select value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 px-2 py-2 rounded-xl text-xs outline-none dark:text-white border border-gray-200 dark:border-white/5">
                                    <option value="all">Todos</option>
                                    {(settings.users || []).length > 0 && (
                                        <optgroup label="🖥️ Cajas / Usuarios">
                                            {(settings.users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </optgroup>
                                    )}
                                    {(settings.salesAdvisors || []).length > 0 && (
                                        <optgroup label="👔 Asesores de Piso">
                                            {(settings.salesAdvisors || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4 sm:space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 size={40} className="animate-spin mb-4 text-ios-blue" />
                        <p className="text-xs font-bold uppercase">Cargando Historial...</p>
                    </div>
                ) : transactionGroups.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <Wallet size={48} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">No se encontraron movimientos.</p>
                    </div>
                ) : (
                    transactionGroups.map((group) => (
                        <div key={group.dateKey} className="space-y-2">
                            <div className="bg-gray-100/90 dark:bg-zinc-800/90 backdrop-blur-md px-4 py-2 rounded-xl flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-white/5 shadow-sm">
                                <span className="capitalize flex items-center gap-2">
                                    <Calendar size={12} /> {group.dateLabel}
                                </span>
                                <span>{group.count} Transacciones</span>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 overflow-hidden">
                                {group.orders.map((order) => {
                                    const isCancelled = order.status === 'cancelled';
                                    const isPending = order.status === 'pending';
                                    const paymentMethodStr = order.paymentMethod || 'Por Definir';
                                    const sellerDisplay = order.sellerName || 'Sistema';
                                    const hasDiscount = (order.discount || 0) > 0;

                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setViewingOrder(order)}
                                            className={`p-3.5 sm:p-4 transition-all cursor-pointer group ${isCancelled ? 'bg-red-50/50 dark:bg-red-900/5 hover:bg-red-100/50 dark:hover:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            {/* Vista Móvil (< sm) */}
                                            <div className="sm:hidden flex flex-col gap-2 w-full">
                                                {/* Fila 1: Badges de Estado y Hora */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {isCancelled && <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 text-[9px] font-black uppercase flex items-center gap-1"><XCircle size={10} /> Anulado</span>}
                                                        {isPending && <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><Clock size={10} /> Pendiente</span>}
                                                        {order.status === 'completed' && <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-600 text-[9px] font-black uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Exitoso</span>}
                                                    </div>
                                                    <span className="font-mono text-[10px] font-bold text-gray-400 shrink-0">
                                                        {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Fila 2: Ícono, Monto Destacado y Cliente */}
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isCancelled ? 'bg-gray-100 dark:bg-white/10 text-gray-400' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                                            {getPaymentIcon(paymentMethodStr)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                                {order.customerName || 'Cliente General'}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                                                {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'} • <span className="font-semibold uppercase">{paymentMethodStr.includes('+') ? 'Múltiple' : paymentMethodStr.split(' ')[0]}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {hasDiscount && <p className="text-[9px] text-green-500 font-bold">DCTO -${order.discount?.toFixed(2)}</p>}
                                                        <p className={`font-black text-base ${isCancelled ? 'line-through text-gray-400' : 'text-ios-text dark:text-white'}`}>
                                                            ${order.total.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Fila 3: Chips de Personal y Referencia */}
                                                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-white/5 text-[9px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1 ${order.sellerId === 'web-client' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                            <UserCircle size={10} /> {sellerDisplay}
                                                        </span>
                                                        {order.advisorName && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                👔 {order.advisorName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-gray-400 group-hover:text-ios-blue transition-colors">
                                                        <span className="font-mono text-[9px]">Ref: {order.id.slice(0, 8)}</span>
                                                        <ChevronRight size={14} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vista Escritorio (sm:flex) */}
                                            <div className="hidden sm:flex items-center gap-3">
                                                <div className={`flex items-center gap-2 sm:gap-4 w-32 sm:w-40 shrink-0 ${isCancelled ? 'opacity-60' : ''}`}>
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform text-gray-600 dark:text-gray-300 ${isCancelled ? 'bg-white dark:bg-white/10' : 'bg-gray-50 dark:bg-white/5 group-hover:scale-110'}`}>
                                                        {getPaymentIcon(paymentMethodStr)}
                                                    </div>
                                                    <div>
                                                        {hasDiscount && <p className="text-[9px] text-green-500 font-bold">DCTO: -${order.discount?.toFixed(2)}</p>}
                                                        <p className={`font-black text-base sm:text-lg ${isCancelled ? 'line-through text-gray-400' : 'text-ios-text dark:text-white'} truncate`}>${order.total.toFixed(2)}</p>
                                                        <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase truncate max-w-[80px]">
                                                            {paymentMethodStr.includes('+') ? 'Múltiple' : paymentMethodStr.split(' ')[0]}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0 border-l border-gray-100 dark:border-white/5 pl-3 sm:pl-6">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        {isCancelled && <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1"><XCircle size={10} /> Anulado</span>}
                                                        {isPending && <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1"><Clock size={10} /> Pendiente</span>}
                                                        {order.status === 'completed' && <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-600 text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Exitoso</span>}

                                                        <span className={`px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1 ${order.sellerId === 'web-client' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            <UserCircle size={10} /> Caja: {sellerDisplay}
                                                        </span>
                                                        {order.advisorName && (
                                                            <span className="px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                                                👔 Asesor: {order.advisorName}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                                                        {order.customerName || 'Cliente General'}
                                                    </p>
                                                    <p className="text-[9px] sm:text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                                                        {order.items.length} productos • Ref: <span className="font-mono">{order.id.slice(0, 8)}</span>
                                                    </p>
                                                </div>

                                                <div className="text-right shrink-0 pl-1 sm:pl-2">
                                                    <p className="font-mono text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">
                                                        {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <ChevronRight size={20} className="ml-auto text-gray-300 group-hover:text-ios-blue transition-colors mt-1" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Controles de Paginación Ejecutiva Senior */}
            {!isLoading && totalPages > 1 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-white/10 p-3 sm:p-4 shadow-sm">
                    {/* Vista Móvil: Ergonómica, compacta y con selector directo nativo */}
                    <div className="sm:hidden flex items-center justify-between gap-2">
                        <button
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shrink-0 shadow-sm"
                        >
                            <ChevronLeft size={16} />
                            <span>Anterior</span>
                        </button>

                        <div className="relative flex flex-col items-center justify-center min-w-0 px-2 text-center cursor-pointer">
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                    Pág. {currentPage} de {totalPages}
                                </span>
                                <ChevronDown size={12} className="text-gray-400" />
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                                {totalRecords.toLocaleString()} registros
                            </span>
                            {/* Selector nativo transparente para salto rápido en móviles */}
                            <select
                                value={currentPage}
                                onChange={(e) => handlePageChange(Number(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Ir a página"
                            >
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        Página {i + 1} de {totalPages}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shrink-0 shadow-sm"
                        >
                            <span>Siguiente</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Vista Tablet / Escritorio: Control Completo, Números con Elipsis y Color de Marca */}
                    <div className="hidden sm:flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Mostrando página <strong className="text-gray-800 dark:text-white font-bold">{currentPage}</strong> de <strong className="text-gray-800 dark:text-white font-bold">{totalPages}</strong></span>
                            <span>•</span>
                            <span>{totalRecords.toLocaleString()} transacciones</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95"
                            >
                                <ChevronLeft size={14} />
                                <span>Anterior</span>
                            </button>

                            {getPageNumbers().map((p, idx) => {
                                if (p === 'ellipsis') {
                                    return (
                                        <span key={`ell-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400 font-bold select-none">
                                            ...
                                        </span>
                                    );
                                }
                                const pageNum = Number(p);
                                const isCurrent = pageNum === currentPage;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        style={isCurrent ? { backgroundColor: primaryColor, boxShadow: `0 4px 12px ${primaryColor}40` } : undefined}
                                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                            isCurrent
                                                ? 'text-white font-black'
                                                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95"
                            >
                                <span>Siguiente</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingOrder && (
                <OrderDetailsModal order={viewingOrder} onClose={() => setViewingOrder(null)} />
            )}
        </div>
    );
};
