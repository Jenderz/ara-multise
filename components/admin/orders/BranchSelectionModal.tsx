import React, { useState } from 'react';
import { Branch } from '../../../types';
import { X, CheckCircle2, Store } from 'lucide-react';

interface BranchSelectionModalProps {
    branches: Branch[];
    onConfirm: (branchId: number) => void;
    onClose: () => void;
}

export const BranchSelectionModal: React.FC<BranchSelectionModalProps> = ({ branches, onConfirm, onClose }) => {
    const [selectedBranchId, setSelectedBranchId] = useState<number>(0);

    const activeBranches = branches.filter(b => b.isActive);

    const handleConfirm = () => {
        if (selectedBranchId > 0) {
            onConfirm(selectedBranchId);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold dark:text-white">Completar Pedido</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                </div>

                <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-4">Selecciona la sede desde la cual se despachará este pedido para descontar el inventario correctamente:</p>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {activeBranches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedBranchId === branch.id ? 'border-ios-blue bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedBranchId === branch.id ? 'bg-ios-blue text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                                        <Store size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className={`font-bold ${selectedBranchId === branch.id ? 'text-ios-blue' : 'text-gray-700 dark:text-white'}`}>{branch.name}</p>
                                        <p className="text-xs text-gray-400">{branch.address}</p>
                                    </div>
                                </div>
                                {selectedBranchId === branch.id && <CheckCircle2 size={20} className="text-ios-blue" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition">Cancelar</button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedBranchId === 0}
                        className="px-5 py-2.5 bg-ios-blue text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-ios-blue/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Confirmar y Descontar
                    </button>
                </div>
            </div>
        </div>
    );
};
