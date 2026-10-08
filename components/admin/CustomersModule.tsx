import React, { useState, useEffect, useMemo } from 'react';
import { Card, Badge, Button } from '../UIComponents';
import { Customer, Order } from '../../types';
import { Search, Eye, ShoppingBag, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight, Download, MessageCircle, Plus, Users, UserCheck, TrendingUp, CreditCard, Copy, Check, Filter } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { exportToExcel } from './Shared';
import { extractCedula, formatCedulaDisplay } from '../../utils/customerUtils';

// Imports de los sub-módulos de clientes
import { CustomerDetailModal } from './customers/CustomerDetailModal';
import { CustomerEditModal } from './customers/CustomerEditModal';

const ITEMS_PER_PAGE = 20;

export const CustomersModule = ({ orders }: { orders: Order[] }) => {
    const { deleteCustomer, updateCustomer, userRole } = useStore();

    // --- SERVER SIDE STATE ---
    const [serverCustomers, setServerCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
    const [filterSegment, setFilterSegment] = useState<'all' | 'recurring' | 'vip' | 'missing_ci'>('all');

    const totalPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCustomers();
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm, currentPage]);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const res = await api.getCustomers(currentPage, ITEMS_PER_PAGE, searchTerm);
            if (res && res.data) {
                setServerCustomers(res.data);
                setTotalCustomers(res.pagination.total);
            } else {
                setServerCustomers([]);
                setTotalCustomers(0);
            }
        } catch (e) {
            console.error("Error cargando clientes:", e);
            setServerCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    // KPIs calculados
    const stats = useMemo(() => {
        const totalRegistered = totalCustomers || serverCustomers.length;
        const totalSalesSum = serverCustomers.reduce((acc, c) => acc + (Number(c.totalSpent) || 0), 0);
        const recurringCount = serverCustomers.filter(c => (c.orderCount || 0) >= 2).length;
        const avgTicket = serverCustomers.length > 0 ? (totalSalesSum / serverCustomers.length) : 0;
        return {
            totalRegistered,
            recurringCount,
            totalSalesSum,
            avgTicket
        };
    }, [totalCustomers, serverCustomers]);

    // Filtrado local por segmento
    const displayedCustomers = useMemo(() => {
        if (filterSegment === 'all') return serverCustomers;
        if (filterSegment === 'recurring') {
            return serverCustomers.filter(c => (c.orderCount || 0) >= 2);
        }
        if (filterSegment === 'vip') {
            return serverCustomers.filter(c => (c.totalSpent || 0) >= 100);
        }
        if (filterSegment === 'missing_ci') {
            return serverCustomers.filter(c => !extractCedula(c.cedula, c.address));
        }
        return serverCustomers;
    }, [serverCustomers, filterSegment]);

    const handleDelete = async (e: React.MouseEvent, phone: string) => {
        e.stopPropagation();
        if (window.confirm('¿Eliminar cliente permanentemente? Esta acción no se puede deshacer.')) {
            await deleteCustomer(phone);
            loadCustomers();
        }
    };

    const handleExport = () => {
        if (serverCustomers.length === 0) {
            alert("No hay clientes para exportar.");
            return;
        }
        const data = serverCustomers.map(c => {
            const resolvedCedula = extractCedula(c.cedula, c.address);
            return {
                Nombre: c.name,
                Cedula_RIF: resolvedCedula || 'N/A',
                Telefono: c.phone,
                Direccion: c.address || 'N/A',
                Total_Gastado_USD: (Number(c.totalSpent) || 0).toFixed(2),
                Cantidad_Pedidos: c.orderCount || 0,
                Ultima_Compra: c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'N/A'
            };
        });
        exportToExcel(data, 'Listado_Clientes_ARA');
    };

    const handleWhatsApp = (e: React.MouseEvent, c: Customer) => {
        e.stopPropagation();
        const cleanPhone = String(c.phone || '').replace(/\D/g, '');
        const text = encodeURIComponent(`Hola ${c.name}, te escribimos de nuestro equipo de atención. ¿En qué podemos ayudarte hoy?`);
        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    };

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedPhone(text);
        setTimeout(() => setCopiedPhone(null), 2000);
    };

    const handleCreateNew = () => {
        const newCustomer: Customer = {
            name: '',
            phone: '+58',
            cedula: '',
            address: '',
            totalSpent: 0,
            orderCount: 0,
            lastOrderDate: 0,
            orderIds: []
        };
        setEditingCustomer(newCustomer);
    };

    const handleEditCustomer = (c: Customer) => {
        setEditingCustomer(c);
    };

    return (
        <div className="space-y-6 animate-fade-in">

            {/* KPIs Ejecutivos del Módulo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 sm:p-5 bg-white/70 dark:bg-zinc-900/70 border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Clientes</p>
                            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.totalRegistered}</h3>
                        </div>
                        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-ios-blue shrink-0">
                            <Users size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 bg-white/70 dark:bg-zinc-900/70 border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fidelizados (≥2 Pedidos)</p>
                            <h3 className="text-xl sm:text-2xl font-black text-green-600 dark:text-green-400 mt-1">{stats.recurringCount}</h3>
                        </div>
                        <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 shrink-0">
                            <UserCheck size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 bg-white/70 dark:bg-zinc-900/70 border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Gasto Total Clientes</p>
                            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">${stats.totalSalesSum.toFixed(2)}</h3>
                        </div>
                        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 bg-white/70 dark:bg-zinc-900/70 border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ticket Medio / Cliente</p>
                            <h3 className="text-xl sm:text-2xl font-black text-ios-blue dark:text-blue-400 mt-1">${stats.avgTicket.toFixed(2)}</h3>
                        </div>
                        <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0">
                            <CreditCard size={20} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Barra de Búsqueda, Filtros y Acciones */}
            <div className="flex flex-col gap-3 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cédula o teléfono..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent outline-none focus:ring-4 focus:ring-ios-blue/10 dark:text-white transition-all shadow-inner text-sm"
                        />
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleExport} className="py-2.5 px-4 flex items-center gap-2 flex-1 sm:flex-none">
                            <Download size={16} /> <span className="text-xs font-bold">Exportar</span>
                        </Button>
                        <Button onClick={handleCreateNew} className="py-2.5 px-5 flex items-center gap-2 flex-1 sm:flex-none bg-ios-blue text-white shadow-sm">
                            <Plus size={16} /> <span className="text-xs font-bold">Nuevo Cliente</span>
                        </Button>
                    </div>
                </div>

                {/* Filtros por Segmento */}
                <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs pb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <Filter size={12} /> Segmento:
                    </span>
                    {[
                        { id: 'all', label: 'Todos' },
                        { id: 'recurring', label: 'Recurrentes (≥2 pedidos)' },
                        { id: 'vip', label: 'VIP (≥$100)' },
                        { id: 'missing_ci', label: 'Sin Cédula' }
                    ].map(f => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilterSegment(f.id as any)}
                            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                                filterSegment === f.id
                                    ? 'bg-ios-blue text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla de Clientes */}
            <Card className="overflow-hidden bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border-gray-100 dark:border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100/60 dark:bg-white/5 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Cliente</th>
                                <th className="p-4">Identificación / Cédula</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4 text-center">Fidelidad</th>
                                <th className="p-4">Total Gastado</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-ios-blue" /></td></tr>
                            ) : displayedCustomers.length > 0 ? (
                                displayedCustomers.map((c: Customer) => {
                                    const resolvedCedula = extractCedula(c.cedula, c.address);
                                    return (
                                        <tr key={c.phone} className="hover:bg-white dark:hover:bg-white/5 transition-colors group">
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 text-ios-blue dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm dark:text-white truncate">{c.name}</p>
                                                        <p className="text-[10px] text-gray-400 line-clamp-1 max-w-[180px]">{c.address || 'Sin dirección registrada'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {resolvedCedula ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-ios-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                                            CI: {formatCedulaDisplay(resolvedCedula)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleCopy(e, resolvedCedula)}
                                                            className="p-1 text-gray-400 hover:text-ios-blue rounded transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Copiar Cédula"
                                                        >
                                                            {copiedPhone === resolvedCedula ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-900/30 font-medium">
                                                        Sin Cédula
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 font-mono text-xs dark:text-gray-300">
                                                    <span>{c.phone}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCopy(e, c.phone)}
                                                        className="p-1 text-gray-400 hover:text-ios-blue rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Copiar Teléfono"
                                                    >
                                                        {copiedPhone === c.phone ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <Badge color={(c.orderCount || 0) >= 2 ? 'green' : 'blue'} className="shadow-sm font-bold">
                                                    {c.orderCount || 0} {c.orderCount === 1 ? 'Pedido' : 'Pedidos'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 font-black text-ios-text dark:text-white">
                                                ${(Number(c.totalSpent) || 0).toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <div className="flex justify-end gap-1.5">
                                                    <button 
                                                        onClick={(e) => handleWhatsApp(e, c)} 
                                                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all" 
                                                        title="Contactar por WhatsApp"
                                                    >
                                                        <MessageCircle size={17} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setSelectedCustomer(c)} 
                                                        className="p-2 text-gray-400 hover:text-ios-blue hover:bg-ios-blue/10 rounded-xl transition-all" 
                                                        title="Ver Ficha 360° e Historial"
                                                    >
                                                        <Eye size={17} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditCustomer(c)} 
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all" 
                                                        title="Editar Datos"
                                                    >
                                                        <Edit2 size={17} />
                                                    </button>
                                                    {userRole === 'admin' && (
                                                        <button 
                                                            onClick={(e) => handleDelete(e, c.phone)} 
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all cursor-pointer" 
                                                            title="Eliminar Cliente"
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        <ShoppingBag className="mx-auto mb-2 opacity-20" size={40} />
                                        <p className="text-sm font-medium">No se encontraron clientes con el criterio actual.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
                    <span className="text-xs font-bold text-gray-500">Página {currentPage} de {totalPages || 1} ({totalCustomers} clientes)</span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Modal de Detalle / Ficha 360 */}
            {selectedCustomer && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    orders={orders}
                    onClose={() => setSelectedCustomer(null)}
                />
            )}

            {/* Modal de Creación / Edición */}
            {editingCustomer && (
                <CustomerEditModal
                    customer={editingCustomer}
                    onSave={async (c: Customer) => {
                        await updateCustomer(c);
                        loadCustomers();
                        setEditingCustomer(null);
                    }}
                    onClose={() => setEditingCustomer(null)}
                />
            )}
        </div>
    );
};