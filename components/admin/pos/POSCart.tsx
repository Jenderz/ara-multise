
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, SalesAdvisor, PaymentMethod } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { usePOS } from '../../../context/POSContext';
import { Button } from '../../UIComponents';
import { ShoppingCart, Plus, Minus, Trash2, X, User, FileText, PauseCircle, Maximize2, Minimize2, Tag, DollarSign, Percent, History, CheckCircle2, UserCheck, Award, UserPlus, ChevronDown, ChevronLeft } from 'lucide-react';

interface POSCartProps {
    onBackToCatalog?: () => void;
}

export const POSCart: React.FC<POSCartProps> = ({ onBackToCatalog }) => {
    const { customers, activeExchangeRate, activeCurrencySymbol, currentUser, settings, updateSettings, currentBranch } = useStore();
    const {
        cart,
        updateQuantity,
        updateItemDiscount,
        removeFromCart,
        clearCart,
        prepareCheckout,
        parkOrder,
        parkedOrders,
        restoreOrder,
        deleteParkedOrder,
        isFullScreen,
        toggleFullScreen,
        total: cartTotal // Total base calculado en contexto
    } = usePOS();

    // --- ESTADOS LOCALES DEL CARRITO UI ---
    const [customerInput, setCustomerInput] = useState('');
    const [customerPhone, setCustomerPhone] = useState('+58');
    const [customerCedula, setCustomerCedula] = useState('');
    const [showCustomerDetails, setShowCustomerDetails] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [orderNote, setOrderNote] = useState('');
    const [showParkedList, setShowParkedList] = useState(false);

    // --- ESTADO PARA ASIGNACIÓN DE ASESOR DE PISO (OPCIONAL) Y COMISIÓN ---
    const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>('');
    const [selectedAdvisorObj, setSelectedAdvisorObj] = useState<SalesAdvisor | null>(null);
    const [localQuickAdvisors, setLocalQuickAdvisors] = useState<SalesAdvisor[]>([]);
    const [applyCommission, setApplyCommission] = useState<boolean>(false);
    const [customCommissionRate, setCustomCommissionRate] = useState<string>('0');

    // --- MODAL DE ASESOR Y REGISTRO RÁPIDO DE ASESOR ---
    const [showAdvisorModal, setShowAdvisorModal] = useState(false);
    const [showRegisterNewAdvisor, setShowRegisterNewAdvisor] = useState(false);
    const [quickAdvisorName, setQuickAdvisorName] = useState('');
    const [quickAdvisorRate, setQuickAdvisorRate] = useState('0');
    const [isSavingQuickAdvisor, setIsSavingQuickAdvisor] = useState(false);

    // Solo asesores de venta (combinando ajustes globales con asesores registrados en caliente en esta sesión)
    const availableAdvisors = useMemo(() => {
        const fromSettings = (settings.salesAdvisors || []).filter((a: SalesAdvisor) => a.active !== false);
        const combined = [...fromSettings];
        localQuickAdvisors.forEach(la => {
            if (!combined.some(a => a.id === la.id)) {
                combined.push(la);
            }
        });
        return combined;
    }, [settings.salesAdvisors, localQuickAdvisors]);

    const selectedAdvisor = useMemo(() => {
        if (selectedAdvisorObj && selectedAdvisorObj.id === selectedAdvisorId) {
            return selectedAdvisorObj;
        }
        return availableAdvisors.find((a: SalesAdvisor) => a.id === selectedAdvisorId) || null;
    }, [availableAdvisors, selectedAdvisorId, selectedAdvisorObj]);

    const handleSaveQuickAdvisor = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!quickAdvisorName.trim()) return;

        setIsSavingQuickAdvisor(true);
        try {
            const currentAdvisors = Array.isArray(settings.salesAdvisors) ? [...settings.salesAdvisors] : [];
            const newAdvisor: SalesAdvisor = {
                id: 'adv_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
                name: quickAdvisorName.trim(),
                branchId: currentBranch?.id || 0,
                commissionRate: parseFloat(quickAdvisorRate) || 0,
                active: true,
                createdAt: Date.now()
            };

            // 1. Guardar de forma INMEDIATA en memoria local para que esté activo en este mismo instante
            setLocalQuickAdvisors(prev => [...prev, newAdvisor]);
            setSelectedAdvisorId(newAdvisor.id);
            setSelectedAdvisorObj(newAdvisor);

            if (newAdvisor.commissionRate && newAdvisor.commissionRate > 0) {
                setApplyCommission(true);
                setCustomCommissionRate(String(newAdvisor.commissionRate));
            } else {
                setApplyCommission(false);
                setCustomCommissionRate('0');
            }

            // 2. Persistir en ajustes globales
            await updateSettings({ salesAdvisors: [...currentAdvisors, newAdvisor] });

            setQuickAdvisorName('');
            setQuickAdvisorRate('0');
            setShowRegisterNewAdvisor(false);
            setShowAdvisorModal(false);
        } catch (err) {
            console.error("Error saving quick advisor:", err);
        } finally {
            setIsSavingQuickAdvisor(false);
        }
    };

    // Cuando cambia el asesor, sincronizar la comisión sugerida si la tiene
    useEffect(() => {
        if (selectedAdvisor && selectedAdvisor.commissionRate && selectedAdvisor.commissionRate > 0) {
            setApplyCommission(true);
            setCustomCommissionRate(String(selectedAdvisor.commissionRate));
        } else {
            setApplyCommission(false);
            setCustomCommissionRate('0');
        }
    }, [selectedAdvisorId, selectedAdvisor]);
    
    // --- ESTADO PARA DESCUENTO INDIVIDUAL ---
    const [activeItemDiscount, setActiveItemDiscount] = useState<string | null>(null);
    const [itemDiscountVal, setItemDiscountVal] = useState<string>('');
    const [itemDiscountType, setItemDiscountType] = useState<'percent' | 'fixed'>('percent');

    // --- LÓGICA DE DESCUENTO ---
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
    const [discountValue, setDiscountValue] = useState<string>('');

    const discountAmount = useMemo(() => {
        const val = parseFloat(discountValue) || 0;
        if (discountType === 'percent') return cartTotal * (val / 100);
        return val;
    }, [cartTotal, discountValue, discountType]);

    const finalTotal = Math.max(0, cartTotal - discountAmount);
    const totalBs = finalTotal * activeExchangeRate;

    // Comisión opcional para el asesor seleccionado
    const activeCommissionRate = applyCommission 
        ? (customCommissionRate !== '' ? (parseFloat(customCommissionRate) || 0) : (selectedAdvisor?.commissionRate || 0))
        : 0;
    const estimatedCommission = activeCommissionRate > 0 ? (finalTotal * (activeCommissionRate / 100)) : 0;

    // --- CONTADOR DE ITEMS ---
    const totalItems = useMemo(() => {
        return cart.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
    }, [cart]);
    // --- LÓGICA DE PAGO MIXTO ---
    const [isMixedPayment, setIsMixedPayment] = useState(false);
    const activePaymentMethods = (settings.paymentMethods || [])
        .filter((m: PaymentMethod) => m.isActive)
        .map((m: PaymentMethod) => m.name);

    const initialMethod = activePaymentMethods.length > 0 ? activePaymentMethods[0] : 'Efectivo Divisa';
    const [paymentMethod, setPaymentMethod] = useState(initialMethod);
    const [mixedPayments, setMixedPayments] = useState<{ method: string, amount: string }[]>([{ method: initialMethod, amount: '' }]);

    useEffect(() => {
        if (cart.length === 0) {
            setDiscountValue('');
            setShowDiscountInput(false);
        }
    }, [cart]);

    useEffect(() => {
        if (!customerInput || selectedCustomer) {
            setCustomerSuggestions([]);
            return;
        }
        const term = customerInput.toLowerCase();
        const matches = customers.filter(c =>
            c.name.toLowerCase().includes(term) || c.phone.includes(term) || (c.cedula || '').toLowerCase().includes(term)
        ).slice(0, 5);
        setCustomerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [customerInput, customers]);

    const selectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setCustomerInput(c.name);
        setCustomerPhone(c.phone || '+58');
        setCustomerCedula(c.cedula || '');
        setShowSuggestions(false);
    };

    const addPaymentRow = () => {
        setMixedPayments([...mixedPayments, { method: initialMethod, amount: '' }]);
    };

    const removePaymentRow = (index: number) => {
        setMixedPayments(mixedPayments.filter((_, i) => i !== index));
    };

    const updatePaymentRow = (index: number, field: 'method' | 'amount', value: string) => {
        const newPayments = [...mixedPayments];
        newPayments[index] = { ...newPayments[index], [field]: value };
        setMixedPayments(newPayments);
    };

    const remaining = finalTotal - mixedPayments.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);

    const handleCheckoutClick = () => {
        const name = selectedCustomer ? selectedCustomer.name : (customerInput || 'Cliente Mostrador');
        const phone = selectedCustomer ? selectedCustomer.phone : customerPhone;

        let finalAddress = selectedCustomer ? selectedCustomer.address : '';
        const extraInfo: string[] = [];
        if (customerCedula.trim()) extraInfo.push(`CI: ${customerCedula.trim()}`);
        if (orderNote.trim()) extraInfo.push(`Nota: ${orderNote.trim()}`);
        if (extraInfo.length > 0) {
            const extraStr = extraInfo.join(' | ');
            finalAddress = finalAddress ? `${finalAddress} | ${extraStr}` : extraStr;
        }

        let finalPaymentMethod = paymentMethod;

        if (isMixedPayment) {
            if (Math.abs(remaining) > 0.01) {
                alert(`Los montos no coinciden. Faltan $${remaining.toFixed(2)}`);
                return;
            }
            finalPaymentMethod = mixedPayments
                .filter(p => parseFloat(p.amount) > 0)
                .map(p => `${p.method} ($${parseFloat(p.amount).toFixed(2)})`)
                .join(' + ');
        }

        const commissionRate = applyCommission ? activeCommissionRate : 0;
        const advisorCommission = applyCommission ? estimatedCommission : 0;

        // Recuperar asesor activo garantizando que nunca se pierda por retardo de render
        const activeAdv = selectedAdvisor 
            || selectedAdvisorObj 
            || availableAdvisors.find(a => a.id === selectedAdvisorId)
            || (settings.salesAdvisors || []).find(a => a.id === selectedAdvisorId)
            || localQuickAdvisors.find(a => a.id === selectedAdvisorId);

        prepareCheckout({ 
            name, 
            phone, 
            finalAddress, 
            finalPaymentMethod, 
            totalOverride: finalTotal,
            advisorId: activeAdv ? activeAdv.id : (selectedAdvisorId || null),
            advisorName: activeAdv ? activeAdv.name : null,
            advisorCommission,
            advisorRate: commissionRate
        });

        // Reset local state (incluyendo asesor para que la siguiente venta inicie como Venta Directa en Caja)
        setSelectedAdvisorId('');
        setSelectedAdvisorObj(null);
        setApplyCommission(false);
        setCustomCommissionRate('0');
        setOrderNote('');
        setIsMixedPayment(false);
        setMixedPayments([{ method: initialMethod, amount: '' }]);
        setCustomerInput('');
        setCustomerPhone('+58');
        setCustomerCedula('');
        setSelectedCustomer(null);
        setShowCustomerDetails(false);
        setDiscountValue('');
        setShowDiscountInput(false);
    };

    const handlePark = () => {
        if (cart.length === 0) {
            setShowParkedList(!showParkedList);
            return;
        }
        const name = selectedCustomer ? selectedCustomer.name : (customerInput || 'Sin Nombre');
        parkOrder(name, selectedCustomer, selectedAdvisor?.id || null, selectedAdvisor?.name || null);
        setSelectedAdvisorId('');
        setApplyCommission(false);
        setCustomCommissionRate('0');
        setCustomerInput('');
        setCustomerPhone('+58');
        setCustomerCedula('');
        setSelectedCustomer(null);
        setOrderNote('');
        setDiscountValue('');
        setShowCustomerDetails(false);
    };

    const handleRestoreParked = (index: number) => {
        restoreOrder(index);
        setShowParkedList(false);
        const order = parkedOrders[index];
        if (order.customer) selectCustomer(order.customer);
        if (order.advisorId) {
            setSelectedAdvisorId(order.advisorId);
        } else {
            setSelectedAdvisorId('');
        }
    };

    // --- ATAJOS DE TECLADO RÁPIDOS (HOTKEYS) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F4') {
                e.preventDefault();
                if (cart.length > 0) handleCheckoutClick();
            } else if (e.key === 'F8') {
                e.preventDefault();
                handlePark();
            } else if (e.key === 'F2') {
                e.preventDefault();
                const searchInput = document.querySelector('.pos-search') as HTMLInputElement;
                if (searchInput) searchInput.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, finalTotal, selectedCustomer, customerInput, customerPhone, orderNote, paymentMethod, isMixedPayment, mixedPayments]);

    return (
        <div className="w-full md:w-[400px] xl:w-[450px] bg-white dark:bg-zinc-900 border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 flex flex-col h-full shadow-2xl z-20">
            {/* Header POS */}
            <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {onBackToCatalog && (
                        <button
                            type="button"
                            onClick={onBackToCatalog}
                            className="md:hidden p-1.5 -ml-1 text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors flex items-center shrink-0"
                            title="Volver al Catálogo"
                            aria-label="Volver al Catálogo"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className="bg-ios-blue/10 p-1.5 rounded-lg text-ios-blue shrink-0 hidden xs:flex">
                        <ShoppingCart size={17} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-xs sm:text-sm dark:text-white leading-tight uppercase tracking-wide truncate">
                                Orden Actual
                            </h3>
                            {totalItems > 0 && (
                                <span className="bg-ios-blue text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm shrink-0 leading-tight">
                                    {totalItems} <span className="hidden sm:inline">{totalItems === 1 ? 'item' : 'items'}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5 truncate">
                            {currentBranch?.name || 'Sede'} • <span className="text-gray-600 dark:text-gray-300 font-extrabold">Caja: {currentUser?.name?.split(' ')[0] || 'Mostrador'}</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botón de Asesor de Piso en Header */}
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={() => setShowAdvisorModal(true)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all active:scale-95 ${
                                selectedAdvisor 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 shadow-sm' 
                                    : 'bg-white dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:border-emerald-200'
                            }`}
                            title={selectedAdvisor ? `Asesor de piso: ${selectedAdvisor.name}` : "Asignar asesor de venta de piso (opcional)"}
                        >
                            <UserCheck size={14} className={`shrink-0 ${selectedAdvisor ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-300"}`} />
                            <span className="text-[11px] font-bold max-w-[65px] xs:max-w-[85px] sm:max-w-[110px] truncate">
                                {selectedAdvisor ? selectedAdvisor.name.split(' ')[0] : '+ Asesor'}
                            </span>
                            {selectedAdvisor && applyCommission && activeCommissionRate > 0 && (
                                <span className="text-[9px] font-black bg-emerald-500 text-white px-1 py-0.2 rounded-full shrink-0">
                                    {activeCommissionRate}%
                                </span>
                            )}
                        </button>
                        {selectedAdvisor && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAdvisorId('');
                                    setSelectedAdvisorObj(null);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 rounded-md transition-colors -ml-1"
                                title="Quitar asesor (Venta directa en caja)"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Botón Pausar / Historial */}
                    <button
                        type="button"
                        onClick={handlePark}
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/20 transition-all active:scale-95 shrink-0"
                        title={cart.length > 0 ? "Pausar Orden" : "Ver Pausadas"}
                    >
                        <div className="relative">
                            {cart.length > 0 ? <PauseCircle size={15} className="text-gray-500 dark:text-gray-300" /> : <History size={15} className="text-gray-500 dark:text-gray-300" />}
                            {parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 hidden sm:inline">
                            {parkedOrders.length > 0 ? `(${parkedOrders.length})` : ''}
                        </span>
                    </button>

                    {/* Botón Pantalla Completa (oculto en móviles para evitar saturación y falta de soporte en iOS) */}
                    <button
                        type="button"
                        onClick={toggleFullScreen}
                        className="hidden sm:flex p-1.5 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors shrink-0"
                        title={isFullScreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
                    >
                        {isFullScreen ? <Minimize2 size={15} className="text-gray-600 dark:text-gray-300" /> : <Maximize2 size={15} className="text-gray-600 dark:text-gray-300" />}
                    </button>
                </div>
            </div>

            {showParkedList ? (
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-black/10">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Órdenes Pausadas</h4>
                    {parkedOrders.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-10">No hay órdenes pausadas.</p>
                    ) : (
                        <div className="space-y-2">
                            {parkedOrders.map((order, idx) => (
                                <div key={idx} className="bg-white dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{order.name}</p>
                                        <p className="text-[10px] text-gray-500">{new Date(order.date).toLocaleTimeString()} • {order.cart.length} items</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRestoreParked(idx)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Retomar</button>
                                        <button onClick={() => deleteParkedOrder(idx)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Button variant="secondary" className="w-full mt-4" onClick={() => setShowParkedList(false)}>Volver al Carrito</Button>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 dark:bg-black/10">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-3">
                                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center shadow-inner mb-1">
                                    <ShoppingCart size={32} className="text-gray-300" />
                                </div>
                                <p className="text-sm font-bold">Carrito vacío</p>
                            </div>
                        ) : (
                            cart.map((item: any) => (
                                <div key={item.cartId} className="flex gap-3 items-center bg-white dark:bg-white/5 p-2 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm relative group hover:border-ios-blue/30 transition-all">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-white/5">
                                        <img src={item.image} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                        <p className="text-xs font-bold dark:text-white leading-tight line-clamp-1">{item.productTitle}</p>
                                        {item.variantSku !== item.productTitle && (
                                            <span className="text-[9px] bg-gray-100 dark:bg-white/10 px-1 py-0.5 rounded text-gray-500 font-mono w-fit">
                                                {item.variantSku}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-right">
                                            {item.originalPrice !== undefined && item.originalPrice > item.price && (
                                                <p className="text-[10px] font-bold text-red-400 line-through leading-none mb-0.5">
                                                    {activeCurrencySymbol}{item.originalPrice.toFixed(2)}
                                                </p>
                                            )}
                                            <p className="text-xs font-black text-ios-blue">{activeCurrencySymbol}{item.price.toFixed(2)}</p>
                                            {activeExchangeRate > 0 && (
                                                <p className="text-[9px] font-bold text-gray-400 leading-none">
                                                    {(item.price * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => {
                                                    if(activeItemDiscount === item.cartId) {
                                                        setActiveItemDiscount(null);
                                                    } else {
                                                        setActiveItemDiscount(item.cartId);
                                                        setItemDiscountVal(item.itemDiscountValue ? item.itemDiscountValue.toString() : '');
                                                        setItemDiscountType(item.itemDiscountType || 'percent');
                                                    }
                                                }}
                                                className={`p-1 rounded transition-colors ${activeItemDiscount === item.cartId || (item.originalPrice !== undefined && item.originalPrice > item.price) ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 dark:bg-white/10 text-gray-400 hover:text-orange-500'}`}
                                            >
                                                <Tag size={12} />
                                            </button>
                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-black/20 rounded-lg p-0.5 shadow-inner">
                                                <button onClick={() => updateQuantity(item.cartId, -1)} className="p-0.5 hover:bg-white dark:hover:bg-white/10 rounded transition w-5 h-5 flex items-center justify-center"><Minus size={12} /></button>
                                                <span className="text-xs font-bold w-5 text-center dark:text-white">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.cartId, 1)} className="p-0.5 hover:bg-white dark:hover:bg-white/10 rounded transition w-5 h-5 flex items-center justify-center"><Plus size={12} /></button>
                                            </div>
                                        </div>
                                        
                                        {activeItemDiscount === item.cartId && (
                                            <div className="mt-1 flex items-center gap-1 bg-gray-50 dark:bg-black/40 p-1 rounded-lg border border-gray-200 dark:border-white/10 w-full animate-in fade-in zoom-in">
                                                <button onClick={() => setItemDiscountType(itemDiscountType === 'percent' ? 'fixed' : 'percent')} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded text-gray-500 font-bold text-[10px]">
                                                    {itemDiscountType === 'percent' ? '%' : '$'}
                                                </button>
                                                <input 
                                                    type="number" 
                                                    autoFocus
                                                    className="w-12 bg-transparent text-[10px] font-bold outline-none text-right dark:text-white"
                                                    placeholder="0"
                                                    value={itemDiscountVal}
                                                    onChange={(e) => setItemDiscountVal(e.target.value)}
                                                />
                                                <button 
                                                    onClick={() => {
                                                        updateItemDiscount(item.cartId, itemDiscountType, parseFloat(itemDiscountVal) || 0);
                                                        setActiveItemDiscount(null);
                                                    }}
                                                    className="p-1 bg-ios-blue text-white rounded hover:bg-blue-600 ml-1"
                                                >
                                                    <CheckCircle2 size={10}/>
                                                </button>
                                                <button 
                                                    onClick={() => setActiveItemDiscount(null)}
                                                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                                                >
                                                    <X size={10}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removeFromCart(item.cartId)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 sm:p-5 pb-5 sm:pb-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] space-y-3 rounded-t-2xl z-10">
                        {/* --- DATOS DEL CLIENTE (COMPACTO Y COLAPSABLE) --- */}
                        <div className="space-y-1.5">
                            <div className="relative flex items-center">
                                <input
                                    value={customerInput}
                                    onChange={e => { setCustomerInput(e.target.value); setSelectedCustomer(null); }}
                                    placeholder="Nombre del Cliente..."
                                    className="w-full bg-gray-50 dark:bg-black/20 border border-transparent dark:border-white/5 rounded-lg pl-8 pr-14 py-1.5 text-xs dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/30 font-medium placeholder-gray-400"
                                />
                                <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                
                                {/* Flechita para expandir/colapsar detalles adicionales */}
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {(customerPhone !== '+58' || customerCedula || orderNote) && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-ios-blue animate-pulse" title="Tiene datos adicionales" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                                        className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 transition-all text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ${
                                            showCustomerDetails ? 'rotate-180 text-ios-blue dark:text-ios-blue' : ''
                                        }`}
                                        title={showCustomerDetails ? "Ocultar detalles (teléfono, cédula, nota)" : "Ver teléfono, cédula y nota"}
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>

                                {showSuggestions && (
                                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden z-50">
                                        {customerSuggestions.map(c => (
                                            <button key={c.phone} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs border-b border-gray-50 dark:border-white/5 last:border-0">
                                                <p className="font-bold dark:text-white">{c.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-gray-400">{c.phone}</p>
                                                    {c.cedula && <p className="text-[10px] text-gray-400 font-mono">CI: {c.cedula}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Campos desplegables adicionales (Teléfono, Cédula y Nota) */}
                            {showCustomerDetails && (
                                <div className="grid grid-cols-3 gap-1.5 pt-0.5 animate-fade-in">
                                    <div className="relative">
                                        <input
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="Teléfono"
                                            className="w-full bg-gray-50 dark:bg-black/20 border border-transparent dark:border-white/5 rounded-lg pl-6 pr-2 py-1.5 text-[11px] dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/30 font-medium placeholder-gray-400"
                                        />
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">#</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            value={customerCedula}
                                            onChange={e => setCustomerCedula(e.target.value)}
                                            placeholder="Cédula / RIF"
                                            className="w-full bg-gray-50 dark:bg-black/20 border border-transparent dark:border-white/5 rounded-lg pl-6 pr-2 py-1.5 text-[11px] dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/30 font-medium placeholder-gray-400 font-mono"
                                        />
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[9px] font-bold">CI</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            value={orderNote}
                                            onChange={e => setOrderNote(e.target.value)}
                                            placeholder="Nota..."
                                            className="w-full bg-gray-50 dark:bg-black/20 border border-transparent dark:border-white/5 rounded-lg pl-6 pr-2 py-1.5 text-[11px] dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/30 font-medium placeholder-gray-400"
                                        />
                                        <FileText size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ... (Payment Logic same as before) ... */}
                        <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-white/5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Método de Pago</label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-bold ${isMixedPayment ? 'text-ios-blue' : 'text-gray-400'}`}>Mixto</span>
                                    <div
                                        onClick={() => setIsMixedPayment(!isMixedPayment)}
                                        className={`w-6 h-3.5 rounded-full p-0.5 cursor-pointer transition-colors ${isMixedPayment ? 'bg-ios-blue' : 'bg-gray-300'}`}
                                    >
                                        <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transform transition-transform ${isMixedPayment ? 'translate-x-2.5' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>

                            {isMixedPayment ? (
                                <div className="space-y-1 bg-gray-50 dark:bg-white/5 p-1.5 rounded-xl border border-gray-100 dark:border-white/5">
                                    {mixedPayments.map((row, idx) => (
                                        <div key={idx} className="flex gap-1">
                                            <select
                                                value={row.method}
                                                onChange={(e) => updatePaymentRow(idx, 'method', e.target.value)}
                                                className="flex-1 bg-white dark:bg-black/20 rounded-lg px-2 py-1 text-[10px] font-bold outline-none border border-gray-200 dark:border-white/10"
                                            >
                                                {activePaymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="$0.00"
                                                value={row.amount}
                                                onChange={(e) => updatePaymentRow(idx, 'amount', e.target.value)}
                                                className="w-16 bg-white dark:bg-black/20 rounded-lg px-2 py-1 text-[10px] font-bold outline-none border border-gray-200 dark:border-white/10 text-right"
                                            />
                                            {mixedPayments.length > 1 && (
                                                <button onClick={() => removePaymentRow(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg"><X size={12} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-1">
                                        <button onClick={addPaymentRow} className="text-[9px] font-bold text-ios-blue flex items-center gap-1 hover:underline">
                                            <Plus size={10} /> Agregar
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[9px] text-gray-400">Restante</p>
                                            <p className={`text-[10px] font-black ${remaining > 0.01 ? 'text-red-500' : remaining < -0.01 ? 'text-orange-500' : 'text-green-500'}`}>
                                                ${remaining.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-1">
                                    {activePaymentMethods.map(m => {
                                        const isSelected = paymentMethod === m;
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => setPaymentMethod(m)}
                                                className={`
                                                    py-1 px-1 rounded-lg text-[9px] font-bold border transition-all truncate leading-tight
                                                    ${isSelected
                                                        ? 'bg-ios-blue text-white border-ios-blue shadow-sm'
                                                        : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300 hover:bg-gray-50'
                                                    }
                                                `}
                                                title={m}
                                            >
                                                {m.replace('Divisa', '').replace('Móvil', 'M').replace('Efectivo', 'Efec')}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* --- TOTAL Y BOTONES --- */}
                        <div className="pt-2.5 border-t border-gray-100 dark:border-white/5 space-y-2.5">
                            <div>
                                {!showDiscountInput ? (
                                    <button
                                        onClick={() => setShowDiscountInput(true)}
                                        className="text-[10px] font-bold text-ios-blue hover:underline flex items-center gap-1 w-full justify-end transition-colors"
                                    >
                                        <Tag size={12} /> Agregar Descuento
                                    </button>
                                ) : (
                                    <div className="flex gap-2 items-center bg-gray-50 dark:bg-white/5 p-1.5 rounded-xl border border-gray-200 dark:border-white/10">
                                        <button
                                            onClick={() => setDiscountType(discountType === 'fixed' ? 'percent' : 'fixed')}
                                            className="p-1.5 bg-white dark:bg-black/20 rounded-lg shadow-xs text-gray-600 dark:text-gray-300 text-xs font-bold min-w-[30px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                        >
                                            {discountType === 'fixed' ? <DollarSign size={12} /> : <Percent size={12} />}
                                        </button>
                                        <input
                                            type="number"
                                            className="flex-1 bg-transparent text-xs font-bold outline-none dark:text-white text-right"
                                            placeholder="0.00"
                                            value={discountValue}
                                            onChange={e => setDiscountValue(e.target.value)}
                                            autoFocus
                                        />
                                        <button onClick={() => { setShowDiscountInput(false); setDiscountValue(''); }} className="p-1 text-red-400 hover:text-red-500 rounded-lg">
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-end pb-0.5">
                                <div className="flex flex-col">
                                    <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Total</span>
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                                        Ref ({settings.currencyRateMode === 'paralelo' ? 'P' : settings.currencyRateMode === 'euro_bcv' ? 'EUR' : 'BCV'}): {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                    </span>
                                </div>
                                <div className="text-right">
                                    {discountAmount > 0 && (
                                        <p className="text-xs text-red-500 font-bold line-through opacity-60">
                                            ${cartTotal.toFixed(2)}
                                        </p>
                                    )}
                                    <span className="text-3xl font-black text-ios-text dark:text-white tracking-tight leading-none">{activeCurrencySymbol}{finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Botones de acción principales con márgenes ergonómicos */}
                            <div className="flex items-center gap-2.5 pt-1">
                                <Button 
                                    variant="secondary" 
                                    onClick={() => { clearCart(); setSelectedAdvisorId(''); setApplyCommission(false); setCustomCommissionRate('0'); }} 
                                    disabled={cart.length === 0} 
                                    title="Vaciar Carrito"
                                    aria-label="Vaciar Carrito"
                                    className="w-12 h-12 p-0 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 shrink-0 flex items-center justify-center transition-all shadow-xs"
                                >
                                    <Trash2 size={19} />
                                </Button>
                                <Button
                                    onClick={handleCheckoutClick}
                                    disabled={cart.length === 0 || (isMixedPayment && Math.abs(remaining) > 0.01)}
                                    className="flex-1 h-12 shadow-lg shadow-emerald-500/25 text-base font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <CheckCircle2 size={20} strokeWidth={2.5} /> 
                                    <span>Cobrar</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal de Asignación de Vendedor y Registro Rápido */}
            {/* Modal de Asignación Exclusiva de Asesor de Venta y Registro Rápido */}
            {showAdvisorModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <UserCheck size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-ios-text dark:text-white">Asignar Asesor de Venta</h3>
                                    <p className="text-[10px] text-gray-400">Personal de piso • Facturado por tu caja: <span className="font-bold text-gray-600 dark:text-gray-200">{currentUser?.name || 'Caja'}</span></p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => { setShowAdvisorModal(false); setShowRegisterNewAdvisor(false); }} 
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Selector de Asesor Exclusivo */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">
                                    Asesor de Piso (Opcional)
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedAdvisorId}
                                        onChange={e => {
                                            const aid = e.target.value;
                                            setSelectedAdvisorId(aid);
                                            const found = availableAdvisors.find((a: SalesAdvisor) => a.id === aid) || localQuickAdvisors.find(a => a.id === aid) || null;
                                            setSelectedAdvisorObj(found);
                                        }}
                                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold dark:text-white outline-none focus:border-ios-blue"
                                    >
                                        <option value="">-- Venta Directa en Caja (Sin Asesor) --</option>
                                        {availableAdvisors.map((a: SalesAdvisor) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name} {(a.commissionRate && a.commissionRate > 0) ? `(${a.commissionRate}% com.)` : '(Sin com.)'}
                                            </option>
                                        ))}
                                    </select>
                                    <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Control de Comisión si hay asesor seleccionado */}
                            {selectedAdvisor && (
                                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Comisión del Asesor</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Porcentaje reconocido a {selectedAdvisor.name}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setApplyCommission(!applyCommission)}
                                            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                                applyCommission 
                                                    ? 'bg-emerald-500 text-white shadow-sm' 
                                                    : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            {applyCommission ? '✓ Activa' : '+ Activar'}
                                        </button>
                                    </div>

                                    {applyCommission && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={customCommissionRate}
                                                    onChange={e => setCustomCommissionRate(e.target.value)}
                                                    placeholder="%"
                                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white outline-none focus:border-ios-blue"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                                            </div>
                                            {finalTotal > 0 && activeCommissionRate > 0 && (
                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-400 block leading-none">Monto estim.:</span>
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        ${estimatedCommission.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sección para Registrar Nuevo Asesor */}
                            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                                {!showRegisterNewAdvisor ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterNewAdvisor(true)}
                                        className="w-full py-2.5 px-3 border border-dashed border-ios-blue/40 text-ios-blue hover:bg-blue-50/50 dark:hover:bg-blue-950/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <UserPlus size={15} />
                                        <span>+ Registrar Nuevo Asesor al Instante</span>
                                    </button>
                                ) : (
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-3.5 space-y-2.5 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-bold text-ios-blue flex items-center gap-1.5">
                                                <UserPlus size={14} /> Registrar Nuevo Asesor
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowRegisterNewAdvisor(false)}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                                            >
                                                Cancelar
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre completo del asesor..."
                                                value={quickAdvisorName}
                                                onChange={e => setQuickAdvisorName(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white outline-none focus:border-ios-blue"
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.5"
                                                        placeholder="% Comisión (opcional)"
                                                        value={quickAdvisorRate}
                                                        onChange={e => setQuickAdvisorRate(e.target.value)}
                                                        className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white outline-none focus:border-ios-blue"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={() => handleSaveQuickAdvisor()}
                                                    loading={isSavingQuickAdvisor}
                                                    className="py-1.5 px-3 text-xs bg-ios-blue text-white rounded-xl font-bold shrink-0"
                                                >
                                                    Guardar y Asignar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="button"
                                onClick={() => { setShowAdvisorModal(false); setShowRegisterNewAdvisor(false); }}
                                className="w-full py-2.5 text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl shadow-sm"
                            >
                                Listo
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
