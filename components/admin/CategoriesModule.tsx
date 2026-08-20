import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, Input, Button, ImageUploader } from '../UIComponents';
import { generateId } from './Shared';
import { Plus, Trash2, Package, Edit2, Save, ZoomIn, ZoomOut, RotateCcw, Check, X, Move, Crop } from 'lucide-react';
import { Category, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';

// ─── Modal de Recorte Cuadrado 1:1 ────────────────────────────────────────────
interface CropModalProps {
    imageSrc: string;
    onConfirm: (croppedDataUrl: string, file: File) => void;
    onCancel: () => void;
}

const CROP_SIZE = 320;

const CategoryCropModal: React.FC<CropModalProps> = ({ imageSrc, onConfirm, onCancel }) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const imgRef       = useRef<HTMLImageElement | null>(null);
    const [zoom, setZoom]           = useState(1);
    const [offset, setOffset]       = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart]   = useState({ x: 0, y: 0 });
    const [imgLoaded, setImgLoaded]   = useState(false);
    const [isSaving, setIsSaving]     = useState(false);

    // Cargar imagen y calcular zoom inicial para cubrir el cuadro
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            const initialZoom = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
            setZoom(initialZoom);
            setOffset({ x: 0, y: 0 });
            setImgLoaded(true);
        };
        img.src = imageSrc;
    }, [imageSrc]);

    // Re-dibujar canvas en cada cambio de zoom u offset
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        if (!ctx) return;
        const img = imgRef.current;
        canvas.width  = CROP_SIZE;
        canvas.height = CROP_SIZE;
        ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
        const drawW = img.naturalWidth  * zoom;
        const drawH = img.naturalHeight * zoom;
        const drawX = (CROP_SIZE - drawW) / 2 + offset.x;
        const drawY = (CROP_SIZE - drawH) / 2 + offset.y;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }, [imgLoaded, zoom, offset]);

    // Pointer events para drag
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

    const handleZoomIn  = () => setZoom(prev => Math.min(prev + 0.15, 5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.1));
    const handleReset   = () => {
        if (!imgRef.current) return;
        setZoom(Math.max(CROP_SIZE / imgRef.current.naturalWidth, CROP_SIZE / imgRef.current.naturalHeight));
        setOffset({ x: 0, y: 0 });
    };

    // Exportar canvas recortado como WebP → File
    const handleConfirm = async () => {
        if (!canvasRef.current) return;
        setIsSaving(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/webp', 0.88);
            const res  = await fetch(dataUrl);
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-white/10 w-full max-w-sm overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crop size={18} className="text-ios-blue" />
                        <h3 className="font-bold text-base dark:text-white">Encuadrar Portada (1:1)</h3>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full dark:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-4 p-5">
                    <p className="text-[11px] text-gray-400 text-center flex items-center gap-1.5">
                        <Move size={12} /> Arrastra · Rueda o slider para zoom
                    </p>

                    {/* Área de previsualización cuadrada */}
                    <div
                        className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-ios-blue bg-gray-100 dark:bg-zinc-800"
                        style={{ width: CROP_SIZE, height: CROP_SIZE, cursor: isDragging ? 'grabbing' : 'grab' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                    >
                        <canvas
                            ref={canvasRef}
                            style={{ width: CROP_SIZE, height: CROP_SIZE, display: 'block', userSelect: 'none', touchAction: 'none' }}
                        />
                        {/* Guías de tercios */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                                                  linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                                backgroundSize: `${CROP_SIZE / 3}px ${CROP_SIZE / 3}px`,
                            }}
                        />
                        {/* Marcadores de esquina */}
                        {cornerClasses.map((cls, i) => (
                            <div key={i} className={`absolute w-5 h-5 border-ios-blue pointer-events-none ${cls}`} />
                        ))}
                    </div>

                    {/* Controles de zoom */}
                    <div className="flex items-center gap-2 w-full bg-gray-100 dark:bg-white/5 rounded-2xl p-1.5">
                        <button onClick={handleZoomOut} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-600 dark:text-gray-300" title="Reducir">
                            <ZoomOut size={16} />
                        </button>
                        <input
                            type="range" min={10} max={500} step={1}
                            value={Math.round(zoom * 100)}
                            onChange={e => setZoom(Number(e.target.value) / 100)}
                            className="flex-1 accent-ios-blue"
                        />
                        <button onClick={handleZoomIn} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-600 dark:text-gray-300" title="Ampliar">
                            <ZoomIn size={16} />
                        </button>
                        <button onClick={handleReset} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition text-gray-400" title="Restablecer">
                            <RotateCcw size={14} />
                        </button>
                    </div>
                </div>

                {/* Acciones */}
                <div className="px-5 pb-5 flex gap-3">
                    <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} className="flex-[2] gap-2" loading={isSaving}>
                        <Check size={16} /> Aplicar y Subir
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Módulo Principal de Categorías ──────────────────────────────────────────
export const CategoriesModule = ({ categories, products, addCategory, updateCategory, deleteCategory }: any) => {
    const { userRole } = useStore();
    const [name, setName]           = useState('');
    const [img, setImg]             = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado del flujo de recorte
    const [cropSrc, setCropSrc]       = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const safeCategories = Array.isArray(categories) ? categories : [];

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

    const handleSave = () => {
        if (isSubmitting) return;
        if (!name.trim()) { alert('El nombre de la categoría es obligatorio.'); return; }
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
                addCategory({ id: generateId(), name: name.trim(), image: img || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80' });
            }
            setName(''); setImg('');
            setTimeout(() => setIsSubmitting(false), 500);
        }, 50);
    };

    const handleEdit = (cat: Category) => {
        setEditingId(cat.id);
        setName(cat.name);
        setImg(cat.image || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => { setEditingId(null); setName(''); setImg(''); };

    return (
        <>
            {/* Modal de recorte — se monta encima de todo */}
            {cropSrc && (
                <CategoryCropModal
                    imageSrc={cropSrc}
                    onConfirm={handleCropConfirm}
                    onCancel={() => setCropSrc(null)}
                />
            )}

            <div className="space-y-6">
                <h2 className="text-2xl font-bold dark:text-white">Gestión de Categorías</h2>

                <Card className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

                        {/* Campo nombre */}
                        <Input
                            label="Nombre de Categoría"
                            placeholder="Ej: Verano"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={isSubmitting}
                        />

                        {/* Uploader con recorte cuadrado */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-ios-subtext uppercase tracking-wide ml-1">
                                Imagen de Portada
                            </label>

                            {img ? (
                                /* Preview cuadrado una vez la imagen está confirmada */
                                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-ios-blue/30 group shadow-sm">
                                    <img src={img} alt="Portada" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        {/* Cambiar */}
                                        <label
                                            className="p-2.5 bg-ios-blue/90 backdrop-blur text-white rounded-full cursor-pointer hover:bg-ios-blue transition shadow-lg"
                                            title="Cambiar imagen"
                                        >
                                            <Edit2 size={15} />
                                            <input
                                                type="file" accept="image/*" className="hidden"
                                                onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleFileSelect(f);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                        {/* Quitar */}
                                        <button
                                            type="button" onClick={() => setImg('')}
                                            className="p-2.5 bg-red-500/90 backdrop-blur text-white rounded-full hover:bg-red-600 transition shadow-lg"
                                            title="Quitar imagen"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                    {/* Badge 1:1 */}
                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
                                        <Crop size={9} /> 1:1
                                    </div>
                                </div>
                            ) : (
                                /* Zona de carga — intercepta el archivo hacia el modal de recorte */
                                <ImageUploader
                                    label=""
                                    value=""
                                    onChange={setImg}
                                    aspectRatio="square"
                                    onFileUpload={handleFileSelect}
                                    placeholder={
                                        isUploading ? (
                                            <div className="flex flex-col items-center gap-1 text-ios-blue">
                                                <div className="w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
                                                <span className="text-[10px] font-bold">Subiendo...</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 py-2">
                                                <Crop size={26} className="text-ios-blue/50 mb-1" />
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Subir portada</span>
                                                <span className="text-[10px] text-gray-400">Se abrirá editor de encuadre 1:1</span>
                                            </div>
                                        )
                                    }
                                />
                            )}
                        </div>

                        {/* Botones */}
                        <div className="flex items-end gap-2">
                            {editingId ? (
                                <>
                                    <Button onClick={handleCancel} variant="secondary" className="flex-1" disabled={isSubmitting}>Cancelar</Button>
                                    <Button onClick={handleSave} className="flex-1 gap-2" loading={isSubmitting}>
                                        <Save size={18} /> Actualizar
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={handleSave} className="w-full gap-2" loading={isSubmitting}>
                                    <Plus size={20} /> Añadir
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Grid de tarjetas de categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {safeCategories.length === 0 ? (
                        <div className="col-span-full text-center py-10 text-gray-400">
                            <Package size={40} className="mx-auto mb-2 opacity-30" />
                            <p>No hay categorías creadas.</p>
                        </div>
                    ) : safeCategories.map((cat: Category) => {
                        const productCount = (products || []).filter((p: Product) => p.category === cat.name).length;
                        return (
                            <div key={cat.id} className="group relative rounded-[2.5rem] overflow-hidden aspect-square shadow-lg border border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-white/5">
                                <img
                                    src={cat.image} alt={cat.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700 opacity-90 group-hover:opacity-100"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                                    <p className="text-white font-bold text-lg leading-tight">{cat.name}</p>
                                    <div className="flex items-center gap-1.5 text-white/80 text-xs mt-1 font-medium">
                                        <Package size={12} />
                                        <span>{productCount} productos</span>
                                    </div>
                                    {userRole === 'admin' && (
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                                            <button onClick={() => handleEdit(cat)} className="p-2.5 bg-blue-500/80 backdrop-blur-md text-white rounded-full hover:bg-blue-600 transition-all shadow-lg" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteCategory(cat.id)} className="p-2.5 bg-red-500/80 backdrop-blur-md text-white rounded-full hover:bg-red-600 transition-all shadow-lg" title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

