import React, { useMemo } from 'react';
import { Product } from '../../types';
import { METALS_LIST } from './types';
import { calculateJewelryBreakdown, getMetalRate } from './calculator';
import { Scale, Gem, Hammer, Sparkles, DollarSign } from 'lucide-react';

interface ProductJewelryFieldsProps {
  formData: Product;
  onChange: (updates: Partial<Product>) => void;
  metalRates?: Record<string, number>;
  exchangeRate?: number;
  activeCurrencySymbol?: string;
}

export const ProductJewelryFields: React.FC<ProductJewelryFieldsProps> = ({
  formData,
  onChange,
  metalRates,
  exchangeRate = 0,
  activeCurrencySymbol = '$'
}) => {
  const isByWeight = formData.pricingType === 'by_weight' || (formData as any).pricing_type === 'by_weight';
  const currentMetal = formData.metalType || (formData as any).metal_type || 'gold_18k';
  const weight = formData.weightGram ?? (formData as any).weight_gram ?? 0;
  const making = formData.makingCost ?? (formData as any).making_cost ?? 0;
  const makingType = formData.makingCostType || (formData as any).making_cost_type || 'fixed';

  // Desglose en tiempo real
  const breakdown = useMemo(() => {
    return calculateJewelryBreakdown({
      weightGram: weight,
      metalType: currentMetal,
      rates: metalRates,
      makingCost: making,
      makingCostType: makingType
    });
  }, [weight, currentMetal, metalRates, making, makingType]);

  const handleToggleMode = (mode: 'fixed' | 'by_weight') => {
    if (mode === 'by_weight') {
      const newBreakdown = calculateJewelryBreakdown({
        weightGram: weight,
        metalType: currentMetal,
        rates: metalRates,
        makingCost: making,
        makingCostType: makingType
      });
      onChange({
        pricingType: 'by_weight',
        metalType: currentMetal,
        price: newBreakdown.totalUSD
      });
    } else {
      onChange({
        pricingType: 'fixed'
      });
    }
  };

  const handleMetalChange = (newMetal: string) => {
    const newBreakdown = calculateJewelryBreakdown({
      weightGram: weight,
      metalType: newMetal,
      rates: metalRates,
      makingCost: making,
      makingCostType: makingType
    });
    onChange({
      metalType: newMetal,
      price: newBreakdown.totalUSD
    });
  };

  const handleWeightChange = (newWeightStr: string) => {
    const newWeight = Math.max(0, parseFloat(newWeightStr) || 0);
    const newBreakdown = calculateJewelryBreakdown({
      weightGram: newWeight,
      metalType: currentMetal,
      rates: metalRates,
      makingCost: making,
      makingCostType: makingType
    });
    onChange({
      weightGram: newWeight,
      price: newBreakdown.totalUSD
    });
  };

  const handleMakingCostChange = (newMakingStr: string) => {
    const newMaking = Math.max(0, parseFloat(newMakingStr) || 0);
    const newBreakdown = calculateJewelryBreakdown({
      weightGram: weight,
      metalType: currentMetal,
      rates: metalRates,
      makingCost: newMaking,
      makingCostType: makingType
    });
    onChange({
      makingCost: newMaking,
      price: newBreakdown.totalUSD
    });
  };

  const handleMakingTypeChange = (newType: 'fixed' | 'per_gram') => {
    const newBreakdown = calculateJewelryBreakdown({
      weightGram: weight,
      metalType: currentMetal,
      rates: metalRates,
      makingCost: making,
      makingCostType: newType
    });
    onChange({
      makingCostType: newType,
      price: newBreakdown.totalUSD
    });
  };

  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-4 transition-all">
      {/* Selector de Modalidad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/50 dark:border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
            <Gem size={18} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              Modalidad de Venta
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Venta tradicional o cálculo automático por peso en metal
            </p>
          </div>
        </div>

        <div className="flex bg-white dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleToggleMode('fixed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !isByWeight
                ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Precio Fijo
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('by_weight')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              isByWeight
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Scale size={14} /> Por Peso (Gramos)
          </button>
        </div>
      </div>

      {isByWeight && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de Metal */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Metal / Pureza
              </label>
              <select
                value={currentMetal}
                onChange={(e) => handleMetalChange(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 dark:text-white focus:ring-2 focus:ring-amber-500/30 outline-none transition"
              >
                {METALS_LIST.map((m) => {
                  const rate = getMetalRate(m.key, metalRates);
                  return (
                    <option key={m.key} value={m.key}>
                      {m.name} — ${rate.toFixed(2)}/g
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Peso en Gramos */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Scale size={14} className="text-amber-500" /> Peso en Báscula (g)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={weight === 0 ? '' : weight}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 outline-none transition font-mono pr-10"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  gr
                </span>
              </div>
            </div>
          </div>

          {/* Hechura / Mano de obra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Hammer size={14} className="text-amber-500" /> Hechura / Manufactura ($)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  value={making === 0 ? '' : making}
                  onChange={(e) => handleMakingCostChange(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 outline-none transition font-mono pl-7"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  $
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Modalidad de Hechura
              </label>
              <div className="flex bg-white dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => handleMakingTypeChange('fixed')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    makingType === 'fixed'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  Fija por pieza
                </button>
                <button
                  type="button"
                  onClick={() => handleMakingTypeChange('per_gram')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    makingType === 'per_gram'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  Por gramo ($/g)
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta de Cálculo en Vivo */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 dark:border-amber-500/30 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles size={13} /> Precio Automático Calculado
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {breakdown.weightGram}g × ${breakdown.ratePerGram.toFixed(2)} ({breakdown.metalName})
                  {breakdown.makingCostUSD > 0 && ` + $${breakdown.makingCostUSD.toFixed(2)} hechura`}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">
                  {activeCurrencySymbol}{breakdown.totalUSD.toFixed(2)}
                </div>
                {exchangeRate > 0 && (
                  <div className="text-xs font-bold text-amber-700/80 dark:text-amber-400/80 font-mono">
                    ≈ Bs. {(breakdown.totalUSD * exchangeRate).toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
