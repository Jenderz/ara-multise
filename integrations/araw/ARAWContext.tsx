/**
 * integrations/araw/ARAWContext.tsx
 * Proveedor de contexto para la integración B2B con ARAW.
 *
 * La configuración (URL + API Key) se persiste a través de
 * StoreContext → updateSettings() → api.php (save_settings) → BD.
 * NO se usa localStorage propio, para mantener consistencia
 * con el resto de ajustes de la tienda.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ARAWIntegrationConfig } from '../../types';
import { useStore } from '../../context/StoreContext';
import { arawService } from './arawService';
import { B2BOrderPayload, B2BOrderResponse, ARAWContextValue } from './types';

/* ── Valor vacío por si el Provider no está disponible ── */
const ARAWContext = createContext<ARAWContextValue | null>(null);

/* ── Hook público ── */
export const useARAW = (): ARAWContextValue | null => useContext(ARAWContext);

/* ── Proveedor ── */
export const ARAWProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, updateSettings } = useStore();

    // La config vive en settings.arawIntegration (sincronizada con BD)
    const config: ARAWIntegrationConfig = settings.arawIntegration ?? {
        enabled: false,
        arawBaseUrl: '',
        apiKey: '',
    };

    const [isValidating, setIsValidating] = useState(false);
    const [validationOk, setValidationOk] = useState<boolean | null>(null);

    const isActive = config.enabled && !!config.apiKey && !!config.arawBaseUrl;

    /* ── saveConfig: persiste via updateSettings → BD ── */
    const saveConfig = useCallback(async (data: Partial<ARAWIntegrationConfig>) => {
        const updated = { ...config, ...data };
        await updateSettings({ arawIntegration: updated });
        setValidationOk(null);
    }, [config, updateSettings]);

    /* ── validateConnection ── */
    const validateConnection = useCallback(async (): Promise<boolean> => {
        if (!config.apiKey || !config.arawBaseUrl) return false;
        setIsValidating(true);
        try {
            const result = await arawService.validate(config);
            setValidationOk(result.valid);
            if (result.valid) {
                // Guardar timestamp de última validación en BD también
                await updateSettings({
                    arawIntegration: { ...config, lastValidatedAt: new Date().toISOString() }
                });
            }
            return result.valid;
        } catch {
            setValidationOk(false);
            return false;
        } finally {
            setIsValidating(false);
        }
    }, [config, updateSettings]);

    /* ── placeReplenishmentOrder ── */
    const placeReplenishmentOrder = useCallback(
        async (payload: B2BOrderPayload): Promise<B2BOrderResponse> => {
            if (!isActive) throw new Error('La integración ARAW no está activa o configurada.');
            return arawService.createOrder(config, payload);
        },
        [config, isActive]
    );

    return (
        <ARAWContext.Provider value={{
            config,
            isActive,
            isValidating,
            validationOk,
            saveConfig,
            validateConnection,
            placeReplenishmentOrder,
        }}>
            {children}
        </ARAWContext.Provider>
    );
};
