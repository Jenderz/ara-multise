import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import {
    Bot, Send, X, MessageCircle, TrendingUp, AlertCircle, Package, DollarSign,
    ChevronDown, User, Calendar, Award, CreditCard, Sparkles, BarChart3, Zap,
    Mic, MicOff, Trash2, Copy, Check, ArrowRight, ExternalLink, RefreshCw,
    ShoppingBag, Clock, Coins, Layers, MapPin, Phone, Truck, ShieldCheck,
    Store, Tag, Calculator, Search, HelpCircle, CheckCircle2, Compass, Heart,
    Trophy, Printer, Image as ImageIcon, LayoutDashboard, Bell, FileText
} from 'lucide-react';
import { queryGeminiAI, hasGeminiApiKey } from '../../services/geminiService';
import { CURRENT_SYSTEM_VERSION, LATEST_RELEASE, VersionFeatureItem } from '../../data/versionUpdates';

export interface AssistantAction {
    label: string;
    tab?: 'dashboard' | 'pos' | 'inventory' | 'orders' | 'transactions' | 'customers' | 'users' | 'marketing' | 'settings' | 'statistics';
    url?: string;
    onClick?: () => void;
}

export interface AssistantMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    type?: 'text' | 'stats' | 'support' | 'products' | 'ranking' | 'projection' | 'briefing' | 'payment_methods' | 'rates' | 'branches' | 'orders_list' | 'coupons' | 'calculator' | 'store_info' | 'version_release';
    data?: any;
    action?: AssistantAction;
    timestamp: number;
}

export interface SmartAssistantProps {
    activeTab?: string;
    onNavigateTab?: (tab: any) => void;
    mode?: 'admin';
}

export const SmartAssistant: React.FC<SmartAssistantProps> = ({ activeTab, onNavigateTab }) => {
    const {
        orders, products, customers, settings, currentBranch, branches, switchBranch,
        coupons, categories, logs, currentUser, userRole
    } = useStore();
    const { exchangeRate, exchangeRateParalelo, exchangeRateEuro, activeExchangeRate } = useSettings();
    const navigate = useNavigate();

    // Detección de nueva versión no leída para el panel administrativo
    const [hasUnreadVersion, setHasUnreadVersion] = useState<boolean>(() => {
        try {
            const seen = localStorage.getItem('ara_admin_seen_version');
            return seen !== CURRENT_SYSTEM_VERSION;
        } catch {
            return false;
        }
    });

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const bcv = activeExchangeRate || exchangeRate || 1;
    const paralelo = exchangeRateParalelo || bcv;
    const euro = exchangeRateEuro || (bcv * 1.08);

    // Mensaje de bienvenida ejecutivo de ARA Copilot
    const welcomeMessage: AssistantMessage = useMemo(() => ({
        id: 'welcome',
        text: `¡Hola${currentUser?.name ? ' ' + currentUser.name : ''}! Soy **ARA**, tu copiloto de gestión comercial, inventario y POS ✨.\n\nEstoy conectada a tus sedes, pedidos, catálogo, caja y métricas en tiempo real. Puedes consultarme ventas, calcular vueltos, buscar pedidos por cliente o revisar stock cruzado.`,
        sender: 'bot',
        timestamp: Date.now()
    }), [currentUser?.name]);

    // Tarjeta oficial de novedades de la versión
    const versionReleaseMessage: AssistantMessage = useMemo(() => ({
        id: 'version-release-' + CURRENT_SYSTEM_VERSION,
        text: `🚀 **¡Nueva versión ARA v${CURRENT_SYSTEM_VERSION} disponible!**\n\n${LATEST_RELEASE.welcomeMessage}`,
        sender: 'bot',
        type: 'version_release',
        data: LATEST_RELEASE,
        timestamp: Date.now() + 1
    }), []);

    // Inicializar mensajes: si no ha visto la nueva versión, incluir la tarjeta de novedades de ARA
    const [messages, setMessages] = useState<AssistantMessage[]>(() => {
        const list = [welcomeMessage];
        try {
            if (localStorage.getItem('ara_admin_seen_version') !== CURRENT_SYSTEM_VERSION) {
                list.push(versionReleaseMessage);
            }
        } catch (_) {}
        return list;
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Auto-scroll al final del chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, isOpen]);

    // Limpieza de reconocimiento de voz al desmontar
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (_) {}
            }
        };
    }, []);

    // Abrir chat y marcar novedades como vistas
    const handleOpenChat = () => {
        setIsOpen(true);
        if (hasUnreadVersion) {
            try {
                localStorage.setItem('ara_admin_seen_version', CURRENT_SYSTEM_VERSION);
            } catch (_) {}
            setHasUnreadVersion(false);
        }
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleClearChat = () => {
        setMessages([welcomeMessage]);
    };

    // Dictado por voz usando Web Speech API
    const toggleSpeechRecognition = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Tu navegador no soporta reconocimiento de voz nativo. Prueba con Google Chrome o Microsoft Edge.");
            return;
        }

        if (isListening) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (_) {}
            }
            setIsListening(false);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event: any) => {
                const transcript = event.results?.[0]?.[0]?.transcript;
                if (transcript) {
                    setInput(transcript);
                    setTimeout(() => handleSend(undefined, transcript), 300);
                }
            };
            recognition.onerror = (err: any) => {
                console.warn("Error en dictado:", err);
                setIsListening(false);
            };
            recognition.onend = () => setIsListening(false);

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) {
            console.warn("No se pudo iniciar el dictado:", err);
            setIsListening(false);
        }
    };

    // Renderizar iconos para las características de la versión
    const renderFeatureIcon = (iconName: string) => {
        switch (iconName) {
            case 'Compass': return <Compass size={15} className="text-blue-500" />;
            case 'Heart': return <Heart size={15} className="text-rose-500 fill-rose-500/20" />;
            case 'Zap': return <Zap size={15} className="text-amber-500" />;
            case 'Layers': return <Layers size={15} className="text-purple-500" />;
            case 'Trophy': return <Trophy size={15} className="text-amber-500" />;
            case 'Printer': return <Printer size={15} className="text-blue-500" />;
            case 'Image': return <ImageIcon size={15} className="text-emerald-500" />;
            case 'LayoutDashboard': return <LayoutDashboard size={15} className="text-blue-500" />;
            default: return <Sparkles size={15} className="text-indigo-500" />;
        }
    };

    // --- CEREBRO OMNICANAL DE ARA (Conexión Total a Datos) ---
    const processOmniQuery = (query: string): Omit<AssistantMessage, 'id' | 'sender' | 'timestamp'> | null => {
        const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const now = new Date();

        // 1. Saludos
        if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|hey|alo|hola ara)$/.test(q)) {
            return {
                text: `¡Hola! Lista para ayudarte en **${currentBranch?.name || 'Sede Principal'}**. ¿Qué necesitas consultar?`,
                type: 'text'
            };
        }
        if (/^(gracias|muchas gracias|ok|vale|perfecto|excelente|genial|gracias ara)$/.test(q)) {
            return {
                text: "¡Con mucho gusto! Sigo aquí conectada a tu panel. 🌟",
                type: 'text'
            };
        }

        // 2. NOVEDADES Y ACTUALIZACIONES DE VERSIÓN (Sustituye al popup modal)
        if (q.includes('novedad') || q.includes('version') || q.includes('actualizacion') || q.includes('que hay de nuevo') || q.includes('cambios') || q.includes('changelog') || q.includes('release')) {
            return {
                text: `🚀 **ARA Versión ${CURRENT_SYSTEM_VERSION} (${LATEST_RELEASE.releaseDate}):**\n\n${LATEST_RELEASE.subtitle}`,
                type: 'version_release',
                data: LATEST_RELEASE
            };
        }

        // Filtro de órdenes por sucursal activa
        let relevantOrders = orders;
        if (currentBranch && currentBranch.id > 0) {
            relevantOrders = relevantOrders.filter(o => o.branchId === currentBranch.id);
        }
        const completedOrders = relevantOrders.filter(o => o.status === 'completed');
        const pendingOrders = relevantOrders.filter(o => o.status === 'pending');

        // 3. TASAS DE CAMBIO Y CONVERSIÓN
        if (q.includes('tasa') || q.includes('dolar') || q.includes('bcv') || q.includes('paralelo') || q.includes('binance') || q.includes('euro') || q.includes('cambio') || q.includes('bolivares')) {
            const amountMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:dolar|dolares|\$|usd)/);
            let conversionNote = '';
            if (amountMatch) {
                const val = parseFloat(amountMatch[1].replace(',', '.'));
                const bsBcv = val * bcv;
                const bsParalelo = val * paralelo;
                conversionNote = `\n\n💡 **Conversión de $${val.toFixed(2)}:**\n- A tasa oficial BCV: **Bs. ${bsBcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- A tasa Paralelo: **Bs. ${bsParalelo.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`;
            }

            return {
                text: `Aquí tienes las tasas de cambio activas:${conversionNote}`,
                type: 'rates',
                data: { bcv, paralelo, euro, branchName: currentBranch?.name || 'Sede Principal' },
                action: onNavigateTab ? { label: '⚙️ Configurar Monedas', tab: 'settings' } : undefined
            };
        }

        // 4. MULTI-SEDE: Ver Sedes y Cambiar de Sede desde el Chat
        if (q.includes('cambiar sede') || q.includes('cambiar sucursal') || q.includes('ver sedes') || q.includes('sucursales') || q.includes('cambiar a')) {
            const matchBranch = branches.find(b => q.includes(b.name.toLowerCase()));
            if (matchBranch) {
                switchBranch(matchBranch.id);
                return {
                    text: `✅ **Sede cambiada exitosamente:** Ahora estás operando en **${matchBranch.name}**.\nSe actualizaron los datos y el inventario en tiempo real.`,
                    type: 'text'
                };
            }

            return {
                text: `🏢 **Gestión Multi-Sede:**\nActualmente estás en **${currentBranch?.name || 'Sede Principal'}**.\n\nPuedes cambiarte a cualquiera de estas sedes:`,
                type: 'branches',
                data: {
                    branches,
                    currentId: currentBranch?.id
                }
            };
        }

        // 5. CALCULADORA DE VUELTO / CAJA POS (Cálculo robusto para cajeros)
        if (q.includes('vuelto') || q.includes('cambio') || q.includes('calcula') || q.includes('pago con')) {
            const numbers = q.match(/\d+(?:[.,]\d+)?/g);
            if (numbers && numbers.length >= 2) {
                const paid = parseFloat(numbers[0].replace(',', '.'));
                const total = parseFloat(numbers[1].replace(',', '.'));

                if (paid > total) {
                    const changeUsd = paid - total;
                    const changeBsBcv = changeUsd * bcv;
                    const changeBsParalelo = changeUsd * paralelo;

                    return {
                        text: `💵 **Cálculo de Vuelto (Caja POS):**\n\n- Total de la cuenta: **$${total.toFixed(2)}**\n- Cliente entregó: **$${paid.toFixed(2)}**\n\n✨ **Vuelto a entregar:**\n- En Dólares: **$${changeUsd.toFixed(2)} USD**\n- En Bolívares (Tasa BCV): **Bs. ${changeBsBcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n- En Bolívares (Paralelo): **Bs. ${changeBsParalelo.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
                        type: 'calculator'
                    };
                } else if (paid === total) {
                    return {
                        text: `💵 **Pago Exacto:**\nEl cliente entregó exactamente **$${paid.toFixed(2)} USD**. No requiere vuelto.`,
                        type: 'calculator'
                    };
                } else {
                    const diff = total - paid;
                    return {
                        text: `⚠️ **Monto Insuficiente:**\nEl cliente entregó **$${paid.toFixed(2)}**, pero la cuenta es de **$${total.toFixed(2)}**.\nFaltan **$${diff.toFixed(2)} USD** (aprox. Bs. ${(diff * bcv).toLocaleString('es-VE', { maximumFractionDigits: 2 })}).`,
                        type: 'calculator'
                    };
                }
            }
        }

        // 6. BÚSQUEDA AVANZADA DE PEDIDOS (Por cliente, teléfono o ID de pedido)
        if (q.includes('buscar pedido') || q.includes('donde esta el pedido') || q.includes('pedido de') || q.includes('orden de') || (q.includes('pedido') && /\d/.test(q)) || (q.includes('orden') && /\d/.test(q))) {
            const searchTerm = q.replace(/(buscar pedido|donde esta el pedido|pedido de|orden de|pedido|orden)/g, '').trim();
            if (searchTerm.length >= 2) {
                const matchedOrders = orders.filter(o => {
                    const idMatch = (o.id || '').toLowerCase().includes(searchTerm);
                    const nameMatch = (o.customerName || '').toLowerCase().includes(searchTerm);
                    const phoneMatch = (o.customerPhone || '').includes(searchTerm);
                    return idMatch || nameMatch || phoneMatch;
                }).sort((a, b) => (b.date || 0) - (a.date || 0));

                if (matchedOrders.length > 0) {
                    return {
                        text: `📦 Encontré **${matchedOrders.length} pedido${matchedOrders.length > 1 ? 's' : ''}** para "${searchTerm}":`,
                        type: 'orders_list',
                        data: matchedOrders.slice(0, 4).map(o => ({
                            id: o.id,
                            customerName: o.customerName,
                            customerPhone: o.customerPhone,
                            total: o.total,
                            totalBs: (o.total || 0) * bcv,
                            status: o.status,
                            date: o.date,
                            itemsCount: o.items?.reduce((acc, it) => acc + it.quantity, 0) || 0,
                            paymentMethod: o.paymentMethod
                        })),
                        action: onNavigateTab ? { label: '📦 Abrir Módulo de Pedidos', tab: 'orders' } : undefined
                    };
                } else {
                    return {
                        text: `No encontré ningún pedido con "${searchTerm}". Verifica el número de teléfono, nombre del cliente o código de pedido.`,
                        action: onNavigateTab ? { label: '📦 Ir a Pedidos', tab: 'orders' } : undefined
                    };
                }
            }
        }

        // 7. VENDEDORES: "Mis ventas" o "Mis comisiones"
        if (currentUser && (q.includes('mis venta') || q.includes('mi comision') || q.includes('cuanto vendi') || q.includes('mis ingresos'))) {
            const myOrders = completedOrders.filter(o => o.sellerId === currentUser.id || o.sellerName === currentUser.name);
            const myToday = myOrders.filter(o => o.date >= new Date().setHours(0, 0, 0, 0));
            const myTotalToday = myToday.reduce((sum, o) => sum + (o.total || 0), 0);
            const myCommissionToday = myToday.reduce((sum, o) => sum + (o.sellerCommission || 0), 0);
            const myTotalMonth = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            return {
                text: `👤 **Métricas de ${currentUser.name}:**\n\n- Ventas hoy: **${myToday.length} pedidos** ($${myTotalToday.toFixed(2)})\n- Comisiones estimadas hoy: **$${myCommissionToday.toFixed(2)}**\n- Facturado este mes: **$${myTotalMonth.toFixed(2)}**`,
                type: 'stats',
                data: { label: 'Mis Ventas Hoy', value: `$${myTotalToday.toFixed(2)}`, icon: 'award' }
            };
        }

        // 8. AUDITORÍA Y LOGS
        if (q.includes('auditoria') || q.includes('movimiento') || q.includes('quien inicio sesion') || q.includes('logs') || q.includes('historial del sistema')) {
            const recentLogs = (logs || []).slice(0, 4);
            if (recentLogs.length === 0) {
                return { text: "No hay registros de actividad recientes en el sistema." };
            }
            return {
                text: `🛡️ **Últimos Movimientos en el Sistema:**\n\n${recentLogs.map(l => `• **${l.userName || 'Usuario'}** (${l.action}): ${l.details} - *${new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}*`).join('\n')}`
            };
        }

        // 9. PEDIDOS PENDIENTES
        if (q.includes('pendiente') || q.includes('despachar') || q.includes('por entregar') || q.includes('por cobrar') || q.includes('ordenes activas')) {
            const pendingTotal = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const deliveryCount = pendingOrders.filter(o => o.deliveryMethod === 'delivery').length;
            const pickupCount = pendingOrders.filter(o => o.deliveryMethod === 'pickup').length;

            if (pendingOrders.length === 0) {
                return {
                    text: "🎉 ¡Excelente! No tienes ningún pedido pendiente por despachar en este momento.",
                    type: 'stats',
                    data: { label: 'Pedidos Pendientes', value: '0 pedidos', icon: 'check' },
                    action: onNavigateTab ? { label: '📦 Ver Pedidos', tab: 'orders' } : undefined
                };
            }

            return {
                text: `Tienes **${pendingOrders.length} pedido${pendingOrders.length > 1 ? 's' : ''} pendiente${pendingOrders.length > 1 ? 's' : ''}** sumando **$${pendingTotal.toFixed(2)}** (Bs. ${(pendingTotal * bcv).toLocaleString('es-VE', { maximumFractionDigits: 2 })}).\n\n- 🛵 Delivery: **${deliveryCount}**\n- 🏪 Retiro en Sede: **${pickupCount}**`,
                type: 'stats',
                data: { label: 'Por Despachar', value: `${pendingOrders.length} órdenes`, icon: 'shopping-bag' },
                action: onNavigateTab ? { label: '📦 Ver Pedidos Pendientes', tab: 'orders' } : undefined
            };
        }

        // 10. TOP PRODUCTOS MÁS VENDIDOS
        if (q.includes('mas vendido') || q.includes('top producto') || q.includes('mas se vende') || q.includes('estrella') || q.includes('ranking')) {
            const productSales: Record<string, { title: string; count: number; revenue: number; stock: number; image?: string }> = {};

            completedOrders.forEach(order => {
                order.items?.forEach(item => {
                    const id = item.productId || item.cartId || item.productTitle;
                    if (!productSales[id]) {
                        const prod = products.find(p => p.id === item.productId);
                        productSales[id] = {
                            title: item.productTitle || prod?.title || 'Producto',
                            count: 0,
                            revenue: 0,
                            stock: prod?.stock || 0,
                            image: item.image || prod?.images?.[0]
                        };
                    }
                    productSales[id].count += item.quantity || 1;
                    productSales[id].revenue += (item.price || 0) * (item.quantity || 1);
                });
            });

            const topList = Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 4);
            if (topList.length === 0) return { text: "Aún no hay suficientes ventas completadas para generar el ranking." };

            return {
                text: `🔥 Aquí están los productos más vendidos en base a ventas completadas:`,
                type: 'ranking',
                data: { isProductsRanking: true, items: topList },
                action: onNavigateTab ? { label: '📈 Ver Estadísticas', tab: 'statistics' } : undefined
            };
        }

        // 11. VENTAS POR MÉTODO DE PAGO / ARQUEO
        if (q.includes('metodo de pago') || q.includes('arqueo') || q.includes('caja') || q.includes('punto') || q.includes('pago movil') || q.includes('zelle') || q.includes('efectivo')) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const isTodayOnly = q.includes('hoy') || !q.includes('mes');
            const targetOrders = isTodayOnly ? completedOrders.filter(o => o.date >= todayStart) : completedOrders;

            const paymentsSummary: Record<string, number> = {};
            targetOrders.forEach(o => {
                const method = o.paymentMethod || 'Otro / No especificado';
                paymentsSummary[method] = (paymentsSummary[method] || 0) + (o.total || 0);
            });

            const methodsList = Object.entries(paymentsSummary).map(([method, total]) => ({
                method,
                total,
                totalBs: total * bcv
            })).sort((a, b) => b.total - a.total);

            const totalSum = methodsList.reduce((acc, curr) => acc + curr.total, 0);

            return {
                text: `💳 Arqueo de cobros por método de pago (${isTodayOnly ? 'Hoy' : 'Histórico'}) - Total: **$${totalSum.toFixed(2)}**:`,
                type: 'payment_methods',
                data: { period: isTodayOnly ? 'Hoy' : 'Acumulado', methods: methodsList, total: totalSum },
                action: onNavigateTab ? { label: '💳 Ver Transacciones', tab: 'transactions' } : undefined
            };
        }

        // 12. BRIEFING / RESUMEN EJECUTIVO
        if (q.includes('resumen') || q.includes('briefing') || q.includes('como vamos') || q.includes('informe') || q.includes('reporte del dia')) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const todayOrders = completedOrders.filter(o => o.date >= todayStart);
            const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0);
            const avgTicket = todayOrders.length > 0 ? (todayTotal / todayOrders.length) : 0;
            const outOfStockCount = products.filter(p => (p.stock || 0) <= 0).length;

            return {
                text: `📊 **Briefing Ejecutivo ARA** (${now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' })}):`,
                type: 'briefing',
                data: {
                    todayTotal,
                    todayTotalBs: todayTotal * bcv,
                    todayOrdersCount: todayOrders.length,
                    pendingCount: pendingOrders.length,
                    avgTicket,
                    outOfStockCount,
                    branchName: currentBranch?.name || 'Sede Principal'
                },
                action: onNavigateTab ? { label: '📊 Ir al Panel Principal', tab: 'dashboard' } : undefined
            };
        }

        // 13. VENTAS HOY / MES
        if (q.includes('venta') || q.includes('hoy') || q.includes('mes')) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            if (q.includes('mes')) {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const monthOrders = completedOrders.filter(o => o.date >= monthStart);
                const total = monthOrders.reduce((sum, o) => sum + o.total, 0);
                return {
                    text: `Este mes llevas facturados **$${total.toFixed(2)}** en **${monthOrders.length} ventas** (Bs. ${(total * bcv).toLocaleString('es-VE', { maximumFractionDigits: 2 })}).`,
                    type: 'stats',
                    data: { label: 'Ventas del Mes', value: `$${total.toFixed(2)}`, icon: 'trending' },
                    action: onNavigateTab ? { label: '📈 Ver Estadísticas', tab: 'statistics' } : undefined
                };
            }

            const todayOrders = completedOrders.filter(o => o.date >= todayStart);
            const total = todayOrders.reduce((acc, o) => acc + o.total, 0);
            return {
                text: `Hoy has completado **${todayOrders.length} ventas** por **$${total.toFixed(2)}** (Bs. ${(total * bcv).toLocaleString('es-VE', { maximumFractionDigits: 2 })}).`,
                type: 'stats',
                data: { label: 'Ventas de Hoy', value: `$${total.toFixed(2)}`, icon: 'dollar' },
                action: onNavigateTab ? { label: '💳 Ver Transacciones de Hoy', tab: 'transactions' } : undefined
            };
        }

        // 14. STOCK CRÍTICO Y ALERTAS
        if (q.includes('stock') || q.includes('agotado') || q.includes('bajo') || q.includes('inventario') || q.includes('sin stock')) {
            if (q.includes('agotado') || q.includes('cero') || q.includes('sin stock')) {
                const outStock = products.filter(p => (p.stock || 0) <= 0);
                return {
                    text: `⚠️ Tienes **${outStock.length} producto${outStock.length !== 1 ? 's' : ''} agotado${outStock.length !== 1 ? 's' : ''}** (stock en 0):`,
                    type: 'products',
                    data: outStock.slice(0, 4).map(p => ({ ...p, priceBs: (p.price || 0) * bcv })),
                    action: onNavigateTab ? { label: '📋 Reponer en Inventario', tab: 'inventory' } : undefined
                };
            }
            const lowStock = products.filter(p => (p.stock || 0) < 5 && (p.stock || 0) > 0);
            return {
                text: `⚠️ Hay **${lowStock.length} producto${lowStock.length !== 1 ? 's' : ''} con stock crítico** (<5 unidades):`,
                type: 'products',
                data: lowStock.slice(0, 4).map(p => ({ ...p, priceBs: (p.price || 0) * bcv })),
                action: onNavigateTab ? { label: '📋 Gestionar Inventario', tab: 'inventory' } : undefined
            };
        }

        // 15. CUPONES DE DESCUENTO
        if (q.includes('cupon') || q.includes('descuento') || q.includes('promocion') || q.includes('oferta activa')) {
            const activeCoupons = coupons.filter(c => c.active);
            if (activeCoupons.length === 0) {
                return { text: "Actualmente no hay cupones de descuento activos en el sistema." };
            }
            return {
                text: `🏷️ **Cupones y Promociones Activas:**\n\n${activeCoupons.map(c => `• Código **${c.code}**: ${c.discountType === 'percentage' ? `${c.value}% OFF` : `$${c.value} de descuento`}`).join('\n')}`,
                type: 'coupons',
                data: activeCoupons,
                action: onNavigateTab ? { label: '🏷️ Gestionar en Marketing', tab: 'marketing' } : undefined
            };
        }

        // 16. CATEGORÍAS DEL CATÁLOGO
        if (q.includes('categoria') || q.includes('departamento') || q.includes('secciones')) {
            const catSummary = categories.map(cat => {
                const count = products.filter(p => p.category === cat.name || p.extraCategories?.includes(cat.name)).length;
                return { name: cat.name, count };
            });

            return {
                text: `📁 **Categorías Disponibles en Catálogo:**\n\n${catSummary.map(c => `• **${c.name}** (${c.count} productos)`).join('\n')}`,
                action: onNavigateTab ? { label: '📋 Gestionar Inventario', tab: 'inventory' } : undefined
            };
        }

        // 17. BÚSQUEDA DE PRODUCTO EN CATÁLOGO CON STOCK MULTI-SEDE EXACTO
        if (q.includes('precio') || q.includes('cuanto cuesta') || q.includes('tienes') || q.includes('hay') || q.includes('buscar producto') || q.includes('producto') || q.includes('catalogo')) {
            const cleanQuery = q.replace(/(precio de|precio|cuanto cuesta|tienes|hay|buscar producto|producto|catalogo)/g, '').trim();
            if (cleanQuery.length >= 2) {
                const tokens = cleanQuery.split(/\s+/);
                const found = products.filter(p => {
                    const title = (p.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const code = (p.code || '').toLowerCase();
                    const barcode = (p.barcodeEan || '').toLowerCase();
                    const cat = (p.category || '').toLowerCase();
                    return tokens.every(token => title.includes(token) || code.includes(token) || barcode.includes(token) || cat.includes(token));
                });

                if (found.length > 0) {
                    return {
                        text: `Encontré **${found.length} producto${found.length > 1 ? 's' : ''}** en el catálogo:`,
                        type: 'products',
                        data: found.slice(0, 4).map(p => {
                            // Cálculo exacto de stock en otras sedes utilizando branchStock
                            let otherBranchesInfo: string | undefined;
                            if ((p.stock || 0) <= 0 && p.branchStock) {
                                const availableInOther = Object.entries(p.branchStock)
                                    .filter(([bId, qty]) => Number(bId) !== currentBranch?.id && (qty as number) > 0)
                                    .map(([bId, qty]) => {
                                        const bName = branches.find(b => b.id === Number(bId))?.name || `Sede #${bId}`;
                                        return `${bName}: ${qty} unid`;
                                    });

                                if (availableInOther.length > 0) {
                                    otherBranchesInfo = `En otras sedes: ${availableInOther.join(', ')}`;
                                }
                            }

                            return {
                                ...p,
                                priceBs: (p.price || 0) * bcv,
                                otherBranchesStock: otherBranchesInfo
                            };
                        }),
                        action: onNavigateTab ? { label: '📋 Ver en Inventario', tab: 'inventory' } : undefined
                    };
                }
            }
        }

        return null;
    };

    // Envío y respuesta híbrida
    const handleSend = async (e?: React.FormEvent, manualQuery?: string) => {
        if (e) e.preventDefault();
        const textToSend = manualQuery || input;
        if (!textToSend.trim()) return;

        const userMsg: AssistantMessage = {
            id: Date.now().toString(),
            text: textToSend,
            sender: 'user',
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // 1. Motor Analítico Local Omnicanal
        const localResult = processOmniQuery(textToSend);

        if (localResult) {
            setTimeout(() => {
                const botMsg: AssistantMessage = {
                    id: (Date.now() + 1).toString(),
                    text: localResult.text,
                    sender: 'bot',
                    type: localResult.type || 'text',
                    data: localResult.data,
                    action: localResult.action,
                    timestamp: Date.now()
                };
                setIsTyping(false);
                setMessages(prev => [...prev, botMsg]);
            }, 250);
            return;
        }

        // 2. Fallback con Gemini AI si hay clave
        if (hasGeminiApiKey()) {
            try {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayOrders = orders.filter(o => o.status === 'completed' && o.date >= todayStart.getTime());
                const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0);
                const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
                const lowStockCount = products.filter(p => (p.stock || 0) < 5).length;

                const responseText = await queryGeminiAI(textToSend, {
                    storeName: settings?.storeName || 'ARA Multisede',
                    currentBranchName: currentBranch?.name || 'Sede Principal',
                    activeRate: activeExchangeRate || exchangeRate,
                    currencySymbol: '$',
                    totalProducts: products.length,
                    lowStockCount,
                    todaySalesTotal: todayTotal,
                    todayOrdersCount: todayOrders.length,
                    pendingOrdersCount,
                    topProducts: products.slice(0, 5).map(p => p.title)
                });

                const botMsg: AssistantMessage = {
                    id: (Date.now() + 1).toString(),
                    text: responseText,
                    sender: 'bot',
                    type: 'text',
                    timestamp: Date.now()
                };
                setIsTyping(false);
                setMessages(prev => [...prev, botMsg]);
                return;
            } catch (err: any) {
                console.warn("Error consultando Gemini:", err);
            }
        }

        // 3. Fallback guiado para administradores y cajeros
        setTimeout(() => {
            const botMsg: AssistantMessage = {
                id: (Date.now() + 1).toString(),
                text: `No logré procesar esa consulta específica 🤔.\n\nPuedes probar con:\n- **"¿Qué hay de nuevo?"** (Novedades de la versión)\n- **"Resumen de hoy"** o "Ventas"\n- **"Pedidos pendientes"** o "Buscar pedido [nombre/código]"\n- **"Calcula vuelto de $50 pagando $32"**\n- **"Cambiar sede"**\n- **"Ventas por método de pago"**\n- **"Tasa de cambio"**`,
                sender: 'bot',
                type: 'text',
                timestamp: Date.now()
            };
            setIsTyping(false);
            setMessages(prev => [...prev, botMsg]);
        }, 300);
    };

    // Chips contextuales adaptados a la pestaña de administración
    const contextualChips = useMemo(() => {
        if (activeTab === 'pos') {
            return [
                { label: '💵 Calcular Vuelto', query: 'vuelto de 20 pagando 15' },
                { label: '💱 Tasa BCV & Paralelo', query: 'tasa de cambio' },
                { label: '🏢 Cambiar Sede', query: 'cambiar sede' },
                { label: '🏷️ Cupones Activos', query: 'cupones' },
                { label: '🚀 Novedades v2.0', query: 'novedades de la version' },
            ];
        }

        if (activeTab === 'orders') {
            return [
                { label: '📦 Pedidos Pendientes', query: 'pedidos pendientes' },
                { label: '🔍 Buscar Pedido', query: 'buscar pedido' },
                { label: '💳 Ventas por Pago', query: 'ventas por metodo de pago' },
                { label: '📊 Ventas de Hoy', query: 'ventas de hoy' },
            ];
        }

        if (activeTab === 'inventory') {
            return [
                { label: '⚠️ Stock Crítico', query: 'productos con stock bajo' },
                { label: '❌ Agotados (Stock 0)', query: 'productos agotados' },
                { label: '🏢 Stock en Otras Sedes', query: 'cambiar sede' },
                { label: '🔍 Buscar Producto', query: 'precio de' },
            ];
        }

        // General Admin / Dashboard
        return [
            { label: '🚀 Novedades v2.0', query: 'novedades de la version' },
            { label: '⚡ Briefing Hoy', query: 'resumen de hoy' },
            { label: '📦 Pedidos Pendientes', query: 'pedidos pendientes' },
            { label: '💱 Tasas del Día', query: 'tasa de cambio' },
            { label: '🏢 Cambiar Sede', query: 'cambiar sede' },
            { label: '🔥 Top Más Vendidos', query: 'productos mas vendidos' },
        ];
    }, [activeTab]);

    // Posición ergonómica del botón flotante en el panel admin y POS
    const floatingButtonPosition = useMemo(() => {
        return activeTab === 'pos'
            ? 'fixed bottom-4 right-4'
            : 'fixed bottom-5 sm:bottom-6 right-4 sm:right-6';
    }, [activeTab]);

    return (
        <>
            {/* BOTÓN FLOTANTE CON BADGE INTELIGENTE DE NOVEDADES */}
            {!isOpen && (
                <button
                    onClick={handleOpenChat}
                    aria-label="Abrir asistente virtual ARA"
                    className={`${floatingButtonPosition} z-[60] bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3 sm:p-3.5 rounded-full shadow-2xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 group flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14`}
                >
                    <div className="relative flex items-center justify-center">
                        <Bot size={24} className="transition-transform group-hover:rotate-12" />

                        {hasUnreadVersion ? (
                            <span className="absolute -top-2.5 -right-2.5 flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-md animate-bounce">
                                <Sparkles size={9} />
                                <span>v{CURRENT_SYSTEM_VERSION}</span>
                            </span>
                        ) : (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-zinc-900 animate-pulse"></span>
                        )}
                    </div>
                </button>
            )}

            {/* VENTANA MODAL DEL CHAT */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[190] sm:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="fixed bottom-0 right-0 z-[200] w-full h-[88vh] sm:h-[630px] sm:w-[420px] sm:bottom-20 sm:right-6 bg-white dark:bg-zinc-900 sm:rounded-3xl rounded-t-3xl shadow-[0_25px_60px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-white/10 flex flex-col overflow-hidden animate-slide-up">

                        {/* Encabezado */}
                        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-4 flex justify-between items-center shrink-0 border-b border-gray-100 dark:border-white/5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-2.5 rounded-2xl text-white shadow-md shadow-indigo-500/20">
                                    <Bot size={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">ARA</h3>
                                        <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md">
                                            Copilot
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span>En línea • {currentBranch?.name || 'Sede Principal'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleClearChat}
                                    title="Reiniciar conversación"
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    title="Minimizar"
                                    className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition"
                                >
                                    <ChevronDown size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Mensajes */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70 dark:bg-[#121212]">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[88%] rounded-2xl p-3.5 text-sm shadow-sm relative group ${msg.sender === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-xs'
                                        : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-white/5 rounded-bl-xs'
                                        }`}>

                                        {msg.sender === 'bot' && (
                                            <button
                                                onClick={() => handleCopy(msg.id, msg.text)}
                                                title="Copiar texto"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-zinc-700 rounded-md transition-opacity"
                                            >
                                                {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            </button>
                                        )}

                                        <div className="leading-relaxed whitespace-pre-wrap pr-4">{msg.text}</div>

                                        {/* TARJETA ESPECIAL: NOVEDADES Y ACTUALIZACIÓN DE VERSIÓN */}
                                        {msg.type === 'version_release' && msg.data && (
                                            <div className="mt-3 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/30 space-y-3">
                                                <div className="flex items-center justify-between border-b border-indigo-100/60 dark:border-indigo-900/20 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-blue-600 text-white rounded-xl shadow-xs">
                                                            <Sparkles size={16} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-xs text-gray-900 dark:text-white leading-tight">{msg.data.title}</h4>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">{msg.data.releaseDate} • v{msg.data.version}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                                        OFICIAL
                                                    </span>
                                                </div>

                                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                                                    {msg.data.features?.map((feat: VersionFeatureItem) => {
                                                        const tagBg = feat.tag === 'NUEVO'
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                                            : feat.tag === 'MEJORA'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';

                                                        return (
                                                            <div key={feat.id} className="bg-white/80 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 space-y-1 text-xs">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className="shrink-0 p-1 bg-gray-50 dark:bg-zinc-700/60 rounded-lg">
                                                                            {renderFeatureIcon(feat.iconName)}
                                                                        </div>
                                                                        <span className="font-bold text-gray-900 dark:text-white truncate">{feat.title}</span>
                                                                    </div>
                                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${tagBg}`}>
                                                                        {feat.tag}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed pl-7">
                                                                    {feat.description}
                                                                </p>
                                                                {feat.highlight && (
                                                                    <div className="pl-7 pt-0.5">
                                                                        <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-md inline-block">
                                                                            ✨ {feat.highlight}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        try {
                                                            localStorage.setItem('ara_admin_seen_version', CURRENT_SYSTEM_VERSION);
                                                        } catch (_) {}
                                                        setHasUnreadVersion(false);
                                                        handleSend(undefined, '¡Gracias! Quedan claras las novedades.');
                                                    }}
                                                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                                                >
                                                    <Check size={14} />
                                                    <span>¡Entendido! Todo claro</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* TARJETA: SEDES Y CAMBIO DE SUCURSAL */}
                                        {msg.type === 'branches' && msg.data && (
                                            <div className="mt-3 space-y-1.5">
                                                {msg.data.branches.map((b: any) => {
                                                    const isCurrent = b.id === msg.data.currentId;
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            onClick={async () => {
                                                                await switchBranch(b.id);
                                                                handleSend(undefined, `Cambiado a ${b.name}`);
                                                            }}
                                                            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition ${isCurrent
                                                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-bold'
                                                                : 'bg-gray-50 dark:bg-zinc-900/60 border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Store size={15} className={isCurrent ? 'text-blue-600' : 'text-gray-400'} />
                                                                <div>
                                                                    <p className="text-xs">{b.name}</p>
                                                                    {b.address && <p className="text-[10px] text-gray-400 font-normal">{b.address}</p>}
                                                                </div>
                                                            </div>
                                                            {isCurrent ? (
                                                                <span className="text-[10px] uppercase font-bold bg-blue-600 text-white px-2 py-0.5 rounded-md">Activa</span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-500 font-medium flex items-center gap-0.5">Cambiar <ArrowRight size={10} /></span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* TARJETA: BÚSQUEDA DE PEDIDOS */}
                                        {msg.type === 'orders_list' && msg.data && (
                                            <div className="mt-3 space-y-2">
                                                {msg.data.map((ord: any) => (
                                                    <div key={ord.id} className="bg-gray-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 text-xs space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-gray-900 dark:text-white">Pedido #{ord.id.slice(-6).toUpperCase()}</span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${ord.status === 'completed'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                                : ord.status === 'pending'
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                                                : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                                                }`}>
                                                                {ord.status === 'completed' ? 'Completado' : ord.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-600 dark:text-gray-300">Cliente: **{ord.customerName || 'Consumidor Final'}** {ord.customerPhone ? `(${ord.customerPhone})` : ''}</p>
                                                        <div className="flex justify-between items-center pt-1 border-t border-gray-200/50 dark:border-white/5">
                                                            <span className="text-[10px] text-gray-500">{ord.itemsCount} productos • {ord.paymentMethod || 'Pago directo'}</span>
                                                            <span className="font-black text-blue-600 dark:text-blue-400">${ord.total?.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* TARJETA: CUPONES ACTIVOS */}
                                        {msg.type === 'coupons' && msg.data && (
                                            <div className="mt-3 space-y-1.5">
                                                {msg.data.map((c: any, idx: number) => (
                                                    <div key={idx} className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-200/60 dark:border-amber-800/30 flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Tag size={14} className="text-amber-600 dark:text-amber-400" />
                                                            <span className="font-black tracking-wider text-amber-800 dark:text-amber-300 uppercase">{c.code}</span>
                                                        </div>
                                                        <span className="font-bold text-amber-700 dark:text-amber-400">
                                                            {c.discountType === 'percentage' ? `${c.value}% OFF` : `$${c.value} OFF`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* TARJETA: TASAS DE CAMBIO */}
                                        {msg.type === 'rates' && msg.data && (
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                <div className="bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">Oficial BCV</span>
                                                    <span className="text-base font-black text-gray-900 dark:text-white">Bs. {msg.data.bcv.toFixed(2)}</span>
                                                </div>
                                                <div className="bg-purple-50 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                                    <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block">Paralelo / Binance</span>
                                                    <span className="text-base font-black text-gray-900 dark:text-white">Bs. {msg.data.paralelo.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* TARJETA: BRIEFING EJECUTIVO */}
                                        {msg.type === 'briefing' && msg.data && (
                                            <div className="mt-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-zinc-900 dark:to-indigo-950/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                                                <div className="flex justify-between items-center border-b border-indigo-100/60 dark:border-indigo-900/20 pb-1.5">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Ventas Hoy:</span>
                                                    <span className="font-black text-base text-indigo-600 dark:text-indigo-400">${msg.data.todayTotal.toFixed(2)}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-gray-100 dark:border-white/5">
                                                        <span className="text-[9px] text-gray-400 uppercase font-bold block">Ventas</span>
                                                        <span className="font-bold">{msg.data.todayOrdersCount} órdenes</span>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-gray-100 dark:border-white/5">
                                                        <span className="text-[9px] text-amber-500 uppercase font-bold block">Pendientes</span>
                                                        <span className="font-bold text-amber-600">{msg.data.pendingCount} por despachar</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* TARJETA: PRODUCTOS ENCONTRADOS CON DETALLES DE STOCK */}
                                        {msg.type === 'products' && msg.data && (
                                            <div className="mt-3 space-y-2">
                                                {msg.data.map((p: any) => (
                                                    <div key={p.id} className="bg-white dark:bg-zinc-900/90 p-3 rounded-xl border border-gray-100 dark:border-white/5 shadow-xs space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                                                {p.images?.[0] ? (
                                                                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Package size={18} className="text-gray-400" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{p.title}</p>
                                                                <div className="flex items-center justify-between mt-0.5">
                                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                                                        ${p.price?.toFixed(2)}
                                                                        {p.priceBs ? <span className="text-[10px] text-gray-400 font-normal ml-1">({p.priceBs.toLocaleString('es-VE', { maximumFractionDigits: 1 })} Bs)</span> : null}
                                                                    </span>
                                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-sm font-semibold ${(p.stock || 0) <= 0 ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'}`}>
                                                                        Sede: {p.stock || 0} unid
                                                                    </span>
                                                                </div>
                                                                {p.code && (
                                                                    <p className="text-[9px] text-gray-400">SKU/Código: {p.code}</p>
                                                                )}
                                                                {p.otherBranchesStock && (
                                                                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">🏢 {p.otherBranchesStock}</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {onNavigateTab && (
                                                            <div className="pt-1 border-t border-gray-100 dark:border-white/5">
                                                                <button
                                                                    onClick={() => onNavigateTab('inventory')}
                                                                    className="w-full py-1.5 px-2 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                                                                >
                                                                    <Package size={12} />
                                                                    <span>Ver en Inventario</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* TARJETA: ESTADÍSTICAS RÁPIDAS */}
                                        {msg.type === 'stats' && msg.data && (
                                            <div className="mt-3 bg-gray-50/70 dark:bg-zinc-900/60 rounded-xl p-3 border border-gray-100 dark:border-white/5 flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full">
                                                    {msg.data.icon === 'dollar' ? <DollarSign size={18} /> :
                                                        msg.data.icon === 'award' ? <Award size={18} /> :
                                                        msg.data.icon === 'shopping-bag' ? <ShoppingBag size={18} /> :
                                                        <TrendingUp size={18} />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400">{msg.data.label}</p>
                                                    <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{msg.data.value}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* TARJETA: RANKING */}
                                        {msg.type === 'ranking' && msg.data && (
                                            <div className="mt-3 space-y-1.5">
                                                {msg.data.items?.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-gray-50 dark:bg-zinc-900/60 p-2 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
                                                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate pr-2">#{idx + 1} {item.title}</span>
                                                        <span className="font-black text-emerald-600 shrink-0">${item.revenue?.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* BOTÓN DE ACCIÓN / DEEP LINKING */}
                                        {msg.action && (
                                            <div className="mt-3">
                                                {msg.action.url ? (
                                                    <a
                                                        href={msg.action.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-200/50"
                                                    >
                                                        <span>{msg.action.label}</span>
                                                        <ExternalLink size={13} />
                                                    </a>
                                                ) : msg.action.onClick ? (
                                                    <button
                                                        onClick={msg.action.onClick}
                                                        className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-blue-200/50"
                                                    >
                                                        <span>{msg.action.label}</span>
                                                        <ArrowRight size={13} />
                                                    </button>
                                                ) : (msg.action.tab && onNavigateTab) ? (
                                                    <button
                                                        onClick={() => onNavigateTab(msg.action!.tab)}
                                                        className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-blue-200/50"
                                                    >
                                                        <span>{msg.action.label}</span>
                                                        <ArrowRight size={13} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        )}

                                        <span className={`text-[9px] block mt-2 opacity-50 ${msg.sender === 'user' ? 'text-blue-100 text-right' : 'text-gray-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-white/5 rounded-2xl rounded-bl-xs p-3.5 shadow-xs flex gap-1.5 items-center">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Área de Entrada y Chips */}
                        <div className="bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5 p-3.5 z-10">
                            {/* Chips Contextuales */}
                            <div className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                                {contextualChips.map((chip, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(undefined, chip.query)}
                                        className="whitespace-nowrap px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white rounded-full text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-colors border border-gray-200/60 dark:border-white/5 shrink-0"
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>

                            {/* Formulario */}
                            <form onSubmit={(e) => handleSend(e)} className="flex gap-2 items-center mt-1.5">
                                <div className="flex-1 bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                                    <MessageCircle size={17} className="text-gray-400 shrink-0" />
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={isListening ? "Escuchando tu voz..." : "Escribe o consulta a ARA..."}
                                        className="bg-transparent text-sm outline-hidden w-full text-gray-900 dark:text-white placeholder-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={toggleSpeechRecognition}
                                        title={isListening ? "Detener dictado" : "Dictar por voz"}
                                        className={`p-1.5 rounded-xl transition ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                    >
                                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!input.trim() || isTyping}
                                    className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl transition shadow-md shadow-blue-500/20 active:scale-95 shrink-0"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export const AraAssistant = SmartAssistant;
