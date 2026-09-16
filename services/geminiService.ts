/**
 * SERVICIO DE ASISTENCIA INTELIGENTE CON GEMINI PARA ARA
 * 
 * Permite a ARA responder preguntas complejas en lenguaje natural combinando
 * el contexto del negocio (métricas, productos, sedes, tasas) con la IA generativa de Google.
 */

export interface StoreContextSummary {
    storeName?: string;
    currentBranchName?: string;
    activeRate?: number;
    currencySymbol?: string;
    totalProducts?: number;
    lowStockCount?: number;
    todaySalesTotal?: number;
    todayOrdersCount?: number;
    pendingOrdersCount?: number;
    topProducts?: string[];
}

// Obtener la clave API desde variables de entorno o almacenamiento local
export const getGeminiApiKey = (): string => {
    // 1. Clave manual guardada en configuración
    const savedKey = localStorage.getItem('ara_gemini_api_key');
    if (savedKey && savedKey.trim() !== '') return savedKey.trim();

    // 2. Claves inyectadas por Vite en build / dev
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu_api_key_de_gemini_aqui') {
            // @ts-ignore
            return process.env.GEMINI_API_KEY;
        }
    } catch (_) {}

    try {
        // @ts-ignore
        if (import.meta.env?.VITE_GEMINI_API_KEY && import.meta.env.VITE_GEMINI_API_KEY !== 'tu_api_key_de_gemini_aqui') {
            // @ts-ignore
            return import.meta.env.VITE_GEMINI_API_KEY;
        }
    } catch (_) {}

    return '';
};

export const hasGeminiApiKey = (): boolean => {
    const key = getGeminiApiKey();
    return Boolean(key && key.length > 10 && key !== 'tu_api_key_de_gemini_aqui');
};

export const setGeminiApiKey = (key: string): void => {
    if (key) {
        localStorage.setItem('ara_gemini_api_key', key.trim());
    } else {
        localStorage.removeItem('ara_gemini_api_key');
    }
};

/**
 * Consulta a Gemini 1.5 Flash con el prompt del usuario y el contexto operativo de ARA
 */
export const queryGeminiAI = async (
    prompt: string,
    context: StoreContextSummary
): Promise<string> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('No hay API Key de Gemini configurada.');
    }

    const systemInstruction = `
Eres ARA, la asistente virtual inteligente y copiloto de gestión para la tienda y sistema de inventario "${context.storeName || 'ARA Multisede'}".
Tu rol es ayudar al administrador y al equipo de ventas de forma profesional, cordial, ágil y ejecutiva.

Datos y contexto actual del sistema en tiempo real:
- Sede activa: ${context.currentBranchName || 'Sede Principal / Global'}
- Tasa de cambio activa: ${context.activeRate ? `${context.activeRate.toFixed(2)} Bs/$` : 'No configurada'}
- Total de productos en catálogo: ${context.totalProducts ?? 0}
- Productos con stock bajo o crítico: ${context.lowStockCount ?? 0}
- Ventas completadas hoy: $${(context.todaySalesTotal ?? 0).toFixed(2)} (${context.todayOrdersCount ?? 0} pedidos)
- Pedidos pendientes por procesar/entregar: ${context.pendingOrdersCount ?? 0}
- Productos destacados o más vendidos: ${context.topProducts?.join(', ') || 'No disponibles'}

Directrices para tus respuestas:
1. Responde siempre en español, con un tono amable, claro y ejecutivo.
2. Sé concisa y ve al grano, destacando cifras y recomendaciones prácticas.
3. Si el usuario te pide redactar un mensaje para un cliente, hazlo de forma cálida y profesional.
4. No inventes datos que contradigan el contexto proporcionado.
5. Usa emojis de forma moderada y profesional para estructurar la información.
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `${systemInstruction}\n\nPregunta del usuario: "${prompt}"`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600,
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error en la API de Gemini (${response.status})`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
        throw new Error('Respuesta vacía recibida desde Gemini.');
    }

    return candidateText.trim();
};
