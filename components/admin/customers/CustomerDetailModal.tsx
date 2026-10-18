import React, { useMemo, useState } from 'react';
import { Customer, Order } from '../../../types';
import { X, User, Phone, MapPin, Calendar, Clock, DollarSign, ExternalLink, ShoppingBag, History, CreditCard, Copy, Check, MessageCircle, FileText, Star, Mail } from 'lucide-react';
import { LazyImage } from '../../UIComponents';
import { DEFAULT_IMAGE } from '../../../config';
import { extractCedula, formatCedulaDisplay } from '../../../utils/customerUtils';

interface CustomerDetailModalProps {
    customer: Customer;
    orders: Order[];
    onClose: () => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, orders, onClose }) => {
    const [activeTab, setActiveTab] = useState<'history' | 'top_products' | 'notes'>('history');
    const [copiedCedula, setCopiedCedula] = useState(false);

    const resolvedCedula = useMemo(() => {
        return extractCedula(customer.cedula, customer.address);
    }, [customer]);

    // Filtrar y ordenar el historial de pedidos de este cliente
    const customerHistory = useMemo(() => {
        const cleanPhone = String(customer.phone || '').replace(/\D/g, '');

        return orders.filter(o => {
            const matchesId = customer.orderIds && customer.orderIds.includes(o.id);
            const matchesPhone = String(o.customerPhone || '').replace(/\D/g, '') === cleanPhone;
            return matchesId || matchesPhone;
        }).sort((a, b) => b.date - a.date);
    }, [customer, orders]);

    const completedOrders = useMemo(() => customerHistory.filter(o => o.status !== 'cancelled'), [customerHistory]);
    const totalCalculated = useMemo(() => completedOrders.reduce((acc, o) => acc + o.total, 0), [completedOrders]);
    const avgTicket = completedOrders.length > 0 ? (totalCalculated / completedOrders.length) : 0;

    // Productos más comprados (agregados por título)
    const topProducts = useMemo(() => {
        const map: Record<string, { title: string; image: string; quantity: number; totalSpent: number }> = {};
        completedOrders.forEach(o => {
            o.items.forEach(it => {
                const key = it.productTitle || it.productId;
                if (!map[key]) {
                    map[key] = {
                        title: it.productTitle,
                        image: it.image || DEFAULT_IMAGE,
                        quantity: 0,
                        totalSpent: 0
                    };
                }
                map[key].quantity += (it.quantity || 1);
                map[key].totalSpent += (it.price * (it.quantity || 1));
            });
        });
        return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    }, [completedOrders]);

    const handleCopyCedula = () => {
        if (!resolvedCedula) return;
        navigator.clipboard.writeText(resolvedCedula);
        setCopiedCedula(true);
        setTimeout(() => setCopiedCedula(false), 2000);
    };

    const handleWhatsapp = () => {
        const phone = String(customer.phone || '').replace(/\D/g, '');
        const greeting = encodeURIComponent(`Hola ${customer.name}, un saludo cordial de parte de nuestro equipo.`);
        window.open(`https://wa.me/${phone}?text=${greeting}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-slide-up flex flex-col max-h-[90vh] border border-white/10 overflow-hidden">

                {/* Header con Info Cliente */}
                <div className="p-4 sm:p-6 bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
                    <div className="flex gap-3 sm:gap-4 min-w-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg shadow-blue-500/30 shrink-0">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold dark:text-white flex items-center gap-2 truncate">
                                {customer.name}
                                <button onClick={handleWhatsapp} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 p-1.5 rounded-full transition-colors shrink-0" title="Contactar por WhatsApp">
                                    <MessageCircle size={16} />
                                </button>
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-1.5 font-mono">
                                <span className="flex items-center gap-1">
                                    <Phone size={12} className="text-gray-400" /> {customer.phone}
                                </span>
                                {resolvedCedula ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex items-center gap-1 text-ios-blue dark:text-blue-400 font-bold">
                                            <CreditCard size={12} /> {formatCedulaDisplay(resolvedCedula)}
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={handleCopyCedula} 
                                            className="p-1 text-gray-400 hover:text-ios-blue dark:hover:text-blue-400 rounded-md transition-colors"
                                            title="Copiar Cédula"
                                        >
                                            {copiedCedula ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-gray-400 italic font-sans">Sin Cédula registrada</span>
                                )}
                                {customer.email && (
                                    <span className="flex items-center gap-1 text-gray-400 font-sans">
                                        <Mail size={12} /> {customer.email}
                                    </span>
                                )}
                            </div>
                            {customer.address && (
                                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 line-clamp-1">
                                    <MapPin size={11} className="shrink-0" /> {customer.address}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-full transition-colors dark:text-white shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Resumen Estadístico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-zinc-900">
                    <div className="text-center p-2.5 bg-blue-50/70 dark:bg-blue-900/10 rounded-2xl">
                        <p className="text-[9px] uppercase font-bold text-blue-500">Pedidos</p>
                        <p className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400">{customerHistory.length}</p>
                    </div>
                    <div className="text-center p-2.5 bg-green-50/70 dark:bg-green-900/10 rounded-2xl">
                        <p className="text-[9px] uppercase font-bold text-green-500">Total Gastado</p>
                        <p className="text-base sm:text-lg font-black text-green-700 dark:text-green-400">${totalCalculated.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-2.5 bg-amber-50/70 dark:bg-amber-900/10 rounded-2xl">
                        <p className="text-[9px] uppercase font-bold text-amber-500">Ticket Medio</p>
                        <p className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400">${avgTicket.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-2.5 bg-purple-50/70 dark:bg-purple-900/10 rounded-2xl">
                        <p className="text-[9px] uppercase font-bold text-purple-500">Última Compra</p>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mt-1">
                            {customerHistory.length > 0
                                ? new Date(customerHistory[0].date).toLocaleDateString()
                                : '-'}
                        </p>
                    </div>
                </div>

                {/* Pestañas de Navegación */}
                <div className="flex border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10 px-3 sm:px-6 pt-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            activeTab === 'history'
                                ? 'border-ios-blue text-ios-blue'
                                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <History size={14} /> Historial ({customerHistory.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('top_products')}
                        className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            activeTab === 'top_products'
                                ? 'border-ios-blue text-ios-blue'
                                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Star size={14} /> Productos Preferidos ({topProducts.length})
                    </button>
                    {customer.notes && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('notes')}
                            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                activeTab === 'notes'
                                    ? 'border-ios-blue text-ios-blue'
                                    : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <FileText size={14} /> Notas Internas
                        </button>
                    )}
                </div>

                {/* Contenido de Pestaña */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-white dark:bg-zinc-900">
                    {activeTab === 'history' && (
                        <div className="space-y-4 sm:space-y-6 relative before:absolute before:left-2 sm:before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-100 dark:before:bg-white/5">
                            {customerHistory.length === 0 ? (
                                <div className="text-center py-10 pl-6 sm:pl-8 text-gray-400">
                                    <ShoppingBag size={40} className="mx-auto mb-2 opacity-20" />
                                    <p>No hay historial de pedidos registrado.</p>
                                </div>
                            ) : (
                                customerHistory.map((order) => (
                                    <div key={order.id} className="relative pl-6 sm:pl-10 group">
                                        <div className={`absolute left-0.5 sm:left-[11px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 z-10 ${order.status === 'completed' ? 'bg-green-500' : order.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'}`}></div>

                                        <div className="bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-2 mb-3 border-b border-gray-100 dark:border-white/5 pb-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-xs font-bold text-gray-500">#{order.id.slice(0, 8)}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                            {order.status === 'pending' ? 'Pendiente' : order.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                        </span>
                                                        {order.deliveryMethod === 'pos' && (
                                                            <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-ios-blue px-1.5 py-0.5 rounded">POS</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                            <Calendar size={10} /> {new Date(order.date).toLocaleDateString()}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                            <Clock size={10} /> {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {order.paymentMethod && <span className="font-sans font-bold whitespace-nowrap">· {order.paymentMethod}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-base sm:text-lg font-black text-ios-text dark:text-white">${order.total.toFixed(2)}</p>
                                                    <p className="text-[9px] text-gray-400">{order.items.length} items</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0 overflow-hidden border border-gray-200 dark:border-white/5">
                                                            <LazyImage src={item.image || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold dark:text-white truncate">{item.productTitle}</p>
                                                            {item.variantSku && item.variantSku !== item.productId && (
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
                    )}

                    {activeTab === 'top_products' && (
                        <div className="space-y-3">
                            {topProducts.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Star size={36} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">No hay suficientes compras para calcular preferencias.</p>
                                </div>
                            ) : (
                                topProducts.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5">
                                                <LazyImage src={p.image} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-bold dark:text-white truncate">{p.title}</p>
                                                <p className="text-[10px] text-gray-400">Comprado {p.quantity} {p.quantity === 1 ? 'unidad' : 'unidades'}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-ios-blue dark:text-blue-400 shrink-0 ml-3">
                                            ${p.totalSpent.toFixed(2)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                            <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                                <FileText size={14} /> Observaciones y Preferencias
                            </h5>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {customer.notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
