
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Button } from '../../UIComponents';
import { Banknote, TrendingUp, TrendingDown, RefreshCw, Calculator, Loader2, ShieldCheck, ArrowRight, Wallet, Plus, Trash2, CheckCircle2, XCircle, CreditCard, DollarSign, Bitcoin, Landmark } from 'lucide-react';
import { StoreSettings, Product, PaymentMethod } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { useNotification } from '../../../context/NotificationContext';
import { generateId } from '../Shared';

// Modal de Simulación (Integrado localmente)
const PriceSimulationModal = ({ isOpen, onClose, products, percentage, rounding, onApply }: any) => {
    const [progress, setProgress] = useState(0);
    const [isApplying, setIsApplying] = useState(false);

    const previewData = useMemo(() => {
        const factor = 1 + (percentage / 100);
        const calcPrice = (price: number) => {
            let newPrice = price * factor;
            if (newPrice < 0) newPrice = 0;
            if (rounding === 'integer') newPrice = Math.round(newPrice);
            if (rounding === 'x99') newPrice = Math.floor(newPrice) + 0.99;
            if (rounding === 'x50') newPrice = Math.floor(newPrice) + 0.50;
            return parseFloat(newPrice.toFixed(2));
        };
        return products.filter((p: Product) => p.price > 0).slice(0, 5).map((p: Product) => ({
            title: p.title,
            oldPrice: p.price,
            newPrice: calcPrice(p.price),
            variants: p.variants ? p.variants.length : 0
        }));
    }, [products, percentage, rounding]);

    const handleConfirm = async () => {
        setIsApplying(true);
        await onApply(setProgress);
        setIsApplying(false);
        onClose();
    };

    const isNegative = percentage < 0;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => !isApplying && onClose()} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slide-up border border-white/10">
                <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-2"><Calculator className="text-ios-blue"/> Simulación Financiera</h3>
                    <p className="text-xs text-gray-500 mt-1">Ajuste del <span className={`font-bold ${isNegative ? 'text-red-500' : 'text-green-500'}`}>{percentage}%</span> a <span className="font-bold">{products.length} productos</span>.</p>
                </div>
                <div className="p-6 space-y-6">
                    {isApplying ? (
                        <div className="py-10 text-center space-y-4">
                             <Loader2 size={40} className="text-ios-blue animate-spin mx-auto"/>
                             <p className="text-lg font-bold dark:text-white">Procesando {progress}%...</p>
                        </div>
                    ) : (
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Vista Previa</h4>
                            <div className="space-y-2">
                                {previewData.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                        <p className="font-bold text-sm dark:text-white truncate flex-1">{item.title}</p>
                                        <div className="flex items-center gap-3 font-mono text-sm">
                                            <span className="text-gray-400 line-through">${item.oldPrice.toFixed(2)}</span>
                                            <ArrowRight size={14} className="text-gray-300"/>
                                            <span className={`font-bold ${isNegative ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>${item.newPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {!isApplying && (
                    <div className="p-6 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
                        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleConfirm} className="bg-ios-blue text-white shadow-lg shadow-blue-500/30">Confirmar</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface FinanceTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({ settings, onUpdate }) => {
    const { products, updateMultipleProducts, exchangeRate, exchangeRateParalelo, exchangeRateEuro, activeCurrencySymbol } = useStore();
    const { addNotification } = useNotification();
    
    const [inflationGap, setInflationGap] = useState(0);
    const [targetPercentage, setTargetPercentage] = useState(0);
    const [roundingMode, setRoundingMode] = useState<'none' | 'integer' | 'x99' | 'x50'>('none');
    const [isSimulationOpen, setIsSimulationOpen] = useState(false);
    
    // Estado para nuevo método de pago
    const [newMethodName, setNewMethodName] = useState('');
    const [newMethodType, setNewMethodType] = useState<PaymentMethod['type']>('bank');

    useEffect(() => {
        if (exchangeRate > 0 && exchangeRateParalelo > 0) {
            const gap = ((exchangeRateParalelo - exchangeRate) / exchangeRate) * 100;
            setInflationGap(gap);
            if (gap > 1) setTargetPercentage(parseFloat(gap.toFixed(2)));
        }
    }, [exchangeRate, exchangeRateParalelo]);

    const handleBatchUpdate = async (onProgress: (p: number) => void) => {
        const factor = 1 + (targetPercentage / 100);
        
        const calcPrice = (price: number) => {
            let newPrice = price * factor;
            if (newPrice < 0) newPrice = 0;
            if (roundingMode === 'integer') newPrice = Math.round(newPrice);
            if (roundingMode === 'x99') newPrice = Math.floor(newPrice) + 0.99;
            if (roundingMode === 'x50') newPrice = Math.floor(newPrice) + 0.50;
            return parseFloat(newPrice.toFixed(2));
        };

        const updates = products.map(p => {
            const updatedProduct = { ...p };
            updatedProduct.price = calcPrice(p.price);
            if (updatedProduct.salePrice) updatedProduct.salePrice = calcPrice(updatedProduct.salePrice);
            if (updatedProduct.variants && updatedProduct.variants.length > 0) {
                updatedProduct.variants = updatedProduct.variants.map(v => ({
                    ...v,
                    price: calcPrice(v.price)
                }));
            }
            return updatedProduct;
        });

        await updateMultipleProducts(updates, onProgress);
        addNotification({ title: 'Actualización Exitosa', body: `Se han actualizado los precios de ${updates.length} productos.`, type: 'success' });
    };

    // --- GESTIÓN MÉTODOS DE PAGO ---
    const getPaymentMethods = (): PaymentMethod[] => {
        return settings.paymentMethods || [];
    };

    const handleAddPaymentMethod = () => {
        if (!newMethodName.trim()) {
            alert("El nombre es obligatorio");
            return;
        }
        const currentMethods = getPaymentMethods();
        const newMethod: PaymentMethod = {
            id: generateId(),
            name: newMethodName.trim(),
            type: newMethodType,
            isActive: true
        };
        onUpdate({ paymentMethods: [...currentMethods, newMethod] });
        setNewMethodName('');
        addNotification({ title: 'Método Agregado', body: `${newMethod.name} listo para usarse.`, type: 'success' });
    };

    const handleToggleMethod = (id: string) => {
        const updatedMethods = getPaymentMethods().map(m => 
            m.id === id ? { ...m, isActive: !m.isActive } : m
        );
        onUpdate({ paymentMethods: updatedMethods });
    };

    const handleDeleteMethod = (id: string) => {
        if (window.confirm("¿Borrar este método de pago? (No afecta historial)")) {
            const updatedMethods = getPaymentMethods().filter(m => m.id !== id);
            onUpdate({ paymentMethods: updatedMethods });
        }
    };

    const getMethodIcon = (type: string) => {
        switch(type) {
            case 'crypto': return <Bitcoin size={16} className="text-orange-500"/>;
            case 'bank': return <Landmark size={16} className="text-purple-500"/>;
            case 'fiat': return <Banknote size={16} className="text-green-600"/>;
            default: return <CreditCard size={16} className="text-gray-500"/>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* PANEL DE MÉTODOS DE PAGO */}
            <Card className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold flex items-center gap-2 dark:text-white">
                        <Wallet size={20} className="text-green-600"/> Métodos de Pago
                    </h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <input 
                            placeholder="Nuevo método (ej: Paypal)" 
                            className="bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-xl text-sm outline-none dark:text-white w-full sm:w-48"
                            value={newMethodName}
                            onChange={e => setNewMethodName(e.target.value)}
                        />
                        <select 
                            className="bg-gray-100 dark:bg-white/5 px-2 py-2 rounded-xl text-sm outline-none dark:text-white"
                            value={newMethodType}
                            onChange={e => setNewMethodType(e.target.value as any)}
                        >
                            <option value="bank">Bancario</option>
                            <option value="fiat">Efectivo</option>
                            <option value="crypto">Cripto</option>
                            <option value="other">Otro</option>
                        </select>
                        <Button onClick={handleAddPaymentMethod} className="px-3 py-2 h-auto"><Plus size={18}/></Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getPaymentMethods().map(method => (
                        <div key={method.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${method.isActive ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-white/10' : 'bg-gray-50 dark:bg-white/5 border-transparent opacity-60'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${method.isActive ? 'bg-gray-100 dark:bg-white/5' : 'bg-gray-200 dark:bg-white/5'}`}>
                                    {getMethodIcon(method.type)}
                                </div>
                                <span className="text-sm font-bold dark:text-white">{method.name}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleToggleMethod(method.id)} className={`p-1.5 rounded-lg transition-colors ${method.isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-200'}`}>
                                    {method.isActive ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                </button>
                                <button onClick={() => handleDeleteMethod(method.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {getPaymentMethods().length === 0 && (
                        <div className="col-span-full text-center py-4 text-gray-400 text-sm italic">
                            No hay métodos configurados. Agrega el primero arriba.
                        </div>
                    )}
                </div>
            </Card>

            <Card className="p-6 space-y-6 border-l-4 border-l-slate-500 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    {targetPercentage < 0 ? <TrendingDown size={120} className="text-red-500" /> : <TrendingUp size={120} className="text-green-500" />}
                </div>
                
                <div className="relative z-10">
                    <h3 className="font-bold flex items-center gap-2 dark:text-white text-xl">
                        <Banknote size={24} className="text-slate-500"/> Gestión de Valor de Reposición (Dinámico)
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                        Actualiza el valor base de tu inventario en divisa según los indicadores del mercado para mantener tu margen operativo saludable.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 bg-white/50 dark:bg-black/20 p-6 rounded-3xl border border-slate-100 dark:border-slate-900/20 backdrop-blur-sm">
                    <div className="flex flex-col justify-center">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Diferencial Operativo</p>
                        <div className="flex items-end gap-3">
                            <span className="text-5xl font-black text-slate-600 dark:text-slate-400">
                                {inflationGap > 0 ? inflationGap.toFixed(2) : '0.00'}%
                            </span>
                            <div className="text-xs font-bold text-gray-500 mb-2 flex flex-col">
                                <span>BCV USD: {exchangeRate.toFixed(2)}</span>
                                <span>Binance: {exchangeRateParalelo.toFixed(2)}</span>
                                {exchangeRateEuro > 0 && <span className="text-yellow-600">EUR BCV: {exchangeRateEuro.toFixed(2)}</span>}
                            </div>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-slate-500" style={{ width: `${Math.min(100, inflationGap * 3)}%` }}></div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Factor de Ajuste (+/-)</label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    placeholder="Ej: 20 o -10"
                                    value={targetPercentage} 
                                    onChange={e => setTargetPercentage(parseFloat(e.target.value))}
                                    className={`font-black text-lg ${targetPercentage < 0 ? 'text-red-500' : 'text-green-600'}`}
                                />
                                <button 
                                    onClick={() => setTargetPercentage(parseFloat(inflationGap.toFixed(2)))} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md hover:bg-slate-200"
                                >
                                    Sugerido Mercado
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 pl-1">
                                {targetPercentage > 0 ? 'Actualización al alza.' : targetPercentage < 0 ? 'Descuento / Liquidación.' : 'Sin cambios.'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Estrategia de Redondeo</label>
                            <select 
                                className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white font-medium"
                                value={roundingMode}
                                onChange={(e: any) => setRoundingMode(e.target.value)}
                            >
                                <option value="none">Exacto (Contable)</option>
                                <option value="x99">Psicológico (.99)</option>
                                <option value="x50">Comercial (.50)</option>
                                <option value="integer">Enteros (Sin decimales)</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2 pt-2">
                            <Button 
                                onClick={() => setIsSimulationOpen(true)}
                                className={`w-full text-white shadow-lg gap-2 ${targetPercentage < 0 ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-slate-600 hover:bg-slate-700 shadow-slate-500/30'}`}
                            >
                                <RefreshCw size={18} /> {targetPercentage < 0 ? 'Simular Liquidación' : 'Simular Ajuste de Costos'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><Banknote size={20} className="text-ios-blue"/> Configuración de Precios</h3>
                
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-ios-subtext uppercase block mb-2">Tasa de Cambio Activa</label>
                        <div className="bg-gray-50 dark:bg-white/5 p-1 rounded-xl flex gap-1">
                            {/* Dólar BCV */}
                            <button
                                onClick={() => onUpdate({ currencyRateMode: 'bcv' })}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex flex-col items-center gap-0.5 ${
                                    settings.currencyRateMode === 'bcv' || !settings.currencyRateMode
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span className="text-base leading-none">$</span>
                                <span className="text-[10px]">Dólar BCV</span>
                                {exchangeRate > 0 && (
                                    <span className="text-[9px] opacity-60 font-normal">Bs {exchangeRate.toFixed(2)}</span>
                                )}
                            </button>

                            {/* Tasa Binance */}
                            <button
                                onClick={() => onUpdate({ currencyRateMode: 'paralelo' })}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex flex-col items-center gap-0.5 ${
                                    settings.currencyRateMode === 'paralelo'
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-green-600'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span className="text-base leading-none">₿</span>
                                <span className="text-[10px]">Tasa Binance</span>
                                {exchangeRateParalelo > 0 && (
                                    <span className="text-[9px] opacity-60 font-normal">Bs {exchangeRateParalelo.toFixed(2)}</span>
                                )}
                            </button>

                            {/* Euro BCV */}
                            <button
                                onClick={() => onUpdate({ currencyRateMode: 'euro_bcv' })}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex flex-col items-center gap-0.5 relative ${
                                    settings.currencyRateMode === 'euro_bcv'
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-yellow-600'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span className="text-base leading-none">€</span>
                                <span className="text-[10px]">Euro BCV</span>
                                {exchangeRateEuro > 0 && (
                                    <span className="text-[9px] opacity-60 font-normal">Bs {exchangeRateEuro.toFixed(2)}</span>
                                )}
                                <span className="absolute top-1 right-1 text-[8px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-1 rounded font-black">BCV</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 pl-1">Define qué tasa se usa para calcular el precio en Bs visible para el cliente. La Tasa Binance se obtiene en tiempo real desde P2P.</p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-ios-subtext uppercase block mb-1">Modo de Visualización</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    id: 'usd',
                                    label: `Solo ${activeCurrencySymbol === '€' ? 'EUR (€)' : 'USD ($)'}`,
                                    desc: `${activeCurrencySymbol}10.00`
                                },
                                { id: 'ves', label: 'Solo Bs', desc: 'Bs 450.00' },
                                {
                                    id: 'both',
                                    label: 'Ambas',
                                    desc: `${activeCurrencySymbol}10.00 / Bs 450.00`
                                }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => onUpdate({ priceDisplayMode: opt.id as any })}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${settings.priceDisplayMode === opt.id ? 'border-ios-blue bg-ios-blue/5 text-ios-blue' : 'border-gray-100 text-gray-400'}`}
                                >
                                    <span className="font-bold text-sm">{opt.label}</span>
                                    <span className="text-xs opacity-70">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            <PriceSimulationModal 
                isOpen={isSimulationOpen} 
                onClose={() => setIsSimulationOpen(false)}
                products={products}
                percentage={targetPercentage}
                rounding={roundingMode}
                onApply={handleBatchUpdate}
            />
        </div>
    );
};
