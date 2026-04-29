
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Product, Category, StockMovement } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface ProductContextType {
    products: Product[];
    setProducts: (p: Product[]) => void;
    categories: Category[];
    setCategories: (c: Category[]) => void;
    addProduct: (product: Product) => Promise<any>;
    updateProduct: (product: Product) => Promise<any>;
    updateMultipleProducts: (products: Product[], onProgress?: (percent: number) => void) => Promise<void>;
    deleteProduct: (id: string) => void;
    addCategory: (category: Category) => Promise<void>;
    updateCategory: (category: Category) => void;
    deleteCategory: (id: string) => void;
    resetStoreProducts: () => Promise<void>;
    getProductHistory: (productId: string) => Promise<StockMovement[]>;
    adjustStock: (productId: string, type: 'entry' | 'exit' | 'adjustment' | 'sale', amount: number, reference: string, targetBranchId?: number) => Promise<void>;
    adjustStockLocally: (productId: string, amount: number, variantId?: string) => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { logActivity, currentUser } = useAuth();

    const addProduct = async (product: Product) => {
        setProducts(prev => [product, ...prev]);
        logActivity('create_product', `Creó producto: ${product.title}`);
        // Enviamos usuario para auditoría de stock inicial
        return api.saveProduct(product, currentUser?.id, currentUser?.name).catch(console.error);
    };

    const updateProduct = async (updatedProduct: Product) => {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        logActivity('update_product', `Editó producto: ${updatedProduct.title}`);
        // Enviamos usuario para auditoría de cambios de stock
        return api.saveProduct(updatedProduct, currentUser?.id, currentUser?.name).catch(console.error);
    };

    const updateMultipleProducts = async (productsToUpdate: Product[], onProgress?: (percent: number) => void) => {
        setProducts(prev => {
            const map = new Map(productsToUpdate.map(p => [p.id, p]));
            return prev.map(p => map.get(p.id) || p);
        });
        logActivity('update_product', `Actualización masiva de ${productsToUpdate.length} productos`);

        const total = productsToUpdate.length;
        const chunkSize = 5;
        let processed = 0;

        for (let i = 0; i < total; i += chunkSize) {
            const chunk = productsToUpdate.slice(i, i + chunkSize);
            // Enviamos usuario en batch también
            await Promise.all(chunk.map(p => api.saveProduct(p, currentUser?.id, currentUser?.name)));
            processed += chunk.length;
            if (onProgress) onProgress(Math.min(100, Math.round((processed / total) * 100)));
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };

    // --- LÓGICA DE BORRADO SEGURO DE PRODUCTO ---
    const deleteProduct = (id: string) => {
        const productToDelete = products.find(p => p.id === id);
        const imagesToDelete = productToDelete ? productToDelete.images : [];
        const productName = productToDelete ? productToDelete.title : id;

        logActivity('delete_product', `Eliminó producto: ${productName}`);
        setProducts(prev => prev.filter(p => p.id !== id));
        api.deleteProduct(id, imagesToDelete).catch(console.error);
    };

    const addCategory = async (category: Category) => {
        const normalizedName = category.name.trim().toLowerCase();
        if (categories.some(c => c.name.trim().toLowerCase() === normalizedName)) return;

        setCategories(prev => {
            if (prev.some(c => c.name.trim().toLowerCase() === normalizedName)) return prev;
            return [...prev, category];
        });

        try {
            await api.saveCategory(category);
        } catch (e) {
            console.error("Error saving category", e);
        }
    };

    const updateCategory = (category: Category) => {
        setCategories(prev => prev.map(c => c.id === category.id ? category : c));
        api.saveCategory(category).catch(console.error);
    };

    const deleteCategory = (id: string) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        api.deleteCategory(id).catch(console.error);
    };

    /**
     * ACTUALIZACIÓN OPTIMISTA DE STOCK (Sin recarga de API)
     * Permite al POS reflejar la venta inmediatamente.
     */
    const adjustStockLocally = (productId: string, delta: number, variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id !== productId) return p;

            // Si es un producto simple (sin variantes o no se especificó variante)
            // O si es producto padre
            let newStock = p.stock + delta;

            // Si hay variante, actualizamos también la variante específica
            let newVariants = p.variants;
            if (variantId && p.variants) {
                newVariants = p.variants.map(v => {
                    if (v.id === variantId) {
                        return { ...v, stock: v.stock + delta };
                    }
                    return v;
                });
            }

            // Si el producto no usa trackStock, no cambiamos nada (o depende de la lógica de negocio)
            // Pero asumimos que sí para reflejar visualmente.

            return { ...p, stock: newStock, variants: newVariants };
        }));
    };

    const resetStoreProducts = async () => {
        const total = products.length;
        for (let i = 0; i < total; i += 5) {
            const batch = products.slice(i, i + 5);
            await Promise.all(batch.map(p => api.deleteProduct(p.id, p.images).catch(console.warn)));
        }
        setProducts([]);
    };

    const getProductHistory = async (productId: string) => {
        try {
            return await api.getProductHistory(productId);
        } catch (e) {
            console.error("Error fetching history", e);
            return [];
        }
    };

    const adjustStock = async (productId: string, type: 'entry' | 'exit' | 'adjustment' | 'sale', amount: number, reference: string, targetBranchId?: number) => {
        const userId = currentUser ? currentUser.id : 'system';
        const userName = currentUser ? currentUser.name : 'Sistema';

        try {
            // Pasamos targetBranchId a la API si existe
            await api.adjustStock(productId, userId, userName, type, amount, reference, targetBranchId);

            // Actualización optimista local del stock:
            const currentBranchId = parseInt(localStorage.getItem('lyberate_branch_id') || '1');
            const isCurrentBranch = !targetBranchId || targetBranchId === currentBranchId;

            if (isCurrentBranch) {
                setProducts(prev => prev.map(p => {
                    if (p.id === productId) {
                        let newStock = p.stock;
                        if (type === 'exit' || type === 'sale') newStock = p.stock - amount;
                        else if (type === 'entry') newStock = p.stock + amount;
                        return { ...p, stock: Math.max(0, newStock) };
                    }
                    return p;
                }));
            }

            if (type !== 'sale') {
                const product = products.find(p => p.id === productId);
                const productName = product ? product.title : 'Producto Desconocido';
                logActivity('update_product', `${type}: ${productName}. Cant: ${amount}. Ref: ${reference}`);
            }
        } catch (e) {
            console.error("Error adjusting stock", e);
            throw e;
        }
    };

    return (
        <ProductContext.Provider value={{
            products, setProducts,
            categories, setCategories,
            addProduct, updateProduct, updateMultipleProducts, deleteProduct,
            addCategory, updateCategory, deleteCategory, resetStoreProducts,
            getProductHistory, adjustStock, adjustStockLocally
        }}>
            {children}
        </ProductContext.Provider>
    );
};

export const useProduct = () => {
    const context = useContext(ProductContext);
    if (!context) throw new Error("useProduct must be used within ProductProvider");
    return context;
};
