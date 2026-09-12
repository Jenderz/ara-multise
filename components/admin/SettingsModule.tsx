
import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../UIComponents';
import {
    Save, LayoutTemplate, Palette, Home, Banknote, ShieldCheck, RefreshCw, Gift, Database, Store
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { api } from '../../services/api';

// Importación de Sub-componentes
import { GeneralTab } from './settings/GeneralTab';
import { AppearanceTab } from './settings/AppearanceTab';
import { HeroTab } from './settings/HeroTab';
import { FinanceTab } from './settings/FinanceTab';
import { SecurityTab } from './settings/SecurityTab';
import { GiftBannerTab } from './settings/GiftBannerTab';
import { BranchesTab } from './settings/BranchesTab';
import { DataManagementTab } from './settings/DataManagementTab';

export const SettingsModule = ({ settings, updateSettings, logout }: { settings: StoreSettings, updateSettings: (s: Partial<StoreSettings>) => Promise<void>, logout: () => void }) => {
    const { addNotification } = useNotification();

    const [localSettings, setLocalSettings] = useState<StoreSettings>(JSON.parse(JSON.stringify(settings)));
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'general' | 'appearance' | 'hero' | 'gift' | 'finance' | 'security' | 'branches' | 'data'>('general');

    const dirtyKeysRef = useRef<Set<string>>(new Set());
    const lastSaveTime = useRef<number>(0);

    useEffect(() => {
        if (Date.now() - lastSaveTime.current < 5000) return;

        setLocalSettings(prevLocal => {
            const nextState = { ...settings };
            dirtyKeysRef.current.forEach(key => {
                // @ts-ignore
                if (prevLocal[key] !== undefined) {
                    // @ts-ignore
                    nextState[key] = prevLocal[key];
                }
            });
            if (JSON.stringify(prevLocal) !== JSON.stringify(nextState)) {
                return nextState;
            }
            return prevLocal;
        });
    }, [settings]);

    // FIX SEGURIDAD: Se eliminó el useEffect[activeSection] que llamaba api.getAllData()
    // cada vez que el admin navegaba entre pestañas de configuración.
    // Eso generaba hasta 8 peticiones GET pesadas por sesión de admin.
    // Los datos ya están en el prop `settings` (sincronizado desde StoreContext).
    // Si el admin necesita datos frescos, puede usar el botón "Descartar / Recargar".

    const handleLocalUpdate = (update: Partial<StoreSettings>) => {
        Object.keys(update).forEach(key => dirtyKeysRef.current.add(key));
        setLocalSettings(prev => ({ ...prev, ...update }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        lastSaveTime.current = Date.now();

        try {
            // FIX SEGURIDAD: Se eliminó api.getAllData() pre-guardado.
            // Usamos directamente settings (prop del contexto) como base,
            // y aplicamos encima solo las claves modificadas (dirtyKeysRef).
            // Esto elimina 1 GET por cada click en "Guardar Configuración".
            const finalSettings = { ...settings };

            if (dirtyKeysRef.current.size > 0) {
                dirtyKeysRef.current.forEach(key => {
                    // @ts-ignore
                    finalSettings[key] = localSettings[key];
                });
            } else {
                Object.assign(finalSettings, localSettings);
            }

            await updateSettings(finalSettings);
            addNotification({ title: 'Guardado Exitoso', body: 'Configuración sincronizada con la Base de Datos.', type: 'success' });

            setLocalSettings(finalSettings);
            dirtyKeysRef.current.clear();

        } catch (e: any) {
            console.error(e);
            addNotification({ title: 'Error', body: 'No se pudo guardar. Verifique su conexión.', type: 'warning' });
            lastSaveTime.current = 0;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (window.confirm('¿Recargar datos REALES de la base de datos? Se perderán cambios no guardados.')) {
            setIsSaving(true);
            try {
                const fresh = await api.getAllData();
                if (fresh && fresh.settings) {
                    setLocalSettings(fresh.settings);
                    updateSettings(fresh.settings);
                } else {
                    setLocalSettings(JSON.parse(JSON.stringify(settings)));
                }
                dirtyKeysRef.current.clear();
                lastSaveTime.current = 0;
                addNotification({ title: 'Datos Recargados', body: 'Visualizando datos frescos del servidor.', type: 'info' });
            } catch (e) {
                addNotification({ title: 'Error', body: 'No se pudo recargar.', type: 'warning' });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const TabButton = ({ id, label, icon }: any) => (
        <button
            onClick={() => setActiveSection(id)}
            className={`w-auto md:w-full shrink-0 whitespace-nowrap flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-3 rounded-xl transition-all ${activeSection === id ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'}`}
        >
            {icon}
            <span className="text-xs sm:text-sm font-bold">{label}</span>
        </button>
    );

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 sm:gap-6 pb-28 md:pb-8 animate-fade-in">
            {/* Sidebar de Navegación */}
            <div className="w-full md:w-64 shrink-0 bg-white dark:bg-zinc-900 rounded-2xl md:rounded-[2rem] p-2 sm:p-4 shadow-sm border border-gray-100 dark:border-white/5 h-fit">
                <h3 className="hidden md:block text-xs font-black text-gray-400 uppercase tracking-widest px-4 mb-4 mt-2">Menú Ajustes</h3>
                <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar scrollbar-none pb-1 md:pb-0">
                    <TabButton id="general" label="General" icon={<LayoutTemplate size={16} />} />
                    <TabButton id="branches" label="Sedes" icon={<Store size={16} />} />
                    <TabButton id="appearance" label="Apariencia" icon={<Palette size={16} />} />
                    <TabButton id="hero" label="Portada" icon={<Home size={16} />} />
                    <TabButton id="gift" label="Regalo" icon={<Gift size={16} />} />
                    <TabButton id="finance" label="Finanzas" icon={<Banknote size={16} />} />
                    <TabButton id="data" label="Datos" icon={<Database size={16} />} />
                    <TabButton id="security" label="Seguridad" icon={<ShieldCheck size={16} />} />
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/10 sticky top-0 z-20 shadow-sm transition-all">
                    <h2 className="text-xl font-bold dark:text-white px-2 hidden sm:block">
                        {activeSection === 'general' && 'Información General'}
                        {activeSection === 'branches' && 'Gestión de Sedes'}
                        {activeSection === 'appearance' && 'Diseño e Identidad'}
                        {activeSection === 'hero' && 'Sección de Portada'}
                        {activeSection === 'gift' && 'Promoción Especial (Gift)'}
                        {activeSection === 'finance' && 'Precios y Finanzas'}
                        {activeSection === 'data' && 'Gestión de Datos'}
                        {activeSection === 'security' && 'Seguridad de Acceso'}
                    </h2>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleDiscard} className="px-3" title="Forzar recarga desde BD">
                            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Database size={18} />}
                        </Button>
                        {/* El botón de guardar se oculta en pestañas que tienen su propia lógica de guardado */}
                        {activeSection !== 'branches' && activeSection !== 'data' && (
                            <Button onClick={handleSave} loading={isSaving} className="gap-2 px-6 font-bold shadow-ios-blue/30 h-10 text-sm flex-1 sm:flex-none">
                                <Save size={16} /> Guardar Cambios
                            </Button>
                        )}
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {activeSection === 'general' && <GeneralTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                    {activeSection === 'branches' && <BranchesTab />}
                    {activeSection === 'appearance' && <AppearanceTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                    {activeSection === 'hero' && <HeroTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                    {activeSection === 'gift' && <GiftBannerTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                    {activeSection === 'finance' && <FinanceTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                    {activeSection === 'data' && <DataManagementTab />}
                    {activeSection === 'security' && <SecurityTab settings={localSettings} onUpdate={handleLocalUpdate} />}
                </div>
            </div>
        </div>
    );
};
