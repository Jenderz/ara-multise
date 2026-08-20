/**
 * barcodeUtils.ts
 * Generación de código de barras EAN-13 basado en categoría y producto.
 * Renderizado SVG nativo — sin dependencias externas.
 *
 * Estructura EAN-13:
 *   [20] [AAA] [BBBBBBB] [C]
 *   20   → Prefijo interno (rango reservado para uso privado EAN-13)
 *   AAA  → Hash 3 dígitos derivado del nombre de categoría
 *   BBBBBBB → Hash 7 dígitos derivado del código del producto
 *   C    → Dígito verificador calculado con algoritmo EAN-13
 */

// ─────────────────────────────────────────────
// 1. Generación del código EAN-13
// ─────────────────────────────────────────────

/**
 * Genera un hash numérico de N dígitos a partir de un string.
 * Usa djb2 hash para distribuir bien los valores.
 */
function hashToNDigits(input: string, digits: number): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    // Asegurar positivo y truncar a N dígitos
    const positive = Math.abs(hash);
    const mod = Math.pow(10, digits);
    return String(positive % mod).padStart(digits, '0');
}

/**
 * Calcula el dígito verificador EAN-13.
 * @param first12 - Los primeros 12 dígitos del EAN-13
 */
export function calcEAN13CheckDigit(first12: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(first12[i], 10);
        sum += i % 2 === 0 ? digit : digit * 3;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Genera un EAN-13 único basado en la categoría y el código del producto.
 * @param categoryName - Nombre de la categoría del producto
 * @param productCode  - Código interno del producto
 * @returns string de 13 dígitos EAN-13
 */
export function generateEAN13(categoryName: string, productCode: string): string {
    const prefix = '20'; // Prefijo privado EAN-13
    const catHash = hashToNDigits(categoryName.toLowerCase().trim(), 3);
    const prodHash = hashToNDigits(productCode.toLowerCase().trim(), 7);
    const first12 = `${prefix}${catHash}${prodHash}`;
    const check = calcEAN13CheckDigit(first12);
    return `${first12}${check}`;
}

/**
 * Normaliza cualquier string a un EAN-13 válido de 13 dígitos.
 * - Si ya tiene 13 dígitos numéricos, lo respeta.
 * - Si tiene 12 dígitos (ej: UPC-A), calcula y añade el 13º dígito de control.
 * - Si tiene menos de 12 dígitos numéricos, rellena a la izquierda con '0' y calcula el dígito de control.
 * - Si es alfanumérico o vacío, auto-genera un EAN-13 determinista.
 */
export function normalizeToEAN13(rawInput?: string, categoryName = 'General', productCode = 'PROD'): string {
    if (!rawInput || typeof rawInput !== 'string') {
        return generateEAN13(categoryName, productCode);
    }
    const clean = rawInput.trim();
    if (/^\d{13}$/.test(clean)) {
        return clean;
    }
    if (/^\d{12}$/.test(clean)) {
        return `${clean}${calcEAN13CheckDigit(clean)}`;
    }
    if (/^\d{1,11}$/.test(clean)) {
        const padded12 = clean.padStart(12, '0');
        return `${padded12}${calcEAN13CheckDigit(padded12)}`;
    }
    return generateEAN13(categoryName, clean || productCode);
}

/**
 * Valida si un string es un EAN-13 válido (13 dígitos, checksum correcto).
 */
export function validateEAN13(code: string): boolean {
    if (!/^\d{13}$/.test(code)) return false;
    const check = calcEAN13CheckDigit(code.slice(0, 12));
    return check === parseInt(code[12], 10);
}

// ─────────────────────────────────────────────
// 2. Renderizador SVG de barcode EAN-13
// ─────────────────────────────────────────────

/**
 * Tabla de encodings EAN-13.
 * Cada dígito tiene 3 patrones: L (izquierda paridad), G (izquierda paridad G), R (derecha).
 */
const EAN13_ENCODINGS: Record<string, { L: string; G: string; R: string }> = {
    '0': { L: '0001101', G: '0100111', R: '1110010' },
    '1': { L: '0011001', G: '0110011', R: '1100110' },
    '2': { L: '0010011', G: '0011011', R: '1101100' },
    '3': { L: '0111101', G: '0100001', R: '1000010' },
    '4': { L: '0100011', G: '0011101', R: '1011100' },
    '5': { L: '0110001', G: '0111001', R: '1001110' },
    '6': { L: '0101111', G: '0000101', R: '1010000' },
    '7': { L: '0111011', G: '0010001', R: '1000100' },
    '8': { L: '0110111', G: '0001001', R: '1001000' },
    '9': { L: '0001011', G: '0010111', R: '1110100' },
};

/**
 * Tabla de paridad para el primer dígito del EAN-13.
 * Determina si los 6 dígitos del grupo izquierdo usan patrón L o G.
 */
const PARITY_TABLE: Record<string, string> = {
    '0': 'LLLLLL', '1': 'LLGLGG', '2': 'LLGGLG', '3': 'LLGGGL',
    '4': 'LGLLGG', '5': 'LGGLLG', '6': 'LGGGLL', '7': 'LGLGLG',
    '8': 'LGLGGL', '9': 'LGGGL L'.replace(' ', ''),
};

/**
 * Genera el string de bits del código EAN-13.
 * Formato: guard | 6 dígitos izq | center | 6 dígitos der | guard
 */
function ean13ToBits(ean13: string): string {
    const firstDigit = ean13[0];
    const leftDigits = ean13.slice(1, 7);
    const rightDigits = ean13.slice(7, 13);
    const parity = PARITY_TABLE[firstDigit] || 'LLLLLL';

    const guardStart = '101';
    const guardCenter = '01010';
    const guardEnd = '101';

    const leftBits = leftDigits.split('').map((d, i) => {
        const pat = parity[i] === 'G' ? 'G' : 'L';
        return EAN13_ENCODINGS[d][pat];
    }).join('');

    const rightBits = rightDigits.split('').map(d => EAN13_ENCODINGS[d]['R']).join('');

    return `${guardStart}${leftBits}${guardCenter}${rightBits}${guardEnd}`;
}

export interface BarcodeSVGOptions {
    /** Altura en px de las barras (sin incluir texto) */
    height?: number;
    /** Ancho de cada módulo (barra unitaria) en px */
    moduleWidth?: number;
    /** Color de las barras */
    barColor?: string;
    /** Color de fondo */
    bgColor?: string;
    /** Tamaño de la fuente del número EAN debajo */
    fontSize?: number;
    /** Mostrar el número EAN debajo */
    showText?: boolean;
}

/**
 * Genera un SVG string para el código de barras EAN-13.
 * @param ean13 - Código EAN-13 de 13 dígitos
 * @param options - Opciones visuales del barcode
 * @returns string SVG listo para usar como innerHTML o src de una imagen
 */
export function renderBarcodeSVG(rawBarcode: string, options: BarcodeSVGOptions = {}): string {
    const {
        height = 60,
        moduleWidth = 2,
        barColor = '#000000',
        bgColor = '#ffffff',
        fontSize = 9,
        showText = true,
    } = options;

    const ean13 = normalizeToEAN13(rawBarcode);
    const bits = ean13ToBits(ean13);
    const totalWidth = bits.length * moduleWidth + 14; // +14 para margen lateral (quiet zone)
    const textHeight = showText ? fontSize + 4 : 0;
    const totalHeight = height + textHeight + 4;
    const quietZone = 7; // módulos de margen (EAN-13 requiere al menos 7)

    let bars = '';
    let x = quietZone;

    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === '1') {
            // Barras de guardia (posiciones 0-2, 45-49, 92-94) son más largas
            const isGuard =
                i < 3 ||
                (i >= 45 && i <= 49) ||
                i >= bits.length - 3;
            const barHeight = isGuard ? height + (showText ? 5 : 0) : height;
            bars += `<rect x="${x * moduleWidth}" y="2" width="${moduleWidth}" height="${barHeight}" fill="${barColor}"/>`;
        }
        x++;
    }

    // Texto EAN-13 debajo (formato: D  DDDDDD  DDDDDD)
    let textEl = '';
    if (showText) {
        const y = height + 12;
        const totalBarWidth = bits.length * moduleWidth;
        const textX = quietZone * moduleWidth;

        // Primer dígito (izquierda de las barras de guardia)
        textEl += `<text x="${textX - moduleWidth * 2}" y="${y}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${barColor}">${ean13[0]}</text>`;

        // Grupo izquierdo (6 dígitos, centrado en su área)
        const leftCenterX = textX + moduleWidth + (42 * moduleWidth) / 2;
        textEl += `<text x="${leftCenterX}" y="${y}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${barColor}">${ean13.slice(1, 7)}</text>`;

        // Grupo derecho (6 dígitos)
        const rightStartX = textX + (3 + 42 + 5) * moduleWidth;
        const rightCenterX = rightStartX + (42 * moduleWidth) / 2;
        textEl += `<text x="${rightCenterX}" y="${y}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${barColor}">${ean13.slice(7)}</text>`;
    }

    const svgWidth = (bits.length + quietZone * 2) * moduleWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${totalHeight}" viewBox="0 0 ${svgWidth} ${totalHeight}">
  <rect width="${svgWidth}" height="${totalHeight}" fill="${bgColor}"/>
  ${bars}
  ${textEl}
</svg>`;
}
