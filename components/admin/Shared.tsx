
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

export const NavButton = ({ active, onClick, icon, label, badge }: any) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
            active 
            ? 'bg-ios-blue text-white shadow-lg shadow-blue-500/30' 
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
        }`}
    >
        <div className="flex items-center gap-3">
            <span className={active ? 'text-white' : 'group-hover:text-ios-blue transition-colors'}>{icon}</span>
            <span className="font-medium text-sm">{label}</span>
        </div>
        {badge ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                {badge}
            </span>
        ) : null}
    </button>
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
