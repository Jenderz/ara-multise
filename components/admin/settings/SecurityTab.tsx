import React, { useState, useEffect } from 'react';
import { Card, Input, Button } from '../../UIComponents';
import { ShieldCheck, Users, AlertOctagon, KeyRound, Check, Trash2, Loader2, ListChecks, Lock, Unlock } from 'lucide-react';
import { StoreSettings } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { useNotification } from '../../../context/NotificationContext';
import { api } from '../../../services/api';
import { useDebounce } from '../../../hooks/useDebounce';

// Helper local de Hashing
const hashPassword = async (text: string): Promise<string> => {
    if (!text) return '';
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const FactoryResetModal = ({ isOpen, onClose, onReset, currentUser }: any) => {
    const [step, setStep] = useState<'selection' | 'auth' | 'confirm' | 'processing'>('selection');
    const [selectedOptions, setSelectedOptions] = useState<string[]>(['products', 'orders', 'customers']);
    const [passwordInput, setPasswordInput] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [authError, setAuthError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const optionsList = [
        { id: 'products', label: 'Productos e Inventario' },
        { id: 'categories', label: 'Categorías' },
        { id: 'orders', label: 'Pedidos y Ventas' },
        { id: 'customers', label: 'Base de Clientes' },
        { id: 'branches', label: 'Sedes Adicionales' },
        { id: 'coupons', label: 'Cupones' },
        { id: 'settings', label: 'Configuración General' }
    ];

    const toggleOption = (opt: string) => {
        if (selectedOptions.includes(opt)) setSelectedOptions(prev => prev.filter(o => o !== opt));
        else setSelectedOptions(prev => [...prev, opt]);
    };

    const toggleAll = () => {
        if (selectedOptions.length === optionsList.length) {
            setSelectedOptions([]);
        } else {
            setSelectedOptions(optionsList.map(o => o.id));
        }
    };

    const verifyPassword = async () => {
        if (!passwordInput) {
            setAuthError('La contraseña es requerida.');
            return;
        }

        setIsVerifying(true);
        setAuthError('');
        try {
            const username = currentUser?.username || 'admin';
            const res = await api.login(username, passwordInput);
            if (res && res.status === 'success') {
                setStep('confirm');
                setAuthError('');
            } else {
                setAuthError('Contraseña incorrecta.');
            }
        } catch (e: any) {
            setAuthError('Contraseña incorrecta.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleFinalReset = () => {
        setStep('processing');
        onReset(selectedOptions, setStatusMsg);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-red-900/60 backdrop-blur-md animate-fade-in" onClick={() => step !== 'processing' && onClose()} />
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slide-up border-2 border-red-500/20">
                <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-red-50 dark:bg-red-900/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400"><AlertOctagon size={20} /></div>
                    <div><h3 className="text-xl font-black text-red-600 dark:text-red-400">Restauración de Fábrica</h3></div>
                </div>
                <div className="p-8">
                    {step === 'selection' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-gray-600 dark:text-gray-300">Selecciona los datos a <b className="text-red-500">ELIMINAR</b>:</p>
                                <button onClick={toggleAll} className="text-[10px] font-bold text-ios-blue flex items-center gap-1 hover:underline">
                                    <ListChecks size={12} /> {selectedOptions.length === optionsList.length ? 'Desmarcar Todo' : 'Marcar Todo'}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {optionsList.map(opt => (
                                    <button key={opt.id} onClick={() => toggleOption(opt.id)} className={`p-3 rounded-xl border-2 text-left transition-all ${selectedOptions.includes(opt.id) ? 'border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300' : 'border-gray-200 dark:border-white/10 text-gray-500'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedOptions.includes(opt.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                                {selectedOptions.includes(opt.id) && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs font-bold leading-tight">{opt.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <Button onClick={() => setStep('auth')} disabled={selectedOptions.length === 0} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30">Continuar</Button>
                        </div>
                    )}
                    {step === 'auth' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <KeyRound size={40} className="mx-auto text-gray-300 mb-4" />
                                <h4 className="font-bold text-lg dark:text-white">Autenticación Requerida</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Vuelve a colocar tu contraseña para confirmar.
                                </p>
                            </div>
                            <div>
                                <Input
                                    type="password"
                                    placeholder="Tu contraseña"
                                    value={passwordInput}
                                    onChange={e => setPasswordInput(e.target.value)}
                                    className="text-center tracking-widest font-bold"
                                />
                                {authError && <p className="text-center text-red-500 text-xs mt-2 font-bold">{authError}</p>}
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setStep('selection')} className="flex-1">Atrás</Button>
                                <Button onClick={verifyPassword} disabled={isVerifying} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-black">
                                    {isVerifying ? 'Verificando...' : 'Verificar'}
                                </Button>
                            </div>
                        </div>
                    )}
                    {step === 'confirm' && (
                        <div className="space-y-6 text-center">
                            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-600 animate-pulse border-4 border-red-50 dark:border-red-900/40">
                                <Trash2 size={40} />
                            </div>
                            <div>
                                <h4 className="font-black text-2xl text-red-600 dark:text-red-500 mb-2">¿Estás absolutamente seguro?</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs mx-auto">
                                    Esta acción eliminará permanentemente <b>{selectedOptions.length} módulos</b> seleccionados. <br />
                                    <span className="font-bold">No se puede deshacer.</span>
                                </p>
                                {selectedOptions.includes('settings') && (
                                    <p className="text-xs text-blue-500 font-bold mt-2 bg-blue-50 dark:bg-blue-900/20 py-1 px-2 rounded-lg inline-block">
                                        Nota: Tus usuarios y accesos se mantendrán.
                                    </p>
                                )}
                            </div>
                            <Button onClick={handleFinalReset} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 shadow-xl shadow-red-500/20 text-lg">
                                SI, BORRAR DATOS
                            </Button>
                            <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest">Cancelar operación</button>
                        </div>
                    )}
                    {step === 'processing' && (
                        <div className="py-10 text-center space-y-4">
                            <Loader2 size={50} className="text-red-600 animate-spin mx-auto" />
                            <div>
                                <p className="text-lg font-bold dark:text-white">Restaurando Base de Datos...</p>
                                <p className="text-sm text-gray-400 animate-pulse">{statusMsg || 'Procesando...'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface SecurityTabProps {
    settings: StoreSettings;
    onUpdate: (update: Partial<StoreSettings>) => void;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ settings, onUpdate }) => {
    const { resetStore, currentUser } = useStore();
    const { addNotification } = useNotification();
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    const handleFactoryReset = async (options: string[], setStatus: (m: string) => void) => {
        try {
            setStatus('Limpiando tablas...');
            await resetStore(options, setStatus);
            setStatus('Recargando sistema...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error("Reset failed", error);
            addNotification({ title: 'Error Crítico', body: 'Fallo la restauración. Revisa la consola.', type: 'warning' });
            setIsResetModalOpen(false);
        }
    };

    // --- LOGS VIEWER STATE ---
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 500);

    // Fetch Logs
    useEffect(() => {
        fetchLogs();
    }, [page, debouncedSearch]);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await api.getLogs(page, 50, debouncedSearch);
            setLogs(res.data);
            setTotalPages(res.pagination.pages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingLogs(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-[1.5rem] border border-blue-100 dark:border-blue-900/30 flex gap-4 items-start">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400"><Users size={24} /></div>
                <div>
                    <h3 className="font-bold text-blue-700 dark:text-blue-300 text-lg">Gestión de Usuarios Centralizada</h3>
                    <p className="text-sm text-blue-600/80 dark:text-blue-300/80 mt-1 leading-relaxed">
                        La creación de usuarios, asignación de roles (Admin/Vendedor) y cambio de contraseñas individuales se ha movido al módulo de <b>Equipo</b>.
                    </p>
                    <div className="mt-3 text-xs font-bold text-blue-500 uppercase tracking-wide">Busca la pestaña "Equipo" en el menú principal.</div>
                </div>
            </div>

            <Card className="p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2 dark:text-white"><ShieldCheck size={20} className="text-ios-blue" /> Seguridad del Sistema</h3>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30 flex flex-col justify-between">
                        <div>
                            <h5 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2"><AlertOctagon size={18} /> Zona de Peligro</h5>
                            <p className="text-xs text-red-400 dark:text-red-300 mt-2 mb-4">Aquí puedes restaurar la tienda a su estado original o borrar datos masivamente. Requiere tu contraseña de administrador para confirmar.</p>
                        </div>
                        <Button onClick={() => setIsResetModalOpen(true)} className="md:w-1/2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">
                            Restaurar Fábrica / Borrar Todo
                        </Button>
                    </div>
                </div>
            </Card>

            {/* --- ACTIVITY LOGS VIEWER (SQL PAGINADO) --- */}
            <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="font-bold flex items-center gap-2 dark:text-white"><ListChecks size={20} className="text-ios-blue" /> Registro de Actividad</h3>
                        <p className="text-xs text-gray-500 mt-1">Auditoría de seguridad y acciones del sistema.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            placeholder="Buscar en logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 text-sm"
                        />
                        <Button variant="secondary" onClick={fetchLogs}><Loader2 size={16} className={loadingLogs ? "animate-spin" : ""} /></Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-white/5 text-xs uppercase font-bold text-gray-500 border-b border-gray-100 dark:border-white/5">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Usuario</th>
                                <th className="p-4">Acción</th>
                                <th className="p-4">Detalle</th>
                                <th className="p-4">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loadingLogs ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Cargando registros...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay registros recientes.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-xs font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                    {(log.user_name || '?').charAt(0)}
                                                </div>
                                                <span className="font-bold text-xs">{log.user_name || 'Sistema'}</span>
                                            </div>
                                            <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded ml-8">{log.user_role}</span>
                                        </td>
                                        <td className="p-4"><span className="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-[10px] font-bold uppercase tracking-wide">{log.action}</span></td>
                                        <td className="p-4 max-w-xs truncate text-xs" title={log.details}>{log.details}</td>
                                        <td className="p-4 text-[10px] font-mono text-gray-400">{log.ip_address}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 h-8 text-xs">Anterior</Button>
                        <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 h-8 text-xs">Siguiente</Button>
                    </div>
                </div>
            </Card>

            <FactoryResetModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onReset={handleFactoryReset}
                currentUser={currentUser}
            />
        </div>
    );
};
