
import React from 'react';
import { Card } from '../UIComponents';
import * as XLSX from 'xlsx';
import { TrendingUp } from 'lucide-react';

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: number | string | null;
    collapsed?: boolean;
}

export const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, badge, collapsed = false }) => (
    <div className="relative group">
        <button 
            type="button"
            onClick={onClick}
            aria-label={label}
            className={`w-full flex items-center transition-all duration-200 ${
                collapsed 
                    ? 'justify-center p-2.5 rounded-2xl' 
                    : 'justify-between px-3.5 py-2.5 rounded-xl'
            } ${
                active 
                    ? 'bg-ios-blue text-white shadow-md shadow-blue-500/25 font-bold' 
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
            }`}
        >
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                <span className={`relative shrink-0 flex items-center justify-center ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-ios-blue transition-colors'}`}>
                    {icon}
                    {collapsed && badge ? (
                        <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
                    ) : null}
                </span>
                {!collapsed && (
                    <span className="font-semibold text-sm truncate tracking-tight">
                        {label}
                    </span>
                )}
            </div>

            {!collapsed && badge ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                    {badge}
                </span>
            ) : null}
        </button>

        {/* Tooltip flotante premium en modo colapsado para pantallas grandes */}
        {collapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 -translate-x-1 group-hover:translate-x-0">
                <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold py-1.5 px-3 rounded-xl shadow-xl whitespace-nowrap flex items-center gap-1.5 border border-white/10 dark:border-black/10">
                    <span>{label}</span>
                    {badge ? (
                        <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                            {badge}
                        </span>
                    ) : null}
                </div>
            </div>
        )}
    </div>
);

export const StatCard = ({ title, value, icon, color, trend }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center gap-4 hover:shadow-lg transition-shadow relative overflow-hidden">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${color} z-10`}>
            {icon}
        </div>
        <div className="z-10">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-black text-ios-text dark:text-white">{value}</p>
            {trend && <p className="text-[10px] text-green-500 font-bold flex items-center gap-1"><TrendingUp size={10}/> {trend}</p>}
        </div>
        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 ${color}`}></div>
    </div>
);
