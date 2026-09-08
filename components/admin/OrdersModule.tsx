
import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../UIComponents';
import { ShoppingCart, CheckCircle2, XCircle, Printer, Eye, Edit, Search, Loader2, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../services/api';
import { OrderDetailsModal } from './OrderDetailsModal';

// --- IMPORTAR NUEVOS MÓDULOS SEPARADOS ---
import { ReceiptModal } from './orders/ReceiptModal';
import { OrderEditModal } from './orders/OrderEditModal';

import { BranchSelectionModal } from './orders/BranchSelectionModal';

const ITEMS_PER_PAGE = 10;

export const OrdersModule = ({ updateOrder, settings }: any) => {
    const { userRole, currentUser, adjustStock, branches, currentBranch } = useStore(); // Obtener branches y currentBranch
    const { addNotification } = useNotification();

    // --- ESTADOS SERVER SIDE ---
    const [serverOrders, setServerOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // --- FILTROS ---
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // --- MODALES ---
    const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [completingOrder, setCompletingOrder] = useState<Order | null>(null); // Nuevo estado

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const canManageOrders = userRole === 'admin' || currentUser?.permissions?.includes('orders');

    // Fetch Orders
    useEffect(() => { loadOrders(); }, [currentPage, filterStatus, branches]); // Recargar al cambiar branches también

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => { setCurrentPage(1); loadOrders(); }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            let sellerFilter = 'all';
            if (userRole === 'seller' && currentUser && !currentUser.permissions?.includes('orders')) {
                // Solo si es seller SIN permiso "orders" se filtra por su ID
                sellerFilter = currentUser.id;
            }

            // Lógica de "Branch ID":
            // Si el usuario tiene permisos globales (admin o seller+orders), queremos ver TODO.
            // Para lograr esto, podemos pedir branchId=0 a la API (o no enviar branch filter si el backend lo soporta).
            // Asumiremos que el backend respeta el rol de usuario por encima del header X-Branch-ID para "get_orders"
            // o que implementaremos un cambio en api.ts si es necesario.

            const response = await api.getOrders({ page: currentPage, limit: ITEMS_PER_PAGE, status: filterStatus, seller: sellerFilter, search: searchQuery });
            if (response && response.data) { setServerOrders(response.data); setTotalItems(response.meta?.totalCount || response.pagination?.total || 0); }
        } catch (error) { console.error("Error loading orders:", error); } finally { setLoading(false); }
    };

    const changeStatus = async (order: Order, newStatus: Order['status'], branchIdOverride?: number) => {
        const oldStatus = order.status;

        // INTERCEPTAR COMPLETADO PARA MOSTRAR MODAL O PROCESAR AUTOMÁTICAMENTE
        if (newStatus === 'completed' && oldStatus !== 'completed' && !branchIdOverride) {

            // Caso 1: Retiro en tienda o Venta POS (ya tiene sede asignada)
            if ((order.deliveryMethod === 'pickup' || order.deliveryMethod === 'pos') && order.pickupBranchId) {
                // Pasamos el ID de la sede de retiro directamente
                changeStatus(order, 'completed', order.pickupBranchId);
                return;
            }

            // Caso 2: Solo hay una sede (Mono-sede)
            if (branches.length === 1) {
                // Asignamos la única sede existente automáticamente
                changeStatus(order, 'completed', branches[0].id);
                return;
            }

            // Caso 3: Delivery en Multi-sede (o sin definir) -> Asignar a la sede ACTUAL (Quien lo despacha se lo queda)
            if (currentBranch) {
                changeStatus(order, 'completed', currentBranch.id);
                return;
            }
            // Fallback si no hay currentBranch (raro)
            setCompletingOrder(order);
            return;
        }

        if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            if (!canManageOrders) return;
            if (!window.confirm("¿Anular pedido y devolver items al inventario?")) return;
            // Stock restoration is now handled by backend
        }
        if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
            if (!canManageOrders) return;
            if (!window.confirm("¿Reactivar pedido?")) return;
            // Stock deduction should also be handled by backend or re-process flow
        }

        // Si viene un override de branch (desde el modal), lo inyectamos en el objeto order
        const updatedOrderData = { ...order, status: newStatus };
        if (branchIdOverride) {
            updatedOrderData.branchId = branchIdOverride; // Esto guiará el descuento en backend
        }

        const shouldProcessStock = newStatus === 'completed' && oldStatus !== 'completed';
        try {
            await updateOrder(updatedOrderData, shouldProcessStock);
            if (branchIdOverride) setCompletingOrder(null);
            loadOrders();
        } catch (err: any) {
            addNotification({
                title: 'No se pudo actualizar el pedido',
                body: err.message || 'Error al cambiar estado del pedido.',
                type: 'warning'
            });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ... (Resto del UI igual) ... */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold dark:text-white">Gestión de Pedidos</h2>
                </div>
                <div className="flex bg-white dark:bg-white/10 p-1 rounded-xl border border-gray-100 dark:border-white/5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {['all', 'pending', 'completed', 'cancelled'].map(f => (
                        <button key={f} onClick={() => { setFilterStatus(f as any); setCurrentPage(1); }} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${filterStatus === f ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:text-ios-blue'}`}>
                            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'completed' ? 'Listos' : 'Cancelados'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar por ID, Cliente o Teléfono..." className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl outline-none text-sm font-medium focus:ring-4 focus:ring-ios-blue/10 dark:text-white transition-all shadow-sm border border-gray-100 dark:border-white/5" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
            </div>

            <div className="space-y-4">
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-ios-blue" size={40} /> Cargando pedidos...</div> : serverOrders.length === 0 ? <div className="text-center py-20 opacity-50 bg-white dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10"><ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500 dark:text-gray-400 font-medium">No se encontraron pedidos.</p></div> :
                    serverOrders.map((order: Order) => {
                        // Detectar si el pedido es "Externo" (Delivery mostrado por bandeja compartida)
                        const isExternalDelivery = order.deliveryMethod === 'delivery' && order.branchId !== currentBranch?.id;

                        return (
                            <Card key={order.id} className={`p-6 relative group border-l-4 hover:border-l-ios-blue transition-all ${isExternalDelivery ? 'border-l-orange-400 bg-orange-50/10' : 'border-l-transparent'}`}>
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center"><ShoppingCart size={20} className="text-ios-blue" /></div>
                                            <div><h3 className="font-bold text-lg dark:text-white">#{order.id.slice(0, 8)}</h3><p className="text-xs text-gray-400">{new Date(order.date).toLocaleDateString()} • {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                                            <Badge color={order.status === 'pending' ? 'blue' : order.status === 'completed' ? 'green' : 'red'} className="ml-2">{order.status === 'pending' ? 'Pendiente' : order.status === 'completed' ? 'Completado' : 'Cancelado'}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                            <div><p className="text-[10px] text-gray-400 uppercase font-bold">Cliente</p><p className="font-bold dark:text-white truncate">{order.customerName}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase font-bold">Teléfono</p><p className="font-mono text-xs dark:text-gray-300">{order.customerPhone}</p></div>
                                        </div>
                                    </div>
                                    <div className="md:w-72 space-y-4 border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Total a Pagar</span>
                                                <span className="block text-3xl font-black text-ios-blue leading-none">${(order.total || 0).toFixed(2)}</span>

                                                {/* Badge de Método de Entrega */}
                                                <div className="mt-2">
                                                    {order.deliveryMethod === 'pickup' ? (
                                                        <Badge color="purple" className="flex items-center gap-1">
                                                            Retiro: {branches.find(b => b.id === order.pickupBranchId)?.name || 'Tienda'}
                                                        </Badge>
                                                    ) : order.deliveryMethod === 'pos' ? (
                                                        <Badge color="blue" className="flex items-center gap-1">
                                                            Venta en Tienda
                                                        </Badge>
                                                    ) : order.deliveryMethod === 'delivery' ? (
                                                        <Badge color="orange" className="flex items-center gap-1">
                                                            Delivery
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setViewingReceipt(order)} className="p-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-ios-blue hover:text-white transition-colors"><Printer size={18} /></button>
                                                {canManageOrders && <button onClick={() => setEditingOrder(order)} className="p-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><Edit size={18} /></button>}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <button onClick={() => changeStatus(order, 'completed')} className="flex items-center justify-center gap-1.5 bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400 py-2 rounded-xl text-xs font-bold hover:bg-green-500 hover:text-white hover:border-green-500 transition-all shadow-sm"><CheckCircle2 size={16} /> Entregar</button>
                                            {canManageOrders && <button onClick={() => changeStatus(order, 'cancelled')} className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400 py-2 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm"><XCircle size={16} /> Anular</button>}
                                            <button onClick={() => setViewingOrder(order)} className="col-span-2 flex items-center justify-center gap-1.5 bg-gray-50 text-gray-600 border border-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:bg-ios-blue hover:text-white hover:border-ios-blue transition-all shadow-sm group"><Eye size={16} className="group-hover:scale-110 transition-transform" /> Ver Detalles Completos</button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })
                }
            </div>
            {/* Pagination UI code */}
            <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10 rounded-b-3xl">
                <span className="text-xs font-bold text-gray-500">Página {currentPage} de {totalPages || 1}</span>
                <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"><ChevronLeft size={18} /></button>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"><ChevronRight size={18} /></button>
                </div>
            </div>

            {viewingReceipt && <ReceiptModal order={viewingReceipt} settings={settings} onClose={() => setViewingReceipt(null)} />}
            {viewingOrder && <OrderDetailsModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
            {editingOrder && <OrderEditModal order={editingOrder} onSave={async (o: Order) => { await updateOrder(o); setEditingOrder(null); loadOrders(); }} onClose={() => setEditingOrder(null)} />}
            {completingOrder && (
                <BranchSelectionModal
                    branches={branches}
                    onConfirm={(bid) => {
                        changeStatus(completingOrder, 'completed', bid);
                        setCompletingOrder(null); // Cerrar modal explícitamente tras confirmar
                    }}
                    onClose={() => setCompletingOrder(null)}
                />
            )}
        </div>
    );
};
