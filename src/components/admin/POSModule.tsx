
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, CartItem, Customer, VariantOption, PaymentMethod } from '../../types';
import { Button, LazyImage, Input } from '../UIComponents';
import { Search, ShoppingCart, Plus, Minus, Trash2, X, Store, Loader2, Package, User, CreditCard, Check, ChevronDown, Filter, Wallet, FileText, Calculator, PauseCircle, PlayCircle, Save, CheckCircle2, DollarSign, Maximize2, Minimize2 } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../config';
import { useDebounce } from '../../hooks/useDebounce';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

// --- MODAL SELECCIÓN DE VARIANTE ---
const VariantSelectorModal = ({ product, isOpen, onClose, onConfirm }: { product: Product | null, isOpen: boolean, onClose: () => void, onConfirm: (p: Product, options: Record<string, string>, price: number, sku: string, image: string) => void }) => {
    const [selections, setSelections] = useState<Record<string, string>>({});
    
    useEffect(() => {
        setSelections({});
    }, [product]);

    if (!isOpen || !product) return null;

    const isOptionAvailable = (optionName: string, value: string) => {
        if (!product.variants) return false;
        if (product.stock <= 0) return false;

        return product.variants.some(v => {
            if (v.selections[optionName] !== value) return false;
            const matchesCurrentSelections = Object.entries(selections).every(([k, val]) => {
                if (k === optionName) return true;
                return v.selections[k] === val;
            });
            return matchesCurrentSelections && v.stock > 0;
        });
    };

    const getVariant = () => {
        if (!product.variants) return null;
        return product.variants.find(v => 
            Object.entries(selections).every(([k, val]) => v.selections[k] === val)
        );
    };

    const selectedVariant = getVariant();
    const currentPrice = selectedVariant ? selectedVariant.price : product.price;
    const branchStock = product.stock;
    const isBranchOutOfStock = branchStock <= 0;
    const currentImage = selectedVariant?.image || product.images[0] || DEFAULT_IMAGE;
    
    const isComplete = product.variantOptions?.every(opt => selections[opt.name]);
    const canAdd = isComplete && selectedVariant && selectedVariant.stock > 0 && !isBranchOutOfStock;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl relative p-6 animate-slide-up border border-white/10">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition dark:text-white"><X size={20}/></button>
                
                <div className="flex gap-4 mb-6">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 dark:border-white/10">
                        <img src={currentImage} className="w-full h-full object-cover"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg dark:text-white line-clamp-2">{product.title}</h3>
                        <p className="text-ios-blue font-black text-xl">${currentPrice.toFixed(2)}</p>
                        
                        {isBranchOutOfStock ? (
                            <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block mt-1">
                                Agotado en esta Sede
                            </p>
                        ) : isComplete ? (
                            <p className={`text-xs font-bold ${selectedVariant?.stock && selectedVariant.stock > 0 ? 'text-green-500' : 'text-orange-500'}`}>
                                {selectedVariant?.stock && selectedVariant.stock > 0 ? 'Disponible' : 'Sin stock global'}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400 font-medium">Seleccione opciones</p>
                        )}
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    {product.variantOptions?.map(opt => (
                        <div key={opt.name}>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">{opt.name}</label>
                                {selections[opt.name] && <span className="text-xs font-bold text-ios-blue">{selections[opt.name]}</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {opt.values.map(val => {
                                    const isAvailable = isOptionAvailable(opt.name, val);
                                    const isSelected = selections[opt.name] === val;

                                    return (
                                        <button
                                            key={val}
                                            onClick={() => setSelections(prev => ({ ...prev, [opt.name]: val }))}
                                            disabled={!isAvailable && !isSelected} 
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all relative ${
                                                isSelected
                                                ? 'bg-ios-blue text-white border-ios-blue shadow-md' 
                                                : isAvailable 
                                                    ? 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-300 border-gray-100 dark:border-white/5 cursor-not-allowed decoration-slice opacity-60'
                                            }`}
                                        >
                                            {val}
                                            {!isAvailable && !isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-full h-px bg-gray-400 rotate-45 transform"></div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <Button 
                    onClick={() => {
                        if (canAdd) {
                            onConfirm(product, selections, currentPrice, selectedVariant?.sku || product.code, currentImage);
                            onClose();
                        }
                    }}
                    disabled={!canAdd}
                    className={`w-full h-12 text-sm font-bold shadow-lg ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {canAdd 
                        ? 'Agregar a la Orden' 
                        : (isBranchOutOfStock ? 'Agotado en Sede' : 'Selecciona Opciones Válidas')
                    }
                </Button>
            </div>
        </div>
    );
};

// --- MODAL DE CONFIRMACIÓN DE COBRO ---
const CheckoutModal = ({ isOpen, onClose, onConfirm, total, cart, customerName }: any) => {
    const { activeExchangeRate } = useStore();
    const [receivedAmount, setReceivedAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const received = parseFloat(receivedAmount) || 0;
    const change = received - total;
    const totalBs = total * activeExchangeRate;

    const handleConfirm = async () => {
        setIsProcessing(true);
        await onConfirm();
        setIsProcessing(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}/>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative p-8 animate-slide-up border border-white/10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-green-500" size={28}/> Confirmar Venta
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Resumen final antes de procesar.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:bg-gray-200 transition"><X size={20} className="dark:text-white"/></button>
                </div>

                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Cliente:</span>
                        <span className="font-bold dark:text-white">{customerName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Items:</span>
                        <span className="font-bold dark:text-white">{cart.length} productos</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-white/10 my-2"></div>
                    <div className="flex justify-between items-end">
                        <span className="text-lg font-bold text-gray-600 dark:text-gray-300">Total a Cobrar:</span>
                        <div className="text-right">
                            <p className="text-3xl font-black text-ios-blue">${total.toFixed(2)}</p>
                            <p className="text-sm text-gray-500 font-medium">Bs {totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Dinero Recibido ($ USD o Equivalente)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                        <input 
                            type="number" 
                            autoFocus
                            className="w-full bg-gray-100 dark:bg-black/20 rounded-2xl pl-10 pr-4 py-3 text-lg font-bold outline-none border-2 border-transparent focus:border-ios-blue transition-all dark:text-white"
                            placeholder="Monto recibido..."
                            value={receivedAmount}
                            onChange={(e) => setReceivedAmount(e.target.value)}
                        />
                    </div>
                </div>

                {received > 0 && (
                    <div className={`p-4 rounded-2xl flex justify-between items-center ${change >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                        <span className="font-bold text-sm uppercase">{change >= 0 ? 'Su Cambio:' : 'Falta:'}</span>
                        <span className="text-2xl font-black">${Math.abs(change).toFixed(2)}</span>
                    </div>
                )}

                <Button 
                    onClick={handleConfirm} 
                    loading={isProcessing}
                    disabled={received > 0 && change < -0.01}
                    className="w-full py-4 text-lg font-black bg-green-500 hover:bg-green-600 shadow-xl shadow-green-500/30 rounded-2xl"
                >
                    <Check size={24} className="mr-2" strokeWidth={3}/> Procesar Venta
                </Button>
            </div>
        </div>
    );
};

// --- GRID PRODUCTOS ---
const ProductGrid = ({ onAdd, isFullScreen }: { onAdd: (p: Product) => void, isFullScreen: boolean }) => {
    const { categories } = useStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const debouncedSearch = useDebounce(search, 300);
    
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef(null);

    const loadProducts = async (reset = false) => {
        if (loading && !reset) return;
        setLoading(true);
        if (reset) {
            setProducts([]);
            setPage(1);
        }

        try {
            const p = reset ? 1 : page;
            const catFilter = selectedCategory === 'Todas' ? '' : selectedCategory;
            const res = await api.getProducts(p, 24, debouncedSearch, catFilter);
            
            if (res && res.data) {
                setProducts(prev => reset ? res.data : [...prev, ...res.data]);
                setHasMore(res.data.length === 24);
                if (!reset) setPage(prev => prev + 1);
            } else {
                if (reset) setProducts([]);
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        setHasMore(true);
        loadProducts(true);
    }, [debouncedSearch, selectedCategory]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting && hasMore && !loading) loadProducts(false); },
            { threshold: 1.0 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    return (
        <div className={`flex-1 flex flex-col h-full bg-gray-50 dark:bg-black/20 ${isFullScreen ? '' : 'rounded-l-[2rem]'} overflow-hidden relative`}>
            <div className="p-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-white/5 flex flex-col gap-2 shadow-sm z-10">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-white/5 rounded-xl outline-none text-xs dark:text-white focus:ring-2 focus:ring-ios-blue/20 transition-all" 
                            placeholder="Buscar productos..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>
                    <div className="relative min-w-[120px]">
                        <select 
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full h-full pl-3 pr-8 bg-gray-100 dark:bg-white/5 rounded-xl text-xs font-bold appearance-none outline-none dark:text-white cursor-pointer border-transparent focus:border-ios-blue"
                        >
                            <option value="Todas">Todas</option>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14}/>
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 grid gap-3 content-start ${isFullScreen ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {products.length === 0 && !loading ? (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <Filter size={32} className="mb-2"/>
                        <p className="text-xs">No hay productos en esta categoría.</p>
                    </div>
                ) : (
                    products.map(p => {
                        const hasVariants = p.variantOptions && p.variantOptions.length > 0;
                        const realStock = p.stock;
                        const hasStock = realStock > 0;
                        const otherStock = Math.max(0, (p.globalStock || 0) - realStock);

                        return (
                            <div 
                                key={p.id} 
                                onClick={() => {
                                    if (hasStock) onAdd(p);
                                    else if (otherStock > 0) alert(`Agotado aquí. Disponible en otras sedes: ~${otherStock} unidades.`);
                                }}
                                className={`bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col gap-2 cursor-pointer transition-all active:scale-95 ${hasStock ? 'hover:border-ios-blue hover:shadow-md' : 'opacity-70 grayscale'}`}
                            >
                                <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden relative">
                                    <LazyImage src={p.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover"/>
                                    {hasVariants && (
                                        <div className="absolute top-1 right-1 bg-black/60 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <Filter size={8}/>
                                        </div>
                                    )}
                                    {!hasStock && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-1">
                                            <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded mb-1">AGOTADO</span>
                                            {otherStock > 0 && <span className="text-[9px] text-orange-300 font-bold flex items-center gap-1"><Store size={10}/> Global: {otherStock}</span>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold dark:text-white line-clamp-1 leading-tight">{p.title}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-sm font-black text-ios-blue">${p.price}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${hasStock ? 'text-gray-500 bg-gray-100 dark:bg-white/10' : 'text-red-500 bg-red-50'}`}>
                                            {realStock}u
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                
                <div ref={observerTarget} className="col-span-full h-10 flex items-center justify-center">
                    {loading && <Loader2 className="animate-spin text-ios-blue"/>}
                </div>
            </div>
        </div>
    );
};

// --- CARRITO ---
const POSCart = ({ cart, onUpdate, onRemove, onClear, onPrepareCheckout, onParkOrder, parkedCount, isFullScreen, onToggleFullScreen }: any) => {
    const { customers, activeExchangeRate, currentUser, settings } = useStore();
    const total = cart.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const totalBs = total * activeExchangeRate;
    
    const [customerInput, setCustomerInput] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [orderNote, setOrderNote] = useState('');

    const [isMixedPayment, setIsMixedPayment] = useState(false);
    
    // USAR MÉTODOS DE PAGO DINÁMICOS
    const activePaymentMethods = (settings.paymentMethods || [])
        .filter((m: PaymentMethod) => m.isActive)
        .map((m: PaymentMethod) => m.name);
    
    // Default si no hay métodos o fallback
    const initialMethod = activePaymentMethods.length > 0 ? activePaymentMethods[0] : 'Efectivo Divisa';

    const [paymentMethod, setPaymentMethod] = useState(initialMethod);
    const [mixedPayments, setMixedPayments] = useState<{method: string, amount: string}[]>([{ method: initialMethod, amount: '' }]);

    useEffect(() => {
        if (!customerInput || selectedCustomer) {
            setCustomerSuggestions([]);
            return;
        }
        const term = customerInput.toLowerCase();
        const matches = customers.filter(c => 
            c.name.toLowerCase().includes(term) || c.phone.includes(term)
        ).slice(0, 5);
        setCustomerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [customerInput, customers]);

    const selectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setCustomerInput(c.name);
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

    const mixedTotal = mixedPayments.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
    const remaining = total - mixedTotal;

    const handleCheckoutClick = () => {
        const name = selectedCustomer ? selectedCustomer.name : (customerInput || 'Cliente Mostrador');
        const phone = selectedCustomer ? selectedCustomer.phone : '';
        
        let finalAddress = selectedCustomer ? selectedCustomer.address : '';
        if (orderNote.trim()) {
            finalAddress = finalAddress ? `${finalAddress} | Nota: ${orderNote}` : `Nota: ${orderNote}`;
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

        // Llamar al padre con los datos preparados para mostrar el modal
        onPrepareCheckout({ name, phone, finalAddress, finalPaymentMethod });
        
        // Limpiar inputs locales tras éxito (el padre limpiará el carrito)
        setOrderNote('');
        setIsMixedPayment(false);
        setMixedPayments([{ method: initialMethod, amount: '' }]);
        setCustomerInput('');
        setSelectedCustomer(null);
    };

    const handlePark = () => {
        const name = selectedCustomer ? selectedCustomer.name : (customerInput || 'Sin Nombre');
        onParkOrder(name, selectedCustomer);
        // Limpiar inputs locales
        setCustomerInput('');
        setSelectedCustomer(null);
        setOrderNote('');
    };

    return (
        <div className="w-[400px] xl:w-[450px] bg-white dark:bg-zinc-900 border-l border-gray-100 dark:border-white/5 flex flex-col h-full shadow-2xl z-20">
            {/* Header POS */}
            <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-ios-blue/10 p-1.5 rounded-lg text-ios-blue"><ShoppingCart size={18}/></div>
                    <div>
                        <h3 className="font-black text-sm dark:text-white leading-tight uppercase tracking-wide">Orden Actual</h3>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                            {currentUser?.name || 'Cajero'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePark}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/20 transition-all active:scale-95"
                        title="Guardar Orden Actual / Ver Guardadas"
                    >
                        <div className="relative">
                            <PauseCircle size={16} className="text-gray-500 dark:text-gray-300"/>
                            {parkedCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 hidden sm:inline">
                            {parkedCount > 0 ? `(${parkedCount})` : 'Pausar'}
                        </span>
                    </button>
                    
                    {/* BOTÓN PANTALLA COMPLETA */}
                    <button 
                        onClick={onToggleFullScreen}
                        className="p-1.5 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                        title={isFullScreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
                    >
                        {isFullScreen ? <Minimize2 size={16} className="text-gray-600 dark:text-gray-300"/> : <Maximize2 size={16} className="text-gray-600 dark:text-gray-300"/>}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 dark:bg-black/10">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-3">
                        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center shadow-inner mb-1">
                            <Package size={32} className="text-gray-300"/>
                        </div>
                        <p className="text-sm font-bold">Carrito vacío</p>
                    </div>
                ) : (
                    cart.map((item: any) => (
                        <div key={item.cartId} className="flex gap-3 items-center bg-white dark:bg-white/5 p-2 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm relative group hover:border-ios-blue/30 transition-all">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-white/5">
                                <img src={item.image} className="w-full h-full object-cover"/>
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
                                <p className="text-xs font-black text-ios-blue">${item.price.toFixed(2)}</p>
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-black/20 rounded-lg p-0.5 shadow-inner">
                                    <button onClick={() => onUpdate(item.cartId, -1)} className="p-0.5 hover:bg-white dark:hover:bg-white/10 rounded transition w-5 h-5 flex items-center justify-center"><Minus size={12}/></button>
                                    <span className="text-xs font-bold w-5 text-center dark:text-white">{item.quantity}</span>
                                    <button onClick={() => onUpdate(item.cartId, 1)} className="p-0.5 hover:bg-white dark:hover:bg-white/10 rounded transition w-5 h-5 flex items-center justify-center"><Plus size={12}/></button>
                                </div>
                            </div>
                            <button onClick={() => onRemove(item.cartId)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                                <Trash2 size={12}/>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] space-y-2 rounded-t-2xl z-10">
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <input 
                            value={customerInput} 
                            onChange={e => { setCustomerInput(e.target.value); setSelectedCustomer(null); }} 
                            placeholder="Cliente..." 
                            className="w-full bg-gray-50 dark:bg-black/20 border-transparent rounded-lg pl-8 pr-3 py-1.5 text-xs dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/20 font-medium placeholder-gray-400"
                        />
                        <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                        {showSuggestions && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden z-50">
                                {customerSuggestions.map(c => (
                                    <button key={c.phone} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs border-b border-gray-50 dark:border-white/5 last:border-0">
                                        <p className="font-bold dark:text-white">{c.name}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <input 
                            value={orderNote} 
                            onChange={e => setOrderNote(e.target.value)} 
                            placeholder="Nota..." 
                            className="w-full bg-gray-50 dark:bg-black/20 border-transparent rounded-lg pl-8 pr-3 py-1.5 text-xs dark:text-white outline-none focus:ring-1 focus:ring-ios-blue/20 font-medium placeholder-gray-400"
                        />
                        <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    </div>
                </div>

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
                                        <button onClick={() => removePaymentRow(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg"><X size={12}/></button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-1">
                                <button onClick={addPaymentRow} className="text-[9px] font-bold text-ios-blue flex items-center gap-1 hover:underline">
                                    <Plus size={10}/> Agregar
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
                                        {m.replace('Divisa','').replace('Móvil','M').replace('Efectivo','Efec')}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-end mb-1">
                        <div className="flex flex-col">
                            <span className="text-gray-400 font-bold text-[10px] uppercase">Total</span>
                            <span className="text-xs font-bold text-gray-500">Ref: {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                        </div>
                        <span className="text-3xl font-black text-ios-text dark:text-white tracking-tight leading-none">${total.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <Button variant="secondary" onClick={onClear} disabled={cart.length === 0} className="col-span-1 bg-red-50 text-red-500 hover:bg-red-100 border-transparent dark:bg-red-900/10 dark:text-red-400 h-10 rounded-xl">
                            <Trash2 size={20}/>
                        </Button>
                        <Button 
                            onClick={handleCheckoutClick} 
                            disabled={cart.length === 0 || (isMixedPayment && Math.abs(remaining) > 0.01)} 
                            className="col-span-2 h-10 shadow-lg shadow-green-500/30 text-base font-black uppercase tracking-wider bg-green-500 hover:bg-green-600 rounded-xl flex items-center justify-center gap-2"
                        >
                            <Check size={20} strokeWidth={3} /> Cobrar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const POSModule = () => {
    const { createOrder } = useStore();
    const { addNotification } = useNotification();
    
    const [cart, setCart] = useState<CartItem[]>([]);
    const [parkedOrders, setParkedOrders] = useState<{name: string, cart: CartItem[], date: number, customer?: Customer | null}[]>(() => {
        try {
            const saved = localStorage.getItem('lyberate_pos_parked');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [variantModalOpen, setVariantModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [checkoutDetails, setCheckoutDetails] = useState<any>({});

    useEffect(() => {
        localStorage.setItem('lyberate_pos_parked', JSON.stringify(parkedOrders));
    }, [parkedOrders]);

    const handleAddToCart = (product: Product) => {
        if (product.variantOptions && product.variantOptions.length > 0) {
            setSelectedProduct(product);
            setVariantModalOpen(true);
        } else {
            addItem(product, {}, product.price, product.code, product.images[0] || DEFAULT_IMAGE);
        }
    };

    const addItem = (product: Product, options: Record<string, string>, price: number, sku: string, image: string) => {
        const cartId = `${product.id}-${JSON.stringify(options)}`;
        setCart(prev => {
            const existing = prev.find(i => i.cartId === cartId);
            if (existing) {
                return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                cartId,
                productId: product.id,
                productTitle: product.title,
                price,
                quantity: 1,
                image,
                selectedOptions: options,
                variantSku: sku
            }];
        });
    };

    const handleUpdateQuantity = (cartId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) return { ...item, quantity: Math.max(1, item.quantity + delta) };
            return item;
        }));
    };

    const handleRemoveItem = (cartId: string) => {
        setCart(prev => prev.filter(i => i.cartId !== cartId));
    };

    const handleParkOrder = (name: string, customer: Customer | null) => {
        if (cart.length === 0 && parkedOrders.length > 0) {
            const last = parkedOrders[parkedOrders.length - 1];
            setCart(last.cart);
            setParkedOrders(prev => prev.slice(0, -1));
            return;
        }
        
        if (cart.length === 0) return;

        setParkedOrders(prev => [...prev, { name: name || `Orden ${prev.length + 1}`, cart, date: Date.now(), customer }]);
        setCart([]);
    };

    const handlePrepareCheckout = (details: any) => {
        setCheckoutDetails(details);
        setCheckoutModalOpen(true);
    };

    const handleConfirmCheckout = async () => {
        const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        await createOrder(
            checkoutDetails.name,
            checkoutDetails.phone,
            checkoutDetails.finalAddress,
            cart,
            total,
            checkoutDetails.finalPaymentMethod,
            'completed'
        );
        addNotification({ title: 'Venta Exitosa', body: 'Orden procesada correctamente.', type: 'success' });
        setCart([]);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => console.log(e));
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen(); 
                setIsFullScreen(false);
            }
        }
    };

    return (
        <div className={`flex flex-col md:flex-row h-full ${isFullScreen ? 'fixed inset-0 z-[50] bg-white dark:bg-black' : 'rounded-[2rem] overflow-hidden border border-gray-100 dark:border-white/5 shadow-xl'}`}>
            <ProductGrid onAdd={handleAddToCart} isFullScreen={isFullScreen} />
            
            <POSCart 
                cart={cart}
                onUpdate={handleUpdateQuantity}
                onRemove={handleRemoveItem}
                onClear={() => setCart([])}
                onPrepareCheckout={handlePrepareCheckout}
                onParkOrder={handleParkOrder}
                parkedCount={parkedOrders.length}
                isFullScreen={isFullScreen}
                onToggleFullScreen={toggleFullScreen}
            />

            <VariantSelectorModal 
                product={selectedProduct}
                isOpen={variantModalOpen}
                onClose={() => setVariantModalOpen(false)}
                onConfirm={addItem}
            />

            <CheckoutModal 
                isOpen={checkoutModalOpen}
                onClose={() => setCheckoutModalOpen(false)}
                onConfirm={handleConfirmCheckout}
                total={cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)}
                cart={cart}
                customerName={checkoutDetails.name}
            />
        </div>
    );
};
