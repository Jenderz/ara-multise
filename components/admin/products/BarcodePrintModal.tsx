
import React, { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { generateEAN13, renderBarcodeSVG, normalizeToEAN13 } from '../../../utils/barcodeUtils';
import { X, Printer, Tag, ChevronDown } from 'lucide-react';

interface BarcodePrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    storeName?: string;
}

type LabelSize = 'small' | 'large';
type QtyPreset = 1 | 4 | 10 | 20;

const LABEL_SIZES: Record<LabelSize, { label: string; widthMm: number; heightMm: number }> = {
    small: { label: 'Pequeña (5×3 cm)', widthMm: 50, heightMm: 30 },
    large: { label: 'Grande (9×4 cm)', widthMm: 90, heightMm: 40 },
};

const QTY_PRESETS: QtyPreset[] = [1, 4, 10, 20];

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
    isOpen,
    onClose,
    product,
    storeName = '',
}) => {
    const [qty, setQty] = useState<number>(1);
    const [customQty, setCustomQty] = useState('');
    const [labelSize, setLabelSize] = useState<LabelSize>('small');
    const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);

    // EAN-13: si hay variante seleccionada y tiene su propio barcode, usarlo; si no, usar del producto o generar
    const hasVariants = product.variants && product.variants.length > 0;
    const activeVariant = selectedVariantIdx !== null ? product.variants[selectedVariantIdx] : null;

    const ean13 = (() => {
        const raw = activeVariant?.barcodeEan || product.barcodeEan;
        if (raw) return normalizeToEAN13(raw, product.category, product.code);
        const code = activeVariant ? `${product.code}-${activeVariant.sku}` : product.code;
        return generateEAN13(product.category, code);
    })();

    const barcodeSVG = renderBarcodeSVG(ean13, {
        height: labelSize === 'large' ? 55 : 38,
        moduleWidth: labelSize === 'large' ? 2 : 1.5,
        showText: true,
        fontSize: 8,
    });

    const getEffectivePrice = (price?: number, salePrice?: number): number => {
        const p = Number(price) || 0;
        const s = Number(salePrice) || 0;
        return (s > 0 && s < p) ? s : p;
    };

    const activePrice = activeVariant
        ? getEffectivePrice(activeVariant.price, activeVariant.salePrice)
        : getEffectivePrice(product.price, product.salePrice);

    const activeLabel = activeVariant
        ? `${product.title} — ${Object.values(activeVariant.selections).join(' / ')}`
        : product.title;

    const actualQty = customQty ? parseInt(customQty) || 1 : qty;

    const handlePrint = () => {
        // Usamos un iframe oculto inyectado en el DOM actual en lugar de window.open().
        // window.open() es bloqueado por Safari iOS y Android Chrome en contextos sin
        // interacción directa del usuario o en iframes. El iframe siempre funciona.
        const iframeId = 'barcode-print-frame';
        let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
        if (iframe) iframe.remove(); // Limpiar frame anterior

        iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Etiquetas — ${product.title.replace(/</g, '&lt;')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #fff; }
    .labels-grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; }
    .label {
      width: ${LABEL_SIZES[labelSize].widthMm}mm;
      height: ${LABEL_SIZES[labelSize].heightMm}mm;
      border: 0.5px dashed #aaa;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 2mm 2mm 1mm; overflow: hidden;
      page-break-inside: avoid;
    }
    .label-store  { font-size: 5pt; color: #666; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 1mm; }
    .label-title  { font-size: ${labelSize === 'large' ? '7' : '5.5'}pt; font-weight: bold; text-align: center; line-height: 1.2; max-height: ${labelSize === 'large' ? '8mm' : '6mm'}; overflow: hidden; width: 100%; }
    .label-cat    { font-size: 5pt; color: #888; margin: .5mm 0; }
    .label-barcode{ flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }
    .label-barcode svg { max-width: 100%; max-height: 100%; }
    .label-price  { font-size: ${labelSize === 'large' ? '9' : '7'}pt; font-weight: 900; margin-top: .5mm; }
    @media print { @page { margin: 4mm; } .labels-grid { gap: 3px; } }
  </style>
</head>
<body>
<div class="labels-grid">
${Array.from({ length: actualQty }).map(() => `
  <div class="label">
    ${storeName ? `<div class="label-store">${storeName}</div>` : ''}
    <div class="label-title">${activeLabel}</div>
    <div class="label-cat">${product.category}</div>
    <div class="label-barcode">${barcodeSVG}</div>
    <div class="label-price">$${activePrice.toFixed(2)}</div>
  </div>`).join('')}
</div>
</body>
</html>`;

        doc.open();
        doc.write(html);
        doc.close();

        // Dar tiempo al navegador para renderizar el SVG antes de llamar print()
        setTimeout(() => {
            try {
                iframe!.contentWindow?.focus();
                iframe!.contentWindow?.print();
            } catch (e) {
                // Fallback para navegadores muy restrictivos: abrir en pestaña nueva
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const w = window.open(url, '_blank');
                if (w) {
                    w.onload = () => { w.print(); URL.revokeObjectURL(url); };
                }
            }
        }, 300);
    };

    useEffect(() => {
        if (!isOpen) {
            setQty(1);
            setCustomQty('');
            setLabelSize('small');
            setSelectedVariantIdx(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const { widthMm, heightMm } = LABEL_SIZES[labelSize];
    // Escala para preview (1mm ≈ 3.78px)
    const scale = labelSize === 'large' ? 3.4 : 4;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-black/5 dark:border-white/10">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                            <Tag size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-sm dark:text-white">Imprimir Etiqueta</h2>
                            <p className="text-xs text-gray-400 truncate max-w-[240px]">{product.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5">

                    {/* Variante selector (solo si hay variantes) */}
                    {hasVariants && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                Variante
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedVariantIdx ?? ''}
                                    onChange={e => setSelectedVariantIdx(e.target.value === '' ? null : parseInt(e.target.value))}
                                    className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-transparent outline-none text-sm dark:text-white appearance-none cursor-pointer"
                                >
                                    <option value="">Producto base (sin variante)</option>
                                    {product.variants.map((v, i) => (
                                        <option key={v.id} value={i}>
                                            {Object.values(v.selections).join(' / ')} — SKU: {v.sku}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Tamaño etiqueta */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            Tamaño de etiqueta
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(LABEL_SIZES) as [LabelSize, typeof LABEL_SIZES[LabelSize]][]).map(([key, val]) => (
                                <button
                                    key={key}
                                    onClick={() => setLabelSize(key)}
                                    className={`py-2.5 px-4 rounded-2xl text-xs font-bold border-2 transition-all ${labelSize === key
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                        : 'border-transparent bg-gray-50 dark:bg-white/5 text-gray-500 hover:border-gray-200'
                                        }`}
                                >
                                    {val.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cantidad */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            Cantidad de copias
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {QTY_PRESETS.map(q => (
                                <button
                                    key={q}
                                    onClick={() => { setQty(q); setCustomQty(''); }}
                                    className={`h-10 w-14 rounded-2xl text-sm font-black transition-all ${qty === q && !customQty
                                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                        : 'bg-gray-50 dark:bg-white/5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'
                                        }`}
                                >
                                    {q}
                                </button>
                            ))}
                            <input
                                type="number"
                                min={1}
                                max={200}
                                placeholder="Custom"
                                value={customQty}
                                onChange={e => { setCustomQty(e.target.value); setQty(0); }}
                                className="h-10 w-20 px-3 rounded-2xl bg-gray-50 dark:bg-white/5 border-2 border-dashed border-gray-200 dark:border-white/10 text-sm font-bold text-center dark:text-white outline-none focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                            Vista previa de etiqueta
                        </label>
                        <div className="flex items-center justify-center bg-gray-50 dark:bg-black/20 rounded-2xl p-4 border border-gray-100 dark:border-white/5">
                            <div
                                className="bg-white border border-dashed border-gray-300 flex flex-col items-center justify-center shadow-sm"
                                style={{
                                    width: widthMm * scale * 0.6,
                                    height: heightMm * scale * 0.6,
                                    padding: '4px 6px 2px',
                                }}
                            >
                                {storeName && (
                                    <p className="text-center font-mono leading-none mb-0.5" style={{ fontSize: 5 }}>
                                        {storeName}
                                    </p>
                                )}
                                <p
                                    className="text-center font-bold leading-tight truncate w-full"
                                    style={{ fontSize: labelSize === 'large' ? 7 : 5.5 }}
                                >
                                    {activeLabel}
                                </p>
                                <p className="text-gray-400 text-center" style={{ fontSize: 5 }}>
                                    {product.category}
                                </p>
                                <div
                                    className="flex-1 flex items-center justify-center overflow-hidden w-full"
                                    dangerouslySetInnerHTML={{ __html: barcodeSVG }}
                                />
                                <p className="font-black text-center" style={{ fontSize: labelSize === 'large' ? 9 : 7 }}>
                                    ${activePrice.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-gray-400 mt-2">
                            EAN-13: <span className="font-mono font-bold tracking-widest text-gray-600 dark:text-gray-300">{ean13}</span>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Printer size={16} />
                        Imprimir {actualQty} {actualQty === 1 ? 'copia' : 'copias'}
                    </button>
                </div>
            </div>
        </div>
    );
};
