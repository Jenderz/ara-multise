
import React, { useState } from 'react';
import { Card, Input, Button } from '../../UIComponents';
import { Store, MapPin, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, Lock } from 'lucide-react';
import { useStore } from '../../../context/StoreContext';
import { useNotification } from '../../../context/NotificationContext';
import { Branch } from '../../../types';

export const BranchesTab = () => {
    const { branches, saveBranch, deleteBranch, settings } = useStore();
    const { addNotification } = useNotification();
    
    const [isEditing, setIsEditing] = useState<Partial<Branch> | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Verificar si puede crear más sedes
    const isSinglePlan = settings.planTier === 'single';
    const canCreate = !isSinglePlan;

    const handleSave = async () => {
        if (!isEditing?.name) {
            alert('El nombre de la sede es obligatorio.');
            return;
        }

        setIsProcessing(true);
        try {
            await saveBranch(isEditing);
            addNotification({ title: 'Éxito', body: 'Sede guardada correctamente.', type: 'success' });
            setIsEditing(null);
        } catch (e: any) {
            console.error(e);
            addNotification({ title: 'Error', body: e.message || 'No se pudo guardar la sede.', type: 'warning' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (id === 1) {
            alert("No puedes eliminar la sede principal.");
            return;
        }
        if (window.confirm("¿Eliminar esta sede? Se perderá el acceso a su inventario.")) {
            setIsProcessing(true);
            try {
                await deleteBranch(id);
                addNotification({ title: 'Eliminado', body: 'Sede eliminada.', type: 'info' });
            } catch (e: any) {
                console.error(e);
                addNotification({ title: 'Error', body: 'Fallo al eliminar.', type: 'warning' });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Info */}
            <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-[1.5rem] border border-orange-100 dark:border-orange-900/30 flex gap-4 items-start">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                    <Store size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-orange-700 dark:text-orange-300 text-lg">Gestión de Sedes (Sucursales)</h3>
                    <p className="text-sm text-orange-600/80 dark:text-orange-300/80 mt-1 leading-relaxed">
                        Crea y administra múltiples ubicaciones. Cada sede mantiene su propio inventario independiente.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Formulario */}
                <div className="lg:col-span-1">
                    <Card className="p-6 sticky top-6">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                            {isEditing?.id ? <Edit2 size={18} className="text-blue-500"/> : <Plus size={18} className="text-green-500"/>}
                            {isEditing?.id ? 'Editar Sede' : 'Nueva Sede'}
                        </h4>
                        
                        <div className="space-y-4">
                            <Input 
                                label="Nombre de la Sede" 
                                placeholder="Ej: Sucursal Centro" 
                                value={isEditing?.name || ''} 
                                onChange={e => setIsEditing(prev => ({ ...prev, name: e.target.value }))}
                                disabled={!canCreate && !isEditing?.id}
                            />
                            
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Dirección</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none"/>
                                    <textarea 
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl pl-10 pr-4 py-3 outline-none text-sm dark:text-white min-h-[80px]"
                                        value={isEditing?.address || ''}
                                        onChange={e => setIsEditing(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="Ubicación física..."
                                        disabled={!canCreate && !isEditing?.id}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
                                <input 
                                    type="checkbox" 
                                    id="branchActive"
                                    checked={isEditing?.isActive ?? true}
                                    onChange={e => setIsEditing(prev => ({ ...prev, isActive: e.target.checked }))}
                                    className="w-5 h-5 accent-ios-blue cursor-pointer"
                                    disabled={!canCreate && !isEditing?.id}
                                />
                                <label htmlFor="branchActive" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                    Sede Activa (Visible)
                                </label>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button 
                                    variant="secondary" 
                                    className="flex-1"
                                    onClick={() => setIsEditing(null)}
                                    disabled={!isEditing}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    className="flex-[2] shadow-lg" 
                                    onClick={handleSave}
                                    loading={isProcessing}
                                    disabled={!isEditing}
                                >
                                    Guardar
                                </Button>
                            </div>
                            
                            {!isEditing && (
                                canCreate ? (
                                    <Button 
                                        className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white shadow-green-500/30" 
                                        onClick={() => setIsEditing({ name: '', address: '', isActive: true })}
                                    >
                                        <Plus size={18} className="mr-2"/> Crear Nueva
                                    </Button>
                                ) : (
                                    <div className="mt-4 p-3 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 text-center">
                                        <Lock size={20} className="mx-auto text-gray-400 mb-2"/>
                                        <p className="text-xs font-bold text-gray-500">Plan Básico</p>
                                        <p className="text-[10px] text-gray-400">Actualiza a PRO para crear más sedes.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </Card>
                </div>

                {/* Lista */}
                <div className="lg:col-span-2 space-y-4">
                    {branches.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10">
                            <Store size={40} className="mx-auto text-gray-300 mb-3"/>
                            <p className="text-gray-500 font-medium">No hay sedes registradas.</p>
                        </div>
                    ) : (
                        branches.map(branch => (
                            <div key={branch.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${branch.id === 1 ? 'bg-purple-600' : 'bg-ios-blue'}`}>
                                        <Store size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                            {branch.name}
                                            {branch.id === 1 && <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-200">Principal</span>}
                                            {!branch.isActive && <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-200">Inactiva</span>}
                                        </h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                            <MapPin size={12}/> {branch.address || 'Sin dirección'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 self-end sm:self-center">
                                    <button 
                                        onClick={() => setIsEditing(branch)}
                                        className="p-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 size={18}/>
                                    </button>
                                    {branch.id !== 1 && canCreate && (
                                        <button 
                                            onClick={() => handleDelete(branch.id)}
                                            className="p-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
