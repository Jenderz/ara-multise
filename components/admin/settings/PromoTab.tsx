
import React from 'react';
import { Card, Input, ImageUploader, Button } from '../../UIComponents';
import { Megaphone, Link as LinkIcon, Image as ImageIcon, ExternalLink, ArrowRight } from 'lucide-react';
import { StoreSettings } from '../../../types';

interface PromoTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const PromoTab: React.FC<PromoTabProps> = ({ settings, onUpdate }) => {
    // Verificación de estado activo (Solo si hay imagen)
    const hasImage = !!settings.homeBannerImage;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Encabezado del Módulo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        <Megaphone size={24} className="text-ios-blue"/> Banner Promocional
                    </h3>
                    <p className="text-sm text-gray-500">Configura la sección destacada de tu página de inicio.</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${hasImage ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'}`}>
                    <div className={`w-2 h-2 rounded-full ${hasImage ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    {hasImage ? 'Banner Activo' : 'Inactivo (Falta Imagen)'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* COLUMNA IZQUIERDA: Formulario de Edición */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="p-6 space-y-5">
                        <div className="space-y-4">
                            <Input 
                                label="Título Principal" 
                                placeholder="Ej: LIQUIDACIÓN FINAL" 
                                value={settings.homeBannerTitle || ''} 
                                onChange={e => onUpdate({homeBannerTitle: e.target.value})} 
                            />
                            
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Texto Descriptivo</label>
                                <textarea 
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[100px] transition-all"
                                    placeholder="Ej: Aprovecha hasta un 50% de descuento en referencias seleccionadas..."
                                    value={settings.homeBannerText || ''}
                                    onChange={e => onUpdate({homeBannerText: e.target.value})}
                                />
                            </div>

                            <Input 
                                label="Texto del Botón" 
                                placeholder="Ej: Comprar Ahora" 
                                value={settings.homeBannerButtonText || ''} 
                                onChange={e => onUpdate({homeBannerButtonText: e.target.value})} 
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Etiqueta (Badge)" 
                                    placeholder="Ej: OFERTA" 
                                    value={settings.homeBannerBadgeText || ''} 
                                    onChange={e => onUpdate({homeBannerBadgeText: e.target.value})} 
                                />
                                <Input 
                                    label="Enlace / Link" 
                                    icon={<LinkIcon size={14}/>}
                                    placeholder="/shop" 
                                    value={settings.homeBannerLink || ''} 
                                    onChange={e => onUpdate({homeBannerLink: e.target.value})} 
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ImageIcon size={18} className="text-ios-blue"/>
                            <label className="text-xs font-bold text-gray-500 uppercase">Imagen de Fondo (Requerido)</label>
                        </div>
                        <ImageUploader 
                            value={settings.homeBannerImage || ''} 
                            onChange={url => onUpdate({homeBannerImage: url})}
                            className="min-h-[200px]"
                        />
                        <p className="text-[10px] text-gray-400 mt-2 text-center">Recomendado: 1200x600px o superior.</p>
                    </Card>
                </div>

                {/* COLUMNA DERECHA: Vista Previa en Vivo */}
                <div className="lg:col-span-7">
                    <div className="sticky top-6 space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <ExternalLink size={14}/> Vista Previa en Vivo
                        </h4>
                        
                        {/* Simulación del Banner */}
                        <div className="w-full aspect-[16/9] lg:aspect-[2/1] rounded-[2.5rem] overflow-hidden relative shadow-2xl border-4 border-white dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900 group">
                            {settings.homeBannerImage ? (
                                <img 
                                    src={settings.homeBannerImage} 
                                    className="w-full h-full object-cover transition-transform duration-[10s] ease-linear group-hover:scale-110" 
                                    alt="Preview"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 dark:text-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
                                    <ImageIcon size={48} className="mb-2 opacity-50"/>
                                    <span className="text-xs font-bold uppercase tracking-widest">Sin Imagen</span>
                                </div>
                            )}
                            
                            {/* Overlay Oscuro */}
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>

                            {/* Contenido Simulado */}
                            <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12 items-start text-left">
                                {settings.homeBannerBadgeText && (
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-black uppercase tracking-widest rounded-lg mb-4">
                                        {settings.homeBannerBadgeText}
                                    </span>
                                )}
                                
                                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-white font-bold leading-[0.95] mb-4 drop-shadow-lg max-w-lg">
                                    {settings.homeBannerTitle || 'Título de la Oferta'}
                                </h2>
                                
                                <p className="text-white/80 text-sm md:text-base font-light mb-8 max-w-md line-clamp-3 leading-relaxed border-l-2 border-white/30 pl-4">
                                    {settings.homeBannerText || 'Aquí aparecerá la descripción de tu promoción. Escribe algo atractivo para tus clientes.'}
                                </p>
                                
                                <button className="bg-white text-black px-6 py-3 rounded-full text-xs md:text-sm font-bold shadow-xl flex items-center gap-2">
                                    {settings.homeBannerButtonText || 'Ver Más'} <ArrowRight size={14}/>
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20 text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
                            <strong>Nota de Experto:</strong> Los cambios que haces aquí se guardan localmente mientras editas. Recuerda pulsar el botón <b>"Guardar Cambios"</b> en la barra superior para publicarlos en la tienda.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
