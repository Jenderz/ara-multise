
import React, { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { Button } from '../../UIComponents';
import { X, CheckCircle2, DollarSign, Store, Globe, Check, AlertCircle, MapPin, Package } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../../config';
import { useStore } from '../../../context/StoreContext';

// --- MODAL SELECCIÓN DE VARIANTE ---
export const VariantSelectorModal = ({ product, isOpen, onClose, onConfirm }: { product: Product | null, isOpen: boolean, onClose: () => void, onConfirm: (p: Product, options: Record<string, string>, price: number, sku: string, image: string) => void }) => {
    const { currentBranch, activeExchangeRate, activeCurrencySymbol } = useStore();
    const [selections, setSelections] = useState<Record<string, string>>({});

    useEffect(() => {
        setSelections({});
    }, [product]);

    if (!isOpen || !product) return null;

    const isGlobalView = currentBranch?.id === 0;

    /**
     * Calcula la disponibilidad y el stock exacto de una opción
     * basándose en las selecciones actuales de los otros atributos.
     */
    const getOptionState = (optionName: string, value: string) => {
        if (!product.variants) return { stock: 0 };

        // 1. Filtramos las variantes que coinciden con el valor que estamos evaluando
        // Y que TAMBIÉN coinciden con lo que el usuario ya ha seleccionado en otros campos.
        const compatibleVariants = product.variants.filter(v => {
            // Debe coincidir con el valor del botón actual (ej: "Rojo")
            if (v.selections[optionName] !== value) return false;

            // Debe ser compatible con las otras selecciones (ej: Si ya eligió Talla "M")
            // Iteramos las selecciones actuales, ignorando la categoría que estamos renderizando ahorita
            return Object.entries(selections).every(([k, selectedVal]) => {
                if (k === optionName) return true; // Ignorar la propia categoría
                return v.selections[k] === selectedVal;
            });
        });

        // 2. Sumamos el stock de las variantes compatibles
        // Parseamos a Number() por seguridad contra strings de PHP
        const totalStock = compatibleVariants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);

        return { stock: totalStock };
    };

    const getRepresentativeImage = (optionName: string, value: string) => {
        if (!product.variants) return null;
        // Buscamos la primera variante que tenga este valor seleccionado y tenga foto
        const variantWithImg = product.variants.find(v => v.selections[optionName] === value && v.image);
        return variantWithImg?.image || null;
    };
    const getSelectedVariant = () => {
        if (!product.variants) return null;
        return product.variants.find(v =>
            Object.entries(selections).every(([k, val]) => v.selections[k] === val)
        );
    };

    const selectedVariant = getSelectedVariant();

    // Datos finales para renderizar
    const basePrice = selectedVariant && selectedVariant.price > 0 ? selectedVariant.price : product.price;
    const salePrice = selectedVariant?.salePrice || 0;

    // Determine effective price
    let effectivePrice = basePrice;
    if (salePrice > 0 && salePrice < basePrice) {
        effectivePrice = salePrice;
    } else if (selectedVariant && selectedVariant.price === 0) {
        // Fallback to product sale price if variant has no specific price override (price 0 usually means "use master")
        // But here we handled selectedVariant.price > 0 above. 
        // If variant.price is 0, we used product.price.
        // Now check product sale price? 
        // The original logic was: selectedVariant.price > 0 ? selectedVariant.price : product.price

        // Let's stick to variant specific first.
        if (product.salePrice && product.salePrice > 0 && product.salePrice < product.price) {
            effectivePrice = product.salePrice;
        }
    }

    const currentImage = selectedVariant?.image || product.images[0] || DEFAULT_IMAGE;

    // Validation de Formulario
    const allOptionsSelected = product.variantOptions?.every(opt => selections[opt.name]);

    // Stock final de la selección completa
    const finalStock = selectedVariant ? Number(selectedVariant.stock) : 0;

    // Permitir agregar si está completo y hay stock local
    const canAdd = allOptionsSelected && selectedVariant && (finalStock > 0);

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl relative p-6 animate-slide-up border border-white/10 flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition dark:text-white z-10"><X size={20} /></button>

                {/* Header Producto */}
                <div className="flex gap-4 mb-6 shrink-0">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 dark:border-white/10 relative shrink-0">
                        <img src={currentImage} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg dark:text-white line-clamp-2 leading-tight">{product.title}</h3>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-1">{product.code}</p>

                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex flex-col">
                                {effectivePrice < basePrice ? (
                                    <>
                                        <span className="text-gray-400 line-through text-xs">{activeCurrencySymbol}{basePrice.toFixed(2)}</span>
                                        <span className="text-red-500 font-black text-xl">{activeCurrencySymbol}{effectivePrice.toFixed(2)}</span>
                                    </>
                                ) : (
                                    <span className="text-ios-blue font-black text-xl">{activeCurrencySymbol}{effectivePrice.toFixed(2)}</span>
                                )}

                                {activeExchangeRate > 0 && (
                                    <span className="text-[10px] font-bold text-gray-400 -mt-1 leading-none">
                                        {(effectivePrice * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                    </span>
                                )}
                            </div>
                            {/* Badge de Sede */}
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-500 border border-gray-200 dark:border-white/10">
                                {isGlobalView ? <Globe size={10} /> : <MapPin size={10} />}
                                <span className="truncate max-w-[100px]">{currentBranch?.name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Opciones Scrollable */}
                <div className="space-y-5 mb-6 overflow-y-auto pr-1 custom-scrollbar">
                    {product.variantOptions?.map(opt => {
                        const activeValues = opt.values.filter(val =>
                            product.variants?.some(v => v.selections && v.selections[opt.name] === val)
                        );
                        if (activeValues.length === 0) return null;

                        return (
                        <div key={opt.name}>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{opt.name}</label>
                                {selections[opt.name] && <span className="text-xs font-bold text-ios-blue">{selections[opt.name]}</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {activeValues.map(val => {
                                    const { stock } = getOptionState(opt.name, val);
                                    const isSelected = selections[opt.name] === val;
                                    const isColor = opt.type === 'color';
                                    const colorHex = opt.colorValues?.[val] || '#eeeeee';
                                    const thumbnail = getRepresentativeImage(opt.name, val);
                                    const hasStock = stock > 0;

                                    return (
                                        <button
                                            key={val}
                                            onClick={() => setSelections(prev => ({ ...prev, [opt.name]: val }))}
                                            className={`
                                                relative transition-all border flex items-center gap-1.5 group overflow-hidden
                                                ${isColor
                                                    ? 'w-12 h-12 rounded-full justify-center'
                                                    : 'px-3 py-2 rounded-lg text-xs font-bold'
                                                }
                                                ${isSelected
                                                    ? 'border-ios-blue ring-2 ring-ios-blue/20 z-10'
                                                    : hasStock
                                                        ? 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                                        : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 opacity-80'
                                                }
                                                ${!isColor && isSelected ? 'bg-ios-blue text-white' : ''}
                                                ${!isColor && !isSelected ? 'text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5' : ''}
                                            `}
                                            style={isColor ? {
                                                backgroundColor: thumbnail ? 'transparent' : colorHex,
                                                backgroundImage: thumbnail ? `url(${thumbnail})` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            } : {}}
                                            title={`${val} - Stock: ${stock}`}
                                        >
                                            {!isColor && (
                                                <>
                                                    {val}
                                                    {/* Indicador de Stock Inline - CRUCIAL PARA UX POS */}
                                                    <span className={`text-[9px] font-normal ml-1 ${isSelected ? 'text-white/80' : hasStock ? 'text-gray-400' : 'text-red-500 font-bold'}`}>
                                                        ({stock})
                                                    </span>
                                                </>
                                            )}

                                            {isColor && isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                    <Check size={16} className="text-white" strokeWidth={4} />
                                                </div>
                                            )}

                                            {/* Indicador de Agotado para colores (Diagonal) */}
                                            {isColor && !hasStock && !isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className="w-[120%] h-px bg-red-500/80 rotate-45 transform"></div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        );
                    })}
                </div>

                {/* Footer Status */}
                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
                    <div className={`flex justify-between items-center mb-4 p-3 rounded-xl border ${finalStock > 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20'}`}>
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-2">
                            <Package size={14} /> Disponibilidad:
                        </span>
                        {allOptionsSelected ? (
                            selectedVariant ? (
                                finalStock > 0 ? (
                                    <span className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle2 size={16} /> {finalStock} Unds.
                                    </span>
                                ) : (
                                    <span className="text-sm font-black text-red-500 flex items-center gap-1">
                                        <AlertCircle size={16} /> Agotado
                                    </span>
                                )
                            ) : (
                                <span className="text-xs font-bold text-orange-500">Variante no existe</span>
                            )
                        ) : (
                            <span className="text-xs font-medium text-gray-400 italic">Seleccione opciones...</span>
                        )}
                    </div>

                    <Button
                        onClick={() => {
                            if (canAdd && selectedVariant) {
                                onConfirm(product, selections, effectivePrice, selectedVariant.sku, currentImage);
                                onClose();
                            }
                        }}
                        disabled={!canAdd}
                        className={`w-full h-12 text-sm font-bold shadow-lg transition-all ${canAdd
                            ? 'bg-ios-blue hover:brightness-110 text-white shadow-ios-blue/30'
                            : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-500 shadow-none cursor-not-allowed'
                            }`}
                    >
                        {canAdd ? 'Agregar al Carrito' : 'No Disponible'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL DE CONFIRMACIÓN DE COBRO ---
export const CheckoutModal = ({ isOpen, onClose, onConfirm, total, cart, customerName }: any) => {
    const { activeExchangeRate, activeCurrencySymbol, settings } = useStore();
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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative p-8 animate-slide-up border border-white/10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-green-500" size={28} /> Confirmar Venta
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Resumen final antes de procesar.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:bg-gray-200 transition"><X size={20} className="dark:text-white" /></button>
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
                            <p className="text-3xl font-black text-ios-blue">{activeCurrencySymbol}{total.toFixed(2)}</p>
                            <p className="text-sm text-gray-500 font-medium">({settings.currencyRateMode === 'paralelo' ? 'P' : settings.currencyRateMode === 'euro_bcv' ? 'EUR' : 'BCV'}) {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Dinero Recibido ($ USD o Equivalente)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                        <span className="text-2xl font-black">{activeCurrencySymbol}{Math.abs(change).toFixed(2)}</span>
                    </div>
                )}

                <Button
                    onClick={handleConfirm}
                    loading={isProcessing}
                    disabled={received > 0 && change < -0.01}
                    className="w-full py-4 text-lg font-black bg-green-500 hover:bg-green-600 shadow-xl shadow-green-500/30 rounded-2xl"
                >
                    <CheckCircle2 size={24} className="mr-2" strokeWidth={3} /> Procesar Venta
                </Button>
            </div>
        </div>
    );
};
