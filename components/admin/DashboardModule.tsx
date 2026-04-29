
import React, { useMemo } from 'react';
import { Card } from '../UIComponents';
import { useStore } from '../../context/StoreContext';
import { DollarSign, Clock, AlertTriangle, Landmark } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../config';

export const DashboardModule = ({ orders, products, customers }: any) => {
    const { exchangeRate, exchangeRateParalelo, exchangeRateEuro, activeCurrencySymbol, userRole, currentUser, currentBranch } = useStore();

    const todayMetrics = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // 1. Filtrar por Usuario (Permisos)
        let relevantOrders = userRole === 'admin'
            ? orders
            : orders.filter((o: any) => {
                const canViewWeb = currentUser?.permissions?.includes('view_web_orders');
                const isWebOrder = o.sellerId === 'web-client' || !o.sellerId || o.sellerId === 'online';
                const isOwnOrder = o.sellerId === currentUser?.id;
                return isOwnOrder || (isWebOrder && canViewWeb);
            });

        // 2. Filtrar por SEDE ACTIVA (Vital para multisede)
        // Si currentBranch.id es 0, es Global (ve todo). Si es > 0, filtra.
        if (currentBranch && currentBranch.id > 0) {
            relevantOrders = relevantOrders.filter((o: any) => o.branchId === currentBranch.id);
        }

        // 3. Métricas
        const todayOrders = relevantOrders.filter((o: any) => o.date >= todayStart && o.status === 'completed');
        const pendingOrders = relevantOrders.filter((o: any) => o.status === 'pending');

        // Stock: Ya viene filtrado por la API si handleGetAll funciona bien, 
        // pero por seguridad si es global, filtramos los que tienen stock bajo.
        const lowStockProducts = products.filter((p: any) => {
            if (p.trackStock === false) return false;
            const min = p.minStock || 5;
            const currentStock = p.stock || 0; // Este stock ya es el de la sede actual gracias a refreshStoreData
            return currentStock > 0 && currentStock < min;
        });

        const outOfStockCount = products.filter((p: any) => p.trackStock !== false && (p.stock || 0) <= 0).length;
        const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + o.total, 0);
        const exchangeGap = exchangeRate > 0 ? ((exchangeRateParalelo - exchangeRate) / exchangeRate) * 100 : 0;

        const posCount = todayOrders.filter((o: any) => o.deliveryMethod === 'pos').length;
        const webCount = todayOrders.length - posCount;

        return {
            todayRevenue,
            todayCount: todayOrders.length,
            posCount,
            webCount,
            pendingCount: pendingOrders.length,
            lowStockCount: lowStockProducts.length,
            outOfStockCount,
            recentOrders: relevantOrders.slice(0, 6),
            lowStockList: lowStockProducts.slice(0, 5),
            exchangeGap
        };
    }, [orders, products, exchangeRate, exchangeRateParalelo, userRole, currentUser, currentBranch]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold dark:text-white">Hola, {userRole === 'admin' ? 'Admin' : (currentUser?.name || 'Vendedor')} 👋</h2>
                    <p className="text-gray-500">
                        Resumen operativo: <span className="font-bold text-ios-blue">{currentBranch?.id === 0 ? 'Vista Global' : currentBranch?.name}</span>
                    </p>
                </div>
                <div className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-lg">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-white/20 p-2 rounded-xl"><DollarSign size={20} className="text-white" /></div>
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-md font-bold uppercase tracking-wider">Hoy</span>
                        </div>
                        <h3 className="text-3xl font-black mb-1">{activeCurrencySymbol}{todayMetrics.todayRevenue.toFixed(2)}</h3>
                        <p className="text-[11px] text-blue-100 font-bold">
                            {todayMetrics.todayCount} ventas completadas
                            {(todayMetrics.posCount > 0 || todayMetrics.webCount > 0) && (
                                <span className="block opacity-75 font-normal text-[9px] mt-0.5">
                                    🛒 POS: {todayMetrics.posCount} | 🌐 Web: {todayMetrics.webCount}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                </div>

                <div className="bg-orange-500 text-white p-6 rounded-[2rem] shadow-xl shadow-orange-500/20 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-white/20 p-2 rounded-xl"><Clock size={20} className="text-white" /></div>
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-md font-bold uppercase tracking-wider">Acción</span>
                        </div>
                        <h3 className="text-3xl font-black mb-1">{todayMetrics.pendingCount}</h3>
                        <p className="text-[11px] text-orange-100 font-bold">Por despachar</p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                </div>

                {userRole === 'admin' && (
                    <div className="bg-slate-700 text-white p-6 rounded-[2rem] shadow-xl shadow-slate-500/20 relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-white/20 p-2 rounded-xl"><Landmark size={20} className="text-white" /></div>
                                <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${todayMetrics.exchangeGap > 10 ? 'bg-red-500 text-white' : 'bg-white/20'}`}>Gap: {todayMetrics.exchangeGap.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between items-end gap-2">
                                <div><p className="text-[9px] text-slate-300 uppercase font-black">BCV $</p><h3 className="text-2xl font-black">Bs {exchangeRate.toFixed(2)}</h3></div>
                                <div><p className="text-[9px] text-slate-300 uppercase font-black">BCV €</p><h3 className="text-lg font-bold text-yellow-300 opacity-90">Bs {exchangeRateEuro > 0 ? exchangeRateEuro.toFixed(2) : '--'}</h3></div>
                                <div className="text-right"><p className="text-[9px] text-slate-300 uppercase font-black">Paralelo</p><h3 className="text-xl font-bold opacity-90">Bs {exchangeRateParalelo.toFixed(2)}</h3></div>
                            </div>
                        </div>
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                    </div>
                )}

                <div className="bg-red-500 text-white p-6 rounded-[2rem] shadow-xl shadow-red-500/20 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-white/20 p-2 rounded-xl"><AlertTriangle size={20} className="text-white" /></div>
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-md font-bold uppercase tracking-wider">Alerta</span>
                        </div>
                        <h3 className="text-3xl font-black mb-1">{todayMetrics.lowStockCount}</h3>
                        <p className="text-[11px] text-red-100 font-bold">Stock crítico ({'<'} 5)</p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6 h-full">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg dark:text-white">Actividad Reciente</h3></div>
                    <div className="space-y-3">
                        {todayMetrics.recentOrders.map((order: any) => (
                            <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 shadow-sm transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' : order.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {order.status === 'pending' ? 'P' : order.status === 'completed' ? 'C' : 'X'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{order.customerName}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                            <span className="font-mono">#{order.id.slice(0, 8)}</span>
                                            <span>•</span>
                                            <span>{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-sm dark:text-white">{activeCurrencySymbol}{order.total.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                        {todayMetrics.recentOrders.length === 0 && <p className="text-gray-400 text-center py-4">No hay actividad reciente en esta sede.</p>}
                    </div>
                </Card>
                <Card className="p-6 h-full">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /> Reposición Requerida</h3></div>
                    <div className="space-y-3">
                        {todayMetrics.lowStockList.map((p: any) => {
                            const stockCount = p.stock || 0;
                            return (
                                <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    <div className="relative">
                                        <img src={p.images[0] || DEFAULT_IMAGE} className="w-12 h-12 rounded-lg object-cover bg-gray-100" alt={p.title} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm dark:text-white truncate">{p.title}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{p.code}</p>
                                    </div>
                                    <div className="flex flex-col items-end px-3 py-1 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                                        <span className="font-black text-lg text-red-600 dark:text-red-400 leading-none">{stockCount}</span>
                                        <span className="text-[8px] font-bold text-red-400 uppercase">Quedan</span>
                                    </div>
                                </div>
                            );
                        })}
                        {todayMetrics.lowStockList.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                                <p className="text-sm font-bold text-green-600">Inventario Saludable</p>
                                <p className="text-xs text-gray-400 mt-1">No hay productos con stock crítico en esta sede.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
