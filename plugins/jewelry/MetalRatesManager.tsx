import React, { useState } from 'react';
import { METALS_LIST } from './types';
import { getMetalRate, calculateJewelryPrice } from './calculator';
import { StoreSettings, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useNotification } from '../../context/NotificationContext';
import { Gem, Scale, RefreshCw, CheckCircle2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

interface MetalRatesManagerProps {
  settings: StoreSettings;
  onUpdateSettings: (updates: Partial<StoreSettings>) => void;
}

export const MetalRatesManager: React.FC<MetalRatesManagerProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const { products, updateMultipleProducts, activeExchangeRate, activeCurrencySymbol } = useStore();
  const { addNotification } = useNotification();

  // Tasas en estado local para edición
  const [rates, setRates] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    METALS_LIST.forEach((m) => {
      initial[m.key] = getMetalRate(m.key, settings.jewelry_metal_rates);
    });
    return initial;
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sincronizar con settings cuando se carguen desde el backend si el usuario no ha modificado
  React.useEffect(() => {
    if (!hasChanges && settings.jewelry_metal_rates) {
      const updated: Record<string, number> = {};
      METALS_LIST.forEach((m) => {
        updated[m.key] = getMetalRate(m.key, settings.jewelry_metal_rates);
      });
      setRates(updated);
    }
  }, [settings.jewelry_metal_rates, hasChanges]);

  // Cantidad de productos afectados
  const weightProducts = products.filter((p) => p.pricingType === 'by_weight' || (p as any).pricing_type === 'by_weight');

  const handleRateChange = (metalKey: string, value: string) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setRates((prev) => ({ ...prev, [metalKey]: num }));
    setHasChanges(true);
  };

  const handleApplyRates = async () => {
    setIsUpdating(true);
    try {
      // 1. Guardar las nuevas tasas en settings
      await onUpdateSettings({
        jewelry_metal_rates: rates,
      });

      // 2. Si hay productos vinculados por peso, recalcular su campo price
      if (weightProducts.length > 0) {
        const updatedProducts = weightProducts.map((p) => {
          const newPrice = calculateJewelryPrice({
            weightGram: p.weightGram,
            metalType: p.metalType,
            rates,
            makingCost: p.makingCost,
            makingCostType: p.makingCostType,
          });

          const updated: Product = {
            ...p,
            price: newPrice,
          };

          // Si tiene variantes con peso asignado
          if (p.variants && p.variants.length > 0) {
            updated.variants = p.variants.map((v) => {
              if (v.weightGram && v.weightGram > 0) {
                const variantPrice = calculateJewelryPrice({
                  weightGram: v.weightGram,
                  metalType: p.metalType,
                  rates,
                  makingCost: p.makingCost,
                  makingCostType: p.makingCostType,
                });
                return { ...v, price: variantPrice };
              }
              return { ...v, price: newPrice };
            });
          }

          return updated;
        });

        await updateMultipleProducts(updatedProducts, () => {});
      }

      setHasChanges(false);
      addNotification({
        title: 'Cotización de Metales Actualizada',
        body: `Se han actualizado las tarifas y recalculado los precios de ${weightProducts.length} productos de joyería.`,
        type: 'success',
      });
    } catch (err: any) {
      addNotification({
        title: 'Error al actualizar',
        body: err?.message || 'No se pudieron actualizar los precios.',
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-500/20 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
            <Gem size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Pizarra de Cotización de Metales
              </h3>
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                Plugin Joyería
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Define el precio por gramo en USD. Todos los productos por peso se recalculan automáticamente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-2 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
          <Scale size={16} className="text-amber-600 dark:text-amber-400" />
          <span>{weightProducts.length} productos indexados al peso</span>
        </div>
      </div>

      {/* Grid de Metales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {METALS_LIST.map((metal) => {
          const currentRate = rates[metal.key] ?? metal.defaultRate;
          const vesRate = activeExchangeRate > 0 ? currentRate * activeExchangeRate : 0;

          return (
            <div
              key={metal.key}
              className="bg-gray-50/70 dark:bg-zinc-800/50 border border-gray-200/80 dark:border-white/5 rounded-2xl p-4 transition hover:border-amber-400/50 dark:hover:border-amber-500/30"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: metal.color }}
                  />
                  {metal.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-zinc-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                  {metal.purity}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Precio por Gramo (USD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={currentRate}
                    onChange={(e) => handleRateChange(metal.key, e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-base font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 outline-none transition font-mono pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    $
                  </span>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    /gr
                  </span>
                </div>

                {vesRate > 0 && (
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 pt-1 font-mono">
                    ≈ Bs. {vesRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /gr
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Acción */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 dark:border-white/10">
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" />
          <span>
            Al aplicar, los precios de venta y variantes de joyería se reajustarán inmediatamente en la tienda y en el POS.
          </span>
        </div>

        <button
          type="button"
          disabled={isUpdating}
          onClick={handleApplyRates}
          className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            hasChanges
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 scale-102'
              : 'bg-gray-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 shadow-black/10'
          } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isUpdating ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Actualizando {weightProducts.length} productos...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} /> Guardar y Actualizar Precios
            </>
          )}
        </button>
      </div>
    </div>
  );
};
