
import React, { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useStore } from '../../context/StoreContext';
import { Button, Input, Card, Badge, LazyImage } from '../UIComponents';
import { generateId, exportToExcel } from './Shared';
import {
    Search, Plus, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight,
    Truck, Globe, Download, FileSpreadsheet, AlertTriangle, Tag, SlidersHorizontal
} from 'lucide-react';
import { Product, Category } from '../../types';
import { DEFAULT_IMAGE } from '../../config';
import { api } from '../../services/api';
import { ProductFormModal } from './products/ProductFormModal';
import { ProductImporter } from './products/ProductImporter';
import { StockBreakdownModal } from './products/StockBreakdownModal';
import { BarcodePrintModal } from './products/BarcodePrintModal';
import { StockAdjustmentModal } from './products/StockAdjustmentModal';
import { ReplenishButton } from '../../integrations/araw/ReplenishButton';

const ITEMS_PER_PAGE = 50;



export const ProductsModule = ({ categories, addProduct, updateProduct, deleteProduct }: any) => {
    const { userRole, currentUser, currentBranch, refreshStoreData, settings } = useStore();
    const { addNotification } = useNotification();

    // Data States
    const [serverProducts, setServerProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [transferProduct, setTransferProduct] = useState<Product | null>(null);
    const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
    const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const canManage = userRole === 'admin' || currentUser?.permissions?.includes('products_manage');
    const showCost = canManage;

    const isMultiBranch = settings.planTier !== 'single';

    useEffect(() => {
        loadProducts();
    }, [currentPage, categoryFilter, currentBranch, searchTerm]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const response = await api.getProducts(currentPage, ITEMS_PER_PAGE, searchTerm, categoryFilter === 'all' ? '' : categoryFilter);
            if (response && response.data) {
                setServerProducts(response.data);
                setTotalItems(response.pagination.total);
            }
        } catch (error) {
            console.error("Error loading products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProduct = async (data: any) => {
        try {
            if (editingProduct) {
                await updateProduct({ ...data, id: editingProduct.id });
                addNotification({ title: 'Actualizado', body: 'Producto guardado.', type: 'success' });
            } else {
                await addProduct({ ...data, id: generateId(), createdAt: Date.now() });
                addNotification({ title: 'Creado', body: 'Nuevo producto añadido.', type: 'success' });
            }
            setIsModalOpen(false);
            // FIX SEGURIDAD: Se eliminó loadProducts() aquí.
            // ProductContext.updateProduct/addProduct ya actualizan el estado local vía setProducts().
            // Re-llamar a la API sólo genera un GET redundante por cada producto guardado.
            // La tabla se actualiza automáticamente porque serverProducts refleja el contexto.
            loadProducts(); // Mantener para sincronizar stock y datos del servidor
        } catch (e) {
            addNotification({ title: 'Error', body: 'Falló el guardado.', type: 'warning' });
        }
    };


    const handleExport = async () => {
        addNotification({ title: 'Generando Reporte', body: 'Descargando inventario completo...', type: 'info' });

        try {
            const response = await api.getProducts(1, 100000, searchTerm, categoryFilter === 'all' ? '' : categoryFilter);
            const allProducts = response.data || [];

            if (allProducts.length === 0) {
                addNotification({ title: 'Vacío', body: 'No hay productos para exportar.', type: 'warning' });
                return;
            }

            const data: any[] = [];

            allProducts.forEach((p: Product) => {
                // Encontrar la imagen de la categoría actual para incluirla en el export
                const catObj = (categories as Category[]).find(c => c.name === p.category);

                const baseProduct = {
                    ID: p.id,
                    "Nombre*": p.title,
                    Categoría: p.category,
                    "Imagen Categoría": catObj ? catObj.image : '', // EXPORTACIÓN DE IMAGEN DE CATEGORÍA
                    Código: p.code,
                    Descripción: p.description,
                    "Costo unitario": p.cost,
                    "Precio*": p.price,
                    "Precio de promoción": p.salePrice,
                    "Mostrar en el catálogo": p.isVisible ? 'S' : 'N',
                    "Destacar": p.isFeatured ? 'S' : 'N',
                    "Controlar stock": p.trackStock ? 'S' : 'N',
                    "Stock mínimo": p.minStock,
                    "Imágenes": p.images ? p.images.join(', ') : ''
                };

                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        const variantRow = {
                            ...baseProduct,
                            "SKU Variante": v.sku,
                            "Precio*": v.price > 0 ? v.price : p.price,
                            "Stock actual": v.stock,
                            "Imagen Variante": v.image || '',
                            ...v.selections
                        };
                        data.push(variantRow);
                    });
                } else {
                    data.push({
                        ...baseProduct,
                        "SKU Variante": p.code,
                        "Stock actual": p.stock
                    });
                }
            });

            const fileName = `Inventario_${currentBranch?.name || 'Global'}_${new Date().toISOString().split('T')[0]}`;
            exportToExcel(data, fileName);
            addNotification({ title: 'Exportación Lista', body: `Se exportaron ${data.length} filas (incluyendo imágenes de productos y categorías).`, type: 'success' });

        } catch (e) {
            console.error(e);
            addNotification({ title: 'Error', body: 'No se pudo generar el Excel.', type: 'warning' });
        }
    };

    const handleImportSuccess = async () => {
        setIsImportModalOpen(false);
        await refreshStoreData();
        loadProducts();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-white/10">
                <div className="flex flex-col sm:flex-row flex-1 w-full gap-2 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Buscar..." className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl outline-none dark:text-white" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                    </div>
                    <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="w-full sm:w-auto pl-4 pr-8 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl border-transparent outline-none text-xs font-bold dark:text-gray-300">
                        <option value="all">Todas</option>
                        {(categories || []).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>

                {canManage && (
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <Button variant="secondary" onClick={handleExport} className="py-3.5 px-3" title="Descargar Excel Completo">
                            <Download size={20} />
                        </Button>
                        <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="py-3.5 px-3" title="Importar Excel/CSV">
                            <FileSpreadsheet size={20} />
                        </Button>
                        <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="gap-2 py-3.5 px-6 whitespace-nowrap"><Plus size={20} /> <span className="hidden sm:inline">Nuevo</span></Button>
                    </div>
                )}
            </div>

            {/* Vista Tabla Desktop */}
            <Card className="hidden md:block overflow-hidden border-white/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-gray-100/50 dark:bg-black/20 text-gray-500 text-[9px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="p-5 w-20">Imagen</th>
                                <th className="p-5">Producto</th>
                                <th className="p-5">Categoría</th>
                                <th className="p-5">Precio</th>
                                {showCost && <th className="p-5">Costo</th>}
                                <th className="p-5">Stock</th>
                                <th className="p-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={showCost ? 7 : 6} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-ios-blue" /> Cargando...</td></tr>
                            ) : serverProducts.length === 0 ? (
                                <tr><td colSpan={showCost ? 7 : 6} className="p-10 text-center text-gray-400">Sin productos.</td></tr>
                            ) : (
                                serverProducts.map((p: Product) => (
                                    <tr key={p.id} className="hover:bg-white dark:hover:bg-white/5 transition-colors">
                                        <td className="p-5"><div className="w-12 h-12 rounded-xl overflow-hidden border border-black/5"><img src={p.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover" /></div></td>
                                        <td className="p-5"><p className="font-bold text-sm dark:text-white">{p.title}</p><p className="text-[10px] text-gray-400 font-mono">{p.code}</p></td>
                                        <td className="p-5">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Badge color="gray">{p.category}</Badge>
                                                {(p.extraCategories ?? []).map(ec => (
                                                    <span
                                                        key={ec}
                                                        title={`También en: ${ec}`}
                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50"
                                                    >
                                                        {ec}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-5 font-black text-sm dark:text-white">${p.price.toFixed(2)}</td>
                                        {showCost && <td className="p-5 font-medium text-xs text-gray-500">${p.cost.toFixed(2)}</td>}
                                        <td className="p-5">
                                            <div className="flex flex-col items-start gap-1">
                                                <button
                                                    onClick={() => isMultiBranch ? setTransferProduct(p) : null}
                                                    className={`group relative font-black text-sm flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${isMultiBranch ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10' : 'cursor-default'} ${p.stock < 5 ? 'text-red-500' : 'dark:text-white'}`}
                                                >
                                                    {p.stock} u.
                                                    {isMultiBranch && <span className="opacity-0 group-hover:opacity-100 text-[10px] text-ios-blue">Ver Global</span>}
                                                </button>

                                                {isMultiBranch && (
                                                    <span className="text-[9px] text-gray-400 flex gap-1 items-center px-1"><Globe size={10} /> Global: {p.globalStock}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-1">
                                                {/* Solo mostrar botón de transferencia si es multi-sede y no es vista global */}
                                                {isMultiBranch && (currentBranch?.id || 0) > 0 && (
                                                    <button onClick={() => setTransferProduct(p)} className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg" title="Transferir"><Truck size={18} /></button>
                                                )}
                                                {/* Slot B2B: Solo visible si la integración ARAW está activa */}
                                                <ReplenishButton product={p} compact />
                                                {canManage && (
                                                    <>
                                                        <button onClick={() => setAdjustingProduct(p)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" title="Ajuste Rápido de Stock"><SlidersHorizontal size={18} /></button>
                                                        <button onClick={() => setBarcodeProduct(p)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title="Imprimir Etiqueta"><Tag size={18} /></button>
                                                        <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 text-ios-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 size={18} /></button>
                                                        <button onClick={() => { if (window.confirm('¿Eliminar?')) { deleteProduct(p.id); loadProducts(); } }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={18} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Vista Cards Mobile */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-ios-blue" /> Cargando...</div>
                ) : serverProducts.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">Sin productos.</div>
                ) : (
                    serverProducts.map((p: Product) => (
                        <div key={p.id} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-white/5 flex gap-4">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 border border-gray-100 dark:border-white/5">
                                <img src={p.images[0] || DEFAULT_IMAGE} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-sm dark:text-white truncate pr-2 leading-tight mb-1">{p.title}</h3>
                                    <div className="flex items-center gap-2 mb-2">
                                            <Badge color="gray" size="sm">{p.category}</Badge>
                                            {(p.extraCategories ?? []).slice(0, 2).map(ec => (
                                                <span
                                                    key={ec}
                                                    title={`También en: ${ec}`}
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 whitespace-nowrap"
                                                >
                                                    {ec}
                                                </span>
                                            ))}
                                            {(p.extraCategories ?? []).length > 2 && (
                                                <span className="text-[9px] text-gray-400">+{(p.extraCategories ?? []).length - 2}</span>
                                            )}
                                            <p className="text-[10px] text-gray-400 font-mono">{p.code}</p>
                                        </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-black text-lg dark:text-white">${p.price.toFixed(2)}</span>
                                        {showCost && <span className="text-xs text-gray-400">${p.cost.toFixed(2)}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        <button
                                            onClick={() => isMultiBranch ? setTransferProduct(p) : null}
                                            className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg ${p.stock < 5 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'} ${isMultiBranch ? 'active:scale-95 transition-transform' : ''}`}
                                        >
                                            {p.stock} unid.
                                            {isMultiBranch && <ChevronRight size={12} className="opacity-50" />}
                                        </button>

                                        {isMultiBranch && (
                                            <span className="text-[10px] text-gray-400 flex gap-1 items-center bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded"><Globe size={10} /> {p.globalStock}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-white/5">
                                    {isMultiBranch && (currentBranch?.id || 0) > 0 && (
                                        <button onClick={() => setTransferProduct(p)} className="p-2 text-orange-500 bg-orange-50 dark:bg-orange-900/10 rounded-xl" title="Transferir"><Truck size={16} /></button>
                                    )}
                                    {/* Slot B2B mobile */}
                                    <ReplenishButton product={p} />
                                    {canManage && (
                                        <>
                                            <button onClick={() => setAdjustingProduct(p)} className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl" title="Ajuste Rápido de Stock"><SlidersHorizontal size={16} /></button>
                                            <button onClick={() => setBarcodeProduct(p)} className="p-2 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl" title="Imprimir Etiqueta"><Tag size={16} /></button>
                                            <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 text-ios-blue bg-blue-50 dark:bg-blue-900/10 rounded-xl"><Edit2 size={16} /></button>
                                            <button onClick={() => { if (window.confirm('¿Eliminar?')) { deleteProduct(p.id); loadProducts(); } }} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl"><Trash2 size={16} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Paginación */}
            <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10 rounded-b-3xl">
                <span className="text-xs font-bold text-gray-500">Página {currentPage} de {totalPages || 1}</span>
                <div className="flex gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 dark:border-white/5"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <ProductFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={editingProduct} onSave={handleSaveProduct} categories={categories} />
            {/* Modal Híbrido: Sirve para ver desglose Y para transferir */}
            {transferProduct && (
                isMultiBranch ? (
                    <StockBreakdownModal
                        isOpen={!!transferProduct}
                        onClose={() => { setTransferProduct(null); loadProducts(); }}
                        product={transferProduct}
                        onTransfer={() => { }}
                    />
                ) : null
            )}

            {/* Modal de Código de Barras */}
            {barcodeProduct && (
                <BarcodePrintModal
                    isOpen={!!barcodeProduct}
                    onClose={() => setBarcodeProduct(null)}
                    product={barcodeProduct}
                    storeName={settings.storeName}
                />
            )}

            {/* Modal de Ajuste Rápido de Stock */}
            {adjustingProduct && (
                <StockAdjustmentModal
                    isOpen={!!adjustingProduct}
                    product={adjustingProduct}
                    onClose={() => setAdjustingProduct(null)}
                    onSuccess={loadProducts}
                />
            )}

            <ProductImporter
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={handleImportSuccess}
                existingCategories={categories}
            />
        </div>
    );
};
