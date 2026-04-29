
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../../context/StoreContext';
import { usePOS } from '../../../context/POSContext';
import { Product } from '../../../types';
import { LazyImage } from '../../UIComponents';
import { Search, ChevronDown, Filter, Loader2, Store, Globe } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../../config';
import { useDebounce } from '../../../hooks/useDebounce';
import { api } from '../../../services/api';

export const POSProductGrid = () => {
    const { categories, activeExchangeRate, activeCurrencySymbol } = useStore();
    const { addToCart, openVariantModal, isFullScreen, addCustomItemToCart } = usePOS();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const debouncedSearch = useDebounce(search, 300);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef(null);

    const loadProducts = async (reset = false) => {
        if (loading && !reset) return;
        setLoading(true);
        if (reset) {
            setProducts([]);
            setPage(1);
        }

        try {
            const p = reset ? 1 : page;
            const catFilter = selectedCategory === 'Todas' ? '' : selectedCategory;
            const res = await api.getProducts(p, 24, debouncedSearch, catFilter);

            if (res && res.data) {
                setProducts(prev => reset ? res.data : [...prev, ...res.data]);
                setHasMore(res.data.length === 24);
                if (!reset) setPage(prev => prev + 1);
            } else {
                if (reset) setProducts([]);
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setHasMore(true);
        loadProducts(true);
    }, [debouncedSearch, selectedCategory]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting && hasMore && !loading) loadProducts(false); },
            { threshold: 1.0 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    const handleProductClick = (p: Product) => {
        const hasVariants = p.variants && p.variants.length > 0;
        const localStock = p.stock || 0;
        const globalStock = p.globalStock || 0;

        if (hasVariants) {
            openVariantModal(p);
        } else {
            if (localStock > 0) {
                addToCart(p);
            } else if (globalStock > 0) {
                alert(`Producto agotado en esta sede. Disponible en inventario global (${globalStock} u).`);
            }
        }
    };

    const [manualSaleOpen, setManualSaleOpen] = useState(false);
    const [manualItem, setManualItem] = useState({ name: '', price: '', quantity: '1' });

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualItem.name || !manualItem.price) return;
        addCustomItemToCart(manualItem.name, Number(manualItem.price), Number(manualItem.quantity));
        setManualSaleOpen(false);
        setManualItem({ name: '', price: '', quantity: '1' });
    };

    return (
        <div className={`flex-1 flex flex-col h-full bg-gray-50 dark:bg-black/20 ${isFullScreen ? '' : 'rounded-l-[2rem]'} overflow-hidden relative`}>
            <div className="p-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-white/5 flex flex-col gap-2 shadow-sm z-10">
                <div className="flex gap-2">
                    <button
                        onClick={() => setManualSaleOpen(true)}
                        className="bg-ios-blue text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform"
                        title="Venta Rápida / Genérica"
                    >
                        <span className="text-xl font-bold">+</span>
                    </button>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-white/5 rounded-xl outline-none text-xs dark:text-white focus:ring-2 focus:ring-ios-blue/20 transition-all"
                            placeholder="Buscar productos..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="relative min-w-[120px]">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full h-full pl-3 pr-8 bg-gray-100 dark:bg-white/5 rounded-xl text-xs font-bold appearance-none outline-none dark:text-white cursor-pointer border-transparent focus:border-ios-blue"
                        >
                            <option value="Todas">Todas</option>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Modal de Venta Rápida */}
            {manualSaleOpen && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/10 animate-slide-up">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Venta Rápida</h3>
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Descripción</label>
                                <input
                                    autoFocus
                                    type="text"
                                    required
                                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border-none outline-none text-sm dark:text-white focus:ring-2 focus:ring-ios-blue"
                                    placeholder="Ej. Producto Varios"
                                    value={manualItem.name}
                                    onChange={e => setManualItem({ ...manualItem, name: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Precio ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border-none outline-none text-sm dark:text-white focus:ring-2 focus:ring-ios-blue font-mono"
                                        placeholder="0.00"
                                        value={manualItem.price}
                                        onChange={e => setManualItem({ ...manualItem, price: e.target.value })}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Cant.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border-none outline-none text-sm dark:text-white focus:ring-2 focus:ring-ios-blue font-mono"
                                        value={manualItem.quantity}
                                        onChange={e => setManualItem({ ...manualItem, quantity: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setManualSaleOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-3 text-sm font-bold bg-ios-blue text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors">
                                    Agregar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className={`flex-1 overflow-y-auto p-4 grid gap-3 content-start ${isFullScreen ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                {products.length === 0 && !loading ? (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <Filter size={32} className="mb-2" />
                        <p className="text-xs">No hay productos en esta categoría.</p>
                    </div>
                ) : (
                    products.map(p => {
                        const hasVariants = p.variantOptions && p.variantOptions.length > 0;
                        const realStock = p.stock || 0;
                        const globalStock = p.globalStock || 0;

                        // Si tiene variantes, siempre parece "disponible" para poder abrir el modal y chequear combinaciones
                        // Si es simple, depende del stock real.
                        const isInteractable = hasVariants || realStock > 0;
                        const isRemoteStock = !hasVariants && realStock === 0 && globalStock > 0;

                        return (
                            <div
                                key={p.id}
                                onClick={() => handleProductClick(p)}
                                className={`bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col gap-2 cursor-pointer transition-all active:scale-95 ${isInteractable ? 'hover:border-ios-blue hover:shadow-md' : 'opacity-70 grayscale'}`}
                            >
                                <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden relative">
                                    <LazyImage src={p.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                                    {hasVariants && (
                                        <div className="absolute top-1 right-1 bg-black/60 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <Filter size={8} />
                                        </div>
                                    )}
                                    {!isInteractable && !isRemoteStock && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-1">
                                            <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded mb-1">AGOTADO</span>
                                        </div>
                                    )}
                                    {isRemoteStock && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-1">
                                            <span className="text-[9px] text-orange-300 font-bold flex items-center gap-1"><Globe size={10} /> Global: {globalStock}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold dark:text-white line-clamp-1 leading-tight">{p.title}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        {p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price ? (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 line-through">{activeCurrencySymbol}{p.price}</span>
                                                <span className="text-sm font-black text-red-500">{activeCurrencySymbol}{p.discountPrice}</span>
                                                {activeExchangeRate > 0 && (
                                                    <span className="text-[9px] font-bold text-gray-400 leading-none">
                                                        {(p.discountPrice * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                                    </span>
                                                )}
                                            </div>
                                        ) : (p.salePrice && p.salePrice > 0 && p.salePrice < p.price) ? (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 line-through">{activeCurrencySymbol}{p.price}</span>
                                                <span className="text-sm font-black text-red-500">{activeCurrencySymbol}{p.salePrice}</span>
                                                {activeExchangeRate > 0 && (
                                                    <span className="text-[9px] font-bold text-gray-400 leading-none">
                                                        {(p.salePrice * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-ios-blue">{activeCurrencySymbol}{p.price}</span>
                                                {activeExchangeRate > 0 && (
                                                    <span className="text-[9px] font-bold text-gray-400 leading-none">
                                                        {(p.price * activeExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${realStock > 0 ? 'text-gray-500 bg-gray-100 dark:bg-white/10' : 'text-red-500 bg-red-50'}`}>
                                            {realStock}u
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                <div ref={observerTarget} className="col-span-full h-10 flex items-center justify-center">
                    {loading && <Loader2 className="animate-spin text-ios-blue" />}
                </div>
            </div>
        </div >
    );
};
