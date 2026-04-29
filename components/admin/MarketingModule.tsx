
import React, { useState } from 'react';
import { Card, Input, Button } from '../UIComponents';
import { Tag, Trash2, Percent, DollarSign } from 'lucide-react';
import { Coupon } from '../../types';
import { useNotification } from '../../context/NotificationContext';

export const MarketingModule = ({ coupons, addCoupon, toggleCoupon, deleteCoupon }: any) => {
    const { addNotification } = useNotification();
    
    // Coupon State
    const [code, setCode] = useState('');
    const [val, setVal] = useState(0);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');

    const handleAddCoupon = () => {
        if(!code.trim()) {
            alert('El código es obligatorio.');
            return;
        }
        if(val <= 0) {
            alert('El valor del descuento debe ser mayor a 0.');
            return;
        }
        if (discountType === 'percentage' && val > 100) {
            alert('El porcentaje no puede ser mayor a 100%.');
            return;
        }

        addCoupon({ 
            code: code.toUpperCase().replace(/\s/g, ''), 
            discountType, 
            value: val, 
            active: true 
        });
        setCode(''); setVal(0);
        addNotification({ title: 'Cupón Creado', body: `El código ${code.toUpperCase()} está activo.`, type: 'success' });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h2 className="text-2xl font-bold dark:text-white">Marketing y Fidelización</h2>
            
            <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 dark:text-white"><Tag size={20} className="text-ios-blue"/> Cupones de Descuento</h3>
                </div>
                
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                    <div className="flex gap-2 p-1 bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
                        <button 
                            onClick={() => setDiscountType('percentage')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'percentage' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                        >
                            <Percent size={14}/> Porcentaje
                        </button>
                        <button 
                            onClick={() => setDiscountType('fixed')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${discountType === 'fixed' ? 'bg-ios-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                        >
                            <DollarSign size={14}/> Monto Fijo
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input placeholder="CÓDIGO (Ej: VERANO20)" value={code} onChange={e => setCode(e.target.value)} className="uppercase font-mono" />
                        </div>
                        <div className="w-32">
                            <Input type="number" placeholder={discountType === 'percentage' ? "%" : "$"} value={val || ''} onChange={e => setVal(Number(e.target.value))} />
                        </div>
                        <Button onClick={handleAddCoupon} className="px-6 font-bold shadow-lg shadow-ios-blue/20">Crear</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    {(coupons || []).length === 0 ? (
                        <p className="text-center text-gray-400 py-12 text-sm bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                            No hay cupones activos. Crea el primero arriba.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {coupons.map((c: Coupon) => (
                                <div key={c.code} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:shadow-md transition-shadow group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${c.active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`} />
                                        <div>
                                            <p className="font-mono font-bold dark:text-white text-base">{c.code}</p>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                {c.discountType === 'percentage' ? `Descuento del ${c.value}%` : `Descuento de $${c.value}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => toggleCoupon(c.code)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${c.active ? 'bg-orange-50 text-orange-500 hover:bg-orange-100' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}>
                                            {c.active ? 'Pausar' : 'Activar'}
                                        </button>
                                        <button onClick={() => { if(window.confirm('¿Eliminar cupón?')) deleteCoupon(c.code); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
