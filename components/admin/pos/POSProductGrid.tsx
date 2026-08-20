
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../../context/StoreContext';
import { usePOS } from '../../../context/POSContext';
import { Product } from '../../../types';
import { LazyImage } from '../../UIComponents';
import { Search, ChevronDown, Filter, Loader2, Store, Globe, Scan, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { DEFAULT_IMAGE } from '../../../config';
import { useDebounce } from '../../../hooks/useDebounce';
import { api } from '../../../services/api';

import { generateEAN13, normalizeToEAN13 } from '../../../utils/barcodeUtils';

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

    // ──────────────────────────────────────────────────────────────
    // PISTOLA DE CÓDIGO DE BARRAS
    // La pistola envía caracteres muy rápido (< 80ms) y termina con Enter.
    // Acumulamos caracteres en barcodeBuffer; si el Enter llega con ≥ 8
    // chars acumulados en esa ventana, lo tratamos como escaneo.
    // ──────────────────────────────────────────────────────────────
    const barcodeBuffer = useRef('');
    const barcodeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastKeyTime   = useRef<number>(0);
    const [scanFeedback, setScanFeedback] = useState<'ok' | 'notfound' | null>(null);
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showFeedback = (type: 'ok' | 'notfound') => {
        setScanFeedback(type);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setScanFeedback(null), 1800);
    };

    const handleBarcodeDetected = useCallback((code: string) => {
        const normalized = code.trim();
        if (normalized.length < 5) return; // corto

        // 1. Buscar en productos cargados por barcodeEan del producto (exacto o normalizado EAN-13)
        let found = products.find(p =>
            p.barcodeEan && (p.barcodeEan === normalized || normalizeToEAN13(p.barcodeEan) === normalized)
        );

        // 2. Si no, buscar en variantes de los productos cargados
        if (!found) {
            found = products.find(p =>
                p.variants && p.variants.some(v =>
                    v.barcodeEan && (v.barcodeEan === normalized || normalizeToEAN13(v.barcodeEan) === normalized)
                )
            );
        }

        // 3. Si no, buscar por código interno (SKU del producto o de la variante)
        if (!found) {
            found = products.find(p => 
                (p.code && p.code.toUpperCase() === normalized.toUpperCase()) ||
                (p.variants && p.variants.some(v => v.sku && v.sku.toUpperCase() === normalized.toUpperCase()))
            );
        }

        // 4. Fallback: comparar con el EAN-13 autogenerado dinámicamente al vuelo (producto base o variantes)
        if (!found) {
            found = products.find(p => {
                const autoEan = generateEAN13(p.category || 'General', p.code || p.id);
                if (autoEan === normalized) return true;

                if (p.variants && p.variants.length > 0) {
                    return p.variants.some(v => {
                        const vCode = `${p.code || p.id}-${v.sku || ''}`;
                        return generateEAN13(p.category || 'General', vCode) === normalized;
                    });
                }
                return false;
            });
        }

        if (found) {
            const hasVariants = found.variants && found.variants.length > 0;
            if (hasVariants) {
                // Si el barcode es de una variante específica, agregar esa variante directamente
                const matchedVariant = found.variants.find(v => {
                    if (v.barcodeEan && (v.barcodeEan === normalized || normalizeToEAN13(v.barcodeEan) === normalized)) return true;
                    if (v.sku && v.sku.toUpperCase() === normalized.toUpperCase()) return true;
                    const vCode = `${found?.code || found?.id}-${v.sku || ''}`;
                    if (generateEAN13(found?.category || 'General', vCode) === normalized) return true;
                    return false;
                });
                if (matchedVariant) {
                    addToCart(
                        found,
                        matchedVariant.selections,
                        matchedVariant.price,
                        matchedVariant.sku,
                        matchedVariant.image
                    );
                } else {
                    openVariantModal(found);
                }
            } else {
                addToCart(found);
            }
            showFeedback('ok');
        } else {
            showFeedback('notfound');
        }
    }, [products, addToCart, openVariantModal]);

    // Listener global de teclado — captura pistola aunque el foco esté en cualquier elemento
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignorar si el foco está en un input de texto (excepto el de búsqueda del POS)
            const tag = (e.target as HTMLElement).tagName;
            const isTextInput = (tag === 'INPUT' || tag === 'TEXTAREA') &&
                !(e.target as HTMLInputElement).classList.contains('pos-search');
            if (isTextInput) return;

            const now = Date.now();
            const timeSinceLastKey = now - lastKeyTime.current;
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                // Solo procesar si hay datos en el buffer (evita el Enter normal)
                if (barcodeBuffer.current.length >= 6) {
                    handleBarcodeDetected(barcodeBuffer.current);
                }
                barcodeBuffer.current = '';
                if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
                return;
            }

            // Si es una tecla alfanumérica (barcode chars)
            if (e.key.length === 1) {
                // Las pistolas envían caracteres en ráfaga < 80ms
                if (timeSinceLastKey < 80 || barcodeBuffer.current.length > 0) {
                    barcodeBuffer.current += e.key;
                } else {
                    // Primera tecla, o gap largo → reiniciar
                    barcodeBuffer.current = e.key;
                }

                // Reset automático si no llega Enter en 200ms
                if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
                barcodeTimer.current = setTimeout(() => {
                    barcodeBuffer.current = '';
                }, 200);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleBarcodeDetected]);

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

    // ──────────────────────────────────────────────────────────────
    // CÁMARA — BarcodeDetector API (Android Chrome) + fallback iOS
    // ──────────────────────────────────────────────────────────────
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [manualBarcode, setManualBarcode] = useState('');
    const [hasBarcodeDetector] = useState(() => 'BarcodeDetector' in globalThis);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    const stopCamera = () => {
        if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraOpen(false);
        setCameraError('');
        setManualBarcode('');
    };

    const startCamera = async () => {
        setCameraError('');
        setManualBarcode('');
        setCameraOpen(true);
        if (!hasBarcodeDetector) return; // fallback: solo muestra input manual

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // @ts-ignore — BarcodeDetector no está en los tipos TS aún
            const detector = new (globalThis as any).BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
            });

            const scan = async () => {
                if (!videoRef.current || videoRef.current.readyState < 2) {
                    scanLoopRef.current = requestAnimationFrame(scan);
                    return;
                }
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        stopCamera();
                        handleBarcodeDetected(barcodes[0].rawValue);
                        return;
                    }
                } catch (_) { /* continuar */ }
                scanLoopRef.current = requestAnimationFrame(scan);
            };
            scanLoopRef.current = requestAnimationFrame(scan);
        } catch (err: any) {
            setCameraError(err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
                ? 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
                : 'No se pudo acceder a la cámara.');
        }
    };

    const handleManualBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualBarcode.trim()) {
            stopCamera();
            handleBarcodeDetected(manualBarcode.trim());
        }
    };

    return (
        <div className={`flex-1 flex flex-col h-full bg-gray-50 dark:bg-black/20 ${isFullScreen ? '' : 'rounded-l-[2rem]'} overflow-hidden relative`}>
            <div className="p-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-white/5 flex flex-col gap-2 shadow-sm z-10">
                {/* Feedback de escaneo */}
                {scanFeedback && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold animate-fade-in ${
                        scanFeedback === 'ok'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                        {scanFeedback === 'ok'
                            ? <><CheckCircle size={14} /> Producto agregado al carrito</>
                            : <><XCircle size={14} /> Código no encontrado en el sistema</>
                        }
                    </div>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={() => setManualSaleOpen(true)}
                        className="bg-ios-blue text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform"
                        title="Venta Rápida / Genérica"
                    >
                        <span className="text-xl font-bold">+</span>
                    </button>
                    {/* Botón cámara */}
                    <button
                        onClick={startCamera}
                        className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 transition-transform shrink-0"
                        title="Escanear con Cámara"
                    >
                        <Scan size={18} />
                    </button>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            className="pos-search w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-white/5 rounded-xl outline-none text-xs dark:text-white focus:ring-2 focus:ring-ios-blue/20 transition-all"
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

            {/* Modal de Escaneo con Cámara */}
            {cameraOpen && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-slide-up">
                        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                            <h3 className="font-bold dark:text-white flex items-center gap-2">
                                <Scan size={18} className="text-ios-blue" />
                                Escáner de Código
                            </h3>
                            <button onClick={stopCamera} className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        <div className="p-4 flex flex-col gap-4 relative">
                            {cameraError ? (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex flex-col items-center text-center gap-2">
                                    <AlertCircle size={24} />
                                    {cameraError}
                                </div>
                            ) : hasBarcodeDetector ? (
                                <div className="relative aspect-square w-full bg-black rounded-xl overflow-hidden shadow-inner">
                                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                                    {/* Mira visual */}
                                    <div className="absolute inset-0 border-[40px] border-black/40 z-10 pointer-events-none"></div>
                                    <div className="absolute inset-[40px] border-2 border-ios-blue rounded-lg z-10 pointer-events-none shadow-[0_0_20px_rgba(0,122,255,0.5)] flex items-center justify-center">
                                        <div className="w-full h-[2px] bg-red-500/80 animate-scan-line shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                                    </div>
                                    <p className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs z-20 font-bold drop-shadow-md">Apunte al código de barras</p>
                                </div>
                            ) : null}

                            <div className="text-center pt-2">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">O ingrese el código manualmente</p>
                                <form onSubmit={handleManualBarcodeSubmit} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        autoFocus={!hasBarcodeDetector}
                                        value={manualBarcode}
                                        onChange={e => setManualBarcode(e.target.value)}
                                        placeholder="Ej: 7591234567890" 
                                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-black/20 border-2 border-gray-100 dark:border-white/10 rounded-xl outline-none text-sm font-mono dark:text-white focus:border-ios-blue transition-colors"
                                    />
                                    <button type="submit" className="px-4 py-3 bg-ios-blue text-white rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-600 font-bold transition-colors">
                                        Buscar
                                    </button>
                                </form>
                            </div>
                        </div>
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
