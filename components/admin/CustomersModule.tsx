import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../UIComponents';
import { Customer, Order } from '../../types';
import { Search, Eye, ShoppingBag, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight, Download, MessageCircle, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { exportToExcel } from './Shared';

// Imports de los nuevos módulos
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

    const totalPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCustomers();
        }, 500);
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

    const handleDelete = async (e: React.MouseEvent, phone: string) => {
        e.stopPropagation();
        if (window.confirm('¿Eliminar cliente permanentemente?')) {
            await deleteCustomer(phone);
            loadCustomers();
        }
    };

    const handleExport = () => {
        if (serverCustomers.length === 0) {
            alert("No hay clientes para exportar.");
            return;
        }
        const data = serverCustomers.map(c => ({
            Nombre: c.name,
            Cedula: c.cedula || '',
            Telefono: c.phone,
            Direccion: c.address,
            TotalGastado: c.totalSpent,
            Pedidos: c.orderCount,
            UltimaCompra: c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'N/A'
        }));
        exportToExcel(data, 'Listado_Clientes');
    };

    const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
        e.stopPropagation();
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const handleCreateNew = () => {
        const newCustomer: Customer = {
            name: '',
            phone: '',
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
            {/* Header y Buscador */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent outline-none focus:ring-4 focus:ring-ios-blue/10 dark:text-white transition-all shadow-inner"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="secondary" onClick={handleExport} className="py-3 px-4 flex items-center gap-2 flex-1 sm:flex-none">
                        <Download size={18} /> <span className="text-xs font-bold">Exportar</span>
                    </Button>
                    <Button onClick={handleCreateNew} className="py-3 px-6 flex items-center gap-2 flex-1 sm:flex-none">
                        <Plus size={18} /> <span className="text-xs font-bold">Nuevo Cliente</span>
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100/50 dark:bg-white/5 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Cliente</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4 text-center">Fidelidad</th>
                                <th className="p-4">Total Gastado</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-ios-blue" /></td></tr>
                            ) : serverCustomers.length > 0 ? (
                                serverCustomers.map((c: Customer) => (
                                    <tr key={c.phone} className="hover:bg-white dark:hover:bg-white/5 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center font-bold text-gray-500 dark:text-gray-300 shadow-inner">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                        <div>
                                                    <p className="font-bold text-sm dark:text-white">{c.name}</p>
                                                    {c.cedula ? (
                                                        <p className="text-[10px] text-gray-400 font-mono tracking-tight">CI: {c.cedula}</p>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-400 line-clamp-1 max-w-[150px]">{c.address || 'Sin dirección'}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm dark:text-gray-300 font-mono tracking-tight">{c.phone}</td>
                                        <td className="p-4 text-center">
                                            <Badge color="blue" className="shadow-sm">{c.orderCount} Pedidos</Badge>
                                        </td>
                                        <td className="p-4 font-black text-ios-text dark:text-white">${(c.totalSpent || 0).toFixed(2)}</td>
                                        <td className="p-4 text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => handleWhatsApp(e, c.phone)} className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 rounded-xl transition-all" title="Enviar WhatsApp">
                                                    <MessageCircle size={18} />
                                                </button>
                                                <button onClick={() => setSelectedCustomer(c)} className="p-2 text-gray-400 hover:text-ios-blue hover:bg-ios-blue/10 rounded-xl transition-all" title="Ver Historial">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleEditCustomer(c)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all" title="Editar">
                                                    <Edit2 size={18} />
                                                </button>
                                                {userRole === 'admin' && (
                                                    <button onClick={(e) => handleDelete(e, c.phone)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all cursor-pointer z-50" title="Eliminar">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        <ShoppingBag className="mx-auto mb-2 opacity-20" size={40} />
                                        <p>No se encontraron clientes.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
                    <span className="text-xs font-bold text-gray-500">Página {currentPage} de {totalPages || 1}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </Card>

            {selectedCustomer && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    orders={orders}
                    onClose={() => setSelectedCustomer(null)}
                />
            )}

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