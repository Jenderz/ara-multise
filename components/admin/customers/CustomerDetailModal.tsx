
import React, { useMemo } from 'react';
import { Customer, Order } from '../../../types';
import { X, User, Phone, MapPin, Calendar, Package, Clock, DollarSign, ExternalLink, ShoppingBag, History } from 'lucide-react';
import { LazyImage } from '../../UIComponents';
import { DEFAULT_IMAGE } from '../../../config';

interface CustomerDetailModalProps {
    customer: Customer;
    orders: Order[];
    onClose: () => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, orders, onClose }) => {

    // Filtrar y ordenar el historial de pedidos de este cliente
    const customerHistory = useMemo(() => {
        // Normalizar teléfono del cliente para búsqueda (quitar espacios, guiones)
        const cleanPhone = String(customer.phone || '').replace(/\D/g, '');

        return orders.filter(o => {
            // Coincidencia por ID guardado en cliente O por teléfono
            const matchesId = customer.orderIds && customer.orderIds.includes(o.id);
            const matchesPhone = String(o.customerPhone || '').replace(/\D/g, '') === cleanPhone;
            return matchesId || matchesPhone;
        }).sort((a, b) => b.date - a.date); // Más reciente primero
    }, [customer, orders]);

    const totalCalculated = customerHistory.reduce((acc, o) => o.status !== 'cancelled' ? acc + o.total : acc, 0);

    const handleWhatsapp = () => {
        const phone = String(customer.phone || '').replace(/\D/g, '');
        window.open(`https://wa.me/${phone}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-slide-up flex flex-col max-h-[90vh] border border-white/10 overflow-hidden">

                {/* Header con Info Cliente */}
                <div className="p-6 bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/30">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                                {customer.name}
                                <button onClick={handleWhatsapp} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded-full transition-colors" title="Abrir WhatsApp">
                                    <ExternalLink size={16} />
                                </button>
                            </h3>
                            <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 mt-1 gap-1">
                                <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                                <span className="flex items-center gap-1"><MapPin size={12} /> {customer.address || 'Sin dirección'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-full transition-colors dark:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Resumen Estadístico */}
                <div className="grid grid-cols-3 gap-1 p-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-zinc-900">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-blue-500">Pedidos</p>
                        <p className="text-xl font-black text-blue-700 dark:text-blue-400">{customerHistory.length}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-green-500">Total Gastado</p>
                        <p className="text-xl font-black text-green-700 dark:text-green-400">${totalCalculated.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-purple-500">Última Compra</p>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mt-1">
                            {customerHistory.length > 0
                                ? new Date(customerHistory[0].date).toLocaleDateString()
                                : '-'}
                        </p>
                    </div>
                </div>

                {/* Timeline de Pedidos */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-zinc-900">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <History size={14} /> Historial de Compras
                    </h4>

                    <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-100 dark:before:bg-white/5">
                        {customerHistory.length === 0 ? (
                            <div className="text-center py-10 pl-8 text-gray-400">
                                <ShoppingBag size={40} className="mx-auto mb-2 opacity-20" />
                                <p>No hay historial de pedidos registrado.</p>
                            </div>
                        ) : (
                            customerHistory.map((order) => (
                                <div key={order.id} className="relative pl-10 group">
                                    {/* Punto de la línea de tiempo */}
                                    <div className={`absolute left-[11px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 z-10 ${order.status === 'completed' ? 'bg-green-500' : order.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'}`}></div>

                                    <div className="bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                        {/* Cabecera del Pedido */}
                                        <div className="flex justify-between items-start mb-3 border-b border-gray-100 dark:border-white/5 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-gray-500">#{order.id.slice(0, 8)}</span>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {order.status === 'pending' ? 'Pendiente' : order.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                                    <Calendar size={10} /> {new Date(order.date).toLocaleDateString()}
                                                    <Clock size={10} /> {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-ios-text dark:text-white">${order.total.toFixed(2)}</p>
                                                <p className="text-[9px] text-gray-400">{order.items.length} items</p>
                                            </div>
                                        </div>

                                        {/* Lista de Productos del Pedido */}
                                        <div className="space-y-2">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0 overflow-hidden border border-gray-200 dark:border-white/5">
                                                        <LazyImage src={item.image || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold dark:text-white truncate">{item.productTitle}</p>
                                                        {item.variantSku !== item.productId && (
                                                            <p className="text-[9px] text-gray-500 font-mono">{item.variantSku}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-gray-600 dark:text-gray-300">x{item.quantity}</p>
                                                        <p className="text-[9px] text-gray-400">${item.price}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
