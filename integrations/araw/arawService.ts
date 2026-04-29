/**
 * integrations/araw/arawService.ts
 * Capa de servicio para comunicarse con el backend de ARAW
 */

import { ARAWIntegrationConfig } from '../../types';
import { B2BOrderPayload, B2BOrderResponse } from './types';

class ARAWService {
    /**
     * Construye la URL completa del endpoint en ARAW.
     *
     * ARAW expone su API a través de index.php con el parámetro ?route=,
     * que es donde se aplican los headers CORS. Conectar directamente a
     * /api/b2b/... sin pasar por index.php causa que el preflight OPTIONS
     * no reciba los headers correctos.
     *
     * Estrategia:
     * - Si arawBaseUrl ya contiene "index.php", asumimos que está bien configurada
     *   y usamos el parámetro ?route= (ej: .../index.php?route=/api/b2b/orders)
     * - Si no, construimos la URL directa (fallback para otros servidores)
     */
    private buildUrl(baseUrl: string, path: string): string {
        // Normalizar la URL base:
        // 1. Quitar trailing slashes, & y espacios
        // 2. Si el usuario incluyó ?route= o &route= al final, eliminarlo
        //    (el código lo agrega de forma controlada)
        let base = baseUrl
            .trim()
            .replace(/[?&]route=.*$/i, '') // quita ?route=... o &route=...
            .replace(/[\/&?]+$/, '');      // quita trailing /, & y ?

        const route = path.startsWith('/') ? path : `/${path}`;

        if (base.includes('index.php')) {
            // Patrón ARAW canónico: ?route=/api/b2b/...
            const separator = base.includes('?') ? '&' : '?';
            return `${base}${separator}route=${route}`;
        }

        // Fallback: URL directa
        return `${base}${route}`;
    }

    private headers(apiKey: string): HeadersInit {
        return {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
        };
    }

    /** Valida la conexión — llama a GET /api/b2b/validate */
    async validate(config: ARAWIntegrationConfig): Promise<{
        valid: boolean;
        store_name?: string;
        message?: string;
    }> {
        try {
            const url = this.buildUrl(config.arawBaseUrl, '/api/b2b/validate');
            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers(config.apiKey),
            });

            const data = await response.json();

            if (!response.ok) {
                return { valid: false, message: data.message || `Error ${response.status}` };
            }

            return {
                valid: true,
                store_name: data.data?.store_name,
                message: data.message,
            };
        } catch (e: any) {
            return { valid: false, message: e.message || 'No se pudo conectar con ARAW' };
        }
    }

    /** Crea una orden de reposición — llama a POST /api/b2b/orders */
    async createOrder(
        config: ARAWIntegrationConfig,
        payload: B2BOrderPayload
    ): Promise<B2BOrderResponse> {
        const url = this.buildUrl(config.arawBaseUrl, '/api/b2b/orders');
        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers(config.apiKey),
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Error ${response.status} al crear la orden`);
        }

        if (!data.success) {
            throw new Error(data.message || 'Error desconocido al crear la orden');
        }

        return data.data as B2BOrderResponse;
    }
}

export const arawService = new ARAWService();
