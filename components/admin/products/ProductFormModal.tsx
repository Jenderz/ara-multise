import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, VariantOption, ProductVariant } from '../../../types';
import { Button, Input, ImageUploader } from '../../UIComponents';
import { ImageCropper } from '../../ImageCropper';
import { api } from '../../../services/api';
import {
    X, Plus, Minus, Trash2, Save, Upload, AlertCircle, Lock, MapPin, Globe,
    Tag, Printer, Camera, Scan, Star, CheckCircle2, Barcode, Layers, Info
} from 'lucide-react';
import { generateId } from '../Shared';
import { useStore } from '../../../context/StoreContext';
import { generateEAN13, renderBarcodeSVG, normalizeToEAN13 } from '../../../utils/barcodeUtils';
import { BarcodePrintModal } from './BarcodePrintModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ProductJewelryFields, calculateJewelryPrice, isJewelryPluginEnabled as checkJewelryPlugin } from '../../../plugins/jewelry';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSave: (p: Product) => void;
    categories: Category[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, product, onSave, categories }) => {
    const { currentBranch, settings, activeExchangeRate, activeCurrencySymbol } = useStore();
    const isJewelryPluginEnabled = checkJewelryPlugin(settings);

    // --- CROPPER STATE ---
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [croppingTarget, setCroppingTarget] = useState<{ type: 'main' | 'variant', index?: number } | null>(null);

    // --- BARCODE SCANNER STATE ---
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanningTarget, setScanningTarget] = useState<{ type: 'main' | 'variant', index?: number } | null>(null);

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
        extraCategories: [],
        isVisible: true,
        isFeatured: false,
        variantOptions: [],
        variants: [],
        createdAt: Date.now()
    });

    const [activeTab, setActiveTab] = useState<'info' | 'variants'>('info');
    const [showBarcodePrint, setShowBarcodePrint] = useState(false);

    // EAN-13: si el usuario ingresó o escaneó uno manualmente, normalizarlo; sino, generarlo al vuelo
    const ean13 = useMemo(() => {
        if (formData.barcodeEan) return normalizeToEAN13(formData.barcodeEan, formData.category, formData.code);
        if (!formData.code || !formData.category) return null;
        return generateEAN13(formData.category, formData.code);
    }, [formData.barcodeEan, formData.code, formData.category]);

    const barcodeSVGPreview = useMemo(() => {
        if (!ean13) return null;
        return renderBarcodeSVG(ean13, { height: 32, moduleWidth: 1.25, showText: true, fontSize: 7.5 });
    }, [ean13]);

    useEffect(() => {
        if (isOpen) {
            if (product) {
                // Al editar, usamos la data ya hidratada (con stock de esta sede)
                setFormData(JSON.parse(JSON.stringify(product)));
            } else {
                setFormData({
                    id: '',
                    code: '',
                    barcodeEan: '',
                    title: '',
                    description: '',
                    cost: 0,
                    price: 0,
                    stock: 0,
                    images: [],
                    category: categories.length > 0 ? categories[0].name : 'General',
                    extraCategories: [],
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
        if (!formData.title?.trim() || !formData.price) {
            alert('Nombre y precio son obligatorios');
            return;
        }

        let cleanedVariants = formData.variants || [];
        let cleanedOptions = formData.variantOptions || [];

        // Si no quedan variantes en la tabla, vaciar completamente las opciones para no dejar variantes fantasma
        if (cleanedVariants.length === 0) {
            cleanedOptions = [];
        } else {
            // Asegurar que las opciones solo contengan valores que realmente existan en las variantes guardadas
            cleanedOptions = cleanedOptions
                .map(opt => ({
                    ...opt,
                    values: opt.values.filter(val => cleanedVariants.some(v => v.selections && v.selections[opt.name] === val))
                }))
                .filter(opt => opt.values.length > 0);
        }

        onSave({
            ...formData,
            variants: cleanedVariants,
            variantOptions: cleanedOptions,
            barcodeEan: formData.barcodeEan?.trim() || ean13 || ''
        });
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
        const optionToRemove = formData.variantOptions[idx];
        const newOptions = formData.variantOptions.filter((_, i) => i !== idx);

        if (newOptions.length === 0) {
            if (window.confirm('Al eliminar todas las opciones, se eliminarán todas las variantes del producto. ¿Deseas continuar?')) {
                setFormData(prev => ({
                    ...prev,
                    variantOptions: [],
                    variants: []
                }));
            }
            return;
        }

        // Depurar la clave de la opción eliminada de las variantes existentes
        const optName = optionToRemove?.name;
        const updatedVariantsMap = new Map<string, ProductVariant>();

        formData.variants.forEach(v => {
            const newSelections = { ...v.selections };
            if (optName && newSelections[optName] !== undefined) {
                delete newSelections[optName];
            }
            const newKey = buildCombinationKey(newSelections);
            if (!updatedVariantsMap.has(newKey)) {
                updatedVariantsMap.set(newKey, {
                    ...v,
                    combinationKey: newKey,
                    selections: newSelections,
                    sku: `${formData.code}-${Object.values(newSelections).join('-')}`
                });
            }
        });

        setFormData(prev => ({
            ...prev,
            variantOptions: newOptions,
            variants: Array.from(updatedVariantsMap.values())
        }));
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

    // Llave canónica de una combinación
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

        const existingMap = new Map<string, ProductVariant>(
            formData.variants.map(v => {
                const key = v.combinationKey ?? buildCombinationKey(v.selections);
                return [key, v];
            })
        );

        const generate = (
            optIdx: number,
            currentSelections: Record<string, string>
        ): ProductVariant[] => {
            if (optIdx === formData.variantOptions.length) {
                const key = buildCombinationKey(currentSelections);
                const existing = existingMap.get(key);

                if (existing) {
                    return [{
                        ...existing,
                        combinationKey: key,
                        sku: `${formData.code}-${Object.values(currentSelections).join('-')}`,
                    }];
                }

                return [{
                    id: generateId(),
                    combinationKey: key,
                    sku: `${formData.code}-${Object.values(currentSelections).join('-')}`,
                    selections: { ...currentSelections },
                    price: formData.price,
                    salePrice: formData.salePrice,
                    stock: 0,
                    branchStock: {},
                    image: ''
                }];
            }

            const option = formData.variantOptions[optIdx];
            if (option.values.length === 0) {
                return generate(optIdx + 1, currentSelections);
            }

            return option.values.reduce<ProductVariant[]>((acc, val) => [
                ...acc,
                ...generate(optIdx + 1, { ...currentSelections, [option.name]: val })
            ], []);
        };

        const mergedVariants = generate(0, {});
        setFormData(prev => ({ ...prev, variants: mergedVariants }));
    };

    const removeVariant = (idx: number) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar esta variante?')) {
            const remainingVariants = formData.variants.filter((_, i) => i !== idx);

            if (remainingVariants.length === 0) {
                setFormData(prev => ({
                    ...prev,
                    variants: [],
                    variantOptions: []
                }));
                return;
            }

            const updatedOptions = formData.variantOptions
                .map(opt => ({
                    ...opt,
                    values: opt.values.filter(val => remainingVariants.some(v => v.selections && v.selections[opt.name] === val))
                }))
                .filter(opt => opt.values.length > 0);

            setFormData(prev => ({
                ...prev,
                variants: remainingVariants,
                variantOptions: updatedOptions
            }));
        }
    };

    const handleClearAllVariants = () => {
        if (window.confirm('¿Deseas eliminar TODAS las variantes y convertir este producto en un producto simple (sin variantes)?')) {
            setFormData(prev => ({
                ...prev,
                variantOptions: [],
                variants: []
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

    // --- GESTIÓN ERGONÓMICA DE IMÁGENES ---
    const handleRemoveImage = (indexToRemove: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== indexToRemove)
        }));
    };

    const handleSetMainImage = (indexToMain: number) => {
        if (indexToMain === 0) return;
        setFormData(prev => {
            const nextImages = [...prev.images];
            const [selected] = nextImages.splice(indexToMain, 1);
            nextImages.unshift(selected);
            return { ...prev, images: nextImages };
        });
    };

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

    // --- ESCÁNER DE CÓDIGO DE BARRAS DE FÁBRICA ---
    const handleOpenScanner = (target: 'main' | 'variant', index?: number) => {
        setScanningTarget({ type: target, index });
        setScannerOpen(true);
    };

    const handleBarcodeDetected = (scannedCode: string) => {
        if (scanningTarget?.type === 'variant' && scanningTarget.index !== undefined) {
            updateVariant(scanningTarget.index, 'barcodeEan', scannedCode);
        } else {
            setFormData(prev => ({
                ...prev,
                barcodeEan: scannedCode
            }));
        }
        setScannerOpen(false);
        setScanningTarget(null);
    };

    return (
        <div className="fixed inset-0 z-[100] flex sm:items-center sm:justify-center bg-black/75 backdrop-blur-md sm:p-4">
            {/* Backdrop click (solo desktop) */}
            <div className="hidden sm:block absolute inset-0" onClick={onClose} />

            {/* Modal Container: Fullscreen en Móvil, Floating Window en Desktop */}
            <div className="bg-white dark:bg-zinc-900 w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl shadow-2xl relative flex flex-col border-0 sm:border sm:border-white/10 overflow-hidden animate-slide-up">

                {/* ── STICKY HEADER ── */}
                <div className="p-4 sm:p-5 border-b border-gray-150 dark:border-white/10 flex justify-between items-center bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 z-20">
                    <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-bold dark:text-white truncate">
                                {product ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                            {formData.barcodeEan && (
                                <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <Barcode size={11} /> Escaneado
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5 mt-0.5 truncate">
                            <MapPin size={12} className={isGlobalView ? 'text-purple-500 shrink-0' : 'text-orange-500 shrink-0'} />
                            <span className="truncate">
                                {isGlobalView
                                    ? 'Editando Maestro Global (Stock Sumado)'
                                    : `Sede: ${currentBranch?.name || 'Principal'}`}
                            </span>
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-white/10 rounded-full transition-colors active:scale-90 shrink-0"
                        title="Cerrar modal"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── SEGMENTED TABS (Móvil First Touch Friendly) ── */}
                <div className="flex border-b border-gray-150 dark:border-white/10 bg-gray-100/50 dark:bg-black/30 p-1.5 sm:p-2 gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98] ${
                            activeTab === 'info'
                                ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Info size={14} />
                        <span>Información General</span>
                        {formData.images.length > 0 && (
                            <span className="bg-gray-200/80 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                {formData.images.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('variants')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98] ${
                            activeTab === 'variants'
                                ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Layers size={14} />
                        <span>Variantes y Stock</span>
                        {formData.variants.length > 0 && (
                            <span className="bg-ios-blue text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                {formData.variants.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── SCROLLABLE CONTENT ── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-black/20 space-y-5 pb-28 sm:pb-6">
                    {activeTab === 'info' ? (
                        <div className="space-y-5">
                            {/* BLOQUE 1: IDENTIFICACIÓN PRINCIPAL */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                    <Tag size={13} /> Datos Principales
                                </h4>

                                <Input
                                    label="Nombre del Producto"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Ej: Camiseta Básica Algodón"
                                    className="text-base"
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <Input
                                        label="Código / SKU"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="Ej: CAM-001"
                                    />

                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1 block mb-1.5">
                                            Categoría Principal
                                        </label>
                                        <select
                                            className="w-full bg-gray-50/70 dark:bg-black/30 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white transition"
                                            value={formData.category}
                                            onChange={e => {
                                                const newPrimary = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    category: newPrimary,
                                                    extraCategories: (prev.extraCategories ?? []).filter(c => c !== newPrimary)
                                                }));
                                            }}
                                        >
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Multi-Categoría Adicional */}
                                {categories.length > 1 && (
                                    <div className="pt-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1 block mb-1.5">
                                            También visible en categorías
                                            {(formData.extraCategories ?? []).length > 0 && (
                                                <span className="ml-2 bg-ios-blue text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                                                    +{(formData.extraCategories ?? []).length}
                                                </span>
                                            )}
                                        </label>
                                        <div className="bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-2xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
                                            {categories
                                                .filter(c => c.name !== formData.category)
                                                .map(c => {
                                                    const isChecked = (formData.extraCategories ?? []).includes(c.name);
                                                    return (
                                                        <label
                                                            key={c.id}
                                                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors select-none ${
                                                                isChecked
                                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                                    : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 accent-blue-600 rounded"
                                                                checked={isChecked}
                                                                onChange={e => {
                                                                    const extras = formData.extraCategories ?? [];
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        extraCategories: e.target.checked
                                                                            ? [...extras, c.name]
                                                                            : extras.filter(x => x !== c.name)
                                                                    }));
                                                                }}
                                                            />
                                                            <span className={`text-xs font-medium ${
                                                                isChecked ? 'text-ios-blue dark:text-blue-300 font-bold' : 'dark:text-gray-300'
                                                            }`}>
                                                                {c.name}
                                                            </span>
                                                        </label>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* BLOQUE 2: CÓDIGO DE BARRAS DE FÁBRICA / ESCÁNER CÁMARA */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <Barcode size={15} /> Código de Barras / Fábrica
                                    </label>
                                    {formData.barcodeEan ? (
                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Código de Fábrica Asignado
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            Se autogenera EAN-13 si se deja vacío
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={formData.barcodeEan || ''}
                                            onChange={e => setFormData({ ...formData, barcodeEan: e.target.value })}
                                            placeholder="Escanea o ingresa el código del empaque..."
                                            className="w-full bg-gray-50/70 dark:bg-black/30 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm font-mono dark:text-white transition pr-9"
                                        />
                                        {formData.barcodeEan && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, barcodeEan: '' })}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-1 transition"
                                                title="Limpiar código para usar autogenerado"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                    </div>

                                    {/* BOTÓN ESCANEAR CON CÁMARA */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenScanner('main')}
                                        className="px-3.5 sm:px-4 py-3 bg-ios-blue hover:bg-blue-600 text-white rounded-2xl transition-all shadow-md shadow-blue-500/20 font-bold text-xs flex items-center gap-1.5 active:scale-95 shrink-0"
                                        title="Escanear código de barras con la cámara del celular"
                                    >
                                        <Camera size={16} />
                                        <span className="hidden xs:inline">Escanear</span>
                                    </button>
                                </div>

                                {/* Preview EAN-13 inline con botón de imprimir */}
                                {ean13 && barcodeSVGPreview && (
                                    <div className="bg-gray-50 dark:bg-black/30 border border-gray-150 dark:border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3">
                                        <div
                                            className="flex-1 overflow-hidden flex items-center justify-center max-w-[220px] sm:max-w-none"
                                            dangerouslySetInnerHTML={{ __html: barcodeSVGPreview }}
                                        />
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-widest font-bold">
                                                {ean13}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowBarcodePrint(true)}
                                                className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors active:scale-95"
                                            >
                                                <Printer size={12} /> Imprimir
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* PLUGIN JOYERÍA: Campos de peso y metal si está activo */}
                            {isJewelryPluginEnabled && (
                                <ProductJewelryFields
                                    formData={formData}
                                    onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
                                    metalRates={settings?.jewelry_metal_rates}
                                    exchangeRate={activeExchangeRate}
                                    activeCurrencySymbol={activeCurrencySymbol}
                                />
                            )}

                            {/* BLOQUE 3: PRECIOS Y STOCK (Ergonomía Móvil) */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Precios e Inventario
                                </h4>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <Input
                                            label={isJewelryPluginEnabled && formData.pricingType === 'by_weight' ? "Precio ($) [Auto]" : "Precio Venta ($)"}
                                            type="number"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            disabled={isJewelryPluginEnabled && formData.pricingType === 'by_weight'}
                                        />
                                    </div>

                                    <div className="col-span-1">
                                        <Input
                                            label="Oferta ($)"
                                            type="number"
                                            value={formData.salePrice || ''}
                                            onChange={e => handleGlobalSalePriceChange(parseFloat(e.target.value))}
                                            placeholder="Opcional"
                                        />
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <Input
                                            label="Costo ($)"
                                            type="number"
                                            value={formData.cost}
                                            onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                {/* Control de Stock */}
                                <div className={`bg-gray-50 dark:bg-black/30 p-4 rounded-2xl border border-gray-100 dark:border-white/5 ${hasVariants ? 'opacity-80 pointer-events-none' : ''}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">
                                            Stock {isGlobalView ? 'Total Global' : currentBranch?.name}
                                        </label>
                                        <span className="text-xs font-mono text-gray-400">Unidades</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-xs">
                                        <button
                                            type="button"
                                            disabled={hasVariants}
                                            onClick={() => setFormData({ ...formData, stock: Math.max(0, (formData.stock || 0) - 1) })}
                                            className="w-12 h-12 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-white rounded-xl shadow-xs hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-40 active:scale-90 transition border border-black/5 dark:border-white/5"
                                            title="Restar 1 unidad"
                                        >
                                            <Minus size={20} className="stroke-[2.5]" />
                                        </button>
                                        <div className="flex-1 min-w-0 flex items-center justify-center">
                                            <input
                                                type="number"
                                                disabled={hasVariants}
                                                className="w-full text-center bg-transparent text-2xl sm:text-3xl font-black outline-none dark:text-white disabled:opacity-50 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={formData.stock}
                                                onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={hasVariants}
                                            onClick={() => setFormData({ ...formData, stock: (formData.stock || 0) + 1 })}
                                            className="w-12 h-12 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center bg-ios-blue text-white rounded-xl shadow-md shadow-ios-blue/20 hover:bg-blue-600 disabled:opacity-40 active:scale-90 transition"
                                            title="Sumar 1 unidad"
                                        >
                                            <Plus size={20} className="stroke-[2.5]" />
                                        </button>
                                    </div>
                                    {hasVariants && (
                                        <p className="text-[11px] text-ios-blue font-bold mt-2.5 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
                                            <Lock size={13} /> Stock sincronizado automáticamente con la suma de variantes.
                                        </p>
                                    )}
                                    {product?.globalStock !== undefined && !isGlobalView && (
                                        <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                                            <Globe size={13} /> Existencia Global en todas las sedes: {product.globalStock} u.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* BLOQUE 4: GESTIÓN DE IMÁGENES (MOBILE-FIRST SENIOR) */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Galería de Fotos ({formData.images.length})
                                    </label>
                                    <span className="text-[11px] text-gray-400">
                                        La 1ª foto es la portada
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {formData.images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${
                                                idx === 0
                                                    ? 'border-ios-blue shadow-md shadow-ios-blue/10 ring-2 ring-ios-blue/20'
                                                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                            }`}
                                        >
                                            <img
                                                src={img}
                                                alt={`Producto ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />

                                            {/* Badge Portada */}
                                            {idx === 0 && (
                                                <span className="absolute top-2 left-2 bg-ios-blue text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md pointer-events-none z-10">
                                                    <Star size={10} className="fill-white" /> Portada
                                                </span>
                                            )}

                                            {/* BARRA DE ACCIONES TÁCTILES: Visible en móvil siempre */}
                                            <div className="absolute inset-0 bg-black/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 pointer-events-none">
                                                <div className="flex justify-between items-center w-full pointer-events-auto">
                                                    {/* Botón Convertir en Portada */}
                                                    {idx > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetMainImage(idx)}
                                                            className="bg-black/75 hover:bg-ios-blue text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md transition shadow flex items-center gap-1 active:scale-95"
                                                            title="Convertir en portada principal"
                                                        >
                                                            <Star size={10} /> Portada
                                                        </button>
                                                    ) : <div />}

                                                    {/* BOTÓN ELIMINAR FOTO: Ergonómico, Visible y Táctil */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveImage(idx);
                                                        }}
                                                        className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
                                                        title="Eliminar imagen"
                                                        aria-label="Eliminar imagen"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Cuadro de Carga de Nueva Foto */}
                                    <div className="aspect-square">
                                        <ImageUploader
                                            value=""
                                            onChange={url => setFormData({ ...formData, images: [...formData.images, url] })}
                                            onFileUpload={(file) => handleFileSelect(file, 'main')}
                                            placeholder={
                                                <div className="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-zinc-500">
                                                    <Plus size={26} />
                                                    <span className="text-[11px] font-bold">Añadir foto</span>
                                                </div>
                                            }
                                            aspectRatio="square"
                                            className="h-full rounded-2xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 5: DESCRIPCIÓN Y VISIBILIDAD */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase ml-1">
                                        Descripción del Producto
                                    </label>
                                    <textarea
                                        className="w-full bg-gray-50/70 dark:bg-black/30 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[110px] transition"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Escribe detalles, materiales, garantía o especificaciones..."
                                    />
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 dark:bg-black/30 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <div>
                                        <span className="text-sm font-bold dark:text-white block">Visible en Tienda Online</span>
                                        <span className="text-xs text-gray-400">Si está desactivado, solo aparecerá en el inventario interno / POS.</span>
                                    </div>
                                    <div
                                        onClick={() => setFormData({ ...formData, isVisible: !formData.isVisible })}
                                        className={`w-13 h-7 rounded-full p-1 cursor-pointer transition-colors shrink-0 ${formData.isVisible ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${formData.isVisible ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* PESTAÑA: VARIANTES Y STOCK */
                        <div className="space-y-5">
                            {/* Generador de Opciones */}
                            <div className="bg-white dark:bg-zinc-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-150 dark:border-white/5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Configuración de Atributos
                                    </h4>
                                    <span className="text-[11px] text-gray-400">
                                        Ej: Talla, Color, Material
                                    </span>
                                </div>

                                {formData.variantOptions.map((opt, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-2.5 p-3.5 bg-gray-50 dark:bg-black/30 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <input
                                            className="bg-transparent font-bold text-sm outline-none w-full sm:w-36 dark:text-white border-b border-gray-200 dark:border-white/10 sm:border-b-0 pb-1 sm:pb-0"
                                            placeholder="Nombre (Ej: Talla)"
                                            value={opt.name}
                                            onChange={e => updateOption(idx, 'name', e.target.value)}
                                        />
                                        <div className="hidden sm:block h-6 w-[1px] bg-gray-300 dark:bg-zinc-700 self-center" />
                                        <input
                                            className="flex-1 bg-transparent text-sm outline-none dark:text-gray-300"
                                            placeholder="Valores separados por coma (S, M, L, XL...)"
                                            value={opt.values.join(', ')}
                                            onChange={e => updateOption(idx, 'values', e.target.value.split(',').map(v => v.trim()))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeOption(idx)}
                                            className="text-red-400 hover:text-red-600 p-1 self-end sm:self-center transition"
                                            title="Eliminar atributo"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}

                                <div className="flex gap-2.5 items-center flex-wrap pt-1">
                                    <Button variant="secondary" onClick={addOption} className="text-xs h-10 px-4">
                                        <Plus size={14} className="mr-1" /> Agregar Opción
                                    </Button>
                                    <Button onClick={generateVariants} className="text-xs h-10 bg-ios-blue text-white px-4">
                                        {formData.variantOptions.length === 0 ? 'Limpiar Variantes' : 'Generar Combinaciones'}
                                    </Button>
                                    {(formData.variants.length > 0 || formData.variantOptions.length > 0) && (
                                        <button
                                            type="button"
                                            onClick={handleClearAllVariants}
                                            className="text-xs h-10 px-3.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold flex items-center gap-1.5 transition ml-auto"
                                            title="Eliminar todas las variantes y opciones"
                                        >
                                            <Trash2 size={13} /> Limpiar Todo
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* LISTADO DE VARIANTES */}
                            {formData.variants.length > 0 && (
                                <>
                                    {/* ── MOBILE CARDS (Variantes en Teléfonos Móviles) ── */}
                                    <div className="md:hidden space-y-3.5">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 font-medium rounded-2xl flex items-center gap-1.5">
                                            <MapPin size={13} /> Editando inventario de: <b>{currentBranch?.name || 'Sede'}</b>
                                        </div>

                                        {formData.variants.map((v, idx) => (
                                            <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-150 dark:border-white/5 shadow-sm space-y-3 relative">
                                                <div className="flex items-start justify-between gap-2 pr-8">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(v.selections).map(([k, val]) => (
                                                            <span key={k} className="text-xs bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-lg text-gray-700 dark:text-gray-200 font-bold">
                                                                {val}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeVariant(idx)}
                                                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                                        title="Eliminar variante"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-white/10">
                                                        <ImageUploader
                                                            value={v.image || ''}
                                                            onChange={(url) => updateVariant(idx, 'image', url)}
                                                            onFileUpload={(file) => handleFileSelect(file, 'variant', idx)}
                                                            className="h-full w-full !p-0"
                                                            aspectRatio="square"
                                                            placeholder={<Upload size={14} className="text-gray-400" />}
                                                        />
                                                    </div>

                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 uppercase font-bold block">SKU</label>
                                                            <input
                                                                className="text-xs font-mono uppercase bg-transparent w-full outline-none border-b border-gray-200 dark:border-white/10 dark:text-white py-0.5"
                                                                value={v.sku}
                                                                onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                                                placeholder="SKU"
                                                            />
                                                        </div>

                                                        {/* ESCANEAR BARCODE EN VARIANTE MÓVIL */}
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-gray-400 uppercase font-bold flex items-center justify-between">
                                                                <span>Barcode</span>
                                                                {v.barcodeEan && <span className="text-emerald-500 font-bold text-[8px]">✓ Fábrica</span>}
                                                            </label>
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    className="text-xs font-mono bg-transparent w-full outline-none border-b border-gray-200 dark:border-white/10 dark:text-white py-0.5"
                                                                    value={v.barcodeEan || ''}
                                                                    onChange={e => updateVariant(idx, 'barcodeEan', e.target.value)}
                                                                    placeholder="Auto"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenScanner('variant', idx)}
                                                                    className="p-1.5 text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition shrink-0 active:scale-90"
                                                                    title="Escanear con cámara"
                                                                >
                                                                    <Camera size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Precios y Stock de la variante (Mobile-First Ergonomía) */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-gray-150 dark:border-white/5 items-end">
                                                    <div>
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Precio ($)</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-gray-50 dark:bg-black/30 rounded-xl p-2.5 text-xs font-bold dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-gray-150 dark:border-white/5 focus:border-ios-blue"
                                                            value={v.price}
                                                            onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Oferta ($)</label>
                                                        <input
                                                            type="number"
                                                            placeholder="-"
                                                            className="w-full bg-gray-50 dark:bg-black/30 rounded-xl p-2.5 text-xs font-bold text-red-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-gray-150 dark:border-white/5 focus:border-ios-blue placeholder-gray-400"
                                                            value={v.salePrice || ''}
                                                            onChange={e => updateVariant(idx, 'salePrice', parseFloat(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Stock (Unidades)</label>
                                                        <div className="flex items-center justify-between gap-1.5 bg-gray-50 dark:bg-black/30 rounded-xl p-1 border border-gray-150 dark:border-white/5">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateVariant(idx, 'stock', Math.max(0, (v.stock || 0) - 1))}
                                                                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center bg-white dark:bg-zinc-800 rounded-lg shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 active:scale-90 transition border border-black/5 dark:border-white/10"
                                                                title="Restar 1 unidad"
                                                            >
                                                                <Minus size={14} className="stroke-[2.5]" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                className="flex-1 w-0 min-w-0 text-center bg-transparent text-sm sm:text-xs font-black dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-1"
                                                                value={v.stock}
                                                                onChange={e => updateVariant(idx, 'stock', Number(e.target.value) || 0)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateVariant(idx, 'stock', (v.stock || 0) + 1)}
                                                                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center bg-white dark:bg-zinc-800 text-ios-blue dark:text-blue-400 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-zinc-700 active:scale-90 transition border border-black/5 dark:border-white/10"
                                                                title="Sumar 1 unidad"
                                                            >
                                                                <Plus size={14} className="stroke-[2.5]" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── DESKTOP TABLE (Variantes en Pantallas Grandes) ── */}
                                    <div className="hidden md:block border border-gray-150 dark:border-white/5 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 font-medium">
                                            <b>Sede Activa:</b> Estás editando el inventario de <b>{currentBranch?.name || 'Sede Principal'}</b>.
                                        </div>
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-white/5 text-[10px] text-gray-500 uppercase font-bold">
                                                <tr>
                                                    <th className="p-3 w-10 text-center"></th>
                                                    <th className="p-3">Variante</th>
                                                    {isJewelryPluginEnabled && formData.pricingType === 'by_weight' && (
                                                        <th className="p-3 w-20 text-amber-600 dark:text-amber-400">Peso (g)</th>
                                                    )}
                                                    <th className="p-3 w-20">Precio</th>
                                                    <th className="p-3 w-20">Oferta</th>
                                                    <th className="p-3 w-28">Stock Local</th>
                                                    <th className="p-3 w-24">SKU</th>
                                                    <th className="p-3 w-32">Barcode / Fábrica</th>
                                                    <th className="p-3 w-16 text-center">Imagen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {formData.variants.map((v, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="p-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeVariant(idx)}
                                                                className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {Object.entries(v.selections).map(([k, val]) => (
                                                                    <span key={k} className="text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 font-medium">
                                                                        {val}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        {isJewelryPluginEnabled && formData.pricingType === 'by_weight' && (
                                                            <td className="p-3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    placeholder="0.00"
                                                                    className="w-full bg-transparent border-b border-amber-300 dark:border-amber-500/30 focus:border-amber-500 outline-none text-xs py-1 dark:text-white font-mono"
                                                                    value={v.weightGram || ''}
                                                                    onChange={e => {
                                                                        const w = Math.max(0, parseFloat(e.target.value) || 0);
                                                                        const newP = calculateJewelryPrice({
                                                                            weightGram: w,
                                                                            metalType: formData.metalType,
                                                                            rates: settings?.jewelry_metal_rates,
                                                                            makingCost: formData.makingCost,
                                                                            makingCostType: formData.makingCostType
                                                                        });
                                                                        const updated = [...formData.variants];
                                                                        updated[idx] = { ...v, weightGram: w, price: newP };
                                                                        setFormData({ ...formData, variants: updated });
                                                                    }}
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="p-3">
                                                            <input
                                                                type="number"
                                                                disabled={isJewelryPluginEnabled && formData.pricingType === 'by_weight' && (v.weightGram ?? 0) > 0}
                                                                className={`w-full bg-transparent border-b border-gray-200 dark:border-white/10 focus:border-ios-blue outline-none text-xs py-1 dark:text-white font-mono ${isJewelryPluginEnabled && formData.pricingType === 'by_weight' && (v.weightGram ?? 0) > 0 ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                                                            <div className="flex items-center gap-1 bg-gray-50 dark:bg-black/30 rounded-lg p-1 border border-gray-150 dark:border-white/5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateVariant(idx, 'stock', Math.max(0, (v.stock || 0) - 1))}
                                                                    className="w-6 h-6 shrink-0 rounded bg-white dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 active:scale-90 transition"
                                                                >
                                                                    <Minus size={11} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    className="w-10 text-center bg-transparent outline-none text-xs font-bold dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    value={v.stock}
                                                                    onChange={e => updateVariant(idx, 'stock', Number(e.target.value) || 0)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateVariant(idx, 'stock', (v.stock || 0) + 1)}
                                                                    className="w-6 h-6 shrink-0 rounded bg-white dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 active:scale-90 transition"
                                                                >
                                                                    <Plus size={11} />
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
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 focus:border-ios-blue outline-none text-xs py-1 dark:text-white font-mono"
                                                                    value={v.barcodeEan || ''}
                                                                    placeholder="Auto"
                                                                    onChange={e => updateVariant(idx, 'barcodeEan', e.target.value)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenScanner('variant', idx)}
                                                                    className="p-1 text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                                                    title="Escanear con cámara"
                                                                >
                                                                    <Camera size={13} />
                                                                </button>
                                                            </div>
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
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── STICKY FOOTER (Siempre visible y al alcance del pulgar) ── */}
                <div className="p-3.5 sm:p-4 border-t border-gray-150 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="px-4 sm:px-6 text-sm h-11 active:scale-95"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-ios-blue hover:bg-blue-600 text-white shadow-lg shadow-ios-blue/30 px-6 sm:px-8 h-11 gap-2 font-bold flex-1 sm:flex-initial active:scale-95 transition"
                    >
                        <Save size={18} />
                        <span>Guardar</span>
                    </Button>
                </div>
            </div>

            {/* MODAL ESCÁNER DE CÓDIGO DE BARRAS */}
            {scannerOpen && (
                <BarcodeScannerModal
                    isOpen={scannerOpen}
                    onClose={() => {
                        setScannerOpen(false);
                        setScanningTarget(null);
                    }}
                    onScan={handleBarcodeDetected}
                    title={scanningTarget?.type === 'variant' ? 'Escanear Código de Variante' : 'Escanear Código del Producto'}
                    subtitle="Apunta la cámara al código de barras de fábrica"
                />
            )}

            {/* CROPPER MODAL OVERLAY */}
            {cropImage && (
                <ImageCropper
                    imageSrc={cropImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setCropImage(null); setCroppingTarget(null); }}
                    aspectRatio={1}
                />
            )}

            {/* BARCODE PRINT MODAL */}
            {showBarcodePrint && ean13 && (
                <BarcodePrintModal
                    isOpen={showBarcodePrint}
                    onClose={() => setShowBarcodePrint(false)}
                    product={formData as Product}
                />
            )}
        </div>
    );
};
