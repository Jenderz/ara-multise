import React, { useRef } from 'react';
import { Order } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { CheckCircle2, Printer, Share2, ArrowRight, X } from 'lucide-react';
import { Button } from '../../UIComponents';

interface POSTicketModalProps {
    isOpen: boolean;
    order: Order | null;
    onClose: () => void;
}

export const POSTicketModal: React.FC<POSTicketModalProps> = ({ isOpen, order, onClose }) => {
    const { settings, activeExchangeRate, activeCurrencySymbol, currentBranch } = useStore();
    const printAreaRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !order) return null;

    const subtotal = order.subtotal || order.total;
    const discount = order.discount || 0;
    const totalBs = order.total * activeExchangeRate;

    const handlePrint = () => {
        const content = printAreaRef.current;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;

        const styles = `
            @page { margin: 0; size: auto; }
            body {
                font-family: 'Courier New', Courier, monospace;
                margin: 0;
                padding: 10px;
                color: #000;
                background: #fff;
                font-size: 12px;
            }
            .ticket-container {
                width: 100%;
                max-width: 80mm;
                margin: 0 auto;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border-b { border-bottom: 1px dashed #000; margin: 8px 0; }
            .border-t { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { border-bottom: 1px solid #000; padding: 3px 0; text-align: left; }
            td { padding: 4px 0; }
            .footer-msg { font-size: 10px; margin-top: 12px; text-align: center; }
        `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ticket #${order.id}</title>
                    <style>${styles}</style>
                </head>
                <body>
                    <div class="ticket-container">
                        ${content.innerHTML}
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    };

    const handleWhatsApp = () => {
        const phone = (order.customerPhone || '').replace(/[^0-9]/g, '');
        let itemsText = order.items.map(i => `• ${i.quantity}x ${i.productTitle} - $${(i.price * i.quantity).toFixed(2)}`).join('\n');
        
        const message = `🛍️ *COMPROBANTE DE COMPRA*\n` +
            `*${settings.storeName || 'Tienda'}*\n` +
            `Sede: ${currentBranch?.name || 'Principal'}\n` +
            `Ticket: #${order.id}\n` +
            `Fecha: ${new Date(order.date).toLocaleString()}\n\n` +
            `*Detalle:*\n${itemsText}\n\n` +
            `Subtotal: $${subtotal.toFixed(2)}\n` +
            (discount > 0 ? `Descuento: -$${discount.toFixed(2)}\n` : '') +
            `*TOTAL: $${order.total.toFixed(2)} (${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs)*\n` +
            `Método de Pago: ${order.paymentMethod}\n\n` +
            `¡Gracias por su compra! 🙏`;

        const encoded = encodeURIComponent(message);
        const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col max-h-[95vh] overflow-hidden">
                {/* Header Modal */}
                <div className="p-6 pb-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg dark:text-white leading-tight">Venta Completada</h3>
                            <p className="text-xs text-gray-400">Comprobante #{order.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Vista previa Ticket (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                    <div ref={printAreaRef} className="bg-white text-black p-6 rounded-2xl shadow-sm border border-gray-200 text-xs font-mono max-w-[80mm] mx-auto">
                        <div className="text-center space-y-1 mb-4">
                            <p className="font-bold text-base uppercase tracking-wider">{settings.storeName || 'TIENDA'}</p>
                            <p className="text-[10px] text-gray-600">{currentBranch?.name || 'Sede Principal'}</p>
                            {currentBranch?.address && <p className="text-[9px] text-gray-500">{currentBranch.address}</p>}
                            <div className="border-b"></div>
                        </div>

                        <div className="space-y-0.5 text-[11px] mb-3">
                            <p><span className="font-bold">Ticket:</span> #{order.id}</p>
                            <p><span className="font-bold">Fecha:</span> {new Date(order.date).toLocaleDateString()} {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <p><span className="font-bold">Cliente:</span> {order.customerName}</p>
                            {order.customerPhone && <p><span className="font-bold">Teléfono:</span> {order.customerPhone}</p>}
                            <p><span className="font-bold">Pago:</span> {order.paymentMethod}</p>
                            <div className="border-b"></div>
                        </div>

                        {/* Items */}
                        <table className="w-full text-left mb-3">
                            <thead>
                                <tr>
                                    <th className="w-8">Cant</th>
                                    <th>Descripción</th>
                                    <th className="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100">
                                        <td className="align-top font-bold">{item.quantity}</td>
                                        <td className="align-top pr-1">
                                            <p className="font-medium leading-tight">{item.productTitle}</p>
                                            {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                                                <p className="text-[9px] text-gray-500">
                                                    {Object.entries(item.selectedOptions).map(([k, v]) => `${k}:${v}`).join(' ')}
                                                </p>
                                            )}
                                        </td>
                                        <td className="align-top text-right font-bold whitespace-nowrap">
                                            ${(item.price * item.quantity).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totales */}
                        <div className="border-t pt-2 space-y-1 text-right text-[11px]">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>Descuento:</span>
                                    <span>-${discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t my-1"></div>
                            <div className="flex justify-between text-sm font-bold">
                                <span>TOTAL USD:</span>
                                <span>${order.total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-gray-600">
                                <span>TOTAL BS:</span>
                                <span>{totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                            </div>
                        </div>

                        <div className="border-b my-3"></div>
                        <p className="text-center text-[10px] text-gray-500 footer-msg">
                            ¡Gracias por preferirnos!<br />
                            Conserve este ticket para cualquier reclamo.
                        </p>
                    </div>
                </div>

                {/* Acciones */}
                <div className="p-6 pt-4 border-t border-gray-100 dark:border-white/5 space-y-2 bg-white dark:bg-zinc-900">
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="secondary" onClick={handlePrint} className="gap-2 py-3">
                            <Printer size={16} /> Imprimir Ticket
                        </Button>
                        <Button variant="secondary" onClick={handleWhatsApp} className="gap-2 py-3 text-green-600 dark:text-green-400">
                            <Share2 size={16} /> Enviar WhatsApp
                        </Button>
                    </div>
                    <Button onClick={onClose} className="w-full py-3.5 font-bold shadow-lg shadow-ios-blue/30 gap-2">
                        Siguiente Venta <ArrowRight size={18} />
                    </Button>
                </div>
            </div>
        </div>
    );
};
