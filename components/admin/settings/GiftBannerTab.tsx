
import React from 'react';
import { Card, Input, ImageUploader } from '../../UIComponents';
import { Gift, MessageCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { StoreSettings } from '../../../types';

interface GiftBannerTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const GiftBannerTab: React.FC<GiftBannerTabProps> = ({ settings, onUpdate }) => {
    // Verificación de estado activo (Solo si hay imagen)
    const hasImage = !!settings.giftBannerImage;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Encabezado del Módulo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        <Gift size={24} className="text-purple-500"/> Banner Regalo (Gift)
                    </h3>
                    <p className="text-sm text-gray-500">Promociones especiales que redirigen directo a WhatsApp.</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${hasImage ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'}`}>
                    <div className={`w-2 h-2 rounded-full ${hasImage ? 'bg-purple-500 animate-pulse' : 'bg-gray-400'}`} />
                    {hasImage ? 'Banner Activo' : 'Inactivo (Falta Imagen)'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* COLUMNA IZQUIERDA: Formulario de Edición */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="p-6 space-y-5">
                        <div className="space-y-4">
                            <Input 
                                label="Título de la Promoción" 
                                placeholder="Ej: Regalo del Día de la Madre" 
                                value={settings.giftBannerTitle || ''} 
                                onChange={e => onUpdate({giftBannerTitle: e.target.value})} 
                            />
                            
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Descripción</label>
                                <textarea 
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[100px] transition-all"
                                    placeholder="Ej: Escríbenos para reclamar tu cupón de descuento..."
                                    value={settings.giftBannerDescription || ''}
                                    onChange={e => onUpdate({giftBannerDescription: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Texto del Botón" 
                                    placeholder="Ej: Reclamar Regalo" 
                                    value={settings.giftBannerButtonText || ''} 
                                    onChange={e => onUpdate({giftBannerButtonText: e.target.value})} 
                                />
                                <Input 
                                    label="WhatsApp Destino" 
                                    icon={<MessageCircle size={14}/>}
                                    placeholder="Opcional (Usa el principal por defecto)" 
                                    value={settings.giftBannerWhatsApp || ''} 
                                    onChange={e => onUpdate({giftBannerWhatsApp: e.target.value})} 
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 pl-1">
                                Si dejas el WhatsApp vacío, se usará el número principal de la tienda.
                            </p>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ImageIcon size={18} className="text-purple-500"/>
                            <label className="text-xs font-bold text-gray-500 uppercase">Imagen del Banner (Requerido)</label>
                        </div>
                        <ImageUploader 
                            value={settings.giftBannerImage || ''} 
                            onChange={url => onUpdate({giftBannerImage: url})}
                            className="min-h-[200px]"
                        />
                        <p className="text-[10px] text-gray-400 mt-2 text-center">Se recomienda imagen horizontal amplia.</p>
                    </Card>
                </div>

                {/* COLUMNA DERECHA: Vista Previa en Vivo */}
                <div className="lg:col-span-7">
                    <div className="sticky top-6 space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <ExternalLink size={14}/> Vista Previa
                        </h4>
                        
                        {/* Simulación del Banner Gift */}
                        <div className="w-full rounded-[2rem] overflow-hidden relative shadow-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-zinc-900 flex flex-col md:flex-row">
                            {/* Lado Imagen */}
                            <div className="w-full md:w-1/2 aspect-video md:aspect-auto relative overflow-hidden bg-gray-100 dark:bg-zinc-800">
                                {settings.giftBannerImage ? (
                                    <img 
                                        src={settings.giftBannerImage} 
                                        className="w-full h-full object-cover" 
                                        alt="Preview"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 dark:text-zinc-600">
                                        <Gift size={40} className="mb-2 opacity-50"/>
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Sin Imagen</span>
                                    </div>
                                )}
                            </div>

                            {/* Lado Contenido */}
                            <div className="w-full md:w-1/2 p-8 flex flex-col justify-center bg-white dark:bg-zinc-900">
                                <h2 className="text-2xl font-black text-ios-text dark:text-white leading-tight mb-3">
                                    {settings.giftBannerTitle || 'Título del Regalo'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                                    {settings.giftBannerDescription || 'Descripción de la promoción especial para tus clientes.'}
                                </p>
                                <button className="w-full bg-ios-blue hover:brightness-110 text-white py-3 rounded-xl font-bold shadow-lg shadow-ios-blue/30 flex items-center justify-center gap-2 transition-all">
                                    <MessageCircle size={18} /> {settings.giftBannerButtonText || 'Contactar'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/20 text-purple-700 dark:text-purple-300 text-xs leading-relaxed flex gap-3 items-start">
                            <Gift size={16} className="shrink-0 mt-0.5"/>
                            <div>
                                <strong>Funcionalidad:</strong> Este banner aparecerá en la página de inicio. Al hacer clic en el botón, abrirá WhatsApp con el mensaje: "Hola, me interesa la promoción: {settings.giftBannerTitle || '...'}"
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
