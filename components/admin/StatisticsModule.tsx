
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext'; 
import { Activity, Package, DollarSign, Store, MapPin, Trophy } from 'lucide-react';
import { Order, Product, Customer } from '../../types';
import { FinancialAnalytics } from './statistics/FinancialAnalytics';
import { InventoryAnalytics } from './statistics/InventoryAnalytics';
import { SellersAnalytics } from './statistics/SellersAnalytics';

export const StatisticsModule = ({ orders, products, customers, categories }: { orders: Order[], products: Product[], customers: Customer[], categories: any[] }) => {
    const { currentBranch } = useStore();
    const [viewMode, setViewMode] = useState<'financial' | 'inventory' | 'sellers'>('financial');
    const isGlobalView = currentBranch?.id === 0;

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header con Indicador de Sede */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-2">
                        {viewMode === 'financial' ? <Activity className="text-ios-blue" size={24}/> : viewMode === 'inventory' ? <Package className="text-purple-500" size={24}/> : <Trophy className="text-yellow-500" size={24}/>}
                        {viewMode === 'financial' ? 'Inteligencia Financiera' : viewMode === 'inventory' ? 'Valoración de Inventario' : 'Rendimiento de Vendedores'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isGlobalView ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isGlobalView ? <Store size={10}/> : <MapPin size={10}/>}
                            {isGlobalView ? 'VISTA GLOBAL (Todas las Sedes)' : `VISTA LOCAL: ${currentBranch?.name}`}
                        </span>
                        <span className="text-xs text-gray-500">
                            {viewMode === 'financial' ? 'Análisis de ventas completadas.' : viewMode === 'inventory' ? 'Auditoría y costos de stock actual.' : 'Ranking, cuotas y liquidación de comisiones.'}
                        </span>
                    </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl flex gap-1 w-full xl:w-auto">
                    <button onClick={() => setViewMode('financial')} className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'financial' ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                        <DollarSign size={16}/> Ventas
                    </button>
                    <button onClick={() => setViewMode('inventory')} className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'inventory' ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                        <Package size={16}/> Stock
                    </button>
                    <button onClick={() => setViewMode('sellers')} className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'sellers' ? 'bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}>
                        <Trophy size={16}/> Vendedores
                    </button>
                </div>
            </div>

            {viewMode === 'financial' ? (
                <FinancialAnalytics orders={orders} products={products} onNavigateToSellers={() => setViewMode('sellers')} />
            ) : viewMode === 'inventory' ? (
                <InventoryAnalytics products={products} />
            ) : (
                <SellersAnalytics orders={orders} products={products} />
            )}
        </div>
    );
};
