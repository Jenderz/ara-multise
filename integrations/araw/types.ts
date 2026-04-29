/**
 * integrations/araw/types.ts
 * Tipos internos del addon ARAW que no forman parte del modelo de datos general.
 * La configuración de la integración (ARAWIntegrationConfig) vive en types.ts raíz
 * y en settings.arawIntegration para persistir en la BD de ara-multise.
 */

import { ARAWIntegrationConfig } from '../../types';

/** Item de una orden de reposición */
export interface ReplenishmentItem {
    product_code: string;
    product_name: string;
    quantity: number;
    cost_reference?: number;
}

/** Payload que se envía al endpoint POST /api/b2b/orders de ARAW */
export interface B2BOrderPayload {
    items: ReplenishmentItem[];
    notes?: string;
}

/** Respuesta del endpoint POST /api/b2b/orders */
export interface B2BOrderResponse {
    order_id: number;
    order_number: string;
    store_name: string;
    status: string;
    total_items: number;
    created_at: string;
}

/** Estado del contexto ARAW */
export interface ARAWContextValue {
    config: ARAWIntegrationConfig;
    isActive: boolean;
    isValidating: boolean;
    validationOk: boolean | null;
    saveConfig: (data: Partial<ARAWIntegrationConfig>) => Promise<void>;
    validateConnection: () => Promise<boolean>;
    placeReplenishmentOrder: (payload: B2BOrderPayload) => Promise<B2BOrderResponse>;
}

// Re-export para conveniencia
export type { ARAWIntegrationConfig };
