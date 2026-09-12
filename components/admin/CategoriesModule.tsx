import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, Input, Button, ImageUploader } from '../UIComponents';
import { generateId } from './Shared';
import { Plus, Trash2, Package, Edit2, Save, ZoomIn, ZoomOut, RotateCcw, Check, X, Move, Crop, Sparkles } from 'lucide-react';
import { Category, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';

// ─── Modal de Recorte Cuadrado 1:1 Responsivo y Táctil ────────────────────────
interface CropModalProps {
    imageSrc: string;
    onConfirm: (croppedDataUrl: string, file: File) => void;
    onCancel: () => void;
}

const CategoryCropModal: React.FC<CropModalProps> = ({ imageSrc, onConfirm, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imgLoaded, setImgLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Tamaño de recorte responsivo para garantizar que nunca desborde teléfonos móviles
    const [cropSize, setCropSize] = useState(() => {
        if (typeof window === 'undefined') return 280;
        return Math.max(220, Math.min(window.innerWidth - 64, 320));
    });

    useEffect(() => {
        const updateSize = () => {
            setCropSize(Math.max(220, Math.min(window.innerWidth - 64, 320)));
        };
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Cargar imagen y calcular zoom inicial para cubrir el cuadro responsivo
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            const initialZoom = Math.max(cropSize / img.naturalWidth, cropSize / img.naturalHeight);
            setZoom(initialZoom);
            setOffset({ x: 0, y: 0 });
            setImgLoaded(true);
        };
        img.src = imageSrc;
    }, [imageSrc, cropSize]);

    // Re-dibujar canvas en cada cambio de zoom, offset o tamaño de recorte
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = imgRef.current;
        canvas.width = cropSize;
        canvas.height = cropSize;
        ctx.clearRect(0, 0, cropSize, cropSize);
        const drawW = img.naturalWidth * zoom;
        const drawH = img.naturalHeight * zoom;
        const drawX = (cropSize - drawW) / 2 + offset.x;
        const drawY = (cropSize - drawH) / 2 + offset.y;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }, [imgLoaded, zoom, offset, cropSize]);

    // Pointer events táctiles para arrastre fluido
    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handlePointerUp = () => setIsDragging(false);

    // Zoom con rueda del mouse
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(prev => Math.max(0.1, Math.min(prev + (e.deltaY > 0 ? -0.05 : 0.05), 5)));
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.1));
    const handleReset = () => {
        if (!imgRef.current) return;
        setZoom(Math.max(cropSize / imgRef.current.naturalWidth, cropSize / imgRef.current.naturalHeight));
        setOffset({ x: 0, y: 0 });
    };

    // Exportar canvas recortado como WebP de alta resolución (500x500 HD)
    const handleConfirm = async () => {
        if (!canvasRef.current || !imgRef.current) return;
        setIsSaving(true);
        try {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = 500;
            exportCanvas.height = 500;
            const expCtx = exportCanvas.getContext('2d');

            if (expCtx) {
                expCtx.imageSmoothingEnabled = true;
                expCtx.imageSmoothingQuality = 'high';
                expCtx.drawImage(canvasRef.current, 0, 0, cropSize, cropSize, 0, 0, 500, 500);
            }

            const dataUrl = exportCanvas.toDataURL('image/webp', 0.88);
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `cat_cover_${Date.now()}.webp`, { type: 'image/webp' });
            onConfirm(dataUrl, file);
        } catch {
            alert('Error al procesar la imagen. Intenta de nuevo.');
            setIsSaving(false);
        }
    };

    const cornerClasses = [
        'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
        'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
        'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
    ];

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-white/10 w-full max-w-sm overflow-hidden flex flex-col my-auto animate-scale-up">

                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crop size={18} className="text-ios-blue shrink-0" />
                        <h3 className="font-bold text-sm sm:text-base dark:text-white">Encuadrar Portada (1:1)</h3>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full dark:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-3 p-4 sm:p-5">
                    <p className="text-[11px] text-gray-400 text-center flex items-center gap-1.5">
                        <Move size={12} /> Desliza para centrar · Usa el slider para zoom
                    </p>

                    {/* Área de previsualización cuadrada responsiva */}
                    <div
                        className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-ios-blue bg-gray-100 dark:bg-zinc-800 touch-none select-none"
                        style={{ width: cropSize, height: cropSize, cursor: isDragging ? 'grabbing' : 'grab' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                    >
                        <canvas
                            ref={canvasRef}
                            style={{ width: cropSize, height: cropSize, display: 'block', userSelect: 'none', touchAction: 'none' }}
                        />
                        {/* Guías de tercios */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                                                  linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                                backgroundSize: `${cropSize / 3}px ${cropSize / 3}px`,
                            }}
                        />
                        {/* Marcadores de esquina */}
                        {cornerClasses.map((cls, i) => (
                            <div key={i} className={`absolute w-5 h-5 border-ios-blue pointer-events-none ${cls}`} />
                        ))}
                    </div>

                    {/* Controles de zoom táctiles */}
                    <div className="flex items-center gap-2 w-full bg-gray-100 dark:bg-white/5 rounded-2xl p-2">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-600 dark:text-gray-300 active:scale-95 shrink-0"
                            title="Reducir"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <input
                            type="range" min={10} max={500} step={1}
                            value={Math.round(zoom * 100)}
                            onChange={e => setZoom(Number(e.target.value) / 100)}
                            className="flex-1 accent-ios-blue h-2"
                        />
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-600 dark:text-gray-300 active:scale-95 shrink-0"
                            title="Ampliar"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-400 active:scale-95 shrink-0"
                            title="Restablecer"
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>
                </div>

                {/* Acciones */}
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 flex gap-2 sm:gap-3">
                    <Button variant="secondary" onClick={onCancel} className="flex-1 text-xs py-2.5 rounded-xl font-bold" disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} className="flex-[2] gap-2 text-xs py-2.5 rounded-xl font-bold shadow-md" loading={isSaving}>
                        <Check size={16} /> Aplicar y Subir
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal Táctil de Edición / Creación Rápida (Óptimo para Móviles y Desktop) ─
interface EditModalProps {
    isOpen: boolean;
    category: Category | null;
    isCreating: boolean;
    name: string;
    setName: (n: string) => void;
    img: string;
    setImg: (i: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onFileSelect: (file: File) => void;
    isUploading: boolean;
    isSubmitting: boolean;
}

const CategoryEditModal: React.FC<EditModalProps> = ({
    isOpen,
    category,
    isCreating,
    name,
    setName,
    img,
    setImg,
    onSave,
    onCancel,
    onFileSelect,
    isUploading,
    isSubmitting
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Modal */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center font-black">
                            <Package size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base dark:text-white">
                                {isCreating ? 'Nueva Categoría' : `Editar: ${category?.name || 'Categoría'}`}
                            </h3>
                            <p className="text-[11px] text-gray-400">
                                {isCreating ? 'Crea una categoría para agrupar productos' : 'Actualiza el nombre o la foto de portada'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full dark:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Contenido Scrollable */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Campo Nombre */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                            Nombre de la Categoría
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Calzado, Accesorios, Temporada..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-base dark:text-white outline-none focus:ring-2 focus:ring-ios-blue/30 font-medium transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Portada 1:1 con controles táctiles siempre visibles */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                Imagen de Portada (1:1)
                            </label>
                            {img && (
                                <span className="text-[10px] font-bold text-ios-blue bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/30">
                                    Encuadre Cuadrado Activo
                                </span>
                            )}
                        </div>

                        {img ? (
                            <div className="relative aspect-square w-48 sm:w-56 mx-auto rounded-3xl overflow-hidden border-2 border-ios-blue/40 shadow-xl group bg-zinc-900">
                                <img src={img} alt="Portada" className="w-full h-full object-cover" />

                                {/* Barra de acciones táctil fija y visible siempre en móvil */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 flex items-center justify-center gap-3">
                                    <label
                                        className="p-3 bg-ios-blue text-white rounded-2xl cursor-pointer hover:bg-blue-600 active:scale-95 transition shadow-lg flex items-center justify-center"
                                        title="Cambiar imagen"
                                    >
                                        <Edit2 size={16} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) onFileSelect(f);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setImg('')}
                                        className="p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 active:scale-95 transition shadow-lg flex items-center justify-center"
                                        title="Quitar imagen"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-white/15 hover:border-ios-blue rounded-3xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-white/5 active:scale-[0.99]"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) onFileSelect(f);
                                        e.target.value = '';
                                    }}
                                />
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-2 py-4 text-ios-blue">
                                        <div className="w-8 h-8 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs font-bold">Procesando y Subiendo...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-ios-blue flex items-center justify-center shadow-sm">
                                            <Crop size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-white mt-1">
                                            Subir foto de portada
                                        </p>
                                        <p className="text-xs text-gray-400 max-w-xs">
                                            Toca para elegir desde tu galería o cámara. Podrás encuadrarla en formato 1:1.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Botones Fijos */}
                <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-black/20 flex gap-3 shrink-0">
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        className="flex-1 py-3 text-sm rounded-xl font-bold"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={onSave}
                        className="flex-[2] py-3 text-sm rounded-xl font-bold gap-2 shadow-lg"
                        loading={isSubmitting}
                    >
                        <Save size={18} /> {isCreating ? 'Guardar Categoría' : 'Actualizar Cambios'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Módulo Principal de Categorías ──────────────────────────────────────────
export const CategoriesModule = ({ categories, products, addCategory, updateCategory, deleteCategory }: any) => {
    const { userRole, currentUser } = useStore();
    const [name, setName] = useState('');
    const [img, setImg] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado del modal táctil de edición
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeEditingCategory, setActiveEditingCategory] = useState<Category | null>(null);
    const [isCreatingInModal, setIsCreatingInModal] = useState(false);

    // Estado del flujo de recorte
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const safeCategories = Array.isArray(categories) ? categories : [];

    // Permisos ampliados para administradores y encargados
    const canManage = userRole === 'admin' ||
        currentUser?.role === 'admin' ||
        currentUser?.role === 'master' ||
        (Array.isArray(currentUser?.permissions) && currentUser.permissions.includes('products_manage'));

    // Interceptar archivo → FileReader → modal de recorte
    const handleFileSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) setCropSrc(e.target.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Después del recorte: subir el webp recortado al servidor
    const handleCropConfirm = async (_dataUrl: string, croppedFile: File) => {
        setIsUploading(true);
        try {
            const url = await api.uploadImage(croppedFile);
            setImg(url);
        } catch {
            alert('Error al subir la imagen. Intenta de nuevo.');
        } finally {
            setCropSrc(null);
            setIsUploading(false);
        }
    };

    // Guardar desde el formulario superior o modal
    const handleSave = () => {
        if (isSubmitting) return;
        if (!name.trim()) {
            alert('El nombre de la categoría es obligatorio.');
            return;
        }

        setIsSubmitting(true);
        setTimeout(() => {
            if (editingId) {
                updateCategory({ id: editingId, name: name.trim(), image: img });
                setEditingId(null);
            } else {
                if (safeCategories.some((c: Category) => c.name.toLowerCase() === name.trim().toLowerCase())) {
                    alert('Ya existe una categoría con ese nombre.');
                    setIsSubmitting(false);
                    return;
                }
                addCategory({
                    id: generateId(),
                    name: name.trim(),
                    image: img || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80'
                });
            }
            setName('');
            setImg('');
            setIsEditModalOpen(false);
            setActiveEditingCategory(null);
            setIsCreatingInModal(false);
            setTimeout(() => setIsSubmitting(false), 500);
        }, 50);
    };

    // Abrir editor modal táctil para editar una categoría específica
    const handleStartEdit = (cat: Category) => {
        setEditingId(cat.id);
        setActiveEditingCategory(cat);
        setName(cat.name);
        setImg(cat.image || '');
        setIsCreatingInModal(false);
        setIsEditModalOpen(true);
    };

    // Abrir editor modal táctil para crear una nueva categoría
    const handleStartCreate = () => {
        setEditingId(null);
        setActiveEditingCategory(null);
        setName('');
        setImg('');
        setIsCreatingInModal(true);
        setIsEditModalOpen(true);
    };

    const handleCancel = () => {
        setEditingId(null);
        setActiveEditingCategory(null);
        setName('');
        setImg('');
        setIsEditModalOpen(false);
        setIsCreatingInModal(false);
    };

    const handleDelete = (cat: Category) => {
        if (window.confirm(`¿Eliminar la categoría "${cat.name}"? Los productos asociados se conservarán en el catálogo general.`)) {
            deleteCategory(cat.id);
            if (editingId === cat.id) {
                handleCancel();
            }
        }
    };

    return (
        <>
            {/* Modal de recorte 1:1 responsivo */}
            {cropSrc && (
                <CategoryCropModal
                    imageSrc={cropSrc}
                    onConfirm={handleCropConfirm}
                    onCancel={() => setCropSrc(null)}
                />
            )}

            {/* Modal Táctil de Edición / Creación Rápida */}
            <CategoryEditModal
                isOpen={isEditModalOpen}
                category={activeEditingCategory}
                isCreating={isCreatingInModal}
                name={name}
                setName={setName}
                img={img}
                setImg={setImg}
                onSave={handleSave}
                onCancel={handleCancel}
                onFileSelect={handleFileSelect}
                isUploading={isUploading}
                isSubmitting={isSubmitting}
            />

            <div className="space-y-6">
                {/* Header con botón para Móvil */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white">Gestión de Categorías</h2>
                        <p className="text-xs text-gray-500">
                            {safeCategories.length} categorías registradas • Organiza el catálogo y menús de la tienda.
                        </p>
                    </div>

                    {canManage && (
                        <Button
                            type="button"
                            onClick={handleStartCreate}
                            className="w-full sm:w-auto gap-2 py-3 px-5 rounded-2xl font-bold shadow-lg flex items-center justify-center"
                        >
                            <Plus size={18} /> Nueva Categoría
                        </Button>
                    )}
                </div>

                {/* Formulario rápido de escritorio (oculto en móvil para mantener la vista despejada y limpia) */}
                {canManage && (
                    <Card className="hidden sm:block p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <Sparkles size={16} className="text-ios-blue" />
                                {editingId ? 'Editando Categoría en Línea' : 'Creación Rápida de Categoría'}
                            </h3>
                            {editingId && (
                                <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold">
                                    Cancelar Edición
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {/* Campo nombre */}
                            <Input
                                label="Nombre de Categoría"
                                placeholder="Ej: Verano, Calzado..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                                disabled={isSubmitting}
                            />

                            {/* Uploader con recorte cuadrado */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-ios-subtext uppercase tracking-wide ml-1">
                                    Imagen de Portada (1:1)
                                </label>

                                {img ? (
                                    <div className="relative aspect-square w-24 h-24 rounded-2xl overflow-hidden border-2 border-ios-blue/30 group shadow-sm bg-zinc-900">
                                        <img src={img} alt="Portada" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <label
                                                className="p-2 bg-ios-blue text-white rounded-full cursor-pointer hover:bg-blue-600 transition shadow-lg"
                                                title="Cambiar imagen"
                                            >
                                                <Edit2 size={13} />
                                                <input
                                                    type="file" accept="image/*" className="hidden"
                                                    onChange={e => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleFileSelect(f);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                            <button
                                                type="button" onClick={() => setImg('')}
                                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
                                                title="Quitar imagen"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <ImageUploader
                                        label=""
                                        value=""
                                        onChange={setImg}
                                        aspectRatio="square"
                                        onFileUpload={handleFileSelect}
                                        placeholder={
                                            isUploading ? (
                                                <div className="flex flex-col items-center gap-1 text-ios-blue py-1">
                                                    <div className="w-5 h-5 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px] font-bold">Subiendo...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 py-1">
                                                    <Crop size={20} className="text-ios-blue/50 mb-0.5" />
                                                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Subir portada</span>
                                                </div>
                                            )
                                        }
                                    />
                                )}
                            </div>

                            {/* Botones de acción */}
                            <div className="flex items-end gap-2">
                                {editingId ? (
                                    <>
                                        <Button onClick={handleCancel} variant="secondary" className="flex-1 py-2.5 rounded-xl font-bold" disabled={isSubmitting}>
                                            Cancelar
                                        </Button>
                                        <Button onClick={handleSave} className="flex-1 gap-2 py-2.5 rounded-xl font-bold" loading={isSubmitting}>
                                            <Save size={16} /> Actualizar
                                        </Button>
                                    </>
                                ) : (
                                    <Button onClick={handleSave} className="w-full gap-2 py-2.5 rounded-xl font-bold shadow-md" loading={isSubmitting}>
                                        <Plus size={18} /> Añadir Categoría
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Grid de tarjetas de categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {safeCategories.length === 0 ? (
                        <div className="col-span-full text-center py-16 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-gray-400">
                            <Package size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No hay categorías creadas.</p>
                            <p className="text-xs text-gray-400 mt-1">Presiona "Nueva Categoría" para comenzar.</p>
                        </div>
                    ) : safeCategories.map((cat: Category) => {
                        const productCount = (products || []).filter((p: Product) => p.category === cat.name).length;
                        return (
                            <div
                                key={cat.id}
                                onClick={() => {
                                    if (canManage) handleStartEdit(cat);
                                }}
                                className="group relative rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden aspect-square shadow-md hover:shadow-xl border border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
                            >
                                <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700 opacity-95"
                                />

                                {/* Gradiente oscuro inferior */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-5 sm:p-6 pointer-events-none">
                                    <p className="text-white font-black text-lg sm:text-xl leading-tight drop-shadow-sm truncate">
                                        {cat.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-white/80 text-xs mt-1 font-medium">
                                        <Package size={13} className="shrink-0" />
                                        <span>{productCount} {productCount === 1 ? 'producto' : 'productos'}</span>
                                    </div>
                                </div>

                                {/* Botones de acción táctiles: Visibles siempre en móvil, hover en desktop */}
                                {canManage && (
                                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all transform sm:scale-95 sm:group-hover:scale-100 opacity-100 z-10">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartEdit(cat);
                                            }}
                                            className="w-10 h-10 sm:w-9 sm:h-9 bg-blue-600/90 sm:bg-blue-600/80 backdrop-blur-md text-white rounded-full hover:bg-blue-600 active:scale-90 transition-all shadow-xl flex items-center justify-center border border-white/20"
                                            title="Editar categoría"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(cat);
                                            }}
                                            className="w-10 h-10 sm:w-9 sm:h-9 bg-red-600/90 sm:bg-red-600/80 backdrop-blur-md text-white rounded-full hover:bg-red-600 active:scale-90 transition-all shadow-xl flex items-center justify-center border border-white/20"
                                            title="Eliminar categoría"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
