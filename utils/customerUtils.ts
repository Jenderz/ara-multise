import { Customer } from '../types';

/**
 * Utilidades para extracción, formateo y búsqueda de clientes y cédulas/RIF
 */

/**
 * Limpia y normaliza una cédula o RIF (elimina puntos y espacios extra)
 */
export const normalizeCedula = (val?: string): string => {
    if (!val) return '';
    return val.replace(/\./g, '').trim().toUpperCase();
};

/**
 * Extrae la cédula de un cliente a partir de su campo 'cedula' o de su campo 'address'
 * de compras legadas (ej. "Calle 4 | CI: V-12345678" o "Av. Bolivar CI: 14.555.222")
 */
export const extractCedula = (cedula?: string, address?: string): string => {
    if (cedula && cedula.trim()) {
        return normalizeCedula(cedula);
    }

    if (!address || typeof address !== 'string') return '';

    // Buscar patrones comunes de CI / RIF / DNI en la dirección
    // 1. Con etiqueta explícita (CI:, C.I., RIF:, DNI:)
    const labeledMatch = address.match(/(?:CI|C\.I\.|C\.I|RIF|CEDULA|DNI)[\s:\-#]*([VEJGve-jg]?[-.\s]?\d{5,10}[A-Za-z0-9]?)/i);
    if (labeledMatch && labeledMatch[1]) {
        return normalizeCedula(labeledMatch[1]);
    }

    // 2. Patrón venezolano con prefijo directo (ej. V-12345678 o J-12345678-0)
    const prefixMatch = address.match(/(?:^|\s|[|,;])([VEJGve-jg]-?\d{6,9}(?:-\d)?)(?:$|\s|[|,;])/i);
    if (prefixMatch && prefixMatch[1]) {
        return normalizeCedula(prefixMatch[1]);
    }

    return '';
};

/**
 * Determina si un cliente coincide con un término de búsqueda (búsqueda inteligente flexible)
 */
export const matchCustomer = (customer: Customer, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    // Normalizaciones sin guiones/espacios para comparar números
    const cleanTermDigits = term.replace(/[^a-z0-9]/gi, '');

    // Nombre
    if (customer.name && customer.name.toLowerCase().includes(term)) return true;

    // Teléfono
    const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.includes(cleanTermDigits) || (customer.phone || '').toLowerCase().includes(term)) return true;

    // Cédula directa o extraída
    const resolvedCedula = extractCedula(customer.cedula, customer.address);
    if (resolvedCedula) {
        const cleanCedula = resolvedCedula.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (cleanCedula.includes(cleanTermDigits) || resolvedCedula.toLowerCase().includes(term)) {
            return true;
        }
    }

    // Dirección (por si buscan por sector/ciudad)
    if (customer.address && customer.address.toLowerCase().includes(term)) return true;

    return false;
};

/**
 * Formatea amigablemente una cédula para presentación visual
 */
export const formatCedulaDisplay = (cedula?: string): string => {
    const clean = normalizeCedula(cedula);
    if (!clean) return '';
    // Si ya tiene guión después del prefijo (ej: V-12345678)
    if (/^[VEJG]-/i.test(clean)) return clean;
    // Si tiene prefijo sin guión (ej: V12345678)
    if (/^[VEJG]\d/i.test(clean)) {
        return `${clean.charAt(0)}-${clean.slice(1)}`;
    }
    return clean;
};
