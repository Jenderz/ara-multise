import React, { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { useNotification } from '../../../context/NotificationContext';
import { Button, Input } from '../../UIComponents';
import { X, ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../../config';

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSuccess?: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const { adjustStock, branches, currentBranch } = useStore();
    const { addNotification } = useNotification();

    const [selectedVariantId, setSelectedVariantId] = useState<string>('');
    const [adjustmentType, setAdjustmentType] = useState<'entry' | 'exit' | 'adjustment'>('entry');
    const [amount, setAmount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setSelectedBranchId((currentBranch?.id && currentBranch.id > 0) ? currentBranch.id : 1);
            setAmount('');
            setReference('');
            setAdjustmentType('entry');
            if (product.variants && product.variants.length > 0) {
                setSelectedVariantId(product.variants[0].id);
            } else {
                setSelectedVariantId('');
            }
        }
    }, [isOpen, product, currentBranch]);

    if (!isOpen || !product) return null;

    const hasVariants = product.variants && product.variants.length > 0;
    const selectedVariant = hasVariants ? product.variants.find(v => v.id === selectedVariantId) : null;
    const currentStockDisplay = selectedVariant ? selectedVariant.stock : product.stock;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseInt(amount, 10);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            addNotification({ title: 'Cantidad inválida', body: 'Ingresa un número mayor a 0.', type: 'warning' });
            return;
        }

        if (!reference.trim()) {
            addNotification({ title: 'Referencia requerida', body: 'Ingresa el motivo o número de documento.', type: 'warning' });
            return;
        }

        const targetProductId = selectedVariantId || product.id;

        setIsSubmitting(true);
        try {
            await adjustStock(
                targetProductId,
                adjustmentType,
                parsedAmount,
                reference.trim(),
                selectedBranchId
            );

            addNotification({
                title: 'Ajuste Exitoso',
                body: `Se registró el ajuste de ${parsedAmount} unidades.`,
                type: 'success'
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            addNotification({
                title: 'Error en Ajuste',
                body: err.message || 'No se pudo guardar el ajuste de stock.',
                type: 'warning'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center text-ios-blue">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg dark:text-white">Ajuste Rápido de Stock</h3>
                            <p className="text-xs text-gray-400">Entrada, merma o conteo físico directo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                    {/* Resumen del producto */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-zinc-800 shrink-0 border border-gray-200 dark:border-white/10">
                            <img src={(selectedVariant?.image || product.images[0]) || DEFAULT_IMAGE} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm dark:text-white truncate">{product.title}</p>
                            <p className="text-xs text-gray-400 font-mono">{selectedVariant?.sku || product.code}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-bold block uppercase">Stock Actual</span>
                            <span className="text-lg font-black text-ios-blue">{currentStockDisplay} u.</span>
                        </div>
                    </div>

                    {/* Selector de Variante si aplica */}
                    {hasVariants && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">Seleccionar Variante</label>
                            <select
                                className="w-full bg-gray-50 dark:bg-black/20 border border-transparent rounded-2xl px-4 py-3 outline-none text-sm dark:text-white focus:ring-4 focus:ring-ios-blue/10 transition-all font-medium"
                                value={selectedVariantId}
                                onChange={e => setSelectedVariantId(e.target.value)}
                            >
                                {product.variants.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {Object.values(v.selections).join(' / ')} (SKU: {v.sku}) - Stock: {v.stock}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Selector de Sede */}
                    {branches.length > 1 && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">Sucursal de Destino / Afectada</label>
                            <select
                                className="w-full bg-gray-50 dark:bg-black/20 border border-transparent rounded-2xl px-4 py-3 outline-none text-sm dark:text-white focus:ring-4 focus:ring-ios-blue/10 transition-all font-medium"
                                value={selectedBranchId}
                                onChange={e => setSelectedBranchId(parseInt(e.target.value))}
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Selector Tipo de Ajuste */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-2">Tipo de Movimiento</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('entry')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border font-bold text-xs transition-all gap-1.5 ${
                                    adjustmentType === 'entry'
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300 shadow-sm'
                                        : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500 hover:border-gray-200'
                                }`}
                            >
                                <ArrowDownCircle size={20} className={adjustmentType === 'entry' ? 'text-green-600' : 'text-gray-400'} />
                                Entrada / Compra
                            </button>

                            <button
                                type="button"
                                onClick={() => setAdjustmentType('exit')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border font-bold text-xs transition-all gap-1.5 ${
                                    adjustmentType === 'exit'
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300 shadow-sm'
                                        : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500 hover:border-gray-200'
                                }`}
                            >
                                <ArrowUpCircle size={20} className={adjustmentType === 'exit' ? 'text-red-600' : 'text-gray-400'} />
                                Salida / Merma
                            </button>

                            <button
                                type="button"
                                onClick={() => setAdjustmentType('adjustment')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border font-bold text-xs transition-all gap-1.5 ${
                                    adjustmentType === 'adjustment'
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                        : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500 hover:border-gray-200'
                                }`}
                            >
                                <RefreshCw size={20} className={adjustmentType === 'adjustment' ? 'text-blue-600' : 'text-gray-400'} />
                                Conteo Físico
                            </button>
                        </div>
                    </div>

                    {/* Cantidad */}
                    <div>
                        <Input
                            label="Cantidad de Unidades"
                            type="number"
                            min="1"
                            placeholder="Ej: 10"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    {/* Referencia / Motivo */}
                    <div>
                        <Input
                            label="Motivo / Documento de Referencia"
                            placeholder="Ej: Factura Proveedor #4092, Conteo mensual, Merma por daño"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            loading={isSubmitting}
                            className="w-full py-3.5 font-bold shadow-lg shadow-ios-blue/30"
                        >
                            Guardar Ajuste de Inventario
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
