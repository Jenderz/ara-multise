
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Bot, Send, X, MessageCircle, TrendingUp, AlertCircle, Package, DollarSign, ChevronDown, User, Calendar, Award, CreditCard, Sparkles, BarChart3, Zap } from 'lucide-react';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    type?: 'text' | 'stats' | 'support' | 'products' | 'ranking' | 'projection';
    data?: any;
    timestamp: number;
}

interface SmartAssistantProps {
    activeTab?: string;
}

export const SmartAssistant = ({ activeTab }: SmartAssistantProps) => {
    const { orders, products, customers, settings, exchangeRate, currentBranch } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: `¡Hola! Soy tu Asistente de Tienda 🤖. Puedes preguntarme por estadísticas (ej. "Ventas hoy"), sobre productos (ej. "¿tienes cable?"), o pedirme proyecciones.`,
            sender: 'bot',
            timestamp: Date.now()
        }
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, isOpen]);

    // --- CEREBRO LÓGICO ---
    const processQuery = (query: string) => {
        const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const now = new Date();

        // Saludos Corteses
        if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos)$/.test(q)) {
            return { text: "¡Hola! ¿En qué puedo ayudarte con tu tienda hoy?" };
        }
        if (/^(gracias|muchas gracias|ok|vale|perfecto)$/.test(q)) {
            return { text: "¡De nada! Estoy aquí para cualquier otra consulta que tengas." };
        }

        // Lógica de Filtro Consistente con Dashboard
        let relevantOrders = orders;
        if (currentBranch && currentBranch.id > 0) {
            relevantOrders = relevantOrders.filter(o => o.branchId === currentBranch.id);
        }
        const completedOrders = relevantOrders.filter(o => o.status === 'completed');

        // Búsqueda de Productos Específicos Ex. "precio cable", "tienes pendrive"
        if (q.includes('precio de') || q.includes('cuanto cuesta') || q.includes('tienes') || q.includes('hay')) {
            const searchTerms = q.replace(/(precio de|cuanto cuesta|tienes|hay)/g, '').trim();
            if (searchTerms.length > 2) {
                const found = products.filter(p => p.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchTerms));

                if (found.length > 0) {
                    return {
                        text: `Encontré estos resultados para "${searchTerms}":`,
                        type: 'products',
                        data: found.slice(0, 3)
                    };
                } else {
                    return { text: `No encontré ningún producto que coincida con "${searchTerms}".` };
                }
            }
        }

        // 1. PROYECCIÓN FINANCIERA
        if (q.includes('proyeccion') || q.includes('futuro') || q.includes('fin de mes')) {
            const currentDay = now.getDate();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

            const monthOrders = completedOrders.filter(o => o.date >= monthStart);
            const currentTotal = monthOrders.reduce((acc, o) => acc + o.total, 0);

            if (currentDay > 1) {
                const dailyAvg = currentTotal / currentDay;
                const projected = dailyAvg * daysInMonth;

                return {
                    text: `Basado en tu promedio diario de $${dailyAvg.toFixed(2)}, la proyección a fin de mes es:`,
                    type: 'projection',
                    data: { current: currentTotal, projected: projected, label: 'Proyección Mensual' }
                };
            }
            return { text: "No hay datos suficientes este mes para una proyección." };
        }

        // 2. RENTABILIDAD
        if (q.includes('rentabilidad') || q.includes('margen') || q.includes('ganancia neta')) {
            let totalRevenue = 0;
            let totalCost = 0;
            const sample = completedOrders.slice(0, 100);

            sample.forEach(o => {
                totalRevenue += o.total;
                o.items.forEach(item => {
                    const reqProd = products.find(p => p.id === item.productId);
                    if (reqProd) totalCost += (reqProd.cost * item.quantity);
                });
            });

            if (sample.length === 0) return { text: "No hay suficientes ventas completadas para calcular el margen." };

            const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
            return {
                text: `Estimamos tu margen operativo en un ${margin.toFixed(1)}%.`,
                type: 'stats',
                data: { label: 'Margen Global', value: `${margin.toFixed(1)}%`, icon: 'trending' }
            };
        }

        // 3. ANÁLISIS DE TIEMPO
        if (q.includes('ayer') || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].some(d => q.includes(d))) {
            let targetDate = new Date();
            let label = "";

            if (q.includes('ayer')) {
                targetDate.setDate(now.getDate() - 1);
                label = "Ayer";
            } else {
                const daysMap: Record<string, number> = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6 };
                const foundDay = Object.keys(daysMap).find(d => q.includes(d));
                if (foundDay) {
                    const targetDayIndex = daysMap[foundDay];
                    let daysToSubtract = now.getDay() - targetDayIndex;
                    if (daysToSubtract <= 0) daysToSubtract += 7;
                    targetDate.setDate(now.getDate() - daysToSubtract);
                    label = `El ${foundDay}`;
                }
            }

            targetDate.setHours(0, 0, 0, 0);
            const startTs = targetDate.getTime();
            targetDate.setHours(23, 59, 59, 999);
            const endTs = targetDate.getTime();

            const specificOrders = completedOrders.filter(o => o.date >= startTs && o.date <= endTs);
            const total = specificOrders.reduce((acc, o) => acc + o.total, 0);

            return {
                text: `${label} tuviste ${specificOrders.length} ventas completadas.`,
                type: 'stats',
                data: { label: `Ventas ${label}`, value: `$${total.toFixed(2)}`, icon: 'calendar' }
            };
        }

        // 4. MEJOR CLIENTE
        if (q.includes('mejor cliente') || q.includes('vip')) {
            if (customers.length === 0) return { text: "Aún no hay datos de clientes." };
            const topCustomer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
            return {
                text: `El cliente estrella es ${topCustomer.name}.`,
                type: 'ranking',
                data: { title: 'Cliente #1', name: topCustomer.name, detail: `${topCustomer.orderCount} compras`, value: `$${topCustomer.totalSpent.toFixed(2)}` }
            };
        }

        // 5. VENTAS HOY / MES
        if (q.includes('venta') || q.includes('hoy') || q.includes('mes')) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            if (q.includes('mes')) {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const monthOrders = completedOrders.filter(o => o.date >= monthStart);
                const total = monthOrders.reduce((acc, o) => acc + o.total, 0);
                return {
                    text: `Este mes llevas $${total.toFixed(2)} en ventas efectivas.`,
                    type: 'stats',
                    data: { label: 'Ventas Mes', value: `$${total.toFixed(2)}`, icon: 'trending' }
                };
            }

            const todayOrders = completedOrders.filter(o => o.date >= todayStart);
            const total = todayOrders.reduce((acc, o) => acc + o.total, 0);
            return {
                text: `Hoy has completado ${todayOrders.length} ventas por un total de $${total.toFixed(2)}.`,
                type: 'stats',
                data: { label: 'Ventas Hoy', value: `$${total.toFixed(2)}`, icon: 'dollar' }
            };
        }

        // 6. STOCK
        if (q.includes('stock') || q.includes('agotado') || q.includes('bajo')) {
            let branchProducts = products;

            if (q.includes('agotado') || q.includes('cero')) {
                const outStock = branchProducts.filter(p => (p.stock || 0) <= 0);
                return {
                    text: `Tienes ${outStock.length} productos sin inventario en esta sede.`,
                    type: 'products',
                    data: outStock.slice(0, 3)
                };
            }
            const lowStock = branchProducts.filter(p => (p.stock || 0) < 5 && (p.stock || 0) > 0);
            return {
                text: `Hay ${lowStock.length} productos con stock crítico (menos de 5 unidades).`,
                type: 'products',
                data: lowStock.slice(0, 3)
            };
        }

        // Fallback
        return {
            text: 'Hmm, no estoy muy seguro. Intenta con frases como:\n- "Ventas de hoy"\n- "Mejor cliente"\n- "Productos agotados"\n- "Precio de [producto]"'
        };
    };

    const handleSend = (e?: React.FormEvent, manualQuery?: string) => {
        if (e) e.preventDefault();
        const textToSend = manualQuery || input;

        if (!textToSend.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: textToSend,
            sender: 'user',
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            const response = processQuery(textToSend);
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: response.text,
                sender: 'bot',
                // @ts-ignore
                type: response.type || 'text',
                data: response.data,
                timestamp: Date.now()
            };
            setIsTyping(false);
            setMessages(prev => [...prev, botMsg]);
        }, 800);
    };

    const QuickChips = () => (
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 mb-2 custom-scrollbar">
            {[
                { label: '📊 Resumen Hoy', query: 'Ventas de hoy' },
                { label: '🚀 Proyección Mes', query: 'Proyección fin de mes' },
                { label: '⚠️ Alert Stock', query: 'Productos agotados' },
                { label: '🏆 Cliente Estrella', query: 'Mejor cliente' },
                { label: '💵 Margen Operativo', query: 'Rentabilidad' },
            ].map((chip, idx) => (
                <button
                    key={idx}
                    onClick={() => handleSend(undefined, chip.query)}
                    className="whitespace-nowrap px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-ios-blue hover:text-white rounded-full text-[11px] font-bold text-gray-600 dark:text-gray-300 transition-colors border border-gray-200 dark:border-white/5"
                >
                    {chip.label}
                </button>
            ))}
        </div>
    );

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed right-6 bottom-6 z-[60] bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-ios-blue hover:text-ios-blue text-gray-700 dark:text-gray-200 p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 group flex items-center justify-center h-14 w-14"
                >
                    <div className="relative">
                        <Bot size={28} />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-zinc-800"></span>
                    </div>
                </button>
            )}

            {isOpen && (
                <>
                    <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[190] sm:hidden" onClick={() => setIsOpen(false)} />

                    <div className="fixed bottom-0 right-0 z-[200] w-full h-[85vh] sm:h-[600px] sm:w-[400px] sm:bottom-20 sm:right-6 bg-white dark:bg-zinc-900 sm:rounded-[2rem] rounded-t-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-white/10 flex flex-col overflow-hidden animate-slide-up">

                        {/* Header */}
                        <div className="bg-white/70 dark:bg-black/40 backdrop-blur-xl p-4 flex justify-between items-center shrink-0 border-b border-gray-100 dark:border-white/5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
                                    <Bot size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-black dark:text-white text-sm">Asistente Lyberate AI</h3>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        En línea
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-white p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition"><ChevronDown size={22} /></button>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 dark:bg-[#121212]">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm ${msg.sender === 'user'
                                        ? 'bg-ios-blue text-white rounded-br-sm'
                                        : 'bg-white dark:bg-zinc-800 dark:text-gray-200 border border-gray-100 dark:border-white/5 rounded-bl-sm'
                                        }`}>
                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                                        {msg.type === 'stats' && msg.data && (
                                            <div className="mt-4 bg-gray-50/50 dark:bg-black/20 rounded-xl p-3 border border-gray-100 dark:border-white/5 flex items-center gap-3">
                                                <div className="p-2.5 bg-white dark:bg-zinc-700 rounded-full shadow-sm text-ios-blue">
                                                    {msg.data.icon === 'dollar' ? <DollarSign size={18} /> :
                                                        msg.data.icon === 'calendar' ? <Calendar size={18} /> : <TrendingUp size={18} />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400">{msg.data.label}</p>
                                                    <p className="text-xl font-black text-black dark:text-white leading-tight">{msg.data.value}</p>
                                                </div>
                                            </div>
                                        )}

                                        {msg.type === 'projection' && msg.data && (
                                            <div className="mt-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-[10px] font-bold text-purple-500 uppercase">Mes Actual</span>
                                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">${msg.data.current.toFixed(2)}</span>
                                                </div>
                                                <div className="w-full h-2 bg-purple-200 dark:bg-purple-900/40 rounded-full overflow-hidden mb-3">
                                                    <div className="h-full bg-purple-500 rounded-full w-1/2"></div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Cierre Estimado</span>
                                                    <span className="text-xl font-black text-purple-700 dark:text-purple-300 leading-none">${msg.data.projected.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {msg.type === 'ranking' && msg.data && (
                                            <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-800/20 flex items-center gap-4">
                                                <div className="w-12 h-12 flex items-center justify-center bg-amber-400 text-white rounded-full shadow-lg shadow-amber-400/30">
                                                    <Award size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500">{msg.data.title}</p>
                                                    <p className="text-sm font-bold text-black dark:text-white truncate">{msg.data.name}</p>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-gray-500">{msg.data.detail}</span>
                                                        <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">{msg.data.value}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {msg.type === 'products' && msg.data && (
                                            <div className="mt-4 space-y-2">
                                                {msg.data.map((p: any) => (
                                                    <div key={p.id} className="bg-white dark:bg-black/30 p-2.5 rounded-xl flex items-center gap-3 border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                                            {p.images?.[0] ? (
                                                                <img src={p.images[0]} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package size={16} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold truncate text-black dark:text-white">{p.title}</p>
                                                            <p className="text-[10px] text-gray-500 uppercase mt-0.5">${p.price?.toFixed(2)} | Stock: {p.stock || 0}</p>
                                                        </div>
                                                    </div>
                                                ))}
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
                                    <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-white/5 rounded-2xl rounded-bl-sm p-4 shadow-sm flex gap-1.5 items-center inline-flex">
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5 p-4 pb-safe z-10">
                            <QuickChips />

                            <form onSubmit={(e) => handleSend(e)} className="flex gap-2 items-center mt-2">
                                <div className="flex-1 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 focus-within:border-ios-blue focus-within:ring-2 focus-within:ring-ios-blue/10 transition-all">
                                    <MessageCircle size={18} className="text-gray-400 shrink-0" />
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Hazme una pregunta..."
                                        className="bg-transparent text-sm outline-none w-full text-black dark:text-white placeholder-gray-400"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="p-3.5 bg-ios-blue hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-2xl transition-all shadow-md active:scale-95 shrink-0"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
