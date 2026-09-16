
import React, { useState } from 'react';
import { Card, Input, ImageUploader } from '../../UIComponents';
import { LayoutTemplate, Smartphone, MapPin, Mail, Instagram, Facebook, Twitter, Globe, X, MessageCircle, Clock, Megaphone, Tag, Sparkles, Copy, Check, ExternalLink, Layers, Timer } from 'lucide-react';
import { StoreSettings } from '../../../types';

interface GeneralTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onUpdate }) => {
    const [copiedPreview, setCopiedPreview] = useState(false);
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

                    <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div className="pr-4">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white">Permitir Ventas con Stock Negativo (POS)</h4>
                            <p className="text-xs text-gray-500 mt-1">Permite procesar ventas en el Punto de Venta aun si el inventario registrado en el sistema es menor a la cantidad despachada físicamente.</p>
                        </div>
                        <button
                            onClick={() => onUpdate({ allowNegativeStock: !settings.allowNegativeStock })}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.allowNegativeStock ? 'bg-ios-blue shadow-lg shadow-ios-blue/30' : 'bg-gray-200 dark:bg-white/10'}`}
                        >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.allowNegativeStock ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>
            </Card>

            {/* ANUNCIO (BARRA O POPUP DE DESCUENTO) */}
            <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                            <Megaphone size={20} className="text-amber-500" />
                            Anuncio
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Configura un aviso en barra superior o un popup emergente para destacar promociones y descuentos.
                        </p>
                    </div>
                    <button
                        onClick={() => onUpdate({ announcementBarEnabled: !settings.announcementBarEnabled })}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.announcementBarEnabled ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-gray-200 dark:bg-white/10'}`}
                        title={settings.announcementBarEnabled ? 'Desactivar anuncio' : 'Activar anuncio'}
                    >
                        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.announcementBarEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {settings.announcementBarEnabled && (
                    <div className="space-y-5 pt-2">
                        {/* Selector de Formato: Barra vs Popup */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 flex items-center gap-1.5">
                                <Layers size={14} /> Formato de Presentación
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => onUpdate({ announcementType: 'bar' })}
                                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                                        settings.announcementType !== 'popup'
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm ring-1 ring-amber-500/30'
                                            : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl shrink-0 ${settings.announcementType !== 'popup' ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                                        <Megaphone size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            Barra Superior
                                            {settings.announcementType !== 'popup' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">Activa</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                            Cintillo continuo en la parte superior de la página web. Ideal para avisos rápidos o envío gratis.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onUpdate({ announcementType: 'popup' })}
                                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                                        settings.announcementType === 'popup'
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm ring-1 ring-amber-500/30'
                                            : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl shrink-0 ${settings.announcementType === 'popup' ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                                        <Tag size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            Popup de Descuento
                                            {settings.announcementType === 'popup' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">Activo</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                            Ventana emergente flotante con cupón copiable, botón de compra y mayor impacto visual.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Previsualización en Vivo */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-xs font-semibold text-ios-subtext uppercase flex items-center gap-1.5">
                                    <Sparkles size={13} className="text-amber-500" />
                                    Vista Previa en Tiempo Real
                                </label>
                                <span className="text-[11px] text-gray-400">
                                    {settings.announcementType === 'popup' ? 'Simulación de modal emergente' : 'Simulación de barra'}
                                </span>
                            </div>

                            <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center justify-center min-h-[120px] overflow-hidden">
                                {settings.announcementType === 'popup' ? (
                                    /* Preview de Popup de Descuento */
                                    <div
                                        className="max-w-sm w-full rounded-2xl p-5 shadow-xl relative border transition-all text-center space-y-3"
                                        style={{
                                            backgroundColor: settings.announcementBarBgColor || '#111827',
                                            color: settings.announcementBarTextColor || '#ffffff',
                                            borderColor: 'rgba(255,255,255,0.15)'
                                        }}
                                    >
                                        <span className="absolute right-3 top-3 opacity-60 text-xs">✕</span>

                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold tracking-wide uppercase backdrop-blur-sm">
                                            <Sparkles size={10} /> OFERTA ESPECIAL
                                        </div>

                                        <h4 className="font-black text-base leading-tight">
                                            {settings.announcementTitle || '¡Descuento Especial! 🎉'}
                                        </h4>

                                        <p className="text-xs opacity-90 leading-relaxed">
                                            {settings.announcementBarText || 'Obten un descuento especial usando la palabra SAMARA 😍'}
                                        </p>

                                        {settings.announcementCouponCode && (
                                            <div className="bg-black/25 dark:bg-white/10 border border-dashed border-white/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                                                <div className="text-left">
                                                    <span className="text-[9px] uppercase tracking-wider block opacity-70">Código de Descuento</span>
                                                    <span className="font-mono font-bold text-sm tracking-wider">{settings.announcementCouponCode}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCopiedPreview(true);
                                                        setTimeout(() => setCopiedPreview(false), 2000);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-white text-gray-900 flex items-center gap-1 hover:bg-gray-100 active:scale-95"
                                                >
                                                    {copiedPreview ? (
                                                        <>
                                                            <Check size={12} className="text-emerald-600" />
                                                            <span className="text-emerald-700">¡Copiado!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={12} />
                                                            <span>Copiar</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all brightness-105 active:scale-95 flex items-center justify-center gap-1.5"
                                                style={{
                                                    backgroundColor: settings.announcementBarTextColor || '#ffffff',
                                                    color: settings.announcementBarBgColor || '#111827'
                                                }}
                                            >
                                                {settings.announcementButtonText || 'Aprovechar Descuento'}
                                                <ExternalLink size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Preview de Barra Superior */
                                    <div
                                        className="w-full py-2.5 px-10 rounded-xl text-center text-xs font-semibold relative overflow-hidden shadow-sm"
                                        style={{
                                            backgroundColor: settings.announcementBarBgColor || '#0071E3',
                                            color: settings.announcementBarTextColor || '#ffffff'
                                        }}
                                    >
                                        {settings.announcementBarText || '🚚 Envío gratis en compras mayores a $50'}
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 text-[10px]">✕</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Campos de Configuración */}
                        <div className="space-y-4">
                            {/* Campos específicos para Popup */}
                            {settings.announcementType === 'popup' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Título del Descuento / Popup</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-amber-500/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white"
                                        value={settings.announcementTitle || ''}
                                        onChange={e => onUpdate({ announcementTitle: e.target.value })}
                                        placeholder="Ej: ¡Descuento Especial! 🎉 o ¡15% OFF en tu compra!"
                                    />
                                </div>
                            )}

                            {/* Texto principal / mensaje */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">
                                    {settings.announcementType === 'popup' ? 'Mensaje o Descripción de la Oferta' : 'Texto del Anuncio'}
                                </label>
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-amber-500/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[75px] resize-y"
                                    value={settings.announcementBarText || ''}
                                    onChange={e => onUpdate({ announcementBarText: e.target.value })}
                                    placeholder={settings.announcementType === 'popup' ? "Ej: Obten un descuento especial usando la palabra SAMARA 😍" : "Ej: 🚚 Envío gratis en pedidos mayores a $50"}
                                />
                            </div>

                            {/* Campos avanzados exclusivos del Popup */}
                            {settings.announcementType === 'popup' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 flex items-center gap-1">
                                            <Tag size={13} className="text-amber-500" />
                                            Código de Cupón (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-amber-500/50 rounded-2xl px-4 py-3 outline-none text-sm font-mono uppercase dark:text-white font-bold"
                                            value={settings.announcementCouponCode || ''}
                                            onChange={e => onUpdate({ announcementCouponCode: e.target.value.toUpperCase().trim() })}
                                            placeholder="Ej: SAMARA o PROMO10"
                                        />
                                        <p className="text-[11px] text-gray-500 ml-1">Se mostrará una caja estilizada para copiarlo con un clic.</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Texto del Botón (CTA)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-amber-500/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white"
                                            value={settings.announcementButtonText || ''}
                                            onChange={e => onUpdate({ announcementButtonText: e.target.value })}
                                            placeholder="Ej: Aprovechar Descuento o Comprar Ahora"
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 flex items-center gap-1">
                                            <Timer size={13} className="text-amber-500" />
                                            Tiempo de Espera para Aparecer
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: 'Inmediato (0s)', value: 0 },
                                                { label: '1 segundo', value: 1 },
                                                { label: '2 segundos', value: 2 },
                                                { label: '4 segundos', value: 4 },
                                            ].map(opt => {
                                                const currentDelay = settings.announcementPopupDelay ?? 1;
                                                const isSelected = currentDelay === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => onUpdate({ announcementPopupDelay: opt.value })}
                                                        className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                                                            isSelected
                                                                ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-sm'
                                                                : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Enlace de destino */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Enlace al hacer clic (opcional)</label>
                                <input
                                    type="url"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-amber-500/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white"
                                    value={settings.announcementBarLink || ''}
                                    onChange={e => onUpdate({ announcementBarLink: e.target.value })}
                                    placeholder="https://... o /shop"
                                />
                            </div>

                            {/* Colores */}
                            <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Color de Fondo</label>
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl px-4 py-2">
                                            <input
                                                type="color"
                                                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                                                value={settings.announcementBarBgColor || (settings.announcementType === 'popup' ? '#111827' : '#0071E3')}
                                                onChange={e => onUpdate({ announcementBarBgColor: e.target.value })}
                                            />
                                            <span className="text-sm text-gray-500 dark:text-gray-300 font-mono">
                                                {settings.announcementBarBgColor || (settings.announcementType === 'popup' ? '#111827' : '#0071E3')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Color de Texto</label>
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl px-4 py-2">
                                            <input
                                                type="color"
                                                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                                                value={settings.announcementBarTextColor || '#ffffff'}
                                                onChange={e => onUpdate({ announcementBarTextColor: e.target.value })}
                                            />
                                            <span className="text-sm text-gray-500 dark:text-gray-300 font-mono">{settings.announcementBarTextColor || '#ffffff'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Presets Rápidos de Paleta */}
                                <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                                    <span className="text-[11px] text-gray-400 shrink-0 font-medium">Paletas sugeridas:</span>
                                    {[
                                        { bg: '#111827', text: '#ffffff', label: 'Dark Sleek' },
                                        { bg: '#0071E3', text: '#ffffff', label: 'Azul Apple' },
                                        { bg: '#D97706', text: '#ffffff', label: 'Dorado Promo' },
                                        { bg: '#7C3AED', text: '#ffffff', label: 'Púrpura Oferta' },
                                        { bg: '#DC2626', text: '#ffffff', label: 'Rojo Urgente' },
                                        { bg: '#059669', text: '#ffffff', label: 'Verde Éxito' }
                                    ].map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => onUpdate({
                                                announcementBarBgColor: preset.bg,
                                                announcementBarTextColor: preset.text
                                            })}
                                            className="px-2.5 py-1 rounded-full text-[11px] border border-gray-200 dark:border-white/10 flex items-center gap-1.5 hover:scale-105 transition-all bg-white dark:bg-white/5"
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.bg }} />
                                            <span className="text-gray-600 dark:text-gray-300">{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Opciones de cierre */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                                        Permitir cerrar el {settings.announcementType === 'popup' ? 'popup' : 'anuncio'}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        El usuario puede cerrarlo con la "✕". Se recuerda por sesión para no interrumpir su navegación.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onUpdate({ announcementBarDismissible: !settings.announcementBarDismissible })}
                                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.announcementBarDismissible !== false ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-gray-200 dark:bg-white/10'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.announcementBarDismissible !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><MapPin size={20} className="text-ios-blue" /> Footer y Redes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">

                        {/* Toggle: Ocultar marca en footer */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-white">Ocultar Logo y Nombre en Footer</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Esconde la columna de marca (logo, descripción y WhatsApp) del pie de página.</p>
                            </div>
                            <button
                                onClick={() => onUpdate({ hideFooterBrand: !settings.hideFooterBrand })}
                                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.hideFooterBrand ? 'bg-ios-blue shadow-lg shadow-ios-blue/30' : 'bg-gray-200 dark:bg-white/10'}`}
                            >
                                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.hideFooterBrand ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {!settings.hideFooterBrand && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Descripción Footer</label>
                            <textarea className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[80px]" value={settings.footerDescription || ''} onChange={e => onUpdate({ footerDescription: e.target.value })} placeholder="Breve texto sobre tu tienda..." />
                        </div>
                        )}
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
                                <Input placeholder="Twitter / X URL" value={settings.socialTwitter || ''} onChange={e => onUpdate({ socialTwitter: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-900 dark:bg-white/10 rounded-xl flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z"/></svg>
                                </div>
                                <Input placeholder="TikTok URL" value={settings.socialTiktok || ''} onChange={e => onUpdate({ socialTiktok: e.target.value })} />
                            </div>
                        </div>

                        {/* Horario de Atención */}
                        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-3">Horario de Atención</h4>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-ios-blue/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Clock size={18} className="text-ios-blue" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <textarea
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none text-sm dark:text-white min-h-[70px]"
                                        value={settings.businessHours || ''}
                                        onChange={e => onUpdate({ businessHours: e.target.value })}
                                        placeholder="Lunes a Viernes: 9am - 6pm&#10;Sábados: 10am - 3pm"
                                    />
                                    <p className="text-[10px] text-gray-400 ml-1">Aparece en el footer del sitio.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* NUEVA SECCIÓN: BOTÓN FLOTANTE WHATSAPP */}
            <Card className="p-6 space-y-5">
                <h3 className="font-bold flex items-center gap-2 dark:text-white">
                    <MessageCircle size={20} className="text-green-500" /> Botón Flotante de WhatsApp
                </h3>

                <div className="flex items-start justify-between gap-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20">
                    <div>
                        <h4 className="text-sm font-bold text-green-700 dark:text-green-400">Mostrar botón flotante en el sitio</h4>
                        <p className="text-xs text-gray-500 mt-1">Aparece un botón verde con el logo de WhatsApp en todas las páginas públicas, fijo en la esquina inferior derecha.</p>
                    </div>
                    <button
                        onClick={() => onUpdate({ showWhatsappFloat: !settings.showWhatsappFloat })}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${settings.showWhatsappFloat ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-gray-200 dark:bg-white/10'}`}
                    >
                        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${settings.showWhatsappFloat ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {settings.showWhatsappFloat && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1">Mensaje Predeterminado (opcional)</label>
                        <textarea
                            className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl px-4 py-3 outline-none transition-all text-sm dark:text-white min-h-[80px]"
                            value={settings.whatsappFloatMessage || ''}
                            onChange={e => onUpdate({ whatsappFloatMessage: e.target.value })}
                            placeholder="Hola! Me interesa conocer sus productos..."
                        />
                        <p className="text-[10px] text-gray-400 ml-1">Este mensaje se rellenará automáticamente al abrir el chat. Si se deja vacío, abre el chat sin mensaje.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};
