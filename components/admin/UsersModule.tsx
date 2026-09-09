
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Button } from '../UIComponents';
import { UserAccount, ActivityLog, Branch, SalesAdvisor } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useNotification } from '../../context/NotificationContext';
import { generateId } from './Shared';
import { 
    Users, Plus, Trash2, Edit2, ShieldCheck, Check, History, Clock, 
    Search, Filter, ChevronLeft, ChevronRight, X, LogIn, ShoppingBag, 
    Package, Settings, AlertOctagon, FileText, Lock, RefreshCw, Store, Globe,
    UserCheck, Phone, Percent, Sparkles, Power, Award, Info
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// Definición de Módulos Disponibles para Permisos (GRANULARIDAD MEJORADA)
const AVAILABLE_MODULES = [
    { id: 'dashboard', label: 'Dashboard Resumen' },
    { id: 'pos', label: 'Punto de Venta (POS)' },
    { id: 'checkout_authorized', label: 'Autorizar Cobros (POS)' }, // NUEVO: Permiso de caja
    { id: 'orders', label: 'Gestión de Pedidos' },
    { id: 'view_web_orders', label: 'Ver Pedidos Web (Globales)' }, 
    { id: 'products_view', label: 'Ver Inventario (Sólo Lectura)' }, // NUEVO: Granular
    { id: 'products_manage', label: 'Gestionar Inventario (Crear/Editar/Costos)' }, // NUEVO: Granular
    { id: 'customers', label: 'Base de Clientes' },
    { id: 'statistics', label: 'Estadísticas Completas' }
];

export const UsersModule = () => {
    const { settings, updateSettings, addUser, updateUser, deleteUser, currentUser, logs, clearLogs, userRole, refreshStoreData, branches } = useStore();
    const { addNotification } = useNotification();
    
    // --- MODO DE VISTA: USUARIOS/CAJERAS (SISTEMA) [PRINCIPAL] | ASESORES (PISO) | LOGS ---
    const [viewMode, setViewMode] = useState<'advisors' | 'users' | 'logs'>('users');

    // --- ESTADO PARA USUARIOS DEL SISTEMA (CON LOGIN Y CONTRASEÑA) ---
    const [isEditing, setIsEditing] = useState<UserAccount | null>(null);
    const [formData, setFormData] = useState<Partial<UserAccount>>({ 
        name: '', 
        username: '', 
        password: '', 
        role: 'seller',
        assignedBranchId: 0, // 0 = Sin restricción (o no aplica)
        commissionRate: 0,
        permissions: ['dashboard', 'pos', 'checkout_authorized', 'orders', 'products_view'] 
    });

    // --- ESTADO PARA ASESORES DE VENTA DE PISO (SIN ACCESO AL SISTEMA / SIN CLAVE) ---
    const [advisorEditing, setAdvisorEditing] = useState<SalesAdvisor | null>(null);
    const [advisorFormData, setAdvisorFormData] = useState<Partial<SalesAdvisor>>({
        name: '',
        phone: '',
        branchId: 0,
        commissionRate: 0,
        active: true
    });
    const [advisorSearch, setAdvisorSearch] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
    
    // --- ESTADOS DE BÚSQUEDA Y FILTRO ---
    const [userSearch, setUserSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [logActionFilter, setLogActionFilter] = useState<string>('all');
    const [logUserFilter, setLogUserFilter] = useState<string>('all'); 
    const [currentPage, setCurrentPage] = useState(1);

    // --- MANEJO DE ASESORES DE PISO (SIN CLAVE) ---
    const filteredAdvisors = useMemo(() => {
        const list = Array.isArray(settings.salesAdvisors) ? settings.salesAdvisors : [];
        if (!advisorSearch) return list;
        const term = advisorSearch.toLowerCase();
        return list.filter(a => 
            a.name.toLowerCase().includes(term) || 
            (a.phone && a.phone.toLowerCase().includes(term))
        );
    }, [settings.salesAdvisors, advisorSearch]);

    const handleSaveAdvisor = async () => {
        if (!advisorFormData.name?.trim()) {
            addNotification({ title: 'Nombre Obligatorio', body: 'Ingresa el nombre del asesor de venta.', type: 'warning' });
            return;
        }

        setIsProcessing(true);
        try {
            const currentAdvisors: SalesAdvisor[] = Array.isArray(settings.salesAdvisors) ? [...settings.salesAdvisors] : [];
            
            if (advisorEditing) {
                const updated = currentAdvisors.map(a => a.id === advisorEditing.id ? {
                    ...a,
                    name: advisorFormData.name!.trim(),
                    phone: advisorFormData.phone?.trim() || '',
                    branchId: Number(advisorFormData.branchId) || 0,
                    commissionRate: Number(advisorFormData.commissionRate) || 0,
                    active: advisorFormData.active !== undefined ? advisorFormData.active : true
                } : a);
                await updateSettings({ salesAdvisors: updated });
                addNotification({ title: 'Asesor Actualizado', body: `Datos de ${advisorFormData.name} guardados.`, type: 'success' });
            } else {
                const newAdvisor: SalesAdvisor = {
                    id: generateId(),
                    name: advisorFormData.name.trim(),
                    phone: advisorFormData.phone?.trim() || '',
                    branchId: Number(advisorFormData.branchId) || 0,
                    commissionRate: Number(advisorFormData.commissionRate) || 0,
                    active: true,
                    createdAt: Date.now()
                };
                await updateSettings({ salesAdvisors: [...currentAdvisors, newAdvisor] });
                addNotification({ title: 'Asesor Registrado', body: `${newAdvisor.name} ya está disponible en el POS para las cajeras.`, type: 'success' });
            }

            setAdvisorFormData({ name: '', phone: '', branchId: 0, commissionRate: 0, active: true });
            setAdvisorEditing(null);
        } catch (error: any) {
            addNotification({ title: 'Error', body: error.message || 'No se pudo guardar el asesor.', type: 'warning' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteAdvisor = async (id: string, name: string) => {
        if (window.confirm(`¿Estás seguro de eliminar al asesor ${name}? Sus ventas históricas se mantendrán registradas en reportes.`)) {
            try {
                const currentAdvisors: SalesAdvisor[] = Array.isArray(settings.salesAdvisors) ? settings.salesAdvisors : [];
                const filtered = currentAdvisors.filter(a => a.id !== id);
                await updateSettings({ salesAdvisors: filtered });
                addNotification({ title: 'Asesor Eliminado', body: `${name} fue retirado de la lista de asesores.`, type: 'info' });
            } catch (e: any) {
                addNotification({ title: 'Error', body: 'No se pudo eliminar el asesor.', type: 'warning' });
            }
        }
    };

    const handleToggleAdvisorActive = async (advisor: SalesAdvisor) => {
        try {
            const currentAdvisors: SalesAdvisor[] = Array.isArray(settings.salesAdvisors) ? settings.salesAdvisors : [];
            const updated = currentAdvisors.map(a => a.id === advisor.id ? { ...a, active: !a.active } : a);
            await updateSettings({ salesAdvisors: updated });
            addNotification({
                title: advisor.active ? 'Asesor Inactivo' : 'Asesor Activo',
                body: `${advisor.name} ${advisor.active ? 'ya no aparecerá en el selector de caja' : 'ahora aparecerá en el selector de caja'}.`,
                type: 'info'
            });
        } catch (e: any) {
            addNotification({ title: 'Error', body: 'No se pudo cambiar el estado.', type: 'warning' });
        }
    };

    const startEditAdvisor = (advisor: SalesAdvisor) => {
        setAdvisorEditing(advisor);
        setAdvisorFormData({
            name: advisor.name,
            phone: advisor.phone || '',
            branchId: advisor.branchId || 0,
            commissionRate: advisor.commissionRate || 0,
            active: advisor.active
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        if (!formData.name || !formData.username) {
            addNotification({ title: 'Campos Incompletos', body: 'Nombre y usuario son obligatorios.', type: 'warning' });
            return;
        }

        if (formData.username.includes(' ')) {
            addNotification({ title: 'Formato Inválido', body: 'El usuario no puede tener espacios.', type: 'warning' });
            return;
        }
        
        if (!isEditing && !formData.password) {
            addNotification({ title: 'Seguridad', body: 'Debes asignar una contraseña inicial.', type: 'warning' });
            return;
        }

        if (formData.password && formData.password.length < 6) {
            addNotification({ title: 'Contraseña Débil', body: 'La contraseña debe tener al menos 6 caracteres.', type: 'warning' });
            return;
        }

        setIsProcessing(true);

        try {
            const userData: UserAccount = {
                id: isEditing ? isEditing.id : generateId(),
                name: formData.name || 'Nuevo Usuario',
                username: formData.username || '',
                password: formData.password || (isEditing ? isEditing.password : ''), 
                role: (formData.role as 'admin' | 'seller') || 'seller',
                permissions: formData.role === 'admin' ? [] : (formData.permissions || []),
                assignedBranchId: (formData.role === 'seller' ? Number(formData.assignedBranchId) : undefined),
                commissionRate: formData.commissionRate !== undefined ? Number(formData.commissionRate) : 0,
                active: true,
                createdAt: isEditing ? isEditing.createdAt : Date.now()
            };

            if (isEditing) {
                await updateUser(userData);
                if (formData.password) {
                    addNotification({ title: 'Contraseña Actualizada', body: `Acceso renovado para ${userData.name}.`, type: 'success' });
                } else {
                    addNotification({ title: 'Usuario Actualizado', body: `Datos de ${userData.name} guardados.`, type: 'success' });
                }
            } else {
                await addUser(userData);
                addNotification({ title: 'Usuario Creado', body: `${userData.name} ha sido registrado exitosamente.`, type: 'success' });
            }
            
            setFormData({ name: '', username: '', password: '', role: 'seller', commissionRate: 0, permissions: ['dashboard', 'pos', 'checkout_authorized', 'orders', 'products_view'], assignedBranchId: 0 });
            setIsEditing(null);
            
        } catch (error: any) {
            console.error("Error saving user:", error);
            addNotification({ 
                title: 'Error de Guardado', 
                body: error.message || "No se pudo procesar la solicitud.", 
                type: 'warning' 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if(window.confirm(`¿Estás seguro de eliminar a ${name} permanentemente?`)) {
            try {
                await deleteUser(id);
                addNotification({ title: 'Usuario Eliminado', body: `Se ha revocado el acceso a ${name}.`, type: 'info' });
            } catch (e: any) {
                addNotification({ title: 'Error', body: 'No se pudo eliminar el usuario.', type: 'warning' });
            }
        }
    };

    const startEdit = (user: UserAccount) => {
        setIsEditing(user);
        setFormData({ 
            ...user, 
            password: '', 
            commissionRate: user.commissionRate || 0,
            permissions: user.permissions || ['dashboard', 'pos', 'checkout_authorized', 'orders', 'products_view'],
            assignedBranchId: user.assignedBranchId || 0
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const togglePermission = (moduleId: string) => {
        setFormData(prev => {
            const current = prev.permissions || [];
            if (current.includes(moduleId)) {
                return { ...prev, permissions: current.filter(p => p !== moduleId) };
            } else {
                return { ...prev, permissions: [...current, moduleId] };
            }
        });
    };

    const filteredUsers = useMemo(() => {
        const list = Array.isArray(settings.users) ? settings.users : [];
        if (!userSearch) return list;
        return list.filter(u => 
            u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
            u.username.toLowerCase().includes(userSearch.toLowerCase())
        );
    }, [settings.users, userSearch]);

    // --- GESTIÓN DE LOGS ---
    const handleRefreshLogs = async () => {
        setIsRefreshingLogs(true);
        await refreshStoreData();
        setTimeout(() => setIsRefreshingLogs(false), 500);
    };

    const getActionIcon = (action: string) => {
        switch(action) {
            case 'login': return <LogIn size={14} className="text-blue-500"/>;
            case 'sale': return <ShoppingBag size={14} className="text-green-500"/>;
            case 'create_product': return <Plus size={14} className="text-purple-500"/>;
            case 'update_product': return <Edit2 size={14} className="text-orange-500"/>;
            case 'delete_product': return <Trash2 size={14} className="text-red-500"/>;
            case 'update_settings': return <Settings size={14} className="text-gray-500"/>;
            default: return <FileText size={14} className="text-gray-400"/>;
        }
    };

    const formatActionText = (action: string) => {
        switch(action) {
            case 'login': return 'Inicio de Sesión';
            case 'sale': return 'Nueva Venta';
            case 'create_product': return 'Creó Producto';
            case 'update_product': return 'Editó Producto';
            case 'delete_product': return 'Eliminó Item';
            case 'create_user': return 'Gestión Usuarios';
            case 'update_settings': return 'Configuración';
            default: return action;
        }
    };

    const handleClearLogs = () => {
        if(window.confirm('¿Estás seguro de que quieres borrar TODO el historial de actividad? Esta acción no se puede deshacer.')) {
            clearLogs();
            addNotification({ title: 'Historial Limpio', body: 'Se han borrado todos los registros de actividad.', type: 'info' });
        }
    };

    const filteredLogs = useMemo(() => {
        let result = logs || [];
        if (logUserFilter !== 'all') {
            result = result.filter(l => l.userId === logUserFilter);
        }
        if (logActionFilter !== 'all') {
            result = result.filter(l => l.action === logActionFilter);
        }
        if (logSearch) {
            const term = logSearch.toLowerCase();
            result = result.filter(l => 
                l.details.toLowerCase().includes(term) || 
                l.userName.toLowerCase().includes(term)
            );
        }
        return result;
    }, [logs, logUserFilter, logActionFilter, logSearch]);

    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const viewUserHistory = (userId: string) => {
        setLogUserFilter(userId);
        setViewMode('logs');
        setLogActionFilter('all');
        setLogSearch('');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header y Navegación */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <Users className="text-ios-blue"/> Equipo de Trabajo
                </h2>
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl w-full sm:w-auto gap-1">
                    <button 
                        onClick={() => setViewMode('users')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'users' ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <ShieldCheck size={14}/> Cajeras / Acceso Sistema
                        {Array.isArray(settings.users) && settings.users.length > 0 && (
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-600 px-1.5 py-0.2 rounded-full font-black">
                                {settings.users.length}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => setViewMode('advisors')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'advisors' ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <UserCheck size={14}/> Asesores (Sin Clave)
                        {Array.isArray(settings.salesAdvisors) && settings.salesAdvisors.length > 0 && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded-full font-black">
                                {settings.salesAdvisors.length}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => { setViewMode('logs'); setLogUserFilter('all'); }}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'logs' ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <History size={14}/> Actividad
                    </button>
                </div>
            </div>

            {/* TAB 1: ASESORES DE VENTA (SIN CLAVE / SIN LOGIN) */}
            {viewMode === 'advisors' && (
                <div className="space-y-6">
                    {/* Banner Informativo Explicando la Dinámica de Asesores vs Cajeras */}
                    <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-transparent border border-blue-200/50 dark:border-blue-900/30 p-4 sm:p-5 rounded-2xl flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue flex items-center justify-center shrink-0 mt-0.5">
                            <UserCheck size={20} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-sm text-ios-text dark:text-white flex items-center gap-2">
                                Asesores de Venta
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                                    Sin necesidad de contraseña
                                </span>
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                Los asesores atienden y asesoran a los clientes en tienda. <strong>No necesitan credenciales ni acceso al sistema</strong>. 
                                Las cajeras los seleccionan directamente en el Punto de Venta (POS) al momento de cobrar, asociándoles la venta, sus comisiones (opcionales) y sumando puntos para el ranking del <strong>Mejor Vendedor</strong> en Estadísticas.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Formulario de Creación/Edición de Asesor */}
                        <div className="lg:col-span-1 order-2 lg:order-1">
                            <Card className="p-6 space-y-4 sticky top-6">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <UserCheck size={16} className="text-ios-blue"/>
                                        {advisorEditing ? 'Editar Asesor' : 'Nuevo Asesor'}
                                    </h3>
                                    {advisorEditing && (
                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                            Editando
                                        </span>
                                    )}
                                </div>

                                <Input 
                                    label="Nombre Completo" 
                                    value={advisorFormData.name || ''} 
                                    onChange={e => setAdvisorFormData({ ...advisorFormData, name: e.target.value })} 
                                    placeholder="Ej: Carlos Gómez" 
                                />

                                <Input 
                                    label="Teléfono / WhatsApp (Opcional)" 
                                    value={advisorFormData.phone || ''} 
                                    onChange={e => setAdvisorFormData({ ...advisorFormData, phone: e.target.value })} 
                                    placeholder="Ej: +58 412 1234567" 
                                />

                                {/* Sede Asignada */}
                                <div>
                                    <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 block mb-1.5 flex items-center gap-1">
                                        <Store size={14}/> Sede de Trabajo
                                    </label>
                                    <select 
                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm dark:text-white outline-none focus:border-ios-blue font-medium"
                                        value={advisorFormData.branchId || 0}
                                        onChange={e => setAdvisorFormData({ ...advisorFormData, branchId: Number(e.target.value) })}
                                    >
                                        <option value={0}>Todas las Sedes / General</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Porcentaje de Comisión Opcional */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 block">
                                            % Comisión por Venta (Opcional)
                                        </label>
                                        {(advisorFormData.commissionRate !== undefined && Number(advisorFormData.commissionRate) > 0) ? (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                                {advisorFormData.commissionRate}% Activa
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-gray-400">
                                                0% (Sin comisión)
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={advisorFormData.commissionRate ?? ''}
                                            onChange={e => setAdvisorFormData({ ...advisorFormData, commissionRate: parseFloat(e.target.value) || 0 })}
                                            placeholder="0% (Opcional - dejar en 0 si no percibe comisión)"
                                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm dark:text-white outline-none focus:border-ios-blue transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1.5">
                                        Opcional. Si se deja en 0%, el asesor competirá en el ranking de ventas y se le atribuirán sus tickets sin generar comisiones monetarias.
                                    </p>
                                </div>

                                <div className="pt-2 flex gap-2">
                                    {advisorEditing && (
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => { 
                                                setAdvisorEditing(null); 
                                                setAdvisorFormData({ name: '', phone: '', branchId: 0, commissionRate: 0, active: true }); 
                                            }} 
                                            className="flex-1"
                                        >
                                            Cancelar
                                        </Button>
                                    )}
                                    <Button onClick={handleSaveAdvisor} loading={isProcessing} className="flex-1 gap-2">
                                        {advisorEditing ? <Check size={18}/> : <Plus size={18}/>} 
                                        {advisorEditing ? 'Actualizar' : 'Registrar Asesor'}
                                    </Button>
                                </div>
                            </Card>
                        </div>

                        {/* Lista de Asesores */}
                        <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
                            {/* Buscador de Asesores */}
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-white/5 flex gap-3 items-center mb-4">
                                <Search size={18} className="text-gray-400 ml-2"/>
                                <input 
                                    placeholder="Buscar asesor por nombre o teléfono..." 
                                    value={advisorSearch}
                                    onChange={e => setAdvisorSearch(e.target.value)}
                                    className="flex-1 bg-transparent outline-none text-sm dark:text-white font-medium"
                                />
                                {advisorSearch && <button onClick={() => setAdvisorSearch('')}><X size={16} className="text-gray-400"/></button>}
                            </div>

                            {filteredAdvisors.length === 0 ? (
                                <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-white/5 p-8">
                                    <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-ios-blue flex items-center justify-center mx-auto mb-3">
                                        <UserCheck size={32}/>
                                    </div>
                                    <h4 className="font-bold text-gray-700 dark:text-gray-200">No hay asesores registrados</h4>
                                    <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                                        Registra aquí a los asesores para que las cajeras puedan seleccionarlos al cobrar en el POS.
                                    </p>
                                </div>
                            ) : (
                                filteredAdvisors.map(advisor => {
                                    const assignedBranchName = advisor.branchId 
                                        ? branches.find(b => b.id === advisor.branchId)?.name 
                                        : 'Todas las Sedes';

                                    return (
                                        <div 
                                            key={advisor.id} 
                                            className={`bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                                advisor.active === false 
                                                    ? 'opacity-60 border-gray-200 dark:border-white/5 bg-gray-50/50' 
                                                    : 'border-gray-100 dark:border-white/5 hover:shadow-lg'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-500/20 transition-transform group-hover:scale-105">
                                                    {advisor.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-lg text-ios-text dark:text-white">
                                                            {advisor.name}
                                                        </h4>
                                                        {advisor.active === false && (
                                                            <span className="text-[10px] bg-gray-200 dark:bg-white/10 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                                                                Inactivo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2.5 text-xs text-gray-500 mt-1 flex-wrap">
                                                        <span className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md font-semibold border border-emerald-100 dark:border-emerald-800/30">
                                                            <UserCheck size={12}/> Asesor
                                                        </span>

                                                        {advisor.phone && (
                                                            <span className="flex items-center gap-1 text-[11px] text-gray-500 font-mono">
                                                                <Phone size={11}/> {advisor.phone}
                                                            </span>
                                                        )}

                                                        <span className="flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 px-2 py-0.5 rounded-md font-medium">
                                                            <Store size={11}/> {assignedBranchName}
                                                        </span>

                                                        {(advisor.commissionRate !== undefined && Number(advisor.commissionRate) > 0) ? (
                                                            <span className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-md font-bold">
                                                                <Percent size={11}/> {advisor.commissionRate}% Com.
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400">
                                                                Sin comisión
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 border-t sm:border-t-0 border-gray-100 dark:border-white/5 pt-3 sm:pt-0">
                                                <button 
                                                    onClick={() => handleToggleAdvisorActive(advisor)} 
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                                        advisor.active !== false 
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100' 
                                                            : 'bg-gray-100 dark:bg-white/10 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                                    title={advisor.active !== false ? "Desactivar asesor" : "Activar asesor"}
                                                >
                                                    <Power size={13} /> {advisor.active !== false ? 'Activo' : 'Inactivo'}
                                                </button>
                                                <button 
                                                    onClick={() => startEditAdvisor(advisor)} 
                                                    className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl text-gray-400 hover:text-ios-blue transition-colors"
                                                    title="Editar datos del asesor"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteAdvisor(advisor.id, advisor.name)} 
                                                    className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar asesor"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CAJERAS Y USUARIOS DEL SISTEMA (CON LOGIN Y CONTRASEÑA) */}
            {viewMode === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulario de Creación/Edición */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <Card className="p-6 space-y-4 sticky top-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest">
                                    {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </h3>
                                {isEditing && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Editando</span>}
                            </div>
                            
                            <Input label="Nombre Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                            <Input label="Usuario (Login)" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.replace(/\s/g, '')})} placeholder="Ej: juan.perez" />
                            <Input label="Contraseña" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={isEditing ? "(Dejar en blanco para mantener)" : "Clave de acceso"} />
                            
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 block">% Comisión por Venta (Opcional)</label>
                                    {(formData.commissionRate !== undefined && formData.commissionRate > 0) ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Activa</span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-gray-400">Sin comisión</span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={formData.commissionRate ?? ''}
                                        onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                                        placeholder="0% (Opcional - dejar en 0 si no percibe comisión)"
                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm dark:text-white outline-none focus:border-ios-blue transition-all font-bold"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Opcional. Si se deja en 0, el asesor registrará ventas en POS y competirá en el ranking sin generar comisiones monetarias.</p>
                            </div>
                            
                            <div>
                                <label className="text-xs font-semibold text-ios-subtext uppercase ml-1 block mb-2">Rol / Permisos</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setFormData({...formData, role: 'seller'})}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${formData.role === 'seller' ? 'bg-ios-blue text-white border-ios-blue' : 'bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10'}`}
                                    >
                                        Vendedor
                                    </button>
                                    <button 
                                        onClick={() => setFormData({...formData, role: 'admin'})}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${formData.role === 'admin' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10'}`}
                                    >
                                        Admin
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 mb-4">
                                    {formData.role === 'admin' 
                                        ? 'Acceso total a todos los módulos y configuración.' 
                                        : 'Selecciona los módulos a los que tendrá acceso:'}
                                </p>

                                {/* SELECTOR DE PERMISOS GRANULARES PARA VENDEDORES */}
                                {formData.role === 'seller' && (
                                    <div className="space-y-4">
                                        {/* Selector de Sede Asignada */}
                                        <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20">
                                            <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-2 flex items-center gap-1">
                                                <Store size={14}/> Sede Asignada
                                            </label>
                                            <select 
                                                className="w-full bg-white dark:bg-black/20 border border-orange-200 dark:border-orange-900/30 rounded-lg px-2 py-2 text-sm dark:text-white outline-none"
                                                value={formData.assignedBranchId || 0}
                                                onChange={e => setFormData({...formData, assignedBranchId: Number(e.target.value)})}
                                            >
                                                <option value={0}>Sin Restricción (Todas)</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-orange-500/80 mt-1">Si seleccionas una sede, el vendedor solo verá stock y pedidos de esa ubicación.</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                            {AVAILABLE_MODULES.map(mod => (
                                                <button 
                                                    key={mod.id}
                                                    onClick={() => togglePermission(mod.id)}
                                                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-all ${formData.permissions?.includes(mod.id) ? 'bg-white dark:bg-black/20 text-ios-blue shadow-sm border border-ios-blue/20' : 'text-gray-500 hover:bg-white dark:hover:bg-white/10'}`}
                                                >
                                                    <span>{mod.label}</span>
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.permissions?.includes(mod.id) ? 'bg-ios-blue border-ios-blue' : 'border-gray-300 dark:border-white/20'}`}>
                                                        {formData.permissions?.includes(mod.id) && <Check size={10} className="text-white"/>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex gap-2">
                                {isEditing && <Button variant="secondary" onClick={() => { setIsEditing(null); setFormData({ name: '', username: '', password: '', role: 'seller', permissions: ['dashboard', 'pos', 'orders'], assignedBranchId: 0 }); }} className="flex-1">Cancelar</Button>}
                                <Button onClick={handleSave} loading={isProcessing} className="flex-1 gap-2">
                                    {isEditing ? <Check size={18}/> : <Plus size={18}/>} {isEditing ? 'Actualizar' : 'Crear'}
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Lista de Usuarios */}
                    <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
                        {/* Buscador de Usuarios */}
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-white/5 flex gap-3 items-center mb-4">
                            <Search size={18} className="text-gray-400 ml-2"/>
                            <input 
                                placeholder="Buscar usuario..." 
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                className="flex-1 bg-transparent outline-none text-sm dark:text-white font-medium"
                            />
                            {userSearch && <button onClick={() => setUserSearch('')}><X size={16} className="text-gray-400"/></button>}
                        </div>

                        {filteredUsers.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <Users size={40} className="mx-auto mb-2 text-gray-300"/>
                                <p>No se encontraron usuarios.</p>
                            </div>
                        ) : (
                            filteredUsers.map(user => {
                                const assignedBranchName = user.assignedBranchId 
                                    ? branches.find(b => b.id === user.assignedBranchId)?.name 
                                    : 'Acceso Total';

                                return (
                                    <div key={user.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[1.5rem] border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-lg transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg transition-transform group-hover:scale-110 ${user.role === 'admin' ? 'bg-purple-500 shadow-purple-500/30' : 'bg-ios-blue shadow-blue-500/30'}`}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-ios-text dark:text-white flex items-center gap-2">
                                                    {user.name} 
                                                    {user.id === currentUser?.id && <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Tú</span>}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                                    <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">@{user.username}</span>
                                                    <span className="flex items-center gap-1"><ShieldCheck size={10}/> {user.role === 'admin' ? 'Administrador' : 'Vendedor'}</span>
                                                    {(user.commissionRate !== undefined && user.commissionRate > 0) && (
                                                        <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black border border-emerald-200 dark:border-emerald-800/40">
                                                            %{user.commissionRate} Comisión
                                                        </span>
                                                    )}
                                                    {user.role === 'seller' && (
                                                        <>
                                                            <span className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                                                <Lock size={10}/> {(user.permissions || []).length} Módulos
                                                            </span>
                                                            {user.assignedBranchId ? (
                                                                <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                                                    <Store size={10}/> {assignedBranchName}
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                                    <Globe size={10}/> Global
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 border-t sm:border-t-0 border-gray-100 dark:border-white/5 pt-3 sm:pt-0">
                                            <button onClick={() => viewUserHistory(user.id)} className="px-3 py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-2">
                                                <History size={14} /> Historial
                                            </button>
                                            <button onClick={() => startEdit(user)} className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl text-gray-400 hover:text-ios-blue transition-colors">
                                                <Edit2 size={18} />
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button onClick={() => handleDeleteUser(user.id, user.name)} className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-gray-400 hover:text-red-500 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: HISTORIAL DE ACTIVIDAD */}
            {viewMode === 'logs' && (
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-white/5 h-full flex flex-col">
                    {/* Header de Logs */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-white/5">
                        <div>
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <Clock size={20} className="text-ios-blue"/> Historial de Actividad
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {logUserFilter !== 'all' 
                                    ? `Mostrando actividad filtrada del usuario.` 
                                    : `Registro global de eventos del sistema.`}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                            <button onClick={handleRefreshLogs} className={`p-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl transition-all ${isRefreshingLogs ? 'animate-spin' : ''}`} title="Actualizar Logs">
                                <RefreshCw size={16} />
                            </button>
                            {userRole === 'admin' && (
                                <button onClick={handleClearLogs} className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-colors" title="Limpiar Historial Completo">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            {logUserFilter !== 'all' && (
                                <button onClick={() => setLogUserFilter('all')} className="px-3 py-2 bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
                                    <X size={14}/> Quitar filtro
                                </button>
                            )}
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                <select value={logActionFilter} onChange={e => { setLogActionFilter(e.target.value); setCurrentPage(1); }} className="w-full sm:w-40 pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-ios-blue/10 dark:text-white appearance-none cursor-pointer">
                                    <option value="all">Todas las Acciones</option>
                                    <option value="login">Inicios de Sesión</option>
                                    <option value="sale">Ventas</option>
                                    <option value="create_product">Creación Productos</option>
                                    <option value="update_product">Edición Productos</option>
                                    <option value="update_settings">Configuración</option>
                                </select>
                            </div>
                            <div className="relative flex-1 sm:flex-none">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                <input placeholder="Buscar en logs..." value={logSearch} onChange={e => { setLogSearch(e.target.value); setCurrentPage(1); }} className="w-full sm:w-48 pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 dark:text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Timeline de Logs */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {paginatedLogs.length > 0 ? paginatedLogs.map((log, idx) => (
                            <div key={idx} className="flex gap-4 group">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border-2 border-gray-100 dark:border-white/10 flex items-center justify-center z-10 shadow-sm">
                                        {getActionIcon(log.action)}
                                    </div>
                                    {idx !== paginatedLogs.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-white/5 my-1"></div>}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl hover:bg-white dark:hover:bg-white/10 hover:shadow-md transition-all border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-700 dark:text-white uppercase">{formatActionText(log.action)}</p>
                                            <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{log.details}</p>
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200/50 dark:border-white/5">
                                            <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-white/20 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-white">
                                                {log.userName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">{log.userName}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 uppercase">{log.userRole}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-20 text-gray-400">
                                <AlertOctagon size={40} className="mx-auto mb-2 opacity-20"/>
                                <p>No se encontraron eventos con los filtros actuales.</p>
                            </div>
                        )}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Página {currentPage} de {totalPages}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                    <ChevronLeft size={16} className="dark:text-white"/>
                                </button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                    <ChevronRight size={16} className="dark:text-white"/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
