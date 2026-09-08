
import React, { useState } from 'react';
import { ProductsModule } from './ProductsModule';
import { CategoriesModule } from './CategoriesModule';
import { InventoryAnalyticsModule } from './InventoryAnalyticsModule';
import { Product, Category } from '../../types';
import { Package, Tags, BarChart2 } from 'lucide-react';

interface InventoryHubProps {
    products: Product[];
    categories: Category[];
    addProduct: (p: Product) => Promise<any>;
    updateProduct: (p: Product) => Promise<any>;
    deleteProduct: (id: string) => void;
    addCategory: (c: Category) => void;
    updateCategory: (c: Category) => void;
    deleteCategory: (id: string) => void;
}

export const InventoryHub: React.FC<InventoryHubProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'management' | 'categories' | 'analytics'>('management');

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Cabecera del Hub */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white">Inventario General</h2>
                    <p className="text-xs text-gray-500">Gestión centralizada de stock, categorías, mermas y analítica de valor.</p>
                </div>
                
                {/* Switcher tipo iOS */}
                <div className="bg-gray-100 dark:bg-white/10 p-1 rounded-xl flex w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('management')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'management' 
                            ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        <Package size={16} /> Productos
                    </button>
                    <button 
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'categories' 
                            ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        <Tags size={16} /> Categorías
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'analytics' 
                            ? 'bg-white dark:bg-zinc-800 text-ios-blue shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        <BarChart2 size={16} /> Analítica
                    </button>
                </div>
            </div>

            {/* Contenido Dinámico con Scroll Habilitado */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pr-1 pb-20">
                {activeTab === 'management' && (
                    <ProductsModule {...props} />
                )}
                
                {activeTab === 'categories' && (
                    <CategoriesModule 
                        categories={props.categories} 
                        products={props.products} 
                        addCategory={props.addCategory} 
                        updateCategory={props.updateCategory}
                        deleteCategory={props.deleteCategory} 
                    />
                )}

                {activeTab === 'analytics' && (
                    <InventoryAnalyticsModule products={props.products} />
                )}
            </div>
        </div>
    );
};
