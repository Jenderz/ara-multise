
/**
 * =====================================================
 * utils/slugify.ts — Utilidades de SEO para URLs
 * =====================================================
 * Genera slugs amigables para URLs de productos.
 * Diseñado para ser compatible con HashRouter (React Router).
 */

/**
 * Convierte un texto en un slug URL-safe.
 * Elimina acentos, caracteres especiales y normaliza espacios.
 *
 * @example slugify("Camiseta Roja ñ") → "camiseta-roja-n"
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')                          // descomponer caracteres Unicode
    .replace(/[\u0300-\u036f]/g, '')           // eliminar marcas diacríticas (tildes)
    .replace(/[^a-z0-9\s-]/g, '')             // eliminar caracteres no permitidos
    .trim()
    .replace(/\s+/g, '-')                      // espacios → guiones
    .replace(/-+/g, '-')                       // múltiples guiones → uno solo
    .substring(0, 60);                         // máximo 60 caracteres
};

/**
 * Genera el path slug de un producto con formato: "titulo-del-producto--ID"
 * El "--ID" al final garantiza que siempre podamos recuperar el producto exacto,
 * incluso si dos productos tienen el mismo nombre.
 *
 * @example generateProductSlug("Camiseta Roja", "abc-123") → "camiseta-roja--abc-123"
 */
export const generateProductSlug = (title: string, id: string): string => {
  const titleSlug = slugify(title);
  return `${titleSlug}--${id}`;
};

/**
 * Extrae el ID del producto desde un slug o directamente de un ID puro.
 * Soporta ambos formatos para mantener compatibilidad retroactiva:
 *   - Formato nuevo: "camiseta-roja--abc123"  → "abc123"
 *   - Formato legacy: "abc123"                → "abc123"
 *
 * @example extractProductIdFromSlug("camiseta-roja--abc-123") → "abc-123"
 * @example extractProductIdFromSlug("abc-123") → "abc-123" (legacy, sin cambios)
 */
export const extractProductIdFromSlug = (slugOrId: string): string => {
  if (!slugOrId) return '';
  const separatorIndex = slugOrId.lastIndexOf('--');
  if (separatorIndex !== -1) {
    return slugOrId.substring(separatorIndex + 2);
  }
  // Fallback: el parámetro es directamente el ID (compatibilidad con URLs antiguas)
  return slugOrId;
};
