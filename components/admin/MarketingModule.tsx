import React, { useState, useMemo } from 'react';
import { Card, Input, Button } from '../UIComponents';
import { Tag, Trash2, Percent, DollarSign, Copy, Check, Search, Sparkles, AlertCircle } from 'lucide-react';
import { Coupon } from '../../types';
import { useNotification } from '../../context/NotificationContext';

export const MarketingModule = ({ coupons, addCoupon, toggleCoupon, deleteCoupon }: any) => {
    const { addNotification } = useNotification();
    
    // Coupon Form State
    const [code, setCode] = useState('');
    const [val, setVal] = useState<number | ''>('');
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Filtered coupons list
    const filteredCoupons = useMemo(() => {
        const list = Array.isArray(coupons) ? coupons : [];
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter((c: Coupon) => c.code.toLowerCase().includes(q));
    }, [coupons, searchTerm]);

    // Summary stats
    const stats = useMemo(() => {
        const list = Array.isArray(coupons) ? coupons : [];
        const activeCount = list.filter(c => c.active).length;
        const pausedCount = list.length - activeCount;
        return { total: list.length, active: activeCount, paused: pausedCount };
    }, [coupons]);

    const handleAddCoupon = () => {
        const cleanCode = code.toUpperCase().replace(/\s/g, '').trim();
        const numericVal = Number(val);

        if (!cleanCode) {
            alert('El código del cupón es obligatorio.');
            return;
        }
        if (cleanCode.length < 3) {
            alert('El código debe tener al menos 3 caracteres.');
            return;
        }
        if (isNaN(numericVal) || numericVal <= 0) {
            alert('El valor del descuento debe ser mayor a 0.');
            return;
        }
        if (discountType === 'percentage' && numericVal > 100) {
            alert('El porcentaje de descuento no puede ser mayor al 100%.');
            return;
        }

        // Check for duplicate
        const existing = (coupons || []).find((c: Coupon) => c.code.toUpperCase().trim() === cleanCode);
        if (existing) {
            if (!window.confirm(`El cupón "${cleanCode}" ya existe. ¿Deseas actualizar su valor y activarlo?`)) {
                return;
            }
        }

        addCoupon({ 
            code: cleanCode, 
            discountType, 
            value: numericVal, 
            active: true 
        });

        setCode(''); 
        setVal('');
        addNotification({ 
            title: existing ? 'Cupón Actualizado' : 'Cupón Creado', 
            body: `El código ${cleanCode} (${discountType === 'percentage' ? `${numericVal}%` : `$${numericVal}`}) está activo.`, 
            type: 'success' 
        });
    };

    const handleCopy = (couponCode: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(couponCode);
            setCopiedCode(couponCode);
            setTimeout(() => setCopiedCode(null), 2000);
            addNotification({ title: 'Copiado', body: `Código "${couponCode}" copiado al portapapeles.`, type: 'info' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                        <Sparkles className="text-ios-blue" size={24} /> Marketing y Cupones
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Crea y gestiona cupones de descuento para fidelizar a tus clientes en la tienda online.</p>
                </div>

                {/* Stat badges */}
                <div className="flex items-center gap-2">
                    <div className="bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-white/5 text-center shadow-sm">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Total</p>
                        <p className="text-sm font-black dark:text-white">{stats.total}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-xl border border-green-200/50 dark:border-green-800/30 text-center">
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">Activos</p>
                        <p className="text-sm font-black text-green-700 dark:text-green-300">{stats.active}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl border border-orange-200/50 dark:border-orange-800/30 text-center">
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase">Pausados</p>
                        <p className="text-sm font-black text-orange-700 dark:text-orange-300">{stats.paused}</p>
                    </div>
                </div>
            </div>
            
            <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 dark:text-white text-base">
                        <Tag size={20} className="text-ios-blue"/> Crear Nuevo Cupón
                    </h3>
                </div>
                
                {/* Formulario de creación */}
                <div className="bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center gap-2 p-1 bg-white dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
                        <button 
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'percentage' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                        >
                            <Percent size={14}/> Porcentaje (%)
                        </button>
                        <button 
                            type="button"
                            onClick={() => setDiscountType('fixed')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'fixed' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                        >
                            <DollarSign size={14}/> Monto Fijo ($)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-7">
                            <Input 
                                placeholder="CÓDIGO (Ej: BIENVENIDO10, VERANO20)" 
                                value={code} 
                                onChange={e => setCode(e.target.value.toUpperCase())} 
                                onKeyDown={e => { if (e.key === 'Enter') handleAddCoupon(); }}
                                className="uppercase font-mono font-bold tracking-wider" 
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <Input 
                                type="number" 
                                placeholder={discountType === 'percentage' ? "% Descuento" : "$ Descuento"} 
                                value={val === '' ? '' : val} 
                                onChange={e => setVal(e.target.value === '' ? '' : Number(e.target.value))}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddCoupon(); }}
                                min={0}
                                max={discountType === 'percentage' ? 100 : undefined}
                                className="font-bold"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Button 
                                onClick={handleAddCoupon} 
                                className="w-full h-11 font-bold shadow-lg shadow-ios-blue/20 bg-ios-blue hover:brightness-110"
                            >
                                Crear
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Listado de cupones */}
                <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Cupones Registrados ({filteredCoupons.length})
                        </h4>
                        
                        {(coupons || []).length > 3 && (
                            <div className="relative w-full sm:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar cupón..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs dark:text-white outline-none focus:border-ios-blue/40"
                                />
                            </div>
                        )}
                    </div>

                    {(coupons || []).length === 0 ? (
                        <div className="text-center text-gray-400 py-12 px-4 text-sm bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-2">
                            <Tag size={32} className="text-gray-300 dark:text-gray-600 mb-1" />
                            <p className="font-bold text-gray-600 dark:text-gray-300">No hay cupones creados</p>
                            <p className="text-xs text-gray-400">Crea tu primer cupón arriba para ofrecer promociones a tus clientes.</p>
                        </div>
                    ) : filteredCoupons.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-xs bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                            No se encontraron cupones con el término "{searchTerm}".
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredCoupons.map((c: Coupon) => {
                                const isPercentage = (c.discountType === 'percentage' || (c as any).discount_type === 'percentage');
                                const discountLabel = isPercentage ? `${c.value}%` : `$${c.value}`;
                                
                                return (
                                    <div 
                                        key={c.code} 
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                                            c.active 
                                                ? 'bg-white dark:bg-zinc-800/80 border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-ios-blue/30' 
                                                : 'bg-gray-50/70 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 opacity-75'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className={`w-3 h-3 rounded-full shrink-0 ${c.active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-mono font-black text-ios-text dark:text-white text-base tracking-wider truncate">
                                                        {c.code}
                                                    </p>
                                                    <button 
                                                        onClick={() => handleCopy(c.code)}
                                                        className="text-gray-400 hover:text-ios-blue transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
                                                        title="Copiar código"
                                                    >
                                                        {copiedCode === c.code ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        isPercentage 
                                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    }`}>
                                                        {isPercentage ? <Percent size={10} /> : <DollarSign size={10} />}
                                                        {discountLabel} de descuento
                                                    </span>
                                                    <span className={`text-[10px] font-medium ${c.active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                                        {c.active ? 'Activo' : 'Pausado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <button 
                                                onClick={() => toggleCoupon(c.code)} 
                                                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                                    c.active 
                                                        ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400' 
                                                        : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400'
                                                }`}
                                            >
                                                {c.active ? 'Pausar' : 'Activar'}
                                            </button>
                                            <button 
                                                onClick={() => { 
                                                    if (window.confirm(`¿Seguro que deseas eliminar el cupón "${c.code}"?`)) {
                                                        deleteCoupon(c.code);
                                                        addNotification({ title: 'Cupón Eliminado', body: `El cupón ${c.code} fue eliminado.`, type: 'info' });
                                                    } 
                                                }} 
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                                                title="Eliminar cupón"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
