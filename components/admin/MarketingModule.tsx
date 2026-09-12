import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Button } from '../UIComponents';
import { 
    Tag, Trash2, Percent, DollarSign, Copy, Check, Search, Sparkles, 
    Bell, Send, Users, Smartphone, Zap, ExternalLink, RefreshCw, ShoppingCart, Clock,
    Settings2, RotateCcw, Save, MessageSquareText
} from 'lucide-react';
import { Coupon } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../services/api';

// Plantillas por defecto del sistema
const DEFAULT_AUTO_TEMPLATES = {
    offer: {
        title: '🔥 ¡Oferta Relámpago en {tienda}!',
        body: '{producto} con {descuento}% de descuento. ¡Aprovecha antes de que se agote!'
    },
    coupon: {
        title: '🎟️ ¡Nuevo Cupón en {tienda}!',
        body: 'Usa el código {cupon} para obtener {descuento} en tu próxima compra.'
    },
    category: {
        title: '✨ ¡Nueva Categoría en {tienda}!',
        body: 'Descubre nuestra nueva sección: {categoria}. ¡Explora todos los productos disponibles!'
    },
    abandonedCart: {
        title: '🛒 ¡Tus compras en {tienda} te esperan!',
        body: '{saludo}Dejaste \'{producto}\' en tu carrito. Completa tu pedido antes de que se agoten.'
    },
    inactiveUsers: {
        title: '✨ ¡Te extrañamos en {tienda}!',
        body: '{saludo}Tenemos nuevos productos y ofertas esperándote en la tienda hoy.'
    }
};

export const MarketingModule = ({ coupons, addCoupon, toggleCoupon, deleteCoupon, settings, updateSettings }: any) => {
    const { addNotification, permission, requestPermission, subscribeToPush } = useNotification();
    
    // Pestaña activa: 'coupons' | 'push' | 'templates'
    const [activeTab, setActiveTab] = useState<'coupons' | 'push' | 'templates'>('coupons');

    // Nombre dinámico de la tienda configurado
    const storeTitle = settings?.storeName || 'Mi Tienda';

    // ==========================================
    // ESTADO DE CUPONES
    // ==========================================
    const [code, setCode] = useState('');
    const [val, setVal] = useState<number | ''>('');
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // ==========================================
    // ESTADO DE CAMPAÑAS PUSH PERSONALIZADAS
    // ==========================================
    const [pushTitle, setPushTitle] = useState(`✨ Novedades en ${storeTitle}`);
    const [pushBody, setPushBody] = useState('');
    const [pushUrl, setPushUrl] = useState('./');
    const [isSendingPush, setIsSendingPush] = useState(false);
    const [isTestingPush, setIsTestingPush] = useState(false);
    const [pushStats, setPushStats] = useState<{ total: number; active30d: number; cartsPending: number }>({
        total: 0,
        active30d: 0,
        cartsPending: 0
    });
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [lastSendReport, setLastSendReport] = useState<string | null>(null);

    // ==========================================
    // ESTADO DE PLANTILLAS AUTOMÁTICAS
    // ==========================================
    const [autoTemplates, setAutoTemplates] = useState(() => {
        const saved = settings?.pushTemplates;
        if (saved && typeof saved === 'object') {
            return {
                offer: { ...DEFAULT_AUTO_TEMPLATES.offer, ...(saved.offer || {}) },
                coupon: { ...DEFAULT_AUTO_TEMPLATES.coupon, ...(saved.coupon || {}) },
                category: { ...DEFAULT_AUTO_TEMPLATES.category, ...(saved.category || {}) },
                abandonedCart: { ...DEFAULT_AUTO_TEMPLATES.abandonedCart, ...(saved.abandonedCart || {}) },
                inactiveUsers: { ...DEFAULT_AUTO_TEMPLATES.inactiveUsers, ...(saved.inactiveUsers || {}) },
            };
        }
        return DEFAULT_AUTO_TEMPLATES;
    });

    const [isSavingTemplates, setIsSavingTemplates] = useState(false);

    // Sincronizar plantillas si settings cambia externamente
    useEffect(() => {
        if (settings?.pushTemplates && typeof settings.pushTemplates === 'object') {
            setAutoTemplates({
                offer: { ...DEFAULT_AUTO_TEMPLATES.offer, ...(settings.pushTemplates.offer || {}) },
                coupon: { ...DEFAULT_AUTO_TEMPLATES.coupon, ...(settings.pushTemplates.coupon || {}) },
                category: { ...DEFAULT_AUTO_TEMPLATES.category, ...(settings.pushTemplates.category || {}) },
                abandonedCart: { ...DEFAULT_AUTO_TEMPLATES.abandonedCart, ...(settings.pushTemplates.abandonedCart || {}) },
                inactiveUsers: { ...DEFAULT_AUTO_TEMPLATES.inactiveUsers, ...(settings.pushTemplates.inactiveUsers || {}) },
            });
        }
    }, [settings?.pushTemplates]);

    // Actualizar título de push si cambia el storeTitle
    useEffect(() => {
        if (pushTitle === '✨ Novedades en Mi Tienda' || pushTitle.startsWith('✨ Novedades en ')) {
            setPushTitle(`✨ Novedades en ${storeTitle}`);
        }
    }, [storeTitle]);

    // Cargar estadísticas de suscriptores al abrir la pestaña de push
    const loadPushStats = async () => {
        setIsLoadingStats(true);
        try {
            const res = await api.getPushStats();
            if (res) {
                setPushStats({
                    total: res.total || 0,
                    active30d: res.active30d || 0,
                    cartsPending: res.cartsPending || 0
                });
            }
        } catch (e) {
            console.warn("No se pudieron cargar estadísticas de push", e);
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'push') {
            loadPushStats();
        }
    }, [activeTab]);

    // Plantillas rápidas para broadcast
    const pushTemplates = [
        {
            label: '🔥 Oferta Flash',
            title: `🔥 ¡Super Oferta en ${storeTitle}!`,
            body: 'Aprovecha descuentos exclusivos por tiempo limitado en artículos seleccionados. ¡Entra ya!',
            url: './?filter=offers'
        },
        {
            label: '📦 Nuevos Ingresos',
            title: `✨ ¡Nueva Mercancía en ${storeTitle}!`,
            body: 'Acabamos de recibir productos increíbles que te van a encantar. ¡Descubre lo nuevo!',
            url: './'
        },
        {
            label: '🚚 Envío Especial',
            title: `🚚 ¡Promoción de Envíos en ${storeTitle}!`,
            body: 'Aprovecha nuestras tarifas especiales de entrega en tus compras de hoy.',
            url: './'
        },
        {
            label: '🎟️ Cupón de Regalo',
            title: `🎁 ¡Tenemos un Regalo para ti en ${storeTitle}!`,
            body: 'Usa tu cupón exclusivo y ahorra en tu próxima compra online.',
            url: './'
        }
    ];

    const applyTemplate = (tpl: typeof pushTemplates[0]) => {
        setPushTitle(tpl.title);
        setPushBody(tpl.body);
        setPushUrl(tpl.url);
    };

    // Guardar plantillas automáticas en BD
    const handleSaveAutoTemplates = async () => {
        setIsSavingTemplates(true);
        try {
            const updatedPayload = {
                ...(settings || {}),
                pushTemplates: autoTemplates
            };

            if (updateSettings) {
                await updateSettings({ pushTemplates: autoTemplates });
            } else {
                await api.saveSettings(updatedPayload);
            }

            addNotification({
                title: 'Plantillas Guardadas',
                body: 'Los textos automáticos de las notificaciones push han sido actualizados con éxito.',
                type: 'success'
            });
        } catch (e: any) {
            alert('Error al guardar las plantillas: ' + (e?.message || 'Error del servidor'));
        } finally {
            setIsSavingTemplates(false);
        }
    };

    const handleResetTemplate = (key: keyof typeof DEFAULT_AUTO_TEMPLATES) => {
        setAutoTemplates(prev => ({
            ...prev,
            [key]: { ...DEFAULT_AUTO_TEMPLATES[key] }
        }));
    };

    // Helper para previsualizar plantillas automáticas con datos de prueba
    const previewAutoTemplate = (template: { title: string; body: string }, sampleVars: Record<string, string | number>) => {
        let title = template.title;
        let body = template.body;

        const allVars: Record<string, string | number> = {
            tienda: storeTitle,
            ...sampleVars
        };

        for (const [k, v] of Object.entries(allVars)) {
            title = title.replaceAll(`{${k}}`, String(v));
            body = body.replaceAll(`{${k}}`, String(v));
        }

        return { title, body };
    };

    // Enviar notificación de prueba a mi propio navegador
    const handleSendTestPush = async () => {
        setIsTestingPush(true);
        try {
            if (!('Notification' in window)) {
                alert('Tu navegador actual no soporta notificaciones Web Push.');
                return;
            }

            if (Notification.permission === 'denied') {
                alert('Las notificaciones están bloqueadas en este navegador. Por favor actívalas en la configuración de permisos del sitio en tu navegador.');
                return;
            }

            if (Notification.permission !== 'granted') {
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') {
                    alert('Debes conceder permiso de notificaciones para que este dispositivo pueda recibir alertas.');
                    return;
                }
            }

            // Asegurar que la suscripción esté creada y guardada en el servidor
            let endpoint = localStorage.getItem('ara_push_endpoint');
            if (!endpoint && subscribeToPush) {
                const sub = await subscribeToPush(true);
                endpoint = sub?.endpoint || null;
            }

            try {
                const res: any = await api.testPush(endpoint || undefined);
                if (res?.result && res.result.success === false) {
                    throw new Error(res.result.error || 'El servicio Push rechazó la entrega.');
                }
                addNotification({
                    title: 'Push de Prueba Enviado',
                    body: 'Notificación despachada con éxito. Revisa la bandeja de este dispositivo.',
                    type: 'success'
                });
            } catch (apiErr: any) {
                // Si el backend indica que el endpoint no existe o expiró, forzar renovación y reintentar una vez
                if (subscribeToPush && (apiErr?.message?.includes('no registrado') || apiErr?.message?.includes('expirada') || apiErr?.message?.includes('410'))) {
                    const freshSub = await subscribeToPush(true);
                    if (freshSub?.endpoint) {
                        const retryRes: any = await api.testPush(freshSub.endpoint);
                        if (retryRes?.result && retryRes.result.success === false) {
                            throw new Error(retryRes.result.error);
                        }
                        addNotification({
                            title: 'Suscripción Renovada',
                            body: 'Push de prueba reenviado tras renovar la suscripción en el servidor.',
                            type: 'success'
                        });
                        return;
                    }
                }
                throw apiErr;
            }
        } catch (e: any) {
            alert('Error al enviar push de prueba: ' + (e?.message || 'Verifica la conexión y permisos'));
        } finally {
            setIsTestingPush(false);
        }
    };

    // Enviar notificación masiva a todos los clientes suscritos
    const handleSendBroadcastPush = async () => {
        if (!pushBody.trim()) {
            alert('Por favor escribe el mensaje de la notificación.');
            return;
        }

        const audienceCount = pushStats.total;
        const confirmMsg = audienceCount > 0
            ? `¿Deseas enviar esta notificación a los ${audienceCount} clientes suscritos?\n\nTítulo: "${pushTitle}"\nMensaje: "${pushBody}"`
            : `¿Deseas enviar esta notificación a todos los clientes suscritos?\n\nTítulo: "${pushTitle}"\nMensaje: "${pushBody}"`;

        if (!window.confirm(confirmMsg)) return;

        setIsSendingPush(true);
        setLastSendReport(null);

        try {
            const res = await api.sendCustomPush({
                title: pushTitle.trim() || storeTitle,
                body: pushBody.trim(),
                url: pushUrl.trim() || './'
            });

            const successCount = res?.stats?.success ?? 0;
            const totalCount = res?.stats?.total ?? 0;
            const reportMsg = `Enviada exitosamente a ${successCount} de ${totalCount} clientes suscritos.`;

            setLastSendReport(reportMsg);
            addNotification({
                title: 'Campaña Push Enviada',
                body: reportMsg,
                type: 'success'
            });

            loadPushStats();
        } catch (e: any) {
            alert('Error al enviar la campaña: ' + (e?.message || 'Error del servidor'));
        } finally {
            setIsSendingPush(false);
        }
    };

    // ==========================================
    // GESTIÓN DE CUPONES
    // ==========================================
    const filteredCoupons = useMemo(() => {
        const list = Array.isArray(coupons) ? coupons : [];
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter((c: Coupon) => c.code.toLowerCase().includes(q));
    }, [coupons, searchTerm]);

    const stats = useMemo(() => {
        const list = Array.isArray(coupons) ? coupons : [];
        const activeCount = list.filter(c => c.active).length;
        const pausedCount = list.length - activeCount;
        return { total: list.length, active: activeCount, paused: pausedCount };
    }, [coupons]);

    const handleAddCoupon = () => {
        const cleanCode = code.toUpperCase().replace(/\s/g, '').trim();
        const numericVal = Number(val);

        if (!cleanCode) {
            alert('El código del cupón es obligatorio.');
            return;
        }
        if (cleanCode.length < 3) {
            alert('El código debe tener al menos 3 caracteres.');
            return;
        }
        if (isNaN(numericVal) || numericVal <= 0) {
            alert('El valor del descuento debe ser mayor a 0.');
            return;
        }
        if (discountType === 'percentage' && numericVal > 100) {
            alert('El porcentaje de descuento no puede ser mayor al 100%.');
            return;
        }

        const existing = (coupons || []).find((c: Coupon) => c.code.toUpperCase().trim() === cleanCode);
        if (existing) {
            if (!window.confirm(`El cupón "${cleanCode}" ya existe. ¿Deseas actualizar su valor y activarlo?`)) {
                return;
            }
        }

        addCoupon({ 
            code: cleanCode, 
            discountType, 
            value: numericVal, 
            active: true 
        });

        setCode(''); 
        setVal('');
        addNotification({ 
            title: existing ? 'Cupón Actualizado' : 'Cupón Creado', 
            body: `El código ${cleanCode} (${discountType === 'percentage' ? `${numericVal}%` : `$${numericVal}`}) está activo y se ha notificado a los clientes.`, 
            type: 'success' 
        });
    };

    const handleCopy = (couponCode: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(couponCode);
            setCopiedCode(couponCode);
            setTimeout(() => setCopiedCode(null), 2000);
            addNotification({ title: 'Copiado', body: `Código "${couponCode}" copiado al portapapeles.`, type: 'info' });
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-28 sm:pb-16">
            {/* Header del Módulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black dark:text-white flex items-center gap-2">
                        <Sparkles className="text-ios-blue" size={24} /> Marketing & Fidelización
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Crea cupones, envía notificaciones Web Push y personaliza los mensajes automáticos de <strong className="text-ios-blue">{storeTitle}</strong>.
                    </p>
                </div>

                {/* Selector de Pestañas */}
                <div className="flex items-center p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 w-full sm:w-auto overflow-x-auto no-scrollbar scrollbar-none shrink-0 gap-1">
                    <button
                        onClick={() => setActiveTab('coupons')}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'coupons'
                                ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Tag size={15} />
                        Cupones ({stats.total})
                    </button>
                    <button
                        onClick={() => setActiveTab('push')}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'push'
                                ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Bell size={15} />
                        Campañas Push
                        {pushStats.total > 0 && (
                            <span className="bg-ios-blue/10 text-ios-blue px-1.5 py-0.2 rounded-full text-[10px]">
                                {pushStats.total}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'templates'
                                ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Settings2 size={15} />
                        Mensajes Automáticos
                    </button>
                </div>
            </div>

            {/* ============================================================== */}
            {/* PESTAÑA 1: CAMPAÑAS PUSH MANUALES / BROADCAST                 */}
            {/* ============================================================== */}
            {activeTab === 'push' && (
                <div className="space-y-6">
                    {/* Tarjetas de Métricas de Audiencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Users size={12} className="text-ios-blue" /> Suscriptores Totales
                                </p>
                                <p className="text-2xl font-black dark:text-white mt-1">
                                    {isLoadingStats ? '...' : pushStats.total}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Dispositivos listos para recibir push</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                                <Bell size={20} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock size={12} className="text-green-500" /> Activos (Últimos 30d)
                                </p>
                                <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">
                                    {isLoadingStats ? '...' : pushStats.active30d}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Visitaron la app recientemente</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center">
                                <Zap size={20} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <ShoppingCart size={12} className="text-amber-500" /> Carritos en Espera
                                </p>
                                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                    {isLoadingStats ? '...' : pushStats.cartsPending}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Monitoreados por el cron automático</p>
                            </div>
                            <button 
                                onClick={loadPushStats} 
                                title="Actualizar estadísticas" 
                                className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-ios-blue transition-colors flex items-center justify-center"
                            >
                                <RefreshCw size={18} className={isLoadingStats ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Editor y Vista Previa */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Formulario de Creación de Push (7 cols) */}
                        <Card className="lg:col-span-7 p-6 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2 dark:text-white text-base">
                                    <Send size={18} className="text-ios-blue" /> Redactar Notificación Push
                                </h3>
                                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
                                    Nativo RFC 8292
                                </span>
                            </div>

                            {/* Plantillas Rápidas */}
                            <div className="space-y-1.5">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Plantillas Rápidas de 1 Clic:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {pushTemplates.map((tpl, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => applyTemplate(tpl)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-ios-blue/10 hover:text-ios-blue border border-gray-200/60 dark:border-white/5 transition-all"
                                        >
                                            {tpl.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Campo Título */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                    <span>Título de la Notificación</span>
                                    <span className="text-[10px] text-gray-400">{pushTitle.length}/60 car.</span>
                                </label>
                                <Input
                                    placeholder={`Ej: ¡Oferta Especial en ${storeTitle}!`}
                                    value={pushTitle}
                                    onChange={e => setPushTitle(e.target.value)}
                                    maxLength={60}
                                    className="font-bold"
                                />
                            </div>

                            {/* Campo Mensaje */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                    <span>Mensaje / Contenido</span>
                                    <span className="text-[10px] text-gray-400">{pushBody.length}/140 car.</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Escribe el mensaje que llegará al teléfono o computadora del cliente..."
                                    value={pushBody}
                                    onChange={e => setPushBody(e.target.value)}
                                    maxLength={140}
                                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-sm dark:text-white outline-none focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20 transition-all resize-none"
                                />
                            </div>

                            {/* Campo Enlace */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    Enlace al Tocar la Notificación (URL)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                    <div className="sm:col-span-8">
                                        <Input
                                            placeholder="./ o https://..."
                                            value={pushUrl}
                                            onChange={e => setPushUrl(e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="sm:col-span-4 flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setPushUrl('./')}
                                            className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300"
                                        >
                                            Inicio
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPushUrl('./?open_cart=1')}
                                            className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300"
                                        >
                                            Carrito
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Reporte de último envío si existe */}
                            {lastSendReport && (
                                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-xl text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                                    <Check size={16} className="text-green-500 shrink-0" />
                                    <span>{lastSendReport}</span>
                                </div>
                            )}

                            {/* Estado del Navegador Actual */}
                            <div className="flex items-center justify-between px-1 py-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${permission === 'granted' ? 'bg-green-500 animate-pulse' : permission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                    <span className="text-gray-500 dark:text-gray-400 font-medium text-[11px]">
                                        {permission === 'granted' ? 'Notificaciones activas en este navegador' : permission === 'denied' ? 'Notificaciones bloqueadas en este navegador' : 'Permiso pendiente de activación'}
                                    </span>
                                </div>
                                {permission !== 'granted' && (
                                    <button
                                        type="button"
                                        onClick={() => requestPermission()}
                                        className="text-[11px] font-bold text-ios-blue hover:underline"
                                    >
                                        Activar ahora
                                    </button>
                                )}
                            </div>

                            {/* Botones de Envío */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={handleSendTestPush}
                                    disabled={isTestingPush}
                                    className="w-full sm:w-auto h-11 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 font-bold border border-gray-200 dark:border-white/10"
                                >
                                    <Smartphone size={16} />
                                    {isTestingPush ? 'Enviando...' : 'Probar en mi Dispositivo'}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={handleSendBroadcastPush}
                                    disabled={isSendingPush || !pushBody.trim()}
                                    className="w-full sm:flex-1 h-11 bg-ios-blue hover:brightness-110 text-white font-bold shadow-lg shadow-ios-blue/25"
                                >
                                    <Send size={16} />
                                    {isSendingPush ? 'Transmitiendo...' : `Lanzar a los ${pushStats.total} Clientes`}
                                </Button>
                            </div>
                        </Card>

                        {/* Vista Previa Móvil (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Smartphone size={14} /> Vista Previa del Cliente
                                </p>
                                <span className="text-[10px] text-gray-400 font-medium">En vivo</span>
                            </div>

                            {/* Marco de Simulación Móvil */}
                            <div className="bg-gradient-to-b from-slate-900 to-black p-5 rounded-3xl border border-white/10 shadow-2xl space-y-4">
                                <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold px-1">
                                    <span>9:41</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px]">5G</span>
                                        <div className="w-5 h-2.5 rounded-sm border border-gray-400 p-0.5 flex items-center">
                                            <div className="w-full h-full bg-white rounded-2xs" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl space-y-2 text-left">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-ios-blue text-white flex items-center justify-center font-black text-[10px] shadow-sm">
                                                A
                                            </div>
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                {storeTitle}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-400">Ahora</span>
                                    </div>

                                    <div>
                                        <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">
                                            {pushTitle || `Novedades en ${storeTitle}`}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed break-words">
                                            {pushBody || 'Escribe un mensaje en el editor para ver cómo lo recibirán tus clientes en su pantalla.'}
                                        </p>
                                    </div>

                                    <div className="pt-1 flex items-center justify-between text-[10px] text-ios-blue font-bold border-t border-gray-100 dark:border-white/5">
                                        <span>Toca para abrir</span>
                                        <ExternalLink size={10} />
                                    </div>
                                </div>

                                <div className="text-center text-[10px] text-gray-500 pt-2">
                                    Simulación nativa Android / iOS / Desktop
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 2: MENSAJES AUTOMÁTICOS DEL SISTEMA (EDITABLES)       */}
            {/* ============================================================== */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Settings2 className="text-ios-blue" size={18} /> Textos de Notificaciones Automáticas
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                Personaliza cómo se expresan los mensajes que el servidor y el Cron envían solos. Usa las etiquetas como <code className="bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded text-ios-blue font-mono font-bold">{"{tienda}"}</code> o <code className="bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded text-ios-blue font-mono font-bold">{"{producto}"}</code>.
                            </p>
                        </div>
                        <Button
                            onClick={handleSaveAutoTemplates}
                            disabled={isSavingTemplates}
                            className="bg-ios-blue text-white font-bold h-11 px-5 shrink-0 shadow-lg shadow-ios-blue/20"
                        >
                            <Save size={16} />
                            {isSavingTemplates ? 'Guardando...' : 'Guardar Todos los Cambios'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Oferta de Producto */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center font-bold text-sm">
                                        🔥
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold dark:text-white">Oferta Relámpago de Producto</h4>
                                        <p className="text-[10px] text-gray-400">Disparo automático al activar rebaja en catálogo</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleResetTemplate('offer')}
                                    title="Restaurar texto predeterminado"
                                    className="p-1.5 text-gray-400 hover:text-ios-blue rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Título</label>
                                <Input
                                    value={autoTemplates.offer.title}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        offer: { ...prev.offer, title: e.target.value }
                                    }))}
                                    className="text-xs font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                                <textarea
                                    rows={2}
                                    value={autoTemplates.offer.body}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        offer: { ...prev.offer, body: e.target.value }
                                    }))}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs dark:text-white outline-none focus:border-ios-blue resize-none"
                                />
                            </div>

                            {/* Variables disponibles */}
                            <div className="text-[10px] text-gray-400 flex flex-wrap gap-1.5 items-center pt-1">
                                <span>Variables:</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{tienda}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{producto}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{descuento}"}</span>
                            </div>

                            {/* Preview */}
                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-left border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Vista Previa:</p>
                                {(() => {
                                    const p = previewAutoTemplate(autoTemplates.offer, { producto: 'Zapatos Deportivos', descuento: 30 });
                                    return (
                                        <>
                                            <p className="text-xs font-bold dark:text-white">{p.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.body}</p>
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>

                        {/* 2. Nuevo Cupón */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold text-sm">
                                        🎟️
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold dark:text-white">Nuevo Cupón de Descuento</h4>
                                        <p className="text-[10px] text-gray-400">Disparo automático al crear cupón activo</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleResetTemplate('coupon')}
                                    title="Restaurar texto predeterminado"
                                    className="p-1.5 text-gray-400 hover:text-ios-blue rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Título</label>
                                <Input
                                    value={autoTemplates.coupon.title}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        coupon: { ...prev.coupon, title: e.target.value }
                                    }))}
                                    className="text-xs font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                                <textarea
                                    rows={2}
                                    value={autoTemplates.coupon.body}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        coupon: { ...prev.coupon, body: e.target.value }
                                    }))}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs dark:text-white outline-none focus:border-ios-blue resize-none"
                                />
                            </div>

                            <div className="text-[10px] text-gray-400 flex flex-wrap gap-1.5 items-center pt-1">
                                <span>Variables:</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{tienda}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{cupon}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{descuento}"}</span>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-left border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Vista Previa:</p>
                                {(() => {
                                    const p = previewAutoTemplate(autoTemplates.coupon, { cupon: 'VERANO20', descuento: '20% de descuento' });
                                    return (
                                        <>
                                            <p className="text-xs font-bold dark:text-white">{p.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.body}</p>
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>

                        {/* 3. Nueva Categoría */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        ✨
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold dark:text-white">Nueva Categoría en la Tienda</h4>
                                        <p className="text-[10px] text-gray-400">Disparo automático al crear nueva categoría</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleResetTemplate('category')}
                                    title="Restaurar texto predeterminado"
                                    className="p-1.5 text-gray-400 hover:text-ios-blue rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Título</label>
                                <Input
                                    value={autoTemplates.category.title}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        category: { ...prev.category, title: e.target.value }
                                    }))}
                                    className="text-xs font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                                <textarea
                                    rows={2}
                                    value={autoTemplates.category.body}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        category: { ...prev.category, body: e.target.value }
                                    }))}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs dark:text-white outline-none focus:border-ios-blue resize-none"
                                />
                            </div>

                            <div className="text-[10px] text-gray-400 flex flex-wrap gap-1.5 items-center pt-1">
                                <span>Variables:</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{tienda}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{categoria}"}</span>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-left border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Vista Previa:</p>
                                {(() => {
                                    const p = previewAutoTemplate(autoTemplates.category, { categoria: 'Accesorios y Relojes' });
                                    return (
                                        <>
                                            <p className="text-xs font-bold dark:text-white">{p.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.body}</p>
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>

                        {/* 4. Carrito Abandonado */}
                        <Card className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold text-sm">
                                        🛒
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold dark:text-white">Recordatorio de Carrito Abandonado</h4>
                                        <p className="text-[10px] text-gray-400">Ejecutado por Cron tras +2 horas sin comprar</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleResetTemplate('abandonedCart')}
                                    title="Restaurar texto predeterminado"
                                    className="p-1.5 text-gray-400 hover:text-ios-blue rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Título</label>
                                <Input
                                    value={autoTemplates.abandonedCart.title}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        abandonedCart: { ...prev.abandonedCart, title: e.target.value }
                                    }))}
                                    className="text-xs font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                                <textarea
                                    rows={2}
                                    value={autoTemplates.abandonedCart.body}
                                    onChange={e => setAutoTemplates(prev => ({
                                        ...prev,
                                        abandonedCart: { ...prev.abandonedCart, body: e.target.value }
                                    }))}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs dark:text-white outline-none focus:border-ios-blue resize-none"
                                />
                            </div>

                            <div className="text-[10px] text-gray-400 flex flex-wrap gap-1.5 items-center pt-1">
                                <span>Variables:</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{tienda}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{producto}"}</span>
                                <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{saludo}"}</span>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-left border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Vista Previa:</p>
                                {(() => {
                                    const p = previewAutoTemplate(autoTemplates.abandonedCart, { saludo: '¡Hola Carlos! ', producto: 'Camisa Lino Azul' });
                                    return (
                                        <>
                                            <p className="text-xs font-bold dark:text-white">{p.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.body}</p>
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>

                        {/* 5. Clientes Inactivos */}
                        <Card className="p-5 space-y-4 md:col-span-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center font-bold text-sm">
                                        ⏰
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold dark:text-white">Reactivación de Clientes Inactivos (+15 días)</h4>
                                        <p className="text-[10px] text-gray-400">Ejecutado por Cron a clientes sin interacción reciente</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleResetTemplate('inactiveUsers')}
                                    title="Restaurar texto predeterminado"
                                    className="p-1.5 text-gray-400 hover:text-ios-blue rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Título</label>
                                        <Input
                                            value={autoTemplates.inactiveUsers.title}
                                            onChange={e => setAutoTemplates(prev => ({
                                                ...prev,
                                                inactiveUsers: { ...prev.inactiveUsers, title: e.target.value }
                                            }))}
                                            className="text-xs font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                                        <textarea
                                            rows={2}
                                            value={autoTemplates.inactiveUsers.body}
                                            onChange={e => setAutoTemplates(prev => ({
                                                ...prev,
                                                inactiveUsers: { ...prev.inactiveUsers, body: e.target.value }
                                            }))}
                                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-xs dark:text-white outline-none focus:border-ios-blue resize-none"
                                        />
                                    </div>

                                    <div className="text-[10px] text-gray-400 flex flex-wrap gap-1.5 items-center pt-1">
                                        <span>Variables:</span>
                                        <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{tienda}"}</span>
                                        <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-gray-600 dark:text-gray-300">{"{saludo}"}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl text-left border border-gray-100 dark:border-white/5 flex flex-col justify-center">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Vista Previa:</p>
                                    {(() => {
                                        const p = previewAutoTemplate(autoTemplates.inactiveUsers, { saludo: '¡Hola María! ' });
                                        return (
                                            <>
                                                <p className="text-sm font-bold dark:text-white">{p.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{p.body}</p>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 3: CUPONES DE DESCUENTO                               */}
            {/* ============================================================== */}
            {activeTab === 'coupons' && (
                <Card className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2 dark:text-white text-base">
                            <Tag size={20} className="text-ios-blue"/> Crear Nuevo Cupón
                        </h3>
                    </div>
                    
                    {/* Formulario de creación */}
                    <div className="bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                        <div className="flex items-center gap-2 p-1 bg-white dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
                            <button 
                                type="button"
                                onClick={() => setDiscountType('percentage')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'percentage' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                            >
                                <Percent size={14}/> Porcentaje (%)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setDiscountType('fixed')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'fixed' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                            >
                                <DollarSign size={14}/> Monto Fijo ($)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            <div className="sm:col-span-7">
                                <Input 
                                    placeholder="CÓDIGO (Ej: BIENVENIDO10, VERANO20)" 
                                    value={code} 
                                    onChange={e => setCode(e.target.value.toUpperCase())} 
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCoupon(); }}
                                    className="uppercase font-mono font-bold tracking-wider" 
                                />
                            </div>
                            <div className="sm:col-span-3">
                                <Input 
                                    type="number" 
                                    placeholder={discountType === 'percentage' ? "% Descuento" : "$ Descuento"} 
                                    value={val === '' ? '' : val} 
                                    onChange={e => setVal(e.target.value === '' ? '' : Number(e.target.value))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCoupon(); }}
                                    min={0}
                                    max={discountType === 'percentage' ? 100 : undefined}
                                    className="font-bold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Button 
                                    onClick={handleAddCoupon} 
                                    className="w-full h-11 font-bold shadow-lg shadow-ios-blue/20 bg-ios-blue hover:brightness-110"
                                >
                                    Crear
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Listado de cupones */}
                    <div className="space-y-4 pt-2">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Cupones Registrados ({filteredCoupons.length})
                            </h4>
                            
                            {(coupons || []).length > 3 && (
                                <div className="relative w-full sm:w-64">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cupón..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs dark:text-white outline-none focus:border-ios-blue/40"
                                    />
                                </div>
                            )}
                        </div>

                        {(coupons || []).length === 0 ? (
                            <div className="text-center text-gray-400 py-12 px-4 text-sm bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-2">
                                <Tag size={32} className="text-gray-300 dark:text-gray-600 mb-1" />
                                <p className="font-bold text-gray-600 dark:text-gray-300">No hay cupones creados</p>
                                <p className="text-xs text-gray-400">Crea tu primer cupón arriba para ofrecer promociones a tus clientes.</p>
                            </div>
                        ) : filteredCoupons.length === 0 ? (
                            <div className="text-center text-gray-400 py-8 text-xs bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                No se encontraron cupones con el término "{searchTerm}".
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredCoupons.map((c: Coupon) => {
                                    const isPercentage = (c.discountType === 'percentage' || (c as any).discount_type === 'percentage');
                                    const discountLabel = isPercentage ? `${c.value}%` : `$${c.value}`;
                                    
                                    return (
                                        <div 
                                            key={c.code} 
                                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                                                c.active 
                                                    ? 'bg-white dark:bg-zinc-800/80 border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-ios-blue/30' 
                                                    : 'bg-gray-50/70 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 opacity-75'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className={`w-3 h-3 rounded-full shrink-0 ${c.active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-mono font-black text-ios-text dark:text-white text-base tracking-wider truncate">
                                                            {c.code}
                                                        </p>
                                                        <button 
                                                            onClick={() => handleCopy(c.code)}
                                                            className="text-gray-400 hover:text-ios-blue transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
                                                            title="Copiar código"
                                                        >
                                                            {copiedCode === c.code ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            isPercentage 
                                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                        }`}>
                                                            {isPercentage ? <Percent size={10} /> : <DollarSign size={10} />}
                                                            {discountLabel} de descuento
                                                        </span>
                                                        <span className={`text-[10px] font-medium ${c.active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                                            {c.active ? 'Activo' : 'Pausado'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                <button 
                                                    onClick={() => toggleCoupon(c.code)} 
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                                        c.active 
                                                            ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400' 
                                                            : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400'
                                                    }`}
                                                >
                                                    {c.active ? 'Pausar' : 'Activar'}
                                                </button>
                                                <button 
                                                    onClick={() => { 
                                                        if (window.confirm(`¿Seguro que deseas eliminar el cupón "${c.code}"?`)) {
                                                            deleteCoupon(c.code);
                                                            addNotification({ title: 'Cupón Eliminado', body: `El cupón ${c.code} fue eliminado.`, type: 'info' });
                                                        } 
                                                    }} 
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                                                    title="Eliminar cupón"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};
