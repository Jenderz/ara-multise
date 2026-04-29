/**
 * integrations/araw/ReplenishButton.tsx
 * Botón "Pedir a Almacén" que se inyecta en la fila de cada producto
 * del inventario de ara-multise.
 *
 * Solo se renderiza si la integración ARAW está activa.
 * Usa el patrón de composición: el componente padre no necesita saber
 * nada de ARAW, simplemente agrega <ReplenishButton product={p} /> y
 * el botón decide si mostrarse o no.
 */

import React, { useState } from 'react';
import { PackagePlus, Loader2, CheckCircle, AlertTriangle, X, Minus, Plus } from 'lucide-react';
import { useARAW } from './ARAWContext';
import { Product } from '../../types';

interface ReplenishButtonProps {
    product: Product;
    /** Estilo compacto para la tabla desktop (solo ícono) vs cards mobile (con texto) */
    compact?: boolean;
}

export const ReplenishButton: React.FC<ReplenishButtonProps> = ({ product, compact = false }) => {
    const araw = useARAW();

    // Si la integración no está activa, no renderizar NADA → sin impacto visual
    if (!araw || !araw.isActive) return null;

    return <ReplenishButtonInner product={product} compact={compact} araw={araw} />;
};

/* ── Componente interno (solo se monta cuando araw.isActive) ── */
const ReplenishButtonInner: React.FC<ReplenishButtonProps & { araw: NonNullable<ReturnType<typeof useARAW>> }> = ({
    product, compact, araw
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const handleOpen = () => {
        setQuantity(product.minStock || 1);
        setNotes('');
        setResult(null);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        if (!loading) setIsModalOpen(false);
    };

    const handleConfirm = async () => {
        setLoading(true);
        setResult(null);
        try {
            const order = await araw.placeReplenishmentOrder({
                items: [{
                    product_code: product.code,
                    product_name: product.title,
                    quantity,
                    cost_reference: product.cost,
                }],
                notes: notes.trim() || undefined,
            });
            setResult({
                ok: true,
                message: `Orden #${order.order_number} creada con éxito en ARAW.`,
            });
        } catch (e: any) {
            setResult({ ok: false, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* ── Botón triggerr ── */}
            <button
                onClick={handleOpen}
                className={`text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all ${compact ? 'p-2' : 'flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold'}`}
                title="Pedir a Almacén ARAW"
            >
                <PackagePlus size={compact ? 18 : 14} />
                {!compact && <span>Reponer</span>}
            </button>

            {/* ── Modal de confirmación ── */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cabecera */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <PackagePlus size={18} className="text-emerald-500" />
                                    Pedir a Almacén
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.title}</p>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={loading}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Código y stock actual */}
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 mb-5 text-sm">
                            <span className="text-gray-500">Código:</span>
                            <span className="font-mono font-bold text-gray-800 dark:text-white">{product.code}</span>
                            <span className="text-gray-500 ml-4">Stock actual:</span>
                            <span className={`font-bold ${product.stock < 5 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                                {product.stock} u.
                            </span>
                        </div>

                        {/* Resultado previo */}
                        {result && (
                            <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 text-sm ${result.ok
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                }`}>
                                {result.ok
                                    ? <CheckCircle size={16} className="shrink-0 mt-0.5" />
                                    : <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                }
                                <span>{result.message}</span>
                            </div>
                        )}

                        {/* Solo mostrar el formulario si no fue exitoso */}
                        {!result?.ok && (
                            <>
                                {/* Selector de cantidad */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                                        Cantidad a pedir
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 flex items-center justify-center font-bold"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <input
                                            type="number"
                                            min={1}
                                            value={quantity}
                                            onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                            className="flex-1 text-center text-xl font-black bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2 outline-none dark:text-white focus:ring-2 focus:ring-emerald-400/30"
                                        />
                                        <button
                                            onClick={() => setQuantity(q => q + 1)}
                                            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 flex items-center justify-center font-bold"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Notas opcionales */}
                                <div className="mb-5">
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                                        Notas (opcional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Ej: Urgente, falta stock..."
                                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 rounded-xl outline-none resize-none dark:text-white focus:ring-2 focus:ring-emerald-400/30"
                                    />
                                </div>

                                {/* Botones */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        disabled={loading}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading || quantity < 1}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading
                                            ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                                            : <><PackagePlus size={14} /> Confirmar</>
                                        }
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Botón de cerrar al éxito */}
                        {result?.ok && (
                            <button
                                onClick={handleClose}
                                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all"
                            >
                                Cerrar
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
