export type MetalType = 'gold_24k' | 'gold_18k' | 'gold_14k' | 'gold_10k' | 'silver_925';

export interface MetalDefinition {
  key: MetalType;
  name: string;
  purity: string;
  color: string;
  defaultRate: number;
}

export const METALS_LIST: MetalDefinition[] = [
  { key: 'gold_24k', name: 'Oro 24k (Puro 99.9%)', purity: '99.9%', color: '#EAB308', defaultRate: 85.00 },
  { key: 'gold_18k', name: 'Oro 18k (Estándar Joyería Fina)', purity: '75.0%', color: '#F59E0B', defaultRate: 68.00 },
  { key: 'gold_14k', name: 'Oro 14k (Comercial)', purity: '58.5%', color: '#D97706', defaultRate: 54.00 },
  { key: 'gold_10k', name: 'Oro 10k', purity: '41.7%', color: '#B45309', defaultRate: 40.00 },
  { key: 'silver_925', name: 'Plata Ley 925', purity: '92.5%', color: '#94A3B8', defaultRate: 1.20 },
];

export const DEFAULT_METAL_RATES: Record<string, number> = {
  gold_24k: 85.00,
  gold_18k: 68.00,
  gold_14k: 54.00,
  gold_10k: 40.00,
  silver_925: 1.20,
};

/**
 * Determina si el plugin de joyería está activo en los ajustes de la tienda
 * Acepta boolean true, string 'true', número 1, '1', o estructura plugins.jewelry.enabled
 */
export function isJewelryPluginEnabled(settings?: any): boolean {
  if (!settings) return false;
  const val = settings.plugin_jewelry_enabled;
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true;
  const nested = settings.plugins?.jewelry?.enabled;
  if (nested === true || nested === 1 || nested === '1') return true;
  if (typeof nested === 'string' && nested.trim().toLowerCase() === 'true') return true;
  return false;
}

