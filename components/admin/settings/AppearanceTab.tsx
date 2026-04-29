
import React from 'react';
import { Card } from '../../UIComponents';
import { Palette, Type, Pipette } from 'lucide-react';
import { StoreSettings } from '../../../types';

interface AppearanceTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, onUpdate }) => {

    const brandPresets = [
        '#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#000000',
        '#FF2D55', '#5856D6', '#5AC8FA', '#FFCC00', '#171717', '#E5E5EA'
    ];

    const navPresets = [
        'rgba(255, 255, 255, 0.75)', 'rgba(0, 0, 0, 0.75)', 'rgba(28, 28, 30, 0.9)',
        'rgba(0, 122, 255, 0.8)', 'rgba(255, 59, 48, 0.8)', 'rgba(52, 199, 89, 0.8)'
    ];

    const fontPresets = ['Inter', 'Playfair Display', 'Montserrat', 'Roboto', 'Lato', 'Poppins', 'System'];

    return (
        <div className="space-y-6 animate-fade-in">
            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><Palette size={20} className="text-ios-blue" /> Estilo Visual</h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                        <div>
                            <p className="text-sm font-bold dark:text-white">Modo Oscuro Permanente</p>
                            <p className="text-[10px] text-gray-500">Obligar a la web a usar tema oscuro.</p>
                        </div>
                        <button onClick={() => onUpdate({ forceGlobalDarkMode: !settings.forceGlobalDarkMode })} className={`w-12 h-6 rounded-full transition-all relative ${settings.forceGlobalDarkMode ? 'bg-ios-blue' : 'bg-gray-300'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.forceGlobalDarkMode ? 'right-1' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                        <div>
                            <p className="text-sm font-bold dark:text-white">Ocultar Nombre en el Menú</p>
                            <p className="text-[10px] text-gray-500">Mostrar solo el logo en la cabecera.</p>
                        </div>
                        <button onClick={() => onUpdate({ hideStoreName: !settings.hideStoreName })} className={`w-12 h-6 rounded-full transition-all relative ${settings.hideStoreName ? 'bg-ios-blue' : 'bg-gray-300'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.hideStoreName ? 'right-1' : 'left-1'}`} />
                        </button>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Type size={16} className="text-gray-400" />
                            <label className="text-xs font-semibold text-ios-subtext uppercase">Tipografía Global</label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {fontPresets.map(font => (
                                <button
                                    key={font}
                                    onClick={() => onUpdate({ fontFamily: font })}
                                    className={`py-3 px-2 rounded-xl border-2 text-xs sm:text-sm transition-all truncate ${(settings.fontFamily || 'Inter') === font
                                        ? 'border-ios-blue bg-ios-blue/5 text-ios-blue font-bold shadow-sm'
                                        : 'border-gray-100 dark:border-white/5 text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                    style={{ fontFamily: font === 'System' ? '-apple-system, sans-serif' : font }}
                                >
                                    {font}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Color Principal</label>
                        <div className="flex flex-wrap gap-2.5 mt-3">
                            {brandPresets.map(c => (
                                <button
                                    key={c}
                                    onClick={() => onUpdate({ primaryColor: c })}
                                    className={`w-10 h-10 rounded-full border-4 transition-all ${settings.primaryColor === c ? 'border-ios-blue' : 'border-transparent shadow-sm'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <div className="relative w-10 h-10 rounded-full border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center overflow-hidden">
                                <Pipette size={16} className="text-gray-400" />
                                <input type="color" value={settings.primaryColor || '#007AFF'} onChange={e => onUpdate({ primaryColor: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Barra de Navegación</label>
                        <div className="flex flex-wrap gap-2.5 mt-2">
                            {navPresets.map(c => (
                                <button key={c} onClick={() => onUpdate({ navbarColor: c })} className={`w-8 h-8 rounded-lg border-2 transition-all ${settings.navbarColor === c ? 'border-ios-blue' : 'border-transparent shadow-sm'}`} style={{ backgroundColor: c }} />
                            ))}
                            <div className="relative w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center overflow-hidden">
                                <Pipette size={14} className="text-gray-400" />
                                <input type="color" value={settings.navbarColor || '#ffffff'} onChange={e => onUpdate({ navbarColor: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        </div>
                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 block mt-4">Texto Navbar</label>
                        <div className="flex gap-4 mt-2">
                            <button onClick={() => onUpdate({ navbarTextColor: '#FFFFFF' })} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${settings.navbarTextColor === '#FFFFFF' ? 'border-ios-blue bg-gray-900 text-white' : 'border-gray-200 text-gray-400'}`}>Blanco</button>
                            <button onClick={() => onUpdate({ navbarTextColor: '#1C1C1E' })} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${settings.navbarTextColor === '#1C1C1E' ? 'border-ios-blue bg-white text-black' : 'border-gray-200 text-gray-400'}`}>Oscuro</button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
