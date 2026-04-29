
import React, { useState } from 'react';
import { Card, Input, Button, ImageUploader } from '../UIComponents';
import { generateId } from './Shared';
import { Plus, Trash2, Package, Edit2, Save } from 'lucide-react';
import { Category, Product } from '../../types';
import { useStore } from '../../context/StoreContext';

export const CategoriesModule = ({ categories, products, addCategory, updateCategory, deleteCategory }: any) => {
    const { userRole } = useStore(); 
    const [name, setName] = useState('');
    const [img, setImg] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Asegurar que categories es un array siempre
    const safeCategories = Array.isArray(categories) ? categories : [];

    const handleSave = () => {
        if (isSubmitting) return;
        
        if(!name.trim()) {
            alert('El nombre de la categoría es obligatorio.');
            return;
        }
        
        setIsSubmitting(true);

        // Pequeño timeout para asegurar que la UI se bloquee antes de procesar
        setTimeout(() => {
            if (editingId) {
                 // Lógica de Actualización
                 updateCategory({ id: editingId, name: name.trim(), image: img });
                 setEditingId(null);
            } else {
                 // Lógica de Creación
                 if (safeCategories.some((c: Category) => c.name.toLowerCase() === name.trim().toLowerCase())) {
                    alert('Ya existe una categoría con ese nombre.');
                    setIsSubmitting(false);
                    return;
                }
                addCategory({ id: generateId(), name: name.trim(), image: img || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80' });
            }
            
            setName(''); setImg('');
            
            // Liberar botón después de un momento
            setTimeout(() => setIsSubmitting(false), 500);
        }, 50);
    };

    const handleEdit = (cat: Category) => {
        setEditingId(cat.id);
        setName(cat.name);
        setImg(cat.image || '');
        // Scroll suave al formulario
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setName('');
        setImg('');
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold dark:text-white">Gestión de Categorías</h2>
            <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Nombre de Categoría" placeholder="Ej: Verano" value={name} onChange={e => setName(e.target.value)} disabled={isSubmitting} />
                    <ImageUploader label="Imagen Destacada" value={img} onChange={setImg} />
                    <div className="flex items-end gap-2">
                        {editingId ? (
                            <>
                                <Button onClick={handleCancel} variant="secondary" className="flex-1" disabled={isSubmitting}>Cancelar</Button>
                                <Button onClick={handleSave} className="flex-1 gap-2" loading={isSubmitting}><Save size={18}/> Actualizar</Button>
                            </>
                        ) : (
                            <Button onClick={handleSave} className="w-full gap-2" loading={isSubmitting}><Plus size={20}/> Añadir</Button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {safeCategories.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-gray-400">
                        <Package size={40} className="mx-auto mb-2 opacity-30" />
                        <p>No hay categorías creadas.</p>
                    </div>
                ) : (
                    safeCategories.map((cat: Category) => {
                        const productCount = (products || []).filter((p: Product) => p.category === cat.name).length;
                        
                        return (
                            <div key={cat.id} className="group relative rounded-[2.5rem] overflow-hidden aspect-square shadow-lg border border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-white/5">
                                <img src={cat.image} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700 opacity-90 group-hover:opacity-100" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                                    <p className="text-white font-bold text-lg leading-tight">{cat.name}</p>
                                    <div className="flex items-center gap-1.5 text-white/80 text-xs mt-1 font-medium">
                                        <Package size={12} />
                                        <span>{productCount} productos</span>
                                    </div>
                                    
                                    {/* Botones de Acción (Admin Only) */}
                                    {userRole === 'admin' && (
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
                                            <button onClick={() => handleEdit(cat)} className="p-2.5 bg-blue-500/80 backdrop-blur-md text-white rounded-full hover:bg-blue-600 transition-all shadow-lg" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteCategory(cat.id)} className="p-2.5 bg-red-500/80 backdrop-blur-md text-white rounded-full hover:bg-red-600 transition-all shadow-lg" title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
