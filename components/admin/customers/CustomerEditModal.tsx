import React, { useState } from 'react';
import { Customer } from '../../../types';
import { Button, Input } from '../../UIComponents';
import { X, Save, User, Phone, MapPin, CreditCard } from 'lucide-react';

interface CustomerEditModalProps {
    customer: Customer;
    onSave: (c: Customer) => void;
    onClose: () => void;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({ customer, onSave, onClose }) => {
    // Si el cliente no tiene teléfono, es una creación nueva
    const isNew = !customer.phone;
    const [formData, setFormData] = useState<Customer>({ ...customer });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert("El nombre es obligatorio");
            return;
        }
        
        // Limpiar el teléfono de espacios para consistencia
        const cleanPhone = formData.phone.replace(/\s/g, '');
        if (!cleanPhone) {
            alert("El teléfono es obligatorio");
            return;
        }

        setIsSaving(true);
        try {
            // Pasamos el objeto con el teléfono limpio
            await onSave({ ...formData, phone: cleanPhone });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Error al guardar cliente");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-2xl relative animate-slide-up overflow-hidden border border-white/10">
                
                <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <User size={20} className="text-ios-blue"/> {isNew ? 'Nuevo Cliente' : 'Editar Cliente'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full dark:text-white transition"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    <Input 
                        label="Nombre Completo" 
                        value={formData.name} 
                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                        icon={<User size={16}/>}
                        placeholder="Nombre del cliente"
                    />

                    <Input 
                        label="Cédula / DNI" 
                        value={formData.cedula || ''} 
                        onChange={e => setFormData({ ...formData, cedula: e.target.value })} 
                        icon={<CreditCard size={16}/>}
                        placeholder="V-12345678 (opcional)"
                    />
                    
                    <div>
                        <Input 
                            label="Teléfono / WhatsApp" 
                            value={formData.phone} 
                            onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                            icon={<Phone size={16}/>}
                            placeholder="+584120000000"
                            disabled={!isNew} // Solo se puede escribir si es nuevo cliente
                            className={!isNew ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-white/5" : ""}
                        />
                        {!isNew ? (
                            <p className="text-[10px] text-red-400 mt-1 ml-1 font-medium">El número de teléfono es el identificador único y no se puede editar.</p>
                        ) : (
                            <p className="text-[10px] text-gray-400 mt-1 ml-1 font-medium italic">Escribe el teléfono incluyendo el código de país (ej: +58).</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Dirección</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-4 top-3 text-gray-400 pointer-events-none"/>
                            <textarea 
                                className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-ios-blue/50 rounded-2xl pl-11 pr-4 py-3 outline-none text-sm dark:text-white min-h-[100px]"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Dirección de entrega..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 dark:border-white/5 flex gap-3 bg-gray-50/50 dark:bg-black/10">
                    <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button onClick={handleSave} loading={isSaving} className="flex-[2] gap-2 shadow-lg">
                        <Save size={18}/> {isNew ? 'Crear Cliente' : 'Guardar Cambios'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
