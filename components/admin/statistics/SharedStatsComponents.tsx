
import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const StatCard = ({ title, value, icon, color, trend, trendValue, subtitle }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${color} transition-transform group-hover:scale-110 duration-500`}>
                {icon}
            </div>
            {trend && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    trend === 'up' 
                    ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                    : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                }`}>
                    {trend === 'up' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                    {trendValue}%
                </div>
            )}
        </div>
        <div className="relative z-10">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black text-ios-text dark:text-white tracking-tight">{value}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-2 font-medium">{subtitle}</p>}
        </div>
        <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.03] dark:opacity-[0.05] ${color} group-hover:scale-150 transition-transform duration-700 ease-out`}></div>
    </div>
);

export const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 rounded-2xl shadow-xl text-xs z-50">
                <p className="font-bold text-gray-800 dark:text-white mb-2 border-b border-gray-100 dark:border-white/10 pb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-500 dark:text-gray-400 capitalize">
                                {entry.name === 'sales' ? 'Venta Bruta' : entry.name === 'profit' ? 'Ganancia Neta' : entry.name === 'orders' ? 'Pedidos' : entry.name === 'value' ? 'Valor' : entry.name}:
                            </span>
                        </div>
                        <span className="font-bold dark:text-white font-mono">
                            {['sales', 'profit', 'cost', 'value', 'total'].includes(entry.name)
                                ? `$${Number(entry.value).toFixed(2)}` 
                                : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export const PIE_COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#34C759', '#5AC8FA'];
