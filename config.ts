
// Permite sobreescribir la URL de la API mediante variable de entorno (ej: VITE_API_URL)
// o usar por defecto '/api.php' en la raíz del servidor.
const resolveApiUrl = (): string => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        // @ts-ignore
        return import.meta.env.VITE_API_URL;
    }
    return '/api.php';
};

export const API_URL = resolveApiUrl();

// Imagen por defecto
export const DEFAULT_IMAGE = 'https://placehold.co/800x800/E5E5E5/555555?text=IMAGEN%0ANO+DISPONIBLE&font=roboto';
