import { Product, ProductVariant } from '../types';

/**
 * Obtiene el stock disponible de una variante de producto.
 */
export const getVariantAvailableStock = (v: ProductVariant): number => {
    if (!v) return 0;
    if (typeof v.availableStock === 'number') return v.availableStock;
    if (typeof v.stock === 'number') return v.stock;
    if (v.branchStock && typeof v.branchStock === 'object') {
        return Object.values(v.branchStock).reduce((acc: number, qty: any) => acc + (Number(qty) || 0), 0);
    }
    return 0;
};

/**
 * Obtiene el stock disponible consolidado (solo sedes activas).
 * Si se pasa una variante o un ProductVariant directamente, evalúa su stock.
 * Si el producto tiene variantes y no se pasa variante, devuelve la suma de las variantes.
 */
export const getAvailableStock = (p: Product | ProductVariant, v?: ProductVariant): number => {
    if (!p) return 0;

    // Si se pasó una variante explícita como segundo parámetro
    if (v) {
        return getVariantAvailableStock(v);
    }

    // Si el primer parámetro es directamente una variante (no tiene `title` de producto completo)
    if (!('title' in p) || !('images' in p)) {
        return getVariantAvailableStock(p as ProductVariant);
    }

    const prod = p as Product;

    // Si tiene variantes hijas, sumar la disponibilidad de todas ellas
    if (prod.variants && prod.variants.length > 0) {
        return prod.variants.reduce((acc, variant) => acc + getVariantAvailableStock(variant), 0);
    }

    if (typeof prod.availableStock === 'number') return prod.availableStock;
    if (typeof prod.globalStock === 'number') return prod.globalStock;
    return typeof prod.stock === 'number' ? prod.stock : 0;
};

/**
 * Determina si un producto o variante está agotado.
 * Respeta la bandera `trackStock` (si no rastrea stock, nunca está agotado).
 * Si se pasa `branchId > 0`, evalúa el stock específico de esa sede;
 * de lo contrario evalúa la disponibilidad general en sedes activas.
 */
export const isOutOfStock = (p: Product, v?: ProductVariant, branchId?: number): boolean => {
    if (!p) return true;
    if (p.trackStock === false) return false;

    if (branchId !== undefined && branchId > 0) {
        const local = getBranchStock(p, v, branchId);
        return local <= 0;
    }

    return getAvailableStock(p, v) <= 0;
};

/**
 * Obtiene el stock específico de la sede local/contexto (para POS o sede seleccionada).
 */
export const getBranchStock = (p: Product, v?: ProductVariant, branchId?: number): number => {
    if (!p) return 0;
    if (v) {
        if (branchId && v.branchStock && typeof v.branchStock[branchId] === 'number') {
            return v.branchStock[branchId];
        }
        return typeof v.stock === 'number' ? v.stock : 0;
    }
    if (p.variants && p.variants.length > 0) {
        return p.variants.reduce((acc, variant) => acc + getBranchStock(p, variant, branchId), 0);
    }
    if (branchId && p.branchStock && typeof p.branchStock[branchId] === 'number') {
        return p.branchStock[branchId];
    }
    return typeof p.stock === 'number' ? p.stock : 0;
};

/**
 * Verifica si un producto tiene variantes válidas configuradas.
 */
export const hasActiveVariants = (p: Product): boolean => {
    return Boolean(p && p.variants && p.variants.length > 0);
};

/**
 * Actualiza de forma inmutable un producto a partir del snapshot de stock de una transacción.
 * Sincroniza tanto variantes individuales como el total consolidado del producto padre.
 */
export const updateProductWithStockSnapshot = (
    product: Product,
    stockAfter: Record<string, number>
): Product => {
    if (!product || !stockAfter || typeof stockAfter !== 'object') return product;

    let hasChange = false;
    let updatedProduct = { ...product };

    // 1. Si tiene variantes, actualizar cada variante afectada
    if (product.variants && product.variants.length > 0) {
        let anyVariantChanged = false;
        const newVariants = product.variants.map(v => {
            const newStock = stockAfter[v.id];
            if (newStock !== undefined && newStock !== v.stock) {
                anyVariantChanged = true;
                hasChange = true;
                return {
                    ...v,
                    stock: newStock,
                    availableStock: newStock,
                    isAvailable: newStock > 0
                };
            }
            return v;
        });

        if (anyVariantChanged) {
            updatedProduct.variants = newVariants;
            // Recalcular stock del padre a partir de la suma de sus variantes
            const sumStock = newVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
            updatedProduct.stock = sumStock;
            updatedProduct.availableStock = sumStock;
            updatedProduct.isAvailable = sumStock > 0;
        }
    }

    // 2. Si el producto padre tiene actualización directa en stockAfter (para productos simples)
    const parentNewStock = stockAfter[product.id];
    if (parentNewStock !== undefined && (!product.variants || product.variants.length === 0)) {
        if (parentNewStock !== updatedProduct.stock) {
            hasChange = true;
            updatedProduct.stock = parentNewStock;
            updatedProduct.availableStock = parentNewStock;
            updatedProduct.isAvailable = parentNewStock > 0;
        }
    }

    return hasChange ? updatedProduct : product;
};
