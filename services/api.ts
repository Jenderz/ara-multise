
import { API_URL } from '../config';
import { Product, Category, Order, Customer, StoreSettings, Coupon, StockMovement, Branch } from '../types';

const TIMEOUT_MS = 60000;

export interface PaginatedResponse<T> {
    data: T[];
    meta?: { totalRevenue?: number; totalCount?: number; };
    pagination: { total: number; page: number; limit: number; pages: number; };
}

// Helper para obtener la sede activa del almacenamiento local
const getActiveBranchId = () => {
    return localStorage.getItem('lyberate_branch_id') || '1';
};

// Helper para obtener el token de sesión de autenticación
const getAuthToken = () => {
    return localStorage.getItem('lyberate_auth_token') || '';
};

const fetchApi = async (action: string, method: 'GET' | 'POST' = 'GET', data?: any) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const authToken = getAuthToken();
        const headers: Record<string, string> = {
            'X-Branch-ID': getActiveBranchId(),
            'X-App-Token': 'AraEcom_v5_Secure', // Token para evitar bloqueos del WAF/Antivirus
            'Accept': 'application/json',
            // FIX BUG: Cache-Control reemplaza al &t=Date.now() como anti-caché.
            // Es el método correcto y estándar — no genera URLs únicas que disparan rate-limiting.
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache',
            ...(authToken ? {
                'Authorization': `Bearer ${authToken}`,
                'X-Admin-Token': authToken
            } : {})
        };

        if (!(data instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }


        const options: RequestInit = {
            method,
            headers,
            body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
            signal: controller.signal
        };

        // FIX SEGURIDAD: El cache-buster &t=Date.now() solo es necesario en mutaciones
        // POST (donde necesitamos datos frescos del servidor tras un write).
        // Aplicarlo en todas las GETs invalida el cache del servidor/CDN innecesariamente,
        // lo que multiplica la carga y puede activar límites de rate-limiting del hosting.
        const isMutation = method === 'POST';
        const url = isMutation
            ? `${API_URL}?action=${action}&t=${Date.now()}`
            : `${API_URL}?action=${action}`;
        const response = await fetch(url, options);

        clearTimeout(id);

        const text = await response.text();

        let json: any = null;
        let parseFailed = false;

        try {
            json = JSON.parse(text);
        } catch (e) {
            parseFailed = true;
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                try {
                    json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                    parseFailed = false;
                } catch (retryErr) {
                    parseFailed = true;
                }
            }
        }

        if (parseFailed) {
            console.error("Respuesta no válida del servidor (RAW):", text);
            if (!response.ok) throw new Error(`Server Error ${response.status}`);
            throw new Error("El servidor devolvió datos inválidos.");
        }

        if (!response.ok) {
            if (response.status === 401 && action !== 'login') {
                window.dispatchEvent(new Event('lyberate:unauthorized'));
            }
            const errorMsg = json?.error || json?.details || json?.message || `Server Error ${response.status}`;
            throw new Error(errorMsg);
        }

        if (json?.error) {
            const errorMsg = json.error + (json.details ? `: ${json.details}` : '');
            throw new Error(errorMsg);
        }

        return json;

    } catch (error: any) {
        clearTimeout(id);
        console.error(`API Error (${action}):`, error);
        throw error;
    }
};

export const api = {
    login: (username: string, password: string) => fetchApi('login', 'POST', { username, password }),
    runMigration: () => fetchApi('migrate', 'POST'),
    getAllData: () => fetchApi('get_all'),
    getSettings: () => fetchApi('get_settings'),

    getProducts: (page = 1, limit = 100, search = '', category = '') =>
        fetchApi(`get_products&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`),

    getOrders: (filters: any) => {
        let qs = `get_orders&page=${filters.page || 1}&limit=${filters.limit || 50}`;
        if (filters.startDate) qs += `&startDate=${filters.startDate}`;
        if (filters.endDate) qs += `&endDate=${filters.endDate}`;
        if (filters.method) qs += `&method=${filters.method}`;
        if (filters.seller) qs += `&seller=${filters.seller}`;
        if (filters.status) qs += `&status=${filters.status}`;
        if (filters.search) qs += `&search=${encodeURIComponent(filters.search)}`;
        return fetchApi(qs);
    },

    getCustomers: (page = 1, limit = 50, search = '') =>
        fetchApi(`get_customers&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

    saveProduct: (p: Product, userId?: string, userName?: string) =>
        fetchApi('save_product', 'POST', { ...p, userId, userName }),

    deleteProduct: (id: string, imgs: string[] = []) => fetchApi('delete_product', 'POST', { id, images: imgs }),

    saveCategory: (c: Category) => fetchApi('save_category', 'POST', c),
    deleteCategory: (id: string) => fetchApi('delete_category', 'POST', { id }),

    saveOrder: (o: Order, stock = false) => fetchApi('save_order', 'POST', { ...o, processStock: stock }),
    deleteOrder: (id: string) => fetchApi('delete_order', 'POST', { id }),

    saveCustomer: (c: Customer) => fetchApi('save_customer', 'POST', c),
    deleteCustomer: (phone: string) => fetchApi('delete_customer', 'POST', { phone }),

    saveSettings: (s: StoreSettings) => fetchApi('save_settings', 'POST', s),

    saveCoupon: (c: Coupon) => fetchApi('save_coupon', 'POST', c),
    deleteCoupon: (code: string) => fetchApi('delete_coupon', 'POST', { code }),

    saveBranch: (b: Partial<Branch>) => fetchApi('save_branch', 'POST', b),
    deleteBranch: (id: number) => fetchApi('delete_branch', 'POST', { id }),

    saveSubscription: (sub: PushSubscription) => fetchApi('subscribe_push', 'POST', sub),
    resetDatabase: (opts: string[]) => fetchApi('reset_database', 'POST', { options: opts }),

    getTransactions: (filters: any) => api.getOrders({ ...filters, limit: 1000 }).then(res => res?.data || []),
    getProductHistory: (pid: string) => fetchApi(`get_product_history&product_id=${encodeURIComponent(pid)}`),

    getMovements: (page = 1, limit = 50, productId = '', type = '', search = '', branchId: number | string = '') => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(productId && { product_id: productId }),
            ...(type && type !== 'all' && { type }),
            ...(search && { search }),
            ...(branchId && branchId !== 'all' && { branch_id: branchId.toString() })
        });
        return fetchApi(`get_movements&${params.toString()}`);
    },

    adjustStock: (pid: string, uid: string, uname: string, type: string, amt: number, ref: string, targetBranchId?: number) =>
        fetchApi('adjust_stock', 'POST', { productId: pid, userId: uid, userName: uname, type, amount: amt, reference: ref, targetBranchId }),

    getStockBreakdown: (pid: string) => fetchApi(`get_stock_breakdown&product_id=${encodeURIComponent(pid)}`),

    transferStock: (pid: string, fromBranch: number, toBranch: number, amount: number, uid: string, uname: string, variantSku?: string, variantName?: string) =>
        fetchApi('transfer_stock', 'POST', {
            productId: pid,
            fromBranchId: fromBranch,
            toBranchId: toBranch,
            amount,
            userId: uid,
            userName: uname,
            variantSku,
            variantName
        }),

    uploadImage: async (file: File) => {
        // Convertir archivo a Base64 para subida sigilosa (evita bloqueos de antivirus)
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });

        const res = await fetchApi('upload_image_stealth', 'POST', {
            base64,
            name: file.name
        });
        return res.url;
    },

    uploadPWAScreenshot: async (base64: string, fileName: string) => {
        return fetchApi('upload_pwa_screenshot', 'POST', { base64, fileName });
    },

    updatePWAIcon: async (base64: string) => {
        return fetchApi('update_pwa_icon', 'POST', { base64 });
    },

    // --- NUEVO: IMPORTACIÓN MASIVA ---
    importBatch: (type: 'products' | 'orders' | 'customers' | 'categories', items: any[]) =>
        fetchApi('batch_write', 'POST', { type, items }),

    // --- LOGS V2 (SQL) ---
    getLogs: (page = 1, limit = 50, search = '', userId = '') =>
        fetchApi(`get_logs&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&user_id=${userId}`),

    logActivity: (userId: string, userName: string, userRole: string, action: string, details: any) =>
        fetchApi('log_activity', 'POST', { userId, userName, userRole, action, details }),

};
