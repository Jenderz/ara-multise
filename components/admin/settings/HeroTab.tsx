
import React from 'react';
import { Card, Input, ImageUploader, Button } from '../../UIComponents';
import { Home, AlignLeft, AlignCenter, AlignRight, Star, Truck, ShieldCheck, Headphones, RefreshCw, Zap, Leaf, Award, Lock, Gift, Globe, TrendingUp, Sparkles, Clock, Trash2, Plus, GripVertical, Type, MousePointerClick, Droplets, Smartphone, Monitor } from 'lucide-react';
import { StoreSettings, HeroSlide } from '../../../types';
import { generateId } from '../Shared';

// Componente local para iconos
const IconPicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const icons = [
        { id: 'truck', icon: <Truck size={16}/> },
        { id: 'shield', icon: <ShieldCheck size={16}/> },
        { id: 'headphones', icon: <Headphones size={16}/> },
        { id: 'return', icon: <RefreshCw size={16}/> },
        { id: 'star', icon: <Star size={16}/> },
        { id: 'zap', icon: <Zap size={16}/> },
        { id: 'leaf', icon: <Leaf size={16}/> },
        { id: 'award', icon: <Award size={16}/> },
        { id: 'lock', icon: <Lock size={16}/> },
        { id: 'gift', icon: <Gift size={16}/> },
        { id: 'globe', icon: <Globe size={16}/> },
        { id: 'trending', icon: <TrendingUp size={16}/> },
        { id: 'sparkles', icon: <Sparkles size={16}/> },
        { id: 'clock', icon: <Clock size={16}/> },
    ];

    return (
        <div className="flex gap-2 flex-wrap bg-gray-100 dark:bg-black/20 p-2 rounded-xl border border-gray-200 dark:border-white/10">
            {icons.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    className={`p-2 rounded-lg transition-all ${value === item.id ? 'bg-ios-blue text-white shadow-sm' : 'text-gray-400 hover:bg-white dark:hover:bg-white/10'}`}
                    title={item.id}
                >
                    {item.icon}
                </button>
            ))}
        </div>
    );
};

interface HeroTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const HeroTab: React.FC<HeroTabProps> = ({ settings, onUpdate }) => {
    
    // Obtener slides o array vacío (con compatibilidad legacy en mente)
    const slides = settings.heroSlides || [];

    const handleAddSlide = () => {
        if (slides.length >= 5) {
            alert("Máximo 5 imágenes permitidas en el carrusel.");
            return;
        }
        
        // Si es el primer slide y hay data legacy, usarla como base
        const isFirst = slides.length === 0;
        const newSlide: HeroSlide = {
            id: generateId(),
            title: isFirst ? (settings.homeHeroTitle || 'Bienvenido') : 'Nuevo Slide',
            subtitle: isFirst ? (settings.homeHeroSubtitle || 'Subtítulo') : 'Descripción de la promoción',
            image: isFirst ? (settings.homeHeroImage || '') : '',
            buttonText: 'Comprar Ahora',
            link: '/shop',
            align: isFirst ? (settings.homeHeroAlign || 'center') : 'center',
            badgeText: '',
            glassEffect: false, // Default desactivado (modo solo imagen)
            hideText: true,   // Por defecto: solo imagen limpia
            hideButton: true  // Por defecto: sin botón
        };

        onUpdate({ heroSlides: [...slides, newSlide] });
    };

    const handleUpdateSlide = (index: number, updates: Partial<HeroSlide>) => {
        const newSlides = [...slides];
        newSlides[index] = { ...newSlides[index], ...updates };
        onUpdate({ heroSlides: newSlides });
    };

    const handleRemoveSlide = (index: number) => {
        if (window.confirm("¿Eliminar este slide?")) {
            const newSlides = slides.filter((_, i) => i !== index);
            onUpdate({ heroSlides: newSlides });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">

            {/* TOGGLE GLOBAL: MODO SOLO IMAGEN */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-5 flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <Monitor size={20} className="text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Modo Solo Imagen (Global)</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">Oculta todo el texto y botones en TODOS los slides del hero. El carrusel muestra solo las imágenes.</p>
                    </div>
                </div>
                <button
                    onClick={() => onUpdate({ heroSliderOnlyImages: !settings.heroSliderOnlyImages })}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ${settings.heroSliderOnlyImages ? 'bg-ios-blue shadow-lg shadow-ios-blue/30' : 'bg-white/20'}`}
                >
                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.heroSliderOnlyImages ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold flex items-center gap-2 dark:text-white">
                            <Home size={20} className="text-ios-blue"/> Carrusel de Portada (Hero)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Configura hasta 5 imágenes deslizables. Haz clic en la imagen para editar.</p>
                    </div>
                    <Button 
                        onClick={handleAddSlide} 
                        disabled={slides.length >= 5}
                        className="text-xs h-auto py-2 px-3 gap-1"
                    >
                        <Plus size={14}/> Agregar Slide ({slides.length}/5)
                    </Button>
                </div>

                {/* Lista de Slides */}
                <div className="space-y-4">
                    {slides.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                            <p className="text-gray-400 text-sm mb-3">No hay slides configurados. Se está usando la configuración básica antigua.</p>
                            <Button onClick={handleAddSlide} variant="secondary">Crear Primer Slide desde Configuración Actual</Button>
                        </div>
                    ) : (
                        slides.map((slide, index) => (
                            <div key={slide.id} className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col md:flex-row gap-6 relative group">
                                <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
                                    <button onClick={() => handleRemoveSlide(index)} className="p-2 text-gray-400 hover:text-red-500 bg-white/80 dark:bg-black/20 rounded-full transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                                <div className="absolute top-4 left-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md font-bold backdrop-blur-sm z-10">
                                    Slide #{index + 1}
                                </div>

                                {/* Columna Imagenes (Desktop y Móvil) */}
                                <div className="w-full md:w-1/3 min-w-[200px] space-y-3">
                                    {/* Imagen Desktop */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1">
                                            <Monitor size={10} /> Imagen Escritorio (Horizontal)
                                        </label>
                                        <ImageUploader 
                                            value={slide.image} 
                                            onChange={(url) => handleUpdateSlide(index, { image: url })} 
                                            className="h-32"
                                        />
                                    </div>
                                    
                                    {/* Imagen Móvil */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1">
                                            <Smartphone size={10} /> Imagen Móvil (Vertical)
                                        </label>
                                        <ImageUploader 
                                            value={slide.mobileImage || ''} 
                                            onChange={(url) => handleUpdateSlide(index, { mobileImage: url })} 
                                            className="h-32"
                                            placeholder={<span className="text-[10px] text-center text-gray-400">Opcional<br/>(Recomendado 9:16)</span>}
                                        />
                                    </div>

                                    {/* Link Input debajo de imagen */}
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Enlace al hacer click</label>
                                        <Input 
                                            value={slide.link || ''} 
                                            onChange={e => handleUpdateSlide(index, { link: e.target.value })} 
                                            placeholder="/shop"
                                            className="text-xs py-2 h-auto"
                                        />
                                    </div>
                                </div>

                                {/* Columna Datos */}
                                <div className="flex-1 space-y-3">
                                    {/* Controles de Visibilidad (Toggles) */}
                                    <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                                        <button 
                                            onClick={() => handleUpdateSlide(index, { hideText: !slide.hideText })}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${slide.hideText ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white dark:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
                                        >
                                            <Type size={12} /> {slide.hideText ? 'Texto Oculto' : 'Mostrar Texto'}
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateSlide(index, { hideButton: !slide.hideButton })}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${slide.hideButton ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white dark:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
                                        >
                                            <MousePointerClick size={12} /> {slide.hideButton ? 'Botón Oculto' : 'Mostrar Botón'}
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateSlide(index, { glassEffect: !slide.glassEffect })}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${slide.glassEffect ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-400 border-transparent'}`}
                                        >
                                            <Droplets size={12} /> {slide.glassEffect ? 'Efecto Cristal' : 'Sin Fondo'}
                                        </button>
                                    </div>

                                    <div className={slide.hideText ? 'opacity-50 pointer-events-none' : ''}>
                                        <Input 
                                            label="Título" 
                                            value={slide.title} 
                                            onChange={e => handleUpdateSlide(index, { title: e.target.value })} 
                                            placeholder="Título Principal"
                                        />
                                        <div className="space-y-1 mt-3">
                                            <label className="text-xs font-semibold text-ios-subtext uppercase">Subtítulo</label>
                                            <textarea 
                                                className="w-full bg-white dark:bg-black/20 border border-transparent rounded-xl px-3 py-2 text-xs dark:text-white outline-none min-h-[50px]" 
                                                value={slide.subtitle} 
                                                onChange={e => handleUpdateSlide(index, { subtitle: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className={slide.hideButton ? 'opacity-50 pointer-events-none' : ''}>
                                            <Input 
                                                label="Texto Botón" 
                                                value={slide.buttonText || ''} 
                                                onChange={e => handleUpdateSlide(index, { buttonText: e.target.value })} 
                                                placeholder="Ver Más"
                                            />
                                        </div>
                                        <div>
                                            <Input 
                                                label="Etiqueta (Badge)" 
                                                value={slide.badgeText || ''} 
                                                onChange={e => handleUpdateSlide(index, { badgeText: e.target.value })} 
                                                placeholder="Ej: Nueva Colección"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-ios-subtext uppercase block mb-2">Alineación Texto</label>
                                        <div className="flex gap-2">
                                            {[ {id: 'left', icon: <AlignLeft size={14}/>}, {id: 'center', icon: <AlignCenter size={14}/>}, {id: 'right', icon: <AlignRight size={14}/>} ].map(btn => (
                                                <button 
                                                    key={btn.id} 
                                                    onClick={() => handleUpdateSlide(index, { align: btn.id as any })} 
                                                    className={`flex-1 py-2 rounded-lg border flex justify-center transition-all ${slide.align === btn.id ? 'border-ios-blue bg-ios-blue/10 text-ios-blue' : 'border-gray-200 dark:border-white/10 text-gray-400'}`}
                                                > 
                                                    {btn.icon} 
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-6">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Ajustes Globales</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-semibold text-ios-subtext uppercase block mb-3">Altura del Banner</label>
                            <div className="grid grid-cols-3 gap-2">
                            {[ {id: 'compact', label: 'Compacto'}, {id: 'medium', label: 'Normal'}, {id: 'full', label: 'Full Screen'} ].map(btn => (
                                <button 
                                    key={btn.id}
                                    onClick={() => onUpdate({homeHeroHeight: btn.id as any})}
                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${settings.homeHeroHeight === btn.id ? 'border-ios-blue bg-ios-blue/5 text-ios-blue' : 'border-gray-100 text-gray-400'}`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-ios-subtext uppercase block mb-2">Opacidad Fondo Oscuro</label>
                            <div className="flex items-center gap-4">
                                <input 
                                type="range" 
                                min="0" 
                                max="0.9" 
                                step="0.1" 
                                value={settings.homeHeroOverlayOpacity || 0.3} 
                                onChange={e => onUpdate({homeHeroOverlayOpacity: parseFloat(e.target.value)})}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-ios-blue"
                                />
                                <span className="text-sm font-bold w-12 text-right">
                                    {Math.round((settings.homeHeroOverlayOpacity || 0.3) * 100)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><Star size={20} className="text-ios-blue"/> Tarjetas de Características</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tarjeta {i}</h4>
                            <Input placeholder="Título" value={(settings as any)[`homeFeature${i}Title`] || ''} onChange={e => onUpdate({[`homeFeature${i}Title`]: e.target.value})} />
                            <textarea className="w-full bg-white dark:bg-black/20 border border-transparent rounded-xl px-3 py-2 text-sm dark:text-white outline-none" rows={3} value={(settings as any)[`homeFeature${i}Text`] || ''} onChange={e => onUpdate({[`homeFeature${i}Text`]: e.target.value})} />
                            
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Icono</label>
                                <IconPicker 
                                    value={(settings as any)[`homeFeature${i}Icon`] || 'sparkles'} 
                                    onChange={(val) => onUpdate({[`homeFeature${i}Icon`]: val})} 
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* NUEVA SECCIÓN: VISIBILIDAD DE SECCIONES */}
            <Card className="p-6 space-y-5">
                <div>
                    <h3 className="font-bold flex items-center gap-2 dark:text-white">
                        <Star size={20} className="text-ios-blue" /> Visibilidad de Secciones en la Home
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Activa o desactiva secciones completas de la página de inicio. Los cambios se aplican después de guardar.</p>
                </div>

                <div className="space-y-3">
                    {[
                        { key: 'showBestSellers', label: 'Más Vendidos', desc: 'Sección de productos con más ventas' },
                        { key: 'showNewArrivals', label: 'Novedades', desc: 'Productos recién añadidos al catálogo' },
                        { key: 'showSaleSection', label: 'Ofertas Relámpago', desc: 'Productos con precio de oferta activo' },
                        { key: 'showCategoriesSection', label: 'Carrusel de Categorías', desc: 'Visualización de categorías en la home' },
                        { key: 'showFeaturesSection', label: 'Tarjetas de Características', desc: 'Las 3 tarjetas de ventajas/beneficios' },
                    ].map(({ key, label, desc }) => {
                        const isActive = (settings as any)[key] !== false;
                        return (
                            <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5'}`}>
                                <div>
                                    <p className={`text-sm font-bold ${isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>{label}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                                </div>
                                <button
                                    onClick={() => onUpdate({ [key]: !isActive } as any)}
                                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ${isActive ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-gray-200 dark:bg-white/10'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
