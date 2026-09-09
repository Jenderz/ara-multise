
import React from 'react';
import { Order } from '../../types';
import { LazyImage } from '../UIComponents';
import { X, User, Phone, MapPin, Box, Calendar, CreditCard, Clock } from 'lucide-react';

export const OrderDetailsModal = ({ order, onClose }: { order: Order, onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh] border border-white/10" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                            <Box size={24} className="text-ios-blue"/> Pedido #{order.id}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                {order.status === 'pending' ? 'Pendiente' : order.status === 'completed' ? 'Completado' : 'Cancelado'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                <Calendar size={12}/> {new Date(order.date).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                <Clock size={12}/> {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full dark:text-white transition"><X size={20}/></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Customer Info Card */}
                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <User size={18}/>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p>
                                <p className="font-bold dark:text-white text-sm">{order.customerName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                <Phone size={18}/>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Teléfono</p>
                                <p className="font-mono font-bold dark:text-white text-sm">{order.customerPhone}</p>
                            </div>
                        </div>
                        <div className="col-span-1 sm:col-span-2 flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/5">
                            <MapPin size={18} className="text-gray-400 shrink-0 mt-0.5"/>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Dirección / Notas</p>
                                <p className="text-sm dark:text-gray-300 leading-snug">{order.customerAddress || 'Sin dirección registrada'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Products List */}
                    <div>
                        <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-3">Productos ({order.items.length})</h4>
                        <div className="space-y-3">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-3 bg-white dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-ios-blue/30 transition-colors">
                                    <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-white/5 shrink-0 overflow-hidden border border-gray-100 dark:border-white/5">
                                        <LazyImage src={item.image} className="w-full h-full object-cover"/>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <p className="font-bold text-sm dark:text-white leading-tight line-clamp-1">{item.productTitle}</p>
                                        <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {item.variantSku}</p>
                                        {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {Object.values(item.selectedOptions).map((opt, i) => (
                                                    <span key={i} className="text-[9px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{opt}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex flex-col justify-center">
                                        {item.originalPrice !== undefined && item.originalPrice > item.price && (
                                            <p className="text-[10px] font-bold text-red-400 line-through leading-none mb-0.5">
                                                ${item.originalPrice.toFixed(2)}
                                            </p>
                                        )}
                                        <p className="font-bold text-ios-text dark:text-white">${item.price.toFixed(2)}</p>
                                        <p className="text-xs text-gray-500">x {item.quantity}</p>
                                        <p className="font-black text-ios-blue text-sm mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Totals */}
                <div className="p-6 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <div className="text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard size={14}/> 
                            <span className="uppercase">{order.paymentMethod}</span>
                        </div>
                        <span className="text-gray-400">Vendedor: </span>
                        <span className="text-gray-700 dark:text-gray-300 font-bold">{order.sellerName || 'Sistema'}</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        {(() => {
                            const subtotal = order.subtotal && order.subtotal > 0
                                ? order.subtotal
                                : order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
                            const discount = order.discount !== undefined && order.discount > 0
                                ? order.discount
                                : Math.max(0, subtotal - order.total);
                            const hasDiscount = discount > 0.009;

                            return hasDiscount ? (
                                <div className="flex gap-3 text-xs text-gray-500 mb-1">
                                    <span>Subtotal: <span className="font-bold text-gray-700 dark:text-gray-300">${subtotal.toFixed(2)}</span></span>
                                    <span className="text-green-500 font-bold">
                                        Descuento{order.couponCode ? ` (${order.couponCode})` : ''}: -${discount.toFixed(2)}
                                    </span>
                                </div>
                            ) : null;
                        })()}
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Total Pedido</p>
                        <p className="text-3xl font-black text-ios-text dark:text-white leading-none">${order.total.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
