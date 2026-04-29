/**
 * integrations/araw/WarehouseSettings.tsx
 * Panel de configuración de la integración ARAW.
 * Guarda la config vía updateSettings() de StoreContext → api.php → BD.
 */

import React, { useState, useEffect } from 'react';
import { Warehouse, Key, Link2, CheckCircle, XCircle, Loader2, EyeOff, Eye, Save, Trash2 } from 'lucide-react';
import { useARAW } from './ARAWContext';
import { ARAWIntegrationConfig } from '../../types';

export const WarehouseSettings: React.FC = () => {
    const araw = useARAW();

    if (!araw) return null;

    const [form, setForm] = useState<Pick<ARAWIntegrationConfig, 'enabled' | 'arawBaseUrl' | 'apiKey'>>({
        enabled: araw.config.enabled,
        arawBaseUrl: araw.config.arawBaseUrl,
        apiKey: araw.config.apiKey,
    });
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Sincronizar form si el contexto cambia desde fuera
    useEffect(() => {
        setForm({
            enabled: araw.config.enabled,
            arawBaseUrl: araw.config.arawBaseUrl,
            apiKey: araw.config.apiKey,
        });
    }, [araw.config]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await araw.saveConfig(form);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } finally {
            setSaving(false);
        }
    };

    const handleValidate = async () => {
        // Guardar primero para que el contexto use datos frescos
        await araw.saveConfig(form);
        await araw.validateConnection();
    };

    const handleDisable = async () => {
        if (!window.confirm('¿Desactivar la integración con ARAW?\nLa API Key se mantendrá guardada.')) return;
        setForm(f => ({ ...f, enabled: false }));
        await araw.saveConfig({ enabled: false });
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-white/10 shadow-sm">
            {/* Cabecera */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                    <Warehouse size={22} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        Integración con Almacén Central (ARAW)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Permite pedir reposición de stock directamente desde el inventario.
                    </p>
                </div>
                <div className="ml-auto">
                    {araw.isActive ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle size={12} /> Activa
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400 rounded-full text-xs font-bold">
                            Inactiva
                        </span>
                    )}
                </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 mb-5">
                <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Activar integración</p>
                    <p className="text-xs text-gray-400">Habilita el botón "Reponer" en el inventario.</p>
                </div>
                <button
                    onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Campos */}
            <div className="space-y-4 mb-5">
                <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <Link2 size={12} /> URL base de ARAW
                    </label>
                    <input
                        type="url"
                        value={form.arawBaseUrl}
                        onChange={e => setForm(f => ({ ...f, arawBaseUrl: e.target.value }))}
                        placeholder="https://araware.lyberate.app/api/public/index.php?route="
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-400/30"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <Key size={12} /> API Key
                    </label>
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={form.apiKey}
                            onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                            placeholder="araw_key_••••••••••••••••••••••••"
                            className="w-full px-4 py-2.5 pr-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-400/30"
                        />
                        <button
                            onClick={() => setShowKey(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                        Obtén la API Key desde el panel de Integraciones de ARAW (se muestra solo una vez al generarla).
                    </p>
                </div>
            </div>

            {/* Estado de validación */}
            {araw.config.lastValidatedAt && araw.validationOk !== false && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-4">
                    <CheckCircle size={12} />
                    Conexión verificada el {new Date(araw.config.lastValidatedAt).toLocaleString('es-ES')}
                </div>
            )}
            {araw.validationOk === false && (
                <div className="text-xs text-red-500 flex items-center gap-1.5 mb-4">
                    <XCircle size={12} />
                    No se pudo conectar con ARAW. Verifica la URL y la API Key.
                </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={handleValidate}
                    disabled={araw.isValidating || !form.apiKey || !form.arawBaseUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                >
                    {araw.isValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {araw.isValidating ? 'Verificando...' : 'Probar conexión'}
                </button>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
                    {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar en BD'}
                </button>

                {araw.isActive && (
                    <button
                        onClick={handleDisable}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold transition-all"
                    >
                        <Trash2 size={14} /> Desactivar
                    </button>
                )}
            </div>
        </div>
    );
};
