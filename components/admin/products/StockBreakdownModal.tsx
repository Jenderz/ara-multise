
import React, { useState, useEffect } from 'react';
import { useStore } from '../../../context/StoreContext';
import { Product, Branch } from '../../../types';
import { X, Truck, Building2, Package, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../UIComponents';

interface StockBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onTransfer: (product: Product, targetBranchId: number) => void;
}

export const StockBreakdownModal = ({ isOpen, onClose, product, onTransfer }: StockBreakdownModalProps) => {
    const { branches, getStockBreakdown, currentBranch, transferStock } = useStore();
    const [breakdown, setBreakdown] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVariantId, setSelectedVariantId] = useState<string>('');

    // Estados para transferencia rápida dentro del modal
    const [transferMode, setTransferMode] = useState<{ targetId: number, targetName: string } | null>(null);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen && product) {
            // Seleccionar primera variante por defecto si existen
            if (product.variants && product.variants.length > 0) {
                setSelectedVariantId(product.variants[0].id);
            } else {
                setSelectedVariantId('');
            }
            setTransferMode(null);
            setSuccessMsg('');
            setAmount('');
        }
    }, [isOpen, product]);

    useEffect(() => {
        if (isOpen && product) loadBreakdown();
    }, [isOpen, product, selectedVariantId]);

    const loadBreakdown = async () => {
        setLoading(true);
        try {
            // Si hay variante seleccionada, obtenemos SU desglose. Si no, el del producto padre.
            const targetId = selectedVariantId || product.id;
            const data = await getStockBreakdown(targetId);

            if (data && Array.isArray(data)) {
                setBreakdown(data);
            } else {
                // Determine display stock: if variant selected, look it up.
                let displayStock = product.stock;
                if (selectedVariantId && product.variants) {
                    const v = product.variants.find(v => v.id === selectedVariantId);
                    if (v) displayStock = v.stock;
                }

                // Fallback: Si no hay API o falla, mostramos solo la info local conocida
                setBreakdown(branches.map(b => ({
                    branchId: b.id,
                    branchName: b.name,
                    stock: b.id === currentBranch?.id ? displayStock : '?', // Solo conocemos el local con certeza sin la API
                    isCurrent: b.id === currentBranch?.id
                })));
            }
        } catch (error) {
            console.error("Error loading breakdown", error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickTransfer = async () => {
        if (!transferMode) return;
        const qty = parseInt(amount);

        if (!qty || qty <= 0) {
            alert("Cantidad inválida");
            return;
        }

        // Validar stock contra la variante seleccionada o el producto padre
        let currentStock = product.stock;
        let variantSku, variantName;

        if (selectedVariantId && product.variants) {
            const v = product.variants.find(v => v.id === selectedVariantId);
            if (v) {
                currentStock = v.stock;
                variantSku = v.sku;
                variantName = Object.values(v.selections).join(' ');
            }
        }

        if (qty > currentStock) {
            alert("No hay suficiente stock en esta sede para enviar.");
            return;
        }

        setIsSubmitting(true);
        try {
            await transferStock(product.id, transferMode.targetId, qty, variantSku || product.code, variantName || product.title); // Usamos SKU base por defecto
            setSuccessMsg(`Enviadas ${qty} unid. a ${transferMode.targetName}`);
            setTransferMode(null);
            setAmount('');
            loadBreakdown(); // Recargar para ver nuevos stocks

            // Cerrar mensaje de éxito tras 3 segundos
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) {
            alert("Error al transferir");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-slide-up ring-1 ring-black/5 dark:ring-white/10">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shadow-sm border border-gray-100 dark:border-white/5">
                            <Building2 size={20} className="text-ios-blue" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg dark:text-white leading-tight">Disponibilidad Global</h3>
                            <p className="text-xs text-gray-500 font-medium">Stock en todas las sedes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto space-y-4">

                    <div className="flex items-start gap-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                        <div className="w-12 h-12 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center shrink-0">
                            {product.images && product.images[0] ? (
                                <img src={product.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                                <Package size={20} className="text-blue-500" />
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm dark:text-white text-blue-900 dark:text-blue-100">{product.title}</h4>
                            <p className="text-xs text-blue-600 dark:text-blue-300 font-mono mt-0.5">{product.code}</p>
                        </div>
                    </div>

                    {/* Selector de Variantes */}
                    {product.variants && product.variants.length > 0 && (
                        <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Seleccionar Variante</label>
                            <select
                                value={selectedVariantId}
                                onChange={(e) => setSelectedVariantId(e.target.value)}
                                className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none dark:text-white"
                            >
                                {product.variants.map(v => {
                                    // Calcular stock global sumando el breakdown
                                    const globalStock = breakdown.length > 0 && selectedVariantId === v.id
                                        ? breakdown.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0)
                                        : v.stock; // Fallback al stock local si no hay breakdown cargado

                                    return (
                                        <option key={v.id} value={v.id}>
                                            {Object.entries(v.selections).map(([k, val]) => `${val}`).join(' / ')} - (Stock: {globalStock})
                                        </option>
                                    );
                                })}
                            </select>
                            {/* Mostrar stock global de la variante seleccionada */}
                            {selectedVariantId && breakdown.length > 0 && (
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                                    <span className="font-medium">Stock Global:</span>
                                    <span className="font-bold text-ios-blue">
                                        {breakdown.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0)} unidades
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                            <CheckCircle2 size={16} /> {successMsg}
                        </div>
                    )}

                    {transferMode ? (
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 animate-in fade-in zoom-in-95">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold dark:text-white flex items-center gap-2">
                                    <Truck size={16} className="text-orange-500" />
                                    Enviar a {transferMode.targetName}
                                </h4>
                                <button onClick={() => setTransferMode(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">Cancelar</button>
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Cant."
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="bg-white dark:bg-black/20"
                                    autoFocus
                                />
                                <Button
                                    onClick={handleQuickTransfer}
                                    loading={isSubmitting}
                                    disabled={!amount}
                                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                                >
                                    <ArrowRight size={18} />
                                </Button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                                <AlertCircle size={10} /> Se descontará del stock actual ({
                                    selectedVariantId
                                        ? (product.variants?.find(v => v.id === selectedVariantId)?.stock || 0)
                                        : product.stock
                                }).
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {loading ? (
                                <div className="text-center py-8 text-gray-400 text-xs">Cargando disponibilidad...</div>
                            ) : breakdown.map((item, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${item.isCurrent ? 'bg-white dark:bg-zinc-800 border-ios-blue/30 ring-1 ring-ios-blue/10 shadow-sm' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 rounded-full ${item.stock > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                        <div>
                                            <p className={`text-sm font-bold ${item.isCurrent ? 'text-ios-blue' : 'text-gray-700 dark:text-white'}`}>
                                                {item.branchName}
                                                {item.isCurrent && <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase">Actual</span>}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {item.stock > 0 ? 'Disponible' : 'Sin Stock'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-black ${item.stock > 0 ? 'text-gray-800 dark:text-white' : 'text-gray-300'}`}>
                                            {item.stock}
                                        </span>

                                        {/* Solo permitir transferir HACIA otras sedes (no a la actual) */}
                                        {!item.isCurrent && product.stock > 0 && (
                                            <button
                                                onClick={() => setTransferMode({ targetId: item.branchId, targetName: item.branchName })}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                                                title="Enviar Stock aquí"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 text-center">
                    <p className="text-[10px] text-gray-400">
                        Los datos de stock remoto se actualizan casi en tiempo real (según conectividad).
                    </p>
                </div>
            </div>
        </div >
    );
};
