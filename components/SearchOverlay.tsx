
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Search, ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_IMAGE } from '../config';

export const SearchOverlay = () => {
    const { isSearchOpen, setIsSearchOpen, products, categories, settings, activeExchangeRate, activeCurrencySymbol } = useStore();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isSearchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }, [isSearchOpen]);

    const handleClose = () => {
        setIsSearchOpen(false);
        setQuery('');
    };

    const handleProductClick = (id: string) => {
        navigate(`/product/${id}`);
        handleClose();
    };

    const handleCategoryClick = (categoryName: string) => {
        navigate(`/shop?category=${categoryName}`);
        handleClose();
    };

    // Función auxiliar para formatear precios según configuración
    const formatPrice = (amount: number) => {
        if (settings.priceDisplayMode === 'ves') {
            return `Bs ${(amount * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        // Para modo 'usd' o 'both' mostramos la moneda activa en el buscador
        return `${activeCurrencySymbol}${amount.toFixed(2)}`;
    };

    // "Smart" Filter Logic (No AI)
    const filteredProducts = products.filter(p => {
        if (!query) return false;
        if (!p.isVisible) return false;
        
        const term = query.toLowerCase();
        
        // Match Title
        if (p.title.toLowerCase().includes(term)) return true;
        
        // Match Category
        if (p.category.toLowerCase().includes(term)) return true;
        
        // Match Description (Partial)
        if (p.description.toLowerCase().includes(term)) return true;

        // Match Variant Options (e.g. searching for "Red" or "XL")
        if (p.variantOptions.some(opt => 
            opt.values.some(val => val.toLowerCase().includes(term))
        )) return true;

        return false;
    });

    if (!isSearchOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-ios-bg dark:bg-black/95 backdrop-blur-xl animate-fade-in flex flex-col">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/50 sticky top-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Buscar productos, categorías, variantes..." 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-200/50 dark:bg-white/10 rounded-xl outline-none text-base text-ios-text dark:text-white placeholder-gray-500"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 bg-gray-300 dark:bg-white/20 rounded-full p-0.5">
                            <X size={12} />
                        </button>
                    )}
                </div>
                <button onClick={handleClose} className="text-ios-blue font-medium px-2">
                    Cancelar
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {query === '' ? (
                    // Default View (Suggestions)
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 px-2">Categorías</h3>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button 
                                        key={cat.id} 
                                        onClick={() => handleCategoryClick(cat.name)}
                                        className="px-4 py-2 bg-white dark:bg-white/10 rounded-lg text-sm font-medium text-ios-text dark:text-gray-200 border border-gray-100 dark:border-white/5"
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 px-2 flex items-center gap-1">
                                <TrendingUp size={12}/> Tendencias
                            </h3>
                            <div className="bg-white dark:bg-white/5 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
                                {products.filter(p => p.isFeatured).slice(0, 3).map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleProductClick(p.id)}
                                        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                                            <img src={p.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-sm font-medium dark:text-white line-clamp-1">{p.title}</span>
                                        <ChevronRight size={16} className="ml-auto text-gray-300" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Results View
                    <div className="space-y-2">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <div 
                                    key={product.id}
                                    onClick={() => handleProductClick(product.id)}
                                    className="bg-white dark:bg-white/5 p-3 rounded-2xl flex gap-4 items-center cursor-pointer hover:shadow-md transition-all border border-transparent dark:border-white/5"
                                >
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden shrink-0">
                                        <img src={product.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-ios-text dark:text-white truncate">{product.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{product.category}</span>
                                            {product.salePrice ? (
                                                <span className="text-sm font-bold text-red-500">{formatPrice(product.salePrice)}</span>
                                            ) : (
                                                <span className="text-sm font-bold text-ios-text dark:text-gray-300">{formatPrice(product.price)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-gray-300" />
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <Search size={40} className="mx-auto mb-4 opacity-50" />
                                <p>No encontramos resultados para "{query}"</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
