
import React, { useRef, useState, useMemo } from 'react';
import { Order, StoreSettings } from '../../../types';
import { X, Printer, Download, Share2, Loader2 } from 'lucide-react';
import { Button } from '../../UIComponents';
import { useStore } from '../../../context/StoreContext';
import html2canvas from 'html2canvas';

interface ReceiptModalProps {
    order: Order;
    settings: StoreSettings;
    onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, settings, onClose }) => {
    const { activeExchangeRate, activeCurrencySymbol, branches } = useStore();
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // --- CÁLCULOS FINANCIEROS ---
    const financialData = useMemo(() => {
        const subtotal = order.subtotal && order.subtotal > 0
            ? order.subtotal
            : order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = order.discount !== undefined && order.discount > 0
            ? order.discount
            : Math.max(0, subtotal - order.total);
        const hasDiscount = discount > 0.009;

        return { subtotal, discount, hasDiscount };
    }, [order]);

    const activeBranchName = useMemo(() => {
        if (!order.branchId && !order.pickupBranchId) return '';
        const targetId = order.pickupBranchId || order.branchId;
        const b = branches.find(branch => branch.id === targetId);
        return b?.name || '';
    }, [branches, order.branchId, order.pickupBranchId]);

    // --- LÓGICA DE FORMATO DE PRECIO ---
    const formatPrice = (amount: number) => {
        const mode = settings.priceDisplayMode || 'both';

        // Cálculos
        const usdPrice = `${activeCurrencySymbol}${amount.toFixed(2)}`;
        const vesPrice = `Bs ${(amount * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        if (mode === 'ves') return vesPrice;
        if (mode === 'usd') return usdPrice;

        // Modo 'both': Retorna un objeto o string formateado (aquí string para el print simple)
        return { usd: usdPrice, ves: vesPrice, isBoth: true };
    };

    // Helper para renderizar precio en el HTML visual
    const PriceDisplay = ({ amount, bold = false, isNegative = false }: { amount: number, bold?: boolean, isNegative?: boolean }) => {
        const formatted = formatPrice(amount);
        const className = `${bold ? "font-bold" : ""} ${isNegative ? "text-red-500" : ""}`;

        if (typeof formatted === 'object') {
            return (
                <div className={`flex flex-col items-end leading-none ${className}`}>
                    <span>{isNegative && '-'}{formatted.usd}</span>
                    <span className="text-[9px] text-gray-500 font-normal mt-0.5">{isNegative && '-'}{formatted.ves}</span>
                </div>
            );
        }
        return <span className={className}>{isNegative && '-'}{formatted}</span>;
    };

    // Función para imprimir (Browser Print)
    const handlePrint = () => {
        const content = receiptRef.current;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;

        // Estilos CSS inyectados para la ventana de impresión
        const styles = `
            @page { margin: 0; size: auto; }
            body { 
                font-family: 'Courier New', Courier, monospace; 
                margin: 0; 
                padding: 10px; 
                color: #000; 
                background: #fff;
            }
            .receipt-container { 
                width: 100%; 
                max-width: 80mm; /* Ancho estándar térmico */
                margin: 0 auto; 
            }
            img { 
                max-width: 80px; 
                display: block; 
                margin: 0 auto 10px auto; 
                filter: grayscale(100%); /* Ahorro tinta térmica */
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-xs { font-size: 11px; }
            .text-sm { font-size: 12px; }
            .border-b { border-bottom: 1px dashed #000; margin: 8px 0; }
            .border-t { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
            td, th { padding: 4px 0; vertical-align: top; }
            .qty { width: 10%; font-weight: bold; }
            .desc { width: 60%; padding-right: 5px; }
            .total { width: 30%; text-align: right; }
            .totals-section { margin-top: 5px; display: flex; flex-direction: column; align-items: flex-end; width: 100%; }
            .total-row { display: flex; justify-content: space-between; width: 100%; margin-bottom: 4px; }
            .grand-total { font-size: 14px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
            .dual-price { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1; }
            .small-curr { font-size: 9px; font-weight: normal; }
        `;

        // Generar HTML String basado en la lógica de moneda
        const getPriceString = (amt: number, isNeg = false) => {
            const f = formatPrice(amt);
            const prefix = isNeg ? '-' : '';
            if (typeof f === 'object') return `<div class="dual-price"><span>${prefix}${f.usd}</span><span class="small-curr">${prefix}${f.ves}</span></div>`;
            return `${prefix}${f}`;
        };

        const deliveryInfo = order.deliveryMethod === 'delivery'
            ? `<div><b>Dirección:</b> ${order.customerAddress || 'No registrada'}</div>`
            : order.deliveryMethod === 'pickup'
                ? `<div><b>Retiro en Sede:</b> ${activeBranchName || 'Tienda'}</div>`
                : order.deliveryMethod === 'pos'
                    ? `<div><b>Tipo:</b> Venta en Mostrador (POS)</div>`
                    : '';

        const itemsHtml = order.items.map(item => `
            <tr>
                <td class="qty">${item.quantity}</td>
                <td class="desc">
                    ${item.productTitle}
                    ${item.variantSku !== item.productId ? `<div style="font-size:9px">${item.variantSku}</div>` : ''}
                </td>
                <td class="total">${getPriceString(item.price * item.quantity)}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
            <head><title>Ticket #${order.id}</title><style>${styles}</style></head>
            <body>
                <div class="receipt-container">
                    <div class="text-center">
                        ${settings.logoUrl ? `<img src="${settings.logoUrl}" />` : ''}
                        <div class="font-bold" style="font-size:14px; text-transform:uppercase">${settings.storeName}</div>
                        <div class="font-bold" style="font-size:11px; margin: 4px 0;">RECIBO NO FISCAL</div>
                        <div class="text-xs">${settings.contactAddress || ''}</div>
                        <div class="text-xs">Tel: ${settings.whatsappNumber || ''}</div>
                        <div class="text-xs">${new Date(order.date || Date.now()).toLocaleString()}</div>
                    </div>

                    <div class="border-b"></div>

                    <div class="text-xs">
                        <div><b>Orden:</b> #${order.id.slice(0, 8)}</div>
                        ${activeBranchName ? `<div><b>Sede:</b> ${activeBranchName}</div>` : ''}
                        ${order.sellerName ? `<div><b>Caja:</b> ${order.sellerName}</div>` : ''}
                        ${order.advisorName ? `<div><b>Asesor:</b> ${order.advisorName}</div>` : ''}
                        <div><b>Cliente:</b> ${order.customerName}</div>
                        ${order.customerPhone ? `<div><b>Tel:</b> ${order.customerPhone}</div>` : ''}
                        ${deliveryInfo}
                    </div>

                    <div class="border-b"></div>

                    <table>
                        <thead>
                            <tr><th class="qty">#</th><th class="desc">Desc</th><th class="total">Total</th></tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>

                    <div class="border-t"></div>

                    <div class="totals-section text-xs">
                        <div class="total-row">
                            <span>Subtotal:</span>
                            <span>${getPriceString(financialData.subtotal)}</span>
                        </div>
                        ${financialData.hasDiscount ? `
                        <div class="total-row">
                            <span>Descuento:</span>
                            <span>${getPriceString(financialData.discount, true)}</span>
                        </div>` : ''}
                        <div class="total-row grand-total">
                            <span>TOTAL:</span>
                            <span>${getPriceString(order.total)}</span>
                        </div>
                        <div class="total-row" style="margin-top:5px; font-style:italic">
                            <span>Método:</span>
                            <span>${order.paymentMethod}</span>
                        </div>
                        ${settings.priceDisplayMode === 'both' ? `
                        <div class="text-center" style="width:100%; margin-top:5px; font-size:9px">
                            Tasa: 1 ${activeCurrencySymbol} = Bs ${activeExchangeRate.toFixed(2)}
                        </div>` : ''}
                    </div>

                    <div class="border-t"></div>

                    <div class="text-center text-xs" style="margin-top:15px">
                        <p style="font-weight:bold;">¡GRACIAS POR SU COMPRA!</p>
                        <p style="font-size:9px; color:#888; margin-top:5px;">Tecnología Lyberate</p>
                    </div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 500);
        };
    };

    // --- GENERADOR DE IMAGEN (CLONACIÓN) ---
    const generateCanvas = async () => {
        if (!receiptRef.current) return null;

        const original = receiptRef.current;
        const clone = original.cloneNode(true) as HTMLElement;

        // Estilos para el renderizado off-screen perfecto
        clone.style.position = 'fixed';
        clone.style.left = '-9999px';
        clone.style.top = '0px';
        clone.style.width = '320px'; // Un poco más ancho para evitar saltos de línea
        clone.style.height = 'auto';
        clone.style.padding = '20px'; // Padding extra para la imagen
        clone.style.zIndex = '-1';
        clone.style.backgroundColor = '#ffffff';
        clone.style.color = '#000000';

        document.body.appendChild(clone);

        try {
            const canvas = await html2canvas(clone, {
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true,
            });
            document.body.removeChild(clone);
            return canvas;
        } catch (error) {
            document.body.removeChild(clone);
            console.error("Error generando imagen:", error);
            return null;
        }
    };

    const handleDownloadImage = async () => {
        setIsGenerating(true);
        try {
            const canvas = await generateCanvas();
            if (!canvas) throw new Error("Error Canvas");

            const image = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.href = image;
            link.download = `Recibo_${order.id}.png`;
            link.click();
        } catch (error) {
            alert("Error al generar la imagen.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShare = async () => {
        setIsGenerating(true);
        try {
            const canvas = await generateCanvas();
            if (!canvas) throw new Error("Error Canvas");

            const shareViaWhatsappText = () => {
                const phone = (order.customerPhone || '').replace(/[^0-9]/g, '');
                const itemsText = order.items.map(i => `• ${i.quantity}x ${i.productTitle} - $${(i.price * i.quantity).toFixed(2)}`).join('\n');
                const totalBs = (order.total * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 });
                const message = `🛍️ *COMPROBANTE DE COMPRA*\n` +
                    `*${settings.storeName || 'Tienda'}*\n` +
                    (activeBranchName ? `Sede: ${activeBranchName}\n` : '') +
                    `Ticket: #${order.id.slice(0, 8)}\n` +
                    `Fecha: ${new Date(order.date || Date.now()).toLocaleString()}\n\n` +
                    `*Detalle:*\n${itemsText}\n\n` +
                    `Subtotal: $${financialData.subtotal.toFixed(2)}\n` +
                    (financialData.hasDiscount ? `Descuento: -$${financialData.discount.toFixed(2)}\n` : '') +
                    `*TOTAL: $${order.total.toFixed(2)} (${totalBs} Bs)*\n` +
                    `Método: ${order.paymentMethod}\n\n` +
                    `¡Gracias por su compra! 🙏`;
                const encoded = encodeURIComponent(message);
                const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
                window.open(url, '_blank');
            };

            if (navigator.canShare) {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        shareViaWhatsappText();
                        return;
                    }
                    const file = new File([blob], `ticket_${order.id}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: `Recibo #${order.id.slice(0, 8)}`,
                                text: `Gracias por tu compra en ${settings.storeName}!`
                            });
                        } catch (err) {
                            shareViaWhatsappText();
                        }
                    } else {
                        shareViaWhatsappText();
                    }
                }, 'image/png');
            } else {
                shareViaWhatsappText();
            }
        } catch (e) {
            alert("No soportado en este dispositivo.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-800 w-full max-w-sm rounded-3xl shadow-2xl relative animate-slide-up flex flex-col max-h-[90vh]">

                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20 rounded-t-3xl">
                    <h3 className="font-bold dark:text-white flex items-center gap-2 text-sm"><Printer size={16} /> Ticket de Venta</h3>
                    <button onClick={onClose}><X size={20} className="dark:text-white hover:text-red-500 transition" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-black/50 flex justify-center">

                    {/* --- LIENZO DEL TICKET --- */}
                    <div ref={receiptRef} className="receipt-container bg-white text-black p-6 shadow-xl w-[300px] text-xs font-mono leading-tight relative h-fit">
                        <div className="text-center mb-4">
                            {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" className="max-w-[80px] mx-auto mb-2 grayscale" crossOrigin="anonymous" />}
                            <h2 className="text-sm font-bold uppercase">{settings.storeName}</h2>
                            <p className="text-xs font-bold uppercase mt-1 mb-1">Recibo No Fiscal</p>
                            <p className="text-[10px]">{settings.contactAddress}</p>
                            <p className="text-[10px]">Tel: {settings.whatsappNumber}</p>
                            <p className="text-[10px] mt-1">{new Date(order.date || Date.now()).toLocaleString()}</p>
                        </div>

                        {/* Divisor sólido para evitar overlapping */}
                        <div className="w-full border-b border-dashed border-black mb-3 mt-1"></div>

                        <div className="flex flex-col gap-1 mb-3">
                            <div className="flex justify-between"><span>Orden:</span><span className="font-bold">#{order.id.slice(0, 8)}</span></div>
                            {activeBranchName && <div className="flex justify-between"><span>Sede:</span><span>{activeBranchName}</span></div>}
                            {order.sellerName && <div className="flex justify-between"><span>Caja:</span><span>{order.sellerName}</span></div>}
                            {order.advisorName && <div className="flex justify-between"><span>Asesor:</span><span className="font-bold">{order.advisorName}</span></div>}
                            <div className="flex justify-between"><span>Cliente:</span><span className="font-bold">{order.customerName}</span></div>
                            {order.customerPhone && <div className="flex justify-between"><span>Tel:</span><span>{order.customerPhone}</span></div>}

                            {order.deliveryMethod === 'delivery' && (
                                <div className="flex justify-between items-start mt-1">
                                    <span>Dir:</span>
                                    <span className="font-bold text-right max-w-[60%]">{order.customerAddress}</span>
                                </div>
                            )}
                            {order.deliveryMethod === 'pickup' && (
                                <div className="flex justify-between items-start mt-1">
                                    <span>Retiro:</span>
                                    <span className="font-bold text-right max-w-[60%]">{activeBranchName || 'Tienda'}</span>
                                </div>
                            )}
                            {order.deliveryMethod === 'pos' && (
                                <div className="flex justify-between items-start mt-1">
                                    <span>Tipo:</span>
                                    <span className="font-bold text-right">Venta en Mostrador (POS)</span>
                                </div>
                            )}
                        </div>

                        <div className="w-full border-b border-dashed border-black mb-3"></div>

                        <table className="w-full text-left mb-4">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="w-6 pb-2">#</th>
                                    <th className="pb-2">Desc</th>
                                    <th className="text-right pb-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, i) => (
                                    <tr key={i}>
                                        <td className="font-bold align-top pt-2">{item.quantity}</td>
                                        <td className="align-top pr-1 pt-2">
                                            {item.productTitle}
                                            {item.variantSku !== item.productId && <div className="text-[9px] italic">{item.variantSku}</div>}
                                        </td>
                                        <td className="text-right align-top pt-2 font-medium">
                                            <PriceDisplay amount={item.price * item.quantity} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Divisor con margen amplio para evitar colisión con Totales */}
                        <div className="w-full border-b border-dashed border-black mb-4 mt-2"></div>

                        {/* Sección Totales con Gap */}
                        <div className="flex flex-col gap-2 text-right w-full">
                            <div className="flex justify-between items-center text-xs">
                                <span>Subtotal:</span>
                                <PriceDisplay amount={financialData.subtotal} />
                            </div>

                            {financialData.hasDiscount && (
                                <div className="flex justify-between items-center text-xs">
                                    <span>Descuento:</span>
                                    <PriceDisplay amount={financialData.discount} isNegative />
                                </div>
                            )}

                            <div className="flex justify-between items-center text-sm font-bold border-t border-black pt-2 mt-1">
                                <span>TOTAL:</span>
                                <PriceDisplay amount={order.total} bold />
                            </div>

                            <div className="text-[10px] italic mt-1">Método: {order.paymentMethod}</div>

                            {settings.priceDisplayMode === 'both' && (
                                <div className="text-[9px] text-center mt-3 text-gray-500 border-t border-gray-200 pt-2">
                                    Tasa: Bs {activeExchangeRate.toFixed(2)}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center text-[10px]">
                            <p className="font-bold mb-1">¡GRACIAS POR SU COMPRA!</p>
                            <p className="text-[9px] text-gray-400 opacity-70">Tecnología Lyberate</p>
                        </div>
                    </div>
                    {/* --- FIN LIENZO --- */}

                </div>

                <div className="p-4 bg-white dark:bg-zinc-800 border-t border-gray-100 dark:border-white/5 space-y-2 rounded-b-3xl">
                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handlePrint} variant="secondary" className="text-xs h-10 gap-2">
                            <Printer size={16} /> Imprimir
                        </Button>
                        <Button onClick={handleDownloadImage} disabled={isGenerating} className="text-xs h-10 gap-2 bg-gray-900 text-white dark:bg-white dark:text-black">
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Guardar IMG
                        </Button>
                    </div>
                    <Button onClick={handleShare} variant="primary" disabled={isGenerating} className="w-full text-xs h-10 gap-2 bg-green-600 hover:bg-green-700 text-white">
                        <Share2 size={16} /> Compartir Whatsapp
                    </Button>
                </div>
            </div>
        </div>
    );
};
