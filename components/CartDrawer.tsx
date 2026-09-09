
// ... imports remain the same ...
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Minus, Plus, Trash2, MessageCircle, Lock, ChevronRight, CheckCircle2, AlertCircle, Tag, TicketPercent } from 'lucide-react';
import { Button, Input } from './UIComponents';
import { DEFAULT_IMAGE } from '../config';
import { Coupon } from '../types';

export const CartDrawer = () => {
    const { isCartOpen, setIsCartOpen, cart, updateCartQuantity, removeFromCart, clearCart, createOrder, settings, activeExchangeRate, activeCurrencySymbol, coupons } = useStore();
    const [step, setStep] = useState<'cart' | 'details' | 'summary' | 'processing'>('cart');
    // Se inicializa el teléfono con +58 por defecto
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '+58', address: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [countdown, setCountdown] = useState(7);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    // --- Coupon State ---
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // --- Delivery State ---
    const { branches } = useStore();
    const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
    const [pickupBranchId, setPickupBranchId] = useState<number>(0);
    // Efecto para pre-seleccionar si solo hay 1 sede (Lógica Mono-sede)
    useEffect(() => {
        if (branches.length === 1 && deliveryMethod === 'pickup') {
            setPickupBranchId(branches[0].id);
        }
    }, [branches, deliveryMethod]);

    // --- Calculations ---
    const subtotal = (cart || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    const discountAmount = appliedCoupon
        ? ((appliedCoupon.discountType === 'percentage' || (appliedCoupon as any).discount_type === 'percentage')
            ? subtotal * (appliedCoupon.value / 100)
            : Math.min(subtotal, appliedCoupon.value))
        : 0;

    const total = Math.max(0, subtotal - discountAmount);

    useEffect(() => {
        if (!isCartOpen) {
            setTimeout(() => {
                setStep('cart');
                setCountdown(7);
                setErrors({});
                // Reset Coupon
                setCouponCode('');
                setAppliedCoupon(null);
                setCouponMessage(null);
                // Reset Customer Info (manteniendo el prefijo)
                setCustomerInfo(prev => ({ ...prev, phone: '+58' }));
            }, 500);
        }
    }, [isCartOpen]);

    useEffect(() => {
        let timer: any;
        if (step === 'processing' && countdown > 0) {
            timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        } else if (step === 'processing' && countdown === 0) {
            handleWhatsAppRedirect();
        }
        return () => clearInterval(timer);
    }, [step, countdown]);

    const validateDetails = () => {
        const newErrors: Record<string, string> = {};
        if ((customerInfo.name || '').length < 3) newErrors.name = "Nombre muy corto";
        // Validación básica para longitud mínima incluyendo el prefijo
        if (!/^\+?[0-9]{10,15}$/.test((customerInfo.phone || '').replace(/\s/g, ''))) newErrors.phone = "Teléfono inválido";
        if ((customerInfo.address || '').length < 5 && deliveryMethod === 'delivery') newErrors.address = "Dirección insuficiente";

        if (deliveryMethod === 'pickup' && !pickupBranchId && branches.length > 1) {
            newErrors.pickup = "Selecciona una sede";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Asegurar que siempre empiece con +
        if (!val.startsWith('+')) {
            val = '+' + val.replace(/\D/g, '');
        }
        // Permitir solo números y el símbolo +
        if (/^\+?[0-9]*$/.test(val)) {
            setCustomerInfo({ ...customerInfo, phone: val });
        }
    };

    const handleToSummary = () => {
        if (validateDetails()) setStep('summary');
    };

    const handleApplyCoupon = () => {
        const clean = couponCode.trim().toUpperCase().replace(/\s/g, '');
        if (!clean) return;

        const found = coupons.find(c => c.code.toUpperCase().replace(/\s/g, '') === clean && c.active);

        if (found) {
            const normalizedCoupon: Coupon = {
                code: found.code.toUpperCase().trim(),
                discountType: (found.discountType === 'fixed' || (found as any).discount_type === 'fixed') ? 'fixed' : 'percentage',
                value: Number(found.value) || 0,
                active: Boolean(found.active)
            };
            setAppliedCoupon(normalizedCoupon);
            const discountLabel = normalizedCoupon.discountType === 'percentage' 
                ? `${normalizedCoupon.value}%` 
                : `$${normalizedCoupon.value}`;
            setCouponMessage({ type: 'success', text: `¡Cupón aplicado exitosamente! (-${discountLabel})` });
        } else {
            setAppliedCoupon(null);
            setCouponMessage({ type: 'error', text: 'Cupón inválido o inactivo' });
        }
    };

    const handleWhatsAppRedirect = () => {
        const orderItems = cart.map(i => `• ${i.quantity}x ${i.productTitle} [${i.variantSku}]`).join('%0A');

        // Formateo del mensaje con descuento
        let priceBreakdown = `Subtotal: $${subtotal.toFixed(2)}`;

        if (appliedCoupon) {
            priceBreakdown += `%0ADescuento (${appliedCoupon.code}): -$${discountAmount.toFixed(2)}`;
        }

        priceBreakdown += `%0A*TOTAL A PAGAR: ${activeCurrencySymbol}${total.toFixed(2)}*`;

        if (settings.priceDisplayMode === 'ves' || settings.priceDisplayMode === 'both') {
            const totalBs = total * activeExchangeRate;
            priceBreakdown += ` / Bs ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }

        let deliveryInfo = "";
        if (deliveryMethod === 'pickup') {
            const branchName = branches.find(b => b.id === pickupBranchId)?.name || 'Tienda';
            deliveryInfo = `%0A%0AMétodo: *Retiro en Tienda (${branchName})*`;
        } else {
            deliveryInfo = `%0A%0ADirección:%0A*${customerInfo.address}*`;
        }

        const message = `Hola *${settings.storeName}*, soy *${customerInfo.name}*.%0A%0AQuiero confirmar mi pedido:%0A${deliveryInfo}%0A%0ADetalle:%0A${orderItems}%0A%0A${priceBreakdown}`;

        clearCart();
        setIsCartOpen(false);
        window.location.href = `https://wa.me/${String(settings.whatsappNumber || '').replace(/\D/g, '')}?text=${message}`;
    };

    const handleConfirmOrder = async () => {
        if (isSubmittingOrder) return;
        setIsSubmittingOrder(true);
        try {
            // Enviar método de entrega, total, descuento y código de cupón aplicados correctamente
            await createOrder(
                customerInfo.name, 
                customerInfo.phone, 
                deliveryMethod === 'delivery' ? customerInfo.address : 'Retiro en Tienda', 
                cart, 
                total, 
                'WhatsApp', 
                'pending', 
                discountAmount, 
                deliveryMethod, 
                pickupBranchId,
                undefined,
                undefined,
                undefined,
                undefined,
                appliedCoupon?.code
            );
            setStep('processing');
        } catch (error: any) {
            alert(error?.message || "No se pudo procesar la orden. Por favor verifica las existencias o intenta nuevamente.");
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    // --- Price Logic ---
    // Formato: Sin decimales, separador de miles con punto
    const formatVes = (usd: number) => `Bs ${(usd * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const showUsd = settings.priceDisplayMode === 'usd' || settings.priceDisplayMode === 'both';
    const showVes = settings.priceDisplayMode === 'ves' || settings.priceDisplayMode === 'both';

    const isVesOnly = settings.priceDisplayMode === 'ves';

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end font-sans">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />

            <div className="relative w-full max-w-md bg-ios-bg dark:bg-zinc-900 shadow-2xl h-full flex flex-col animate-slide-in-right">

                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-10">
                    <h2 className="text-xl font-bold text-ios-text dark:text-white">
                        {step === 'cart' ? 'Tu Bolsa' : step === 'details' ? 'Tus Datos' : step === 'summary' ? 'Confirmar' : 'Pedido Generado'}
                    </h2>
                    {step !== 'processing' && (
                        <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition dark:text-white">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 relative">

                    {step === 'cart' && (
                        <div className="space-y-6">
                            {(cart || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-50 dark:text-white">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                        <Trash2 className="text-gray-300" />
                                    </div>
                                    <p className="text-lg font-medium">Tu bolsa está vacía</p>
                                </div>
                            ) : cart.map((item) => (
                                <div key={item.cartId} className="flex gap-4">
                                    <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-black/5">
                                        <img src={item.image || DEFAULT_IMAGE} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-semibold text-ios-text dark:text-white text-sm">{item.productTitle}</h3>
                                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {item.variantSku}</p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex flex-col">
                                                {showUsd && <p className="font-bold text-ios-text dark:text-white">{activeCurrencySymbol}{(item.price || 0).toFixed(2)}</p>}
                                                {showVes && <p className="text-[10px] font-medium text-gray-500">{formatVes(item.price || 0)}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 rounded-lg p-0.5">
                                                <button onClick={() => updateCartQuantity(item.cartId, -1)} className="p-1 hover:bg-white dark:hover:bg-black/20 rounded-md transition"><Minus size={12} /></button>
                                                <span className="text-xs font-medium w-4 text-center dark:text-white">{item.quantity}</span>
                                                <button onClick={() => updateCartQuantity(item.cartId, 1)} className="p-1 hover:bg-white dark:hover:bg-black/20 rounded-md transition"><Plus size={12} /></button>
                                            </div>
                                            <button onClick={() => removeFromCart(item.cartId)} className="text-red-400 p-1"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'details' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-start gap-3 border border-blue-100">
                                <Lock className="text-ios-blue shrink-0 mt-0.5" size={18} />
                                <p className="text-xs text-ios-blue dark:text-blue-200">Ingresa tus datos. Finalizarás la compra en WhatsApp.</p>
                            </div>

                            {/* Selector de Método de Entrega */}
                            <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                                <button
                                    onClick={() => setDeliveryMethod('delivery')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${deliveryMethod === 'delivery' ? 'bg-white dark:bg-zinc-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    Delivery / Envío
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('pickup')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${deliveryMethod === 'pickup' ? 'bg-white dark:bg-zinc-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    Retiro en Tienda
                                </button>
                            </div>

                            {deliveryMethod === 'pickup' && branches.length > 1 && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Selecciona la Sede</label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-ios-blue transition dark:text-white"
                                        value={pickupBranchId}
                                        onChange={(e) => setPickupBranchId(Number(e.target.value))}
                                    >
                                        <option value={0} disabled>-- Elige una sede --</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name} - {b.address}</option>
                                        ))}
                                    </select>
                                    {errors.pickup && <p className="text-red-500 text-[10px] mt-1 ml-1 font-bold uppercase">{errors.pickup}</p>}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <Input label="Nombre Completo" placeholder="Ej. Juan Pérez" value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })} />
                                    {errors.name && <p className="text-red-500 text-[10px] mt-1 ml-1 font-bold uppercase">{errors.name}</p>}
                                </div>
                                <div>
                                    <Input label="WhatsApp (Venezuela)" type="tel" placeholder="+58 412..." value={customerInfo.phone} onChange={handlePhoneChange} />
                                    {errors.phone && <p className="text-red-500 text-[10px] mt-1 ml-1 font-bold uppercase">{errors.phone}</p>}
                                </div>

                                {deliveryMethod === 'delivery' && (
                                    <div className="animate-fade-in">
                                        <Input label="Dirección de Entrega" placeholder="Calle, Número, Ciudad..." value={customerInfo.address} onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })} />
                                        {errors.address && <p className="text-red-500 text-[10px] mt-1 ml-1 font-bold uppercase">{errors.address}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ... Summary and Processing Steps (unchanged logic from previous step) ... */}
                    {step === 'summary' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl border border-gray-100 dark:border-white/5 space-y-4 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-green-500" /> Confirmar Datos
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-[10px] text-gray-400 uppercase">Cliente</p><p className="text-sm font-bold dark:text-white">{customerInfo.name}</p></div>
                                    <div><p className="text-[10px] text-gray-400 uppercase">Teléfono</p><p className="text-sm font-bold dark:text-white">{customerInfo.phone}</p></div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] text-gray-400 uppercase">{deliveryMethod === 'delivery' ? 'Dirección de Entrega' : 'Retiro en Sede'}</p>
                                        <p className="text-sm font-bold dark:text-white">
                                            {deliveryMethod === 'delivery'
                                                ? customerInfo.address
                                                : (branches.find(b => b.id === pickupBranchId)?.name || 'Tienda')
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Sección Cupones */}
                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl border border-gray-100 dark:border-white/5 space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <TicketPercent size={14} className="text-ios-blue" /> Cupón de Descuento
                                </h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="CÓDIGO"
                                        className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-2 text-sm outline-none border border-transparent focus:border-ios-blue/30 transition-all uppercase font-mono"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !appliedCoupon) { e.preventDefault(); handleApplyCoupon(); } }}
                                        disabled={!!appliedCoupon}
                                    />
                                    {appliedCoupon ? (
                                        <Button onClick={() => { setAppliedCoupon(null); setCouponCode(''); setCouponMessage(null); }} className="bg-red-500 text-white px-3 py-2 h-auto text-xs">
                                            <Trash2 size={16} />
                                        </Button>
                                    ) : (
                                        <Button onClick={handleApplyCoupon} className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 h-auto text-xs font-bold">
                                            Aplicar
                                        </Button>
                                    )}
                                </div>
                                {couponMessage && (
                                    <p className={`text-[10px] font-bold ${couponMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                        {couponMessage.text}
                                    </p>
                                )}
                            </div>

                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-3xl border border-gray-100 dark:border-white/5 space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resumen de Orden</h4>
                                {cart.map(item => (
                                    <div key={item.cartId} className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">{(item.quantity || 1)}x {item.productTitle}</span>
                                        <span className="font-bold dark:text-white">
                                            {isVesOnly
                                                ? formatVes((item.price || 0) * (item.quantity || 1))
                                                : `${activeCurrencySymbol}${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`
                                            }
                                        </span>
                                    </div>
                                ))}

                                <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex flex-col gap-2">
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Subtotal</span>
                                        <span>
                                            {isVesOnly
                                                ? formatVes(subtotal)
                                                : `${activeCurrencySymbol}${subtotal.toFixed(2)}`
                                            }
                                        </span>
                                    </div>

                                    {appliedCoupon && (
                                        <div className="flex justify-between text-sm text-green-500 font-bold">
                                            <span>Descuento ({appliedCoupon.code})</span>
                                            <span>
                                                -{isVesOnly
                                                    ? formatVes(discountAmount)
                                                    : `${activeCurrencySymbol}${discountAmount.toFixed(2)}`
                                                }
                                            </span>
                                        </div>
                                    )}

                                    {showUsd && (
                                        <div className="flex justify-between text-xl font-black text-ios-blue mt-1">
                                            <span>Total {activeCurrencySymbol === '€' ? 'EUR' : 'USD'}</span>
                                            <span>{activeCurrencySymbol}{total.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {showVes && (
                                        <div className="flex justify-between text-lg font-bold text-gray-500 dark:text-gray-400">
                                            <span>Total Bs</span>
                                            <span>{formatVes(total)}</span>
                                        </div>
                                    )}

                                    {settings.priceDisplayMode === 'both' && (
                                        <p className="text-[10px] text-right text-gray-400">Tasa: 1 {activeCurrencySymbol} = Bs {activeExchangeRate.toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="relative w-24 h-24 mb-6">
                                <svg className="animate-spin w-full h-full text-green-500" viewBox="0 0 50 50">
                                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-10"></circle>
                                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="80" strokeDashoffset="60"></circle>
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center font-bold text-2xl dark:text-white">{countdown}</span>
                            </div>
                            <h3 className="text-2xl font-bold mb-2 dark:text-white">¡Orden Lista!</h3>
                            <p className="text-xs text-ios-subtext max-w-xs mx-auto mb-8">Abriendo WhatsApp para confirmar tu pedido automáticamente...</p>
                            <Button onClick={handleWhatsAppRedirect} className="bg-green-500 hover:bg-green-600 text-white gap-2">
                                <MessageCircle size={20} /> Enviar WhatsApp
                            </Button>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                {step !== 'processing' && (cart || []).length > 0 && (
                    <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur pb-safe z-10">
                        {step === 'cart' ? (
                            <Button className="w-full text-lg h-14 gap-2" onClick={() => setStep('details')}>
                                Comprar Ahora <ChevronRight size={20} />
                            </Button>
                        ) : step === 'details' ? (
                            <div className="flex gap-3">
                                <Button variant="secondary" className="flex-1" onClick={() => setStep('cart')}>Volver</Button>
                                <Button className="flex-[2]" onClick={handleToSummary}>Continuar</Button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <Button variant="secondary" className="flex-1" onClick={() => setStep('details')}>Corregir</Button>
                                <Button 
                                    className="flex-[2] bg-green-500 hover:bg-green-600 text-white gap-2" 
                                    onClick={handleConfirmOrder}
                                    disabled={isSubmittingOrder}
                                >
                                    <MessageCircle size={18} /> {isSubmittingOrder ? 'Procesando...' : 'Confirmar Pedido'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
