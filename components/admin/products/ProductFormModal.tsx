
import React, { useState, useEffect } from 'react';
import { Product, Category, VariantOption, ProductVariant } from '../../../types';
import { Button, Input, ImageUploader } from '../../UIComponents';
import { ImageCropper } from '../../ImageCropper'; // Importar Cropper
import { api } from '../../../services/api'; // Importar API
import { X, Plus, Minus, Trash2, Save, Upload, AlertCircle, Lock, MapPin, Globe } from 'lucide-react';
import { generateId } from '../Shared';
import { useStore } from '../../../context/StoreContext';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSave: (p: Product) => void;
    categories: Category[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, product, onSave, categories }) => {
    const { currentBranch } = useStore();

    // --- CROPPER STATE ---
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [croppingTarget, setCroppingTarget] = useState<{ type: 'main' | 'variant', index?: number } | null>(null);

    const [formData, setFormData] = useState<Product>({
        id: '',
        code: '',
        title: '',
        description: '',
        cost: 0,
        price: 0,
        stock: 0,
        images: [],
        category: 'General',
        isVisible: true,
        isFeatured: false,
        variantOptions: [],
        variants: [],
        createdAt: Date.now()
    });

    const [activeTab, setActiveTab] = useState<'info' | 'variants'>('info');

    useEffect(() => {
        if (isOpen) {
            if (product) {
                // Al editar, usamos la data ya hidratada por read.php (que contiene el stock de ESTA sede)
                setFormData(JSON.parse(JSON.stringify(product)));
            } else {
                setFormData({
                    id: '',
                    code: '',
                    title: '',
                    description: '',
                    cost: 0,
                    price: 0,
                    stock: 0,
                    images: [],
                    category: categories.length > 0 ? categories[0].name : 'General',
                    isVisible: true,
                    isFeatured: false,
                    variantOptions: [],
                    variants: [],
                    createdAt: Date.now()
                });
            }
            setActiveTab('info');
        }
    }, [isOpen, product, categories]);

    // --- SUMA VINCULADA: Sincronización automática de Stock ---
    useEffect(() => {
        if (formData.variants && formData.variants.length > 0) {
            const totalVariantStock = formData.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);

            // Solo actualizamos si hay diferencia para evitar render loops
            setFormData(prev => {
                if (prev.stock === totalVariantStock) return prev;
                return { ...prev, stock: totalVariantStock };
            });
        }
    }, [formData.variants]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!formData.title || !formData.price) {
            alert('Nombre y precio son obligatorios');
            return;
        }
        onSave(formData);
    };

    const addOption = () => {
        setFormData(prev => ({
            ...prev,
            variantOptions: [...prev.variantOptions, { name: '', values: [], type: 'text' }]
        }));
    };

    const updateOption = (idx: number, field: keyof VariantOption, value: any) => {
        const newOptions = [...formData.variantOptions];
        newOptions[idx] = { ...newOptions[idx], [field]: value };
        setFormData(prev => ({ ...prev, variantOptions: newOptions }));
    };

    const removeOption = (idx: number) => {
        const newOptions = [...formData.variantOptions];
        newOptions.splice(idx, 1);
        setFormData(prev => ({ ...prev, variantOptions: newOptions }));
    };

    const handleGlobalSalePriceChange = (value: number) => {
        const val = isNaN(value) ? undefined : value;
        setFormData(prev => ({
            ...prev,
            salePrice: val,
            // Automatically propagate global sale price to all variants
            variants: prev.variants.map(v => ({
                ...v,
                salePrice: val
            }))
        }));
    };

    // ─── UTILIDAD: genera la llave canónica de una combinación ───────────────
    // Ordena las claves para que { Talla:'S', Color:'Rojo' } y
    // { Color:'Rojo', Talla:'S' } produzcan la MISMA llave.
    const buildCombinationKey = (selections: Record<string, string>): string =>
        Object.keys(selections)
            .sort()
            .map(k => `${k}:${selections[k]}`)
            .join('|');

    const generateVariants = () => {
        if (formData.variantOptions.length === 0) {
            setFormData(prev => ({ ...prev, variants: [] }));
            return;
        }

        // ── 1. MAPA O(1) de variantes existentes por combinationKey ───────────
        // Nunca mutamos el array original; usamos un Map de referencia.
        const existingMap = new Map<string, ProductVariant>(
            formData.variants.map(v => {
                const key = v.combinationKey ?? buildCombinationKey(v.selections);
                return [key, v];
            })
        );

        // ── 2. Generador recursivo de combinaciones (inmutable) ───────────────
        const generate = (
            optIdx: number,
            currentSelections: Record<string, string>
        ): ProductVariant[] => {
            if (optIdx === formData.variantOptions.length) {
                const key = buildCombinationKey(currentSelections);
                const existing = existingMap.get(key);

                if (existing) {
                    // ✅ VARIANTE EXISTENTE: preservar TODO su historial
                    // Spread defensivo → nunca mutamos el objeto original
                    return [{
                        ...existing,
                        combinationKey: key,   // normalizamos la key
                        // El SKU se recalcula por si cambió el código del producto,
                        // pero precio, stock y branchStock se conservan intactos.
                        sku: `${formData.code}-${Object.values(currentSelections).join('-')}`,
                    }];
                }

                // 🆕 VARIANTE NUEVA: stock 0 en todas las sedes
                return [{
                    id: generateId(),
                    combinationKey: key,
                    sku: `${formData.code}-${Object.values(currentSelections).join('-')}`,
                    selections: { ...currentSelections },   // copia defensiva
                    price: formData.price,
                    salePrice: formData.salePrice,
                    stock: 0,
                    branchStock: {},   // se pobla cuando el admin asigne stock por sede
                    image: ''
                }];
            }

            const option = formData.variantOptions[optIdx];
            if (option.values.length === 0) {
                return generate(optIdx + 1, currentSelections);
            }

            // reduce es más seguro que concat en bucles grandes (evita copias innecesarias)
            return option.values.reduce<ProductVariant[]>((acc, val) => [
                ...acc,
                ...generate(optIdx + 1, { ...currentSelections, [option.name]: val })
            ], []);
        };

        const mergedVariants = generate(0, {});

        // ── 3. Actualizar estado de forma inmutable ───────────────────────────
        setFormData(prev => ({ ...prev, variants: mergedVariants }));
    };


    const removeVariant = (idx: number) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar esta variante?')) {
            setFormData(prev => ({
                ...prev,
                variants: prev.variants.filter((_, i) => i !== idx)
            }));
        }
    };

    const updateVariant = (idx: number, field: keyof ProductVariant, value: any) => {
        const newVariants = [...formData.variants];
        newVariants[idx] = { ...newVariants[idx], [field]: value };
        setFormData(prev => ({ ...prev, variants: newVariants }));
    };

    const hasVariants = formData.variants.length > 0;
    const isGlobalView = currentBranch?.id === 0;

    // --- CROPPER HANDLERS ---
    const handleFileSelect = (file: File, type: 'main' | 'variant', index?: number) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setCropImage(reader.result as string);
            setCroppingTarget({ type, index });
        };
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        if (!croppingTarget) return;

        try {
            // Convertir blob a file para subir
            const file = new File([croppedBlob], "cropped_image.jpg", { type: "image/jpeg" });
            const url = await api.uploadImage(file);

            if (croppingTarget.type === 'main') {
                setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
            } else if (croppingTarget.type === 'variant' && croppingTarget.index !== undefined) {
                updateVariant(croppingTarget.index, 'image', url);
            }
        } catch (error) {
            console.error("Error uploading cropped image:", error);
            alert("Error al subir la imagen recortada.");
        } finally {
            setCropImage(null);
            setCroppingTarget(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-[2rem] shadow-2xl relative flex flex-col max-h-[90vh] border border-white/10 animate-slide-up">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/20 rounded-t-[2rem]">
                    <div>
                        <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                            {product ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold flex items-center gap-1 mt-1">
                            <MapPin size={12} className={isGlobalView ? 'text-purple-500' : 'text-orange-500'} />
                            {isGlobalView
                                ? 'Editando Maestro Global (Stock Sumado)'
                                : `Gestionando Stock en: ${currentBranch?.name}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full dark:text-white transition"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-white/5">
                    <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'info' ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>Información General</button>
                    <button onClick={() => setActiveTab('variants')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'variants' ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>Variantes y Stock ({formData.variants.length})</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-black/10">
                    {activeTab === 'info' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Input label="Nombre del Producto" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ej: Camiseta Básica" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Código / SKU" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: CAM-001" />
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase ml-1 block mb-1.5">Categoría</label>
                                            <select
                                                className="w-full bg-white dark:bg-black/20 border border-transparent rounded-2xl px-4 py-3 outline-none text-sm dark:text-white focus:ring-4 focus:ring-ios-blue/10 transition-all"
                                                value={formData.category}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            >
                                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <Input label="Precio Venta ($)" type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                                        <Input label="Costo ($)" type="number" value={formData.cost} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) })} />
                                        <Input label="Oferta ($)" type="number" value={formData.salePrice || ''} onChange={e => handleGlobalSalePriceChange(parseFloat(e.target.value))} placeholder="Opcional" />
                                    </div>

                                    <div className={`bg-white dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 ${hasVariants ? 'opacity-80 pointer-events-none' : ''}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Stock {isGlobalView ? 'Total Global' : currentBranch?.name}</label>
                                            <span className="text-xs font-mono text-gray-400">Total</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button disabled={hasVariants} onClick={() => setFormData({ ...formData, stock: Math.max(0, formData.stock - 1) })} className="p-2 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 disabled:opacity-50"><Minus size={16} /></button>
                                            <input
                                                type="number"
                                                disabled={hasVariants}
                                                className="flex-1 text-center bg-transparent text-xl font-bold outline-none dark:text-white disabled:opacity-50"
                                                value={formData.stock}
                                                onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                                            />
                                            <button disabled={hasVariants} onClick={() => setFormData({ ...formData, stock: formData.stock + 1 })} className="p-2 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 disabled:opacity-50"><Plus size={16} /></button>
                                        </div>
                                        {hasVariants && (
                                            <p className="text-[10px] text-ios-blue font-bold mt-2 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                                <Lock size={12} /> Stock sincronizado con variantes.
                                            </p>
                                        )}
                                        {product?.globalStock !== undefined && !isGlobalView && (
                                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                                                <Globe size={12} /> Existencia Global: {product.globalStock} u.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Descripción</label>
                                        <textarea
                                            className="w-full bg-white dark:bg-black/20 border border-transparent rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[120px] focus:ring-4 focus:ring-ios-blue/10 transition-all"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Detalles del producto..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1 block mb-2">Imágenes</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {formData.images.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="aspect-square">
                                                <ImageUploader
                                                    value=""
                                                    onChange={url => setFormData({ ...formData, images: [...formData.images, url] })}
                                                    onFileUpload={(file) => handleFileSelect(file, 'main')}
                                                    placeholder={<Plus size={24} className="text-gray-400" />}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-white dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <span className="text-sm font-bold dark:text-white ml-2">Visible en Tienda</span>
                                        <div
                                            onClick={() => setFormData({ ...formData, isVisible: !formData.isVisible })}
                                            className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${formData.isVisible ? 'bg-green-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${formData.isVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Opciones Config */}
                            <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                                {formData.variantOptions.map((opt, idx) => (
                                    <div key={idx} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                                        <div className="flex gap-2 items-center">
                                            <input
                                                className="bg-transparent font-bold text-sm outline-none w-32 dark:text-white"
                                                placeholder="Nombre (Ej: Talla)"
                                                value={opt.name}
                                                onChange={e => updateOption(idx, 'name', e.target.value)}
                                            />
                                            <div className="h-4 w-[1px] bg-gray-300"></div>
                                            <input
                                                className="flex-1 bg-transparent text-sm outline-none dark:text-gray-300"
                                                placeholder="Valores separados por coma (S, M, L...)"
                                                value={opt.values.join(', ')}
                                                onChange={e => updateOption(idx, 'values', e.target.value.split(',').map(v => v.trim()))}
                                            />
                                            <button onClick={() => removeOption(idx)} className="text-red-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={addOption} className="text-xs h-9"><Plus size={14} /> Agregar Opción</Button>
                                    <Button onClick={generateVariants} className="text-xs h-9 bg-ios-blue text-white">
                                        {formData.variantOptions.length === 0 ? 'Limpiar Variantes' : 'Generar Combinaciones'}
                                    </Button>
                                </div>
                            </div>

                            {/* Lista Variantes */}
                            {formData.variants.length > 0 && (
                                <>
                                    {/* Desktop Table */}
                                    <div className="hidden md:block border border-gray-100 dark:border-white/5 rounded-2xl overflow-visible bg-white dark:bg-black/20 pb-48 mb-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-300 font-medium">
                                            <b>Nota:</b> Estás editando el inventario de <b>{currentBranch?.name}</b>. Si ves "0", es porque esta sede no tiene stock físico asignado.
                                        </div>
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-white/5 text-[10px] text-gray-500 uppercase font-bold">
                                                <tr>
                                                    <th className="p-3 w-10 text-center"></th>
                                                    <th className="p-3">Variante</th>
                                                    <th className="p-3 w-24">Precio</th>
                                                    <th className="p-3 w-24">Oferta</th>
                                                    <th className="p-3 w-32">Stock Local</th>
                                                    <th className="p-3 w-32">SKU</th>
                                                    <th className="p-3 w-20 text-center">Imagen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {formData.variants.map((v, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => removeVariant(idx)}
                                                                className="text-red-400 hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {Object.entries(v.selections).map(([k, val]) => (
                                                                    <span key={k} className="text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">{val}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <input
                                                                type="number"
                                                                className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 focus:border-ios-blue outline-none text-xs py-1 dark:text-white font-mono"
                                                                value={v.price}
                                                                onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <input
                                                                type="number"
                                                                placeholder="-"
                                                                className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 focus:border-ios-blue outline-none text-xs py-1 dark:text-white font-mono text-red-500 placeholder-gray-300"
                                                                value={v.salePrice || ''}
                                                                onChange={e => updateVariant(idx, 'salePrice', parseFloat(e.target.value))}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => updateVariant(idx, 'stock', (v.stock || 0) - 1)}
                                                                    className="w-6 h-6 rounded bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200"
                                                                >
                                                                    <Minus size={10} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    className="w-10 text-center bg-transparent outline-none text-xs font-bold dark:text-white"
                                                                    value={v.stock}
                                                                    onChange={e => updateVariant(idx, 'stock', Number(e.target.value))}
                                                                />
                                                                <button
                                                                    onClick={() => updateVariant(idx, 'stock', (v.stock || 0) + 1)}
                                                                    className="w-6 h-6 rounded bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200"
                                                                >
                                                                    <Plus size={10} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <input
                                                                className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 focus:border-ios-blue outline-none text-xs py-1 dark:text-white font-mono uppercase"
                                                                value={v.sku}
                                                                onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-3 text-center align-middle">
                                                            <div className="w-10 h-10 mx-auto">
                                                                <ImageUploader
                                                                    value={v.image || ''}
                                                                    onChange={(url) => updateVariant(idx, 'image', url)}
                                                                    onFileUpload={(file) => handleFileSelect(file, 'variant', idx)}
                                                                    className="h-10 w-10 min-h-0 !p-0 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10"
                                                                    aspectRatio="square"
                                                                    placeholder={<Upload size={14} className="text-gray-400" />}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Cards (Variants) */}
                                    <div className="md:hidden space-y-3 pb-48 mb-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-300 font-medium rounded-xl">
                                            Sede: <b>{currentBranch?.name}</b>
                                        </div>
                                        {formData.variants.map((v, idx) => (
                                            <div key={idx} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5 relative">
                                                <button onClick={() => removeVariant(idx)} className="absolute top-2 right-2 text-red-400 p-2"><Trash2 size={16} /></button>

                                                <div className="flex gap-3 mb-3 pr-8">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-white/5">
                                                        <ImageUploader
                                                            value={v.image || ''}
                                                            onChange={(url) => updateVariant(idx, 'image', url)}
                                                            onFileUpload={(file) => handleFileSelect(file, 'variant', idx)}
                                                            className="h-full w-full !p-0"
                                                            aspectRatio="square"
                                                            placeholder={<Upload size={14} className="text-gray-400" />}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {Object.entries(v.selections).map(([k, val]) => (
                                                                <span key={k} className="text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">{val}</span>
                                                            ))}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 uppercase font-bold block">SKU</label>
                                                            <input
                                                                className="text-xs font-mono uppercase bg-transparent w-full outline-none border-b border-gray-200 dark:border-white/10 dark:text-white"
                                                                value={v.sku}
                                                                onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                                                placeholder="SKU"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-50 dark:border-white/5">
                                                    <div>
                                                        <label className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Precio</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-gray-50 dark:bg-black/20 rounded-lg p-2 text-xs font-bold dark:text-white outline-none"
                                                            value={v.price}
                                                            onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Oferta</label>
                                                        <input
                                                            type="number"
                                                            placeholder="-"
                                                            className="w-full bg-gray-50 dark:bg-black/20 rounded-lg p-2 text-xs font-bold text-red-500 outline-none"
                                                            value={v.salePrice || ''}
                                                            onChange={e => updateVariant(idx, 'salePrice', parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Stock</label>
                                                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-black/20 rounded-lg p-1">
                                                            <button onClick={() => updateVariant(idx, 'stock', (v.stock || 0) - 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-white/10 rounded shadow-sm"><Minus size={10} /></button>
                                                            <input className="flex-1 w-full text-center bg-transparent text-xs font-bold dark:text-white outline-none" value={v.stock} onChange={e => updateVariant(idx, 'stock', Number(e.target.value))} />
                                                            <button onClick={() => updateVariant(idx, 'stock', (v.stock || 0) + 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-white/10 rounded shadow-sm"><Plus size={10} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 bg-white dark:bg-zinc-900 rounded-b-[2rem]">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} className="bg-ios-blue text-white shadow-lg shadow-ios-blue/30 px-8 gap-2">
                        <Save size={18} /> Guardar Producto
                    </Button>
                </div>
            </div>

            {/* CROPPER MODAL OVERLAY */}
            {cropImage && (
                <ImageCropper
                    imageSrc={cropImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setCropImage(null); setCroppingTarget(null); }}
                    aspectRatio={1} // Siempre cuadrado para productos
                />
            )}
        </div>
    );
};
