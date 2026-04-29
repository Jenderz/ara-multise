
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Button } from '../UIComponents';
import { UserAccount, ActivityLog, Branch } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useNotification } from '../../context/NotificationContext';
import { generateId } from './Shared';
import { 
    Users, Plus, Trash2, Edit2, ShieldCheck, Check, History, Clock, 
    Search, Filter, ChevronLeft, ChevronRight, X, LogIn, ShoppingBag, 
    Package, Settings, AlertOctagon, FileText, Lock, RefreshCw, Store, Globe
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
    const { settings, addUser, updateUser, deleteUser, currentUser, logs, clearLogs, userRole, refreshStoreData, branches } = useStore();
    const { addNotification } = useNotification();
    
    const [isEditing, setIsEditing] = useState<UserAccount | null>(null);
    const [formData, setFormData] = useState<Partial<UserAccount>>({ 
        name: '', 
        username: '', 
        password: '', 
        role: 'seller',
        assignedBranchId: 0, // 0 = Sin restricción (o no aplica)
        permissions: ['dashboard', 'pos', 'checkout_authorized', 'orders', 'products_view'] 
    });
    const [viewMode, setViewMode] = useState<'users' | 'logs'>('users');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
    
    // --- ESTADOS DE BÚSQUEDA Y FILTRO ---
    const [userSearch, setUserSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [logActionFilter, setLogActionFilter] = useState<string>('all');
    const [logUserFilter, setLogUserFilter] = useState<string>('all'); 
    const [currentPage, setCurrentPage] = useState(1);

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
            
            setFormData({ name: '', username: '', password: '', role: 'seller', permissions: ['dashboard', 'pos', 'checkout_authorized', 'orders', 'products_view'], assignedBranchId: 0 });
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
                <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl w-full sm:w-auto">
                    <button 
                        onClick={() => setViewMode('users')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'users' ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Usuarios
                    </button>
                    <button 
                        onClick={() => { setViewMode('logs'); setLogUserFilter('all'); }}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'logs' ? 'bg-white dark:bg-zinc-800 shadow-sm text-ios-blue' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        <History size={14}/> Actividad
                    </button>
                </div>
            </div>

            {viewMode === 'users' ? (
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
            ) : (
                // ... (Bloque de logs se mantiene igual)
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
