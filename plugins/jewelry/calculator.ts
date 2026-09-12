import { DEFAULT_METAL_RATES, METALS_LIST } from './types';

export interface JewelryCalculationParams {
  weightGram?: number;
  metalType?: string;
  rates?: Record<string, number>;
  makingCost?: number;
  makingCostType?: 'fixed' | 'per_gram';
}

export interface JewelryPriceBreakdown {
  ratePerGram: number;
  weightGram: number;
  metalBaseUSD: number;
  makingCostUSD: number;
  totalUSD: number;
  metalName: string;
}

/**
 * Obtiene la tasa en USD por gramo del metal especificado
 */
export function getMetalRate(metalKey?: string, rates?: Record<string, number>): number {
  if (!metalKey) return DEFAULT_METAL_RATES.gold_18k;
  const configured = rates && rates[metalKey];
  if (typeof configured === 'number' && configured > 0) {
    return configured;
  }
  return DEFAULT_METAL_RATES[metalKey] ?? 0;
}

/**
 * Calcula el desglose y precio final de una pieza de joyería
 */
export function calculateJewelryBreakdown(params: JewelryCalculationParams): JewelryPriceBreakdown {
  const weight = Math.max(0, Number(params.weightGram) || 0);
  const metalKey = params.metalType || 'gold_18k';
  const ratePerGram = getMetalRate(metalKey, params.rates);
  const makingCost = Math.max(0, Number(params.makingCost) || 0);
  const makingType = params.makingCostType || 'fixed';

  const metalBaseUSD = weight * ratePerGram;
  const makingCostUSD = makingType === 'per_gram' ? (weight * makingCost) : makingCost;
  const totalUSD = Math.round((metalBaseUSD + makingCostUSD) * 100) / 100;

  const metalDef = METALS_LIST.find(m => m.key === metalKey);
  const metalName = metalDef ? metalDef.name : metalKey;

  return {
    ratePerGram,
    weightGram: weight,
    metalBaseUSD: Math.round(metalBaseUSD * 100) / 100,
    makingCostUSD: Math.round(makingCostUSD * 100) / 100,
    totalUSD,
    metalName,
  };
}

/**
 * Calcula únicamente el precio final en USD de la joya
 */
export function calculateJewelryPrice(params: JewelryCalculationParams): number {
  return calculateJewelryBreakdown(params).totalUSD;
}
