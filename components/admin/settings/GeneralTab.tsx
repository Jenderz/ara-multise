
import React from 'react';
import { Card, Input, ImageUploader } from '../../UIComponents';
import { LayoutTemplate, Smartphone, MapPin, Mail, Instagram, Facebook, Twitter, Globe, X } from 'lucide-react';
import { StoreSettings } from '../../../types';

interface GeneralTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onUpdate }) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><LayoutTemplate size={20} className="text-ios-blue" /> Datos de la Tienda</h3>
                <div className="space-y-4">
                    <Input label="Nombre de la Tienda" value={settings.storeName || ''} onChange={e => onUpdate({ storeName: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUploader label="Logo de la Tienda" value={settings.logoUrl || ''} onChange={url => onUpdate({ logoUrl: url })} />
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 relative">
                            <div className="flex items-center gap-2 mb-2">
                                <Smartphone size={16} className="text-gray-400" />
                                <label className="text-xs font-semibold text-ios-subtext uppercase tracking-wide">Icono de Aplicación (PWA)</label>
                            </div>
                            <ImageUploader
                                value={settings.appIconUrl || ''}
                                onChange={async (url, file) => {
                                    onUpdate({ appIconUrl: url });
                                    // Si hay archivo real, actualizar el icon.png de la PWA
                                    if (file) {
                                        try {
                                            const reader = new FileReader();
                                            reader.onload = async (e) => {
                                                const base64 = e.target?.result as string;
                                                await import('../../../services/api').then(m => m.api.updatePWAIcon(base64));
                                                console.log("PWA Icon Updated physically");
                                            };
                                            reader.readAsDataURL(file);
                                        } catch (err) {
                                            console.error("Error updating PWA icon", err);
                                        }
                                    }
                                }}
                            />
                            <p className="text-[10px] text-gray-400 mt-2">Usado en pantalla de inicio móvil y pestañas. Se actualiza automáticamente el icono de la PWA.</p>
                        </div>
                    </div>
                    <Input label="WhatsApp (Sin espacios)" placeholder="+52..." value={settings.whatsappNumber || ''} onChange={e => onUpdate({ whatsappNumber: e.target.value })} />
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Sobre Nosotros</label>
                        <textarea className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none transition-all text-sm dark:text-white min-h-[120px]" value={settings.aboutUsText || ''} onChange={e => onUpdate({ aboutUsText: e.target.value })} />
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div className="pr-4">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white">Ocultar Productos sin Stock</h4>
                            <p className="text-xs text-gray-500 mt-1">Si activas esto, los productos agotados no serán visibles en el catálogo público en lugar de mostrar "Agotado".</p>
                        </div>
                        <button
                            onClick={() => onUpdate({ hideOutOfStock: !settings.hideOutOfStock })}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.hideOutOfStock ? 'bg-ios-blue shadow-lg shadow-ios-blue/30' : 'bg-gray-200 dark:bg-white/10'}`}
                        >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.hideOutOfStock ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>
            </Card>

            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><MapPin size={20} className="text-ios-blue" /> Footer y Redes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Descripción Footer</label>
                            <textarea className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[80px]" value={settings.footerDescription || ''} onChange={e => onUpdate({ footerDescription: e.target.value })} placeholder="Breve texto sobre tu tienda..." />
                        </div>
                        <Input label="Email" icon={<Mail size={16} />} value={settings.contactEmail || ''} onChange={e => onUpdate({ contactEmail: e.target.value })} />

                        <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Ubicaciones / Sedes</h4>

                            {/* Sede Principal */}
                            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl space-y-3 border border-blue-100 dark:border-blue-900/20">
                                <Input label="Sede Principal (Dirección)" icon={<MapPin size={16} />} value={settings.contactAddress || ''} onChange={e => onUpdate({ contactAddress: e.target.value })} />
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-ios-subtext" />
                                        <label className="text-[10px] font-semibold text-ios-subtext uppercase tracking-wide">Mapa Google (Embed)</label>
                                    </div>
                                    <textarea
                                        className="w-full bg-white dark:bg-black/20 border border-transparent focus:border-ios-blue/50 rounded-xl px-3 py-2 outline-none text-[10px] dark:text-white min-h-[60px] font-mono text-gray-500"
                                        value={settings.contactGoogleMaps || ''}
                                        onChange={e => onUpdate({ contactGoogleMaps: e.target.value })}
                                        placeholder='<iframe src="..." ...></iframe>'
                                    />
                                </div>
                            </div>

                            {/* Sedes Adicionales */}
                            {(settings.additionalAddresses || []).map((addr, idx) => (
                                <div key={addr.id || idx} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl space-y-3 relative group border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all">
                                    <button
                                        onClick={() => {
                                            const newAddrs = [...(settings.additionalAddresses || [])];
                                            newAddrs.splice(idx, 1);
                                            onUpdate({ additionalAddresses: newAddrs });
                                        }}
                                        className="absolute top-2 right-2 p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14} />
                                    </button>
                                    <Input
                                        label="Sede Adicional (Dirección)"
                                        value={addr.address}
                                        onChange={e => {
                                            const newAddrs = [...(settings.additionalAddresses || [])];
                                            newAddrs[idx] = { ...addr, address: e.target.value };
                                            onUpdate({ additionalAddresses: newAddrs });
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-ios-subtext uppercase ml-1 tracking-wide">Mapa (Embed o Link)</label>
                                        <input
                                            className="w-full bg-white dark:bg-black/20 border border-transparent focus:border-ios-blue/50 rounded-xl px-3 py-2 outline-none text-[10px] dark:text-white font-mono"
                                            value={addr.mapUrl}
                                            onChange={e => {
                                                const newAddrs = [...(settings.additionalAddresses || [])];
                                                newAddrs[idx] = { ...addr, mapUrl: e.target.value };
                                                onUpdate({ additionalAddresses: newAddrs });
                                            }}
                                            placeholder="Iframe o enlace directo..."
                                        />
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => {
                                    const newAddrs = [...(settings.additionalAddresses || []), { id: Date.now().toString(), address: '', mapUrl: '' }];
                                    onUpdate({ additionalAddresses: newAddrs });
                                }}
                                className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-xs font-bold text-gray-400 hover:border-ios-blue hover:text-ios-blue transition-all"
                            >
                                + Agregar Otra Sede
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Redes Sociales</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 rounded-xl flex items-center justify-center text-pink-500"><Instagram size={20} /></div>
                                <Input placeholder="Instagram URL" value={settings.socialInstagram || ''} onChange={e => onUpdate({ socialInstagram: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600"><Facebook size={20} /></div>
                                <Input placeholder="Facebook URL" value={settings.socialFacebook || ''} onChange={e => onUpdate({ socialFacebook: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-gray-800 dark:text-white"><Twitter size={20} /></div>
                                <Input placeholder="Twitter URL" value={settings.socialTwitter || ''} onChange={e => onUpdate({ socialTwitter: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
