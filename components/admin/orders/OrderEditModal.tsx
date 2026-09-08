
import React, { useState, useEffect, useMemo } from 'react';
import { Order, Product, CartItem } from '../../../types';
import { useStore } from '../../../context/StoreContext'; // Importar contexto para acceder a productos
import { X, Plus, Trash2, Save, Search, User, Phone, MapPin, ChevronLeft, ChevronRight, Package, Box, Tag, DollarSign, Percent, CreditCard } from 'lucide-react';
import { Button, Input, LazyImage } from '../../UIComponents';
import { DEFAULT_IMAGE } from '../../../config';
import { VariantSelectorModal } from '../pos/POSModals';

interface OrderEditModalProps {
    order: Order;
    onSave: (o: Order) => void;
    onClose: () => void;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({ order, onSave, onClose }) => {
    const { products, settings } = useStore(); // Acceso al inventario y settings para métodos de pago
    const [formData, setFormData] = useState<Order>(JSON.parse(JSON.stringify(order))); // Deep copy
    const [activeTab, setActiveTab] = useState<'general' | 'items'>('items');
    const [isSaving, setIsSaving] = useState(false);
    
    // --- ESTADOS PARA AGREGAR PRODUCTOS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]); // Cambiado para soportar variantes
    const [showResults, setShowResults] = useState(false);
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);

    // --- ESTADO PARA ITEM MANUAL ---
    const [manualItem, setManualItem] = useState({ title: '', price: '', qty: '1' });

    // --- ESTADO PARA DESCUENTO RÁPIDO ---
    const initialDiscount = order.discount !== undefined && order.discount > 0 
        ? order.discount.toString() 
        : (order.subtotal && order.subtotal > order.total ? (order.subtotal - order.total).toFixed(2) : '');
    const [discountValue, setDiscountValue] = useState<string>(initialDiscount);
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');

    // Filtrar productos al escribir
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        const term = searchTerm.toLowerCase();
        let results: any[] = [];
        for (const p of products) {
            if (!p.isVisible) continue;
            if (p.title.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)) {
                results.push({
                    type: p.variants && p.variants.length > 0 ? 'product_with_variants' : 'product',
                    product: p,
                    title: p.title,
                    code: p.code,
                    price: p.price,
                    stock: p.stock
                });
            }
            if (results.length >= 5) break;
        }
        setSearchResults(results.slice(0, 5));
        setShowResults(true);
    }, [searchTerm, products]);

    // Recalcular subtotal y total automáticamente considerando descuento
    useEffect(() => {
        const subtotal = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let discountAmount = 0;
        const val = parseFloat(discountValue) || 0;
        
        if (discountType === 'percent') {
            discountAmount = subtotal * (val / 100);
        } else {
            discountAmount = Math.min(subtotal, val);
        }

        const finalTotal = Math.max(0, subtotal - discountAmount);
        setFormData(prev => ({ 
            ...prev, 
            subtotal, 
            discount: discountAmount, 
            total: finalTotal 
        }));
    }, [formData.items, discountValue, discountType]);

    // Agregar producto del inventario al pedido
    const handleAddProduct = (item: any) => {
        const p = item.product;
        
        if (item.type === 'product_with_variants') {
            setSelectedProductForVariant(p);
            setShowResults(false);
            return;
        }

        const newItem: CartItem = {
            cartId: `edit-${p.id}-base-${Date.now()}`,
            productId: p.id,
            productTitle: p.title,
            price: item.price,
            quantity: 1,
            image: p.images[0] || DEFAULT_IMAGE,
            selectedOptions: {},
            variantSku: p.code
        };
        
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setSearchTerm(''); // Limpiar búsqueda
        setShowResults(false);
    };

    // Agregar variante confirmada desde el modal
    const handleVariantConfirm = (p: Product, selections: Record<string, string>, price: number, variantSku: string, image: string) => {
        // Encontrar la variante original para asegurar que guardamos su ID (para el inventario en backend)
        const v = p.variants?.find(v => v.sku === variantSku);
        
        const newItem: CartItem = {
            cartId: `edit-${p.id}-${v ? v.id : 'variant'}-${Date.now()}`,
            productId: p.id,
            productTitle: p.title,
            price: price,
            quantity: 1,
            image: image,
            selectedOptions: selections,
            variantSku: variantSku,
            variantId: v ? v.id : undefined
        };
        
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setSelectedProductForVariant(null);
        setSearchTerm('');
    };

    const handleUpdateItemQty = (index: number, change: number) => {
        const newItems = [...formData.items];
        const newQty = newItems[index].quantity + change;
        if (newQty > 0) {
            newItems[index].quantity = newQty;
            setFormData({ ...formData, items: newItems });
        } else {
            if (window.confirm("¿Eliminar este producto del pedido?")) {
                newItems.splice(index, 1);
                setFormData({ ...formData, items: newItems });
            }
        }
    };

    const handleRemoveItem = (index: number) => {
        if (window.confirm("¿Eliminar producto?")) {
            const newItems = [...formData.items];
            newItems.splice(index, 1);
            setFormData({ ...formData, items: newItems });
        }
    };

    const handleAddManualItem = () => {
        if (!manualItem.title || !manualItem.price) return;
        const price = parseFloat(manualItem.price);
        const qty = parseInt(manualItem.qty);
        
        if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;

        const newItem: CartItem = {
            cartId: `manual-${Date.now()}`,
            productId: `manual-${Date.now()}`,
            productTitle: manualItem.title,
            price: price,
            quantity: qty,
            image: '',
            selectedOptions: {},
            variantSku: 'MANUAL'
        };

        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setManualItem({ title: '', price: '', qty: '1' });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const subtotal = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const val = parseFloat(discountValue) || 0;
            const discountAmount = discountType === 'percent' ? subtotal * (val / 100) : Math.min(subtotal, val);
            const finalTotal = Math.max(0, subtotal - discountAmount);

            const finalOrderToSave: Order = {
                ...formData,
                subtotal,
                discount: discountAmount,
                total: finalTotal
            };

            await onSave(finalOrderToSave);
            onClose();
        } catch (e: any) {
            alert(e?.message || "Error al guardar el pedido");
        } finally {
            setIsSaving(false);
        }
    };

    const availableMethods = settings.paymentMethods?.filter(m => m.isActive) || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl relative animate-slide-up border border-white/10 flex flex-col max-h-[90vh]">
                
                <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/20 rounded-t-2xl">
                    <div>
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Save size={18} className="text-ios-blue"/> Editar Pedido</h3>
                        <p className="text-xs text-gray-500">Orden #{order.id.slice(0,8)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full dark:text-white transition"><X size={20}/></button>
                </div>

                <div className="flex border-b border-gray-100 dark:border-white/5">
                    <button onClick={() => setActiveTab('items')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'items' ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>Productos ({formData.items.length})</button>
                    <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'general' ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/50 dark:bg-blue-900/20' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>Datos Cliente</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 relative">
                    {activeTab === 'general' ? (
                        <div className="space-y-4">
                            <Input label="Nombre Cliente" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} icon={<User size={16}/>} />
                            <Input label="Teléfono" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} icon={<Phone size={16}/>} />
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Dirección</label>
                                <textarea className="w-full bg-gray-50 dark:bg-white/5 border-transparent rounded-xl p-3 text-sm dark:text-white outline-none focus:ring-2 focus:ring-ios-blue/20" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} rows={2} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Estado</label>
                                    <select 
                                        className="w-full bg-gray-50 dark:bg-white/5 border-transparent rounded-xl px-3 py-2.5 text-sm dark:text-white outline-none"
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                                    >
                                        <option value="pending">Pendiente</option>
                                        <option value="completed">Completado</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Método Pago</label>
                                    <div className="relative">
                                        <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                        <select 
                                            className="w-full bg-gray-50 dark:bg-white/5 border-transparent rounded-xl pl-9 pr-3 py-2.5 text-sm dark:text-white outline-none appearance-none"
                                            value={formData.paymentMethod}
                                            onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                                        >
                                            {availableMethods.map(m => (
                                                <option key={m.id} value={m.name}>{m.name}</option>
                                            ))}
                                            {/* Opción de fallback si el método actual no está en la lista activa */}
                                            {!availableMethods.some(m => m.name === formData.paymentMethod) && (
                                                <option value={formData.paymentMethod}>{formData.paymentMethod} (Archivado)</option>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* --- BUSCADOR DE PRODUCTOS --- */}
                            <div className="relative z-20">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                    <input 
                                        placeholder="Buscar producto para agregar..." 
                                        className="w-full bg-gray-100 dark:bg-white/5 pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ios-blue/30 dark:text-white"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onFocus={() => { if(searchTerm) setShowResults(true); }}
                                    />
                                    {searchTerm && <button onClick={() => { setSearchTerm(''); setShowResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-gray-400"/></button>}
                                </div>
                                
                                {showResults && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-100 dark:border-white/10 max-h-48 overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map((p, i) => (
                                                <button key={i} onClick={() => handleAddProduct(p)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 flex justify-between items-center group">
                                                    <div>
                                                        <p className="text-sm font-bold dark:text-white">{p.title}</p>
                                                        <p className="text-[10px] text-gray-500">
                                                            {p.code} • {p.type === 'product_with_variants' ? 'Múltiples opciones' : `Stock: ${p.stock}`}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-bold text-ios-blue group-hover:scale-110 transition-transform">
                                                        {p.type === 'product_with_variants' ? 'Elegir' : '+ Add'}
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-xs text-gray-400">No encontrado. Agrega manual abajo.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* --- LISTA DE ITEMS --- */}
                            <div className="space-y-3">
                                {formData.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 items-center bg-gray-50 dark:bg-white/5 p-2 rounded-xl border border-gray-100 dark:border-white/5 group hover:border-ios-blue/30 transition-all">
                                        <div className="w-10 h-10 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-white/5">
                                            {item.image ? <img src={item.image} className="w-full h-full object-cover"/> : <Package size={16} className="text-gray-300"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold dark:text-white truncate">{item.productTitle}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-gray-500">${item.price} c/u</p>
                                                {item.variantSku !== item.productId && <span className="text-[9px] bg-gray-200 dark:bg-white/10 px-1 rounded text-gray-600 dark:text-gray-400">{item.variantSku}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-lg p-1 shadow-sm">
                                            <button onClick={() => handleUpdateItemQty(idx, -1)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-gray-600 dark:text-gray-300"><ChevronLeft size={14}/></button>
                                            <span className="text-xs font-bold w-4 text-center dark:text-white">{item.quantity}</span>
                                            <button onClick={() => handleUpdateItemQty(idx, 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-gray-600 dark:text-gray-300"><ChevronRight size={14}/></button>
                                        </div>
                                        <button onClick={() => handleRemoveItem(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* --- AGREGAR ITEM MANUAL --- */}
                            <div className="border-t border-gray-100 dark:border-white/5 pt-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Plus size={14}/> Item Manual / Servicio</h4>
                                <div className="grid grid-cols-6 gap-2">
                                    <div className="col-span-3">
                                        <input className="w-full bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 text-xs outline-none border-transparent focus:border-ios-blue/30 border dark:text-white" placeholder="Descripción (Ej: Envío)" value={manualItem.title} onChange={e => setManualItem({...manualItem, title: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <input className="w-full bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 text-xs outline-none border-transparent focus:border-ios-blue/30 border dark:text-white" type="number" placeholder="Precio $" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} />
                                    </div>
                                    <div className="col-span-1">
                                        <button onClick={handleAddManualItem} className="w-full h-full bg-ios-blue text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors shadow-sm">
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10 rounded-b-2xl">
                    <div className="flex flex-col gap-2 mb-4">
                        {/* Seccion Descuento */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-1 flex items-center gap-1"><Tag size={12}/> Descuento</span>
                            <div className="flex gap-1 bg-white dark:bg-black/20 p-1 rounded-lg border border-gray-100 dark:border-white/5">
                                <button 
                                    onClick={() => setDiscountType(discountType === 'fixed' ? 'percent' : 'fixed')}
                                    className="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300 min-w-[30px] flex justify-center"
                                >
                                    {discountType === 'fixed' ? <DollarSign size={10}/> : <Percent size={10}/>}
                                </button>
                                <input 
                                    type="number"
                                    className="w-16 bg-transparent text-right text-xs font-bold outline-none dark:text-white"
                                    placeholder="0"
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Subtotal</span>
                            <span className="font-bold">${(formData.subtotal || formData.items.reduce((s, i) => s + (i.price * i.quantity), 0)).toFixed(2)}</span>
                        </div>

                        {parseFloat(discountValue) > 0 && (
                            <div className="flex justify-between items-center text-xs text-green-500 font-bold">
                                <span>Descuento aplicado</span>
                                <span>-${(formData.discount || 0).toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-end pt-1">
                            <span className="text-xs font-bold text-gray-500 uppercase">Total Final</span>
                            <span className="text-2xl font-black text-ios-blue">${formData.total.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button onClick={handleSave} loading={isSaving} className="flex-[2] gap-2 shadow-lg">
                            <Save size={16}/> Guardar Cambios
                        </Button>
                    </div>
                </div>
            </div>
            
            <VariantSelectorModal 
                product={selectedProductForVariant}
                isOpen={!!selectedProductForVariant}
                onClose={() => setSelectedProductForVariant(null)}
                onConfirm={handleVariantConfirm}
            />
        </div>
    );
};
