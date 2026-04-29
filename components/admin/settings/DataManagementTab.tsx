
import React, { useState, useRef, useCallback } from 'react';
import { Card, Button } from '../../UIComponents';
import {
    Database, Download, Upload, Check, AlertTriangle, FileJson,
    Loader2, HardDrive, ShieldCheck, Server, RefreshCw, FileText,
    Terminal, ArrowRight, Save, Trash2, CheckCircle2
} from 'lucide-react';
import { api } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { useStore } from '../../../context/StoreContext';

// Tipos para el análisis del respaldo
interface BackupStats {
    products: number;
    categories: number;
    orders: number;
    customers: number;
    inventory: number;
    movements: number;
    hasSettings: boolean;
    version: string;
    size: string;
    timestamp: number;
}

export const DataManagementTab = () => {
    const { refreshStoreData } = useStore();
    const { addNotification } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados de UI
    const [mode, setMode] = useState<'idle' | 'analyzing' | 'importing' | 'exporting'>('idle');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    // Estado de Archivo Cargado
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [backupAnalysis, setBackupAnalysis] = useState<BackupStats | null>(null);
    const [backupData, setBackupData] = useState<any>(null);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-4), `> ${msg}`]);
    };

    // --- 1. EXPORTACIÓN INTELIGENTE (Secuencial) ---
    const handleSmartBackup = async () => {
        setMode('exporting');
        setProgress(0);
        setLogs([]);
        addLog("Iniciando secuencia de respaldo...");

        try {
            // Paso 1: Configuración
            setStatusText("Descargando Configuración...");
            const settingsData = await api.getSettings();
            setProgress(10);
            addLog("Configuración obtenida.");

            // Paso 2: Datos Completos
            setStatusText("Sincronizando Base de Datos completa...");
            const fullData = await api.getAllData();
            setProgress(60);

            // Paso 3: Movimientos (Opcional, pero recomendado)
            setStatusText("Obteniendo historial de auditoría...");
            const history = await api.getMovements(1000); // Límite razonable
            setProgress(80);

            // Construir Payload Final
            const backupPayload = {
                meta: {
                    version: "4.1.0",
                    timestamp: Date.now(),
                    origin: window.location.origin,
                    type: "full_backup_smart",
                    generator: "Lyberate_UI"
                },
                data: {
                    settings: settingsData?.settings || fullData.settings,
                    products: fullData.products || [],
                    categories: fullData.categories || [],
                    orders: fullData.orders || [],
                    customers: fullData.customers || [],
                    product_movements: history || [] // Incluir historial
                }
            };

            setProgress(95);
            setStatusText("Generando archivo JSON...");

            // Descargar
            const jsonString = JSON.stringify(backupPayload, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `Lyberate_Backup_${new Date().toISOString().split('T')[0]}_v4.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setProgress(100);
            addLog("Archivo generado y descargado.");
            addNotification({ title: 'Respaldo Exitoso', body: 'Tus datos están seguros.', type: 'success' });

        } catch (e: any) {
            console.error(e);
            addLog(`ERROR: ${e.message}`);
            addNotification({ title: 'Error de Respaldo', body: 'Falló la conexión con el servidor.', type: 'warning' });
        } finally {
            setTimeout(() => {
                setMode('idle');
                setProgress(0);
            }, 2000);
        }
    };

    // --- 2. ANÁLISIS PRE-IMPORTACIÓN (ADAPTADOR LEGACY) ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        analyzeFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        // Permitir txt o json porque el usuario a veces guarda como txt
        if (file && (file.type === "application/json" || file.type === "text/plain" || file.name.endsWith('.json'))) {
            analyzeFile(file);
        } else {
            addNotification({ title: 'Formato Incorrecto', body: 'Solo se permiten archivos .json', type: 'warning' });
        }
    };

    const analyzeFile = (file: File) => {
        setMode('analyzing');
        setStatusText("Analizando estructura del archivo...");
        setLogs([]);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const content = evt.target?.result as string;
                // Limpieza básica por si el archivo tiene basura al inicio
                const cleanContent = content.trim();
                const json = JSON.parse(cleanContent);

                // --- ADAPTADOR ESTRUCTURAL INTELIGENTE ---
                let normalizedData: any = {};
                let metaInfo: any = {};

                if (json.data && json.meta) {
                    // Estructura V4 Nueva
                    normalizedData = json.data;
                    metaInfo = json.meta;
                    addLog("Formato V4 detectado.");
                } else if (Array.isArray(json.products) || Array.isArray(json.settings)) {
                    // Estructura Legacy (Raíz plana)
                    normalizedData = json;
                    metaInfo = { version: "Legacy", timestamp: Date.now() };
                    addLog("Formato Legacy detectado. Adaptando...");
                } else {
                    throw new Error("Formato desconocido.");
                }

                const stats: BackupStats = {
                    products: normalizedData.products?.length || 0,
                    categories: normalizedData.categories?.length || 0,
                    orders: normalizedData.orders?.length || 0,
                    customers: normalizedData.customers?.length || 0,
                    inventory: normalizedData.inventory?.length || 0,
                    movements: normalizedData.product_movements?.length || 0,
                    hasSettings: !!normalizedData.settings,
                    version: metaInfo.version || 'Unknown',
                    size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    timestamp: metaInfo.timestamp || 0
                };

                setBackupAnalysis(stats);
                setBackupData(normalizedData);
                setPendingFile(file);
                addLog("Análisis completado. Esperando confirmación.");

            } catch (err: any) {
                console.error(err);
                addLog(`Error: ${err.message}`);
                addNotification({ title: 'Archivo Corrupto', body: 'El JSON no es válido o tiene errores de sintaxis.', type: 'warning' });
                setPendingFile(null);
            } finally {
                setMode('idle');
            }
        };
        reader.readAsText(file);
    };

    // --- 3. EJECUCIÓN DE RESTAURACIÓN (Batching Real) ---
    const executeRestore = async () => {
        if (!backupData) return;
        setMode('importing');
        setLogs([]);
        setProgress(0);

        try {
            const { products, categories, orders, customers, settings, inventory, product_movements } = backupData;

            // Colas de trabajo Priorizadas
            const queues = [
                { type: 'categories', items: categories || [], label: 'Categorías' },
                { type: 'products', items: products || [], label: 'Productos' },
                { type: 'inventory', items: inventory || [], label: 'Inventario (Stock Real)' },
                { type: 'product_movements', items: product_movements || [], label: 'Historial Movimientos' },
                { type: 'customers', items: customers || [], label: 'Clientes' },
                { type: 'orders', items: orders || [], label: 'Pedidos' },
            ];

            // Calcular total de operaciones
            let totalOps = queues.reduce((acc, q) => acc + q.items.length, 0);
            if (settings) totalOps += 1;

            let processedOps = 0;

            // 1. Restaurar Configuración
            if (settings) {
                setStatusText("Restaurando Configuración...");
                // Si settings es array (formato legacy), convertirlo a objeto
                let settingsObj = settings;
                if (Array.isArray(settings)) {
                    settingsObj = {};
                    settings.forEach((s: any) => {
                        if (s.setting_key) settingsObj[s.setting_key] = s.setting_value;
                    });
                }

                await api.saveSettings(settingsObj);
                processedOps++;
                addLog("Configuración aplicada.");
            }

            // 2. Procesar Lotes
            const BATCH_SIZE = 50;

            for (const queue of queues) {
                if (queue.items.length === 0) continue;

                addLog(`Iniciando ${queue.label} (${queue.items.length} items)...`);

                for (let i = 0; i < queue.items.length; i += BATCH_SIZE) {
                    const chunk = queue.items.slice(i, i + BATCH_SIZE);

                    setStatusText(`Importando ${queue.label}: ${i + chunk.length} / ${queue.items.length}`);

                    // @ts-ignore
                    await api.importBatch(queue.type, chunk);

                    processedOps += chunk.length;
                    const percent = Math.round((processedOps / totalOps) * 100);
                    setProgress(percent);

                    // Breve pausa para no bloquear el hilo principal de UI
                    await new Promise(r => setTimeout(r, 20));
                }
                addLog(`${queue.label} completado.`);
            }

            setStatusText("Finalizando y recargando...");
            await refreshStoreData();

            addNotification({ title: 'Restauración Completada', body: 'La base de datos ha sido actualizada.', type: 'success' });

            // Reset
            setPendingFile(null);
            setBackupAnalysis(null);
            setBackupData(null);

        } catch (e: any) {
            console.error(e);
            addLog(`ERROR FATAL: ${e.message}`);
            addNotification({ title: 'Fallo Crítico', body: 'Se detuvo la importación.', type: 'warning' });
        } finally {
            setMode('idle');
        }
    };

    const cancelImport = () => {
        setPendingFile(null);
        setBackupAnalysis(null);
        setBackupData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Informativo */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/20 flex flex-col md:flex-row gap-6 items-center">
                <div className="p-4 bg-white dark:bg-white/10 rounded-2xl shadow-sm text-blue-600 dark:text-blue-300">
                    <Database size={32} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 text-xl">Centro de Respaldo Seguro</h3>
                    <p className="text-sm text-blue-700/80 dark:text-blue-200/70 mt-2 max-w-2xl">
                        Gestiona la integridad de tu negocio. Compatible con formatos Legacy y V4.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* --- TARJETA DE EXPORTACIÓN --- */}
                <Card className="p-0 overflow-hidden border-0 shadow-lg flex flex-col h-full">
                    <div className="bg-green-50 dark:bg-green-900/10 p-6 border-b border-green-100 dark:border-green-900/20">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4 shadow-sm">
                            <Download size={24} />
                        </div>
                        <h4 className="text-xl font-bold dark:text-white">Crear Respaldo</h4>
                        <p className="text-sm text-gray-500 mt-1">Descarga un archivo JSON cifrado con toda tu data.</p>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <CheckCircle2 size={16} className="text-green-500" /> Incluye Productos e Inventario
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <CheckCircle2 size={16} className="text-green-500" /> Incluye Historial de Pedidos
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <CheckCircle2 size={16} className="text-green-500" /> Incluye Clientes y Configuración
                            </div>
                        </div>

                        <Button
                            onClick={handleSmartBackup}
                            disabled={mode !== 'idle'}
                            className={`w-full py-4 text-sm font-bold shadow-lg transition-all ${mode === 'exporting' ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 shadow-green-500/30'} text-white`}
                        >
                            {mode === 'exporting' ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 size={18} className="animate-spin" /> Generando archivo...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Save size={18} /> Descargar Copia
                                </div>
                            )}
                        </Button>
                    </div>
                </Card>

                {/* --- TARJETA DE IMPORTACIÓN --- */}
                <Card className="p-0 overflow-hidden border-0 shadow-lg flex flex-col h-full">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 border-b border-blue-100 dark:border-blue-900/20">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-ios-blue dark:text-blue-400 mb-4 shadow-sm">
                            <Upload size={24} />
                        </div>
                        <h4 className="text-xl font-bold dark:text-white">Restaurar Datos</h4>
                        <p className="text-sm text-gray-500 mt-1">Soporta migración de versiones anteriores.</p>
                    </div>

                    <div className="p-6 flex-1 flex flex-col space-y-6">
                        {!pendingFile ? (
                            <div
                                className="flex-1 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 transition-all cursor-pointer flex flex-col items-center justify-center p-8 group"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                <div className="w-16 h-16 bg-white dark:bg-white/10 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                    <FileJson size={28} className="text-gray-400 group-hover:text-ios-blue" />
                                </div>
                                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Haz click o arrastra el archivo aquí</p>
                                <p className="text-xs text-gray-400 mt-1">Soporta archivos .JSON y Legacy</p>
                                <input type="file" ref={fileInputRef} accept=".json,.txt" className="hidden" onChange={handleFileSelect} />
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                {/* Resumen del Análisis */}
                                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-white/10 p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h5 className="font-bold text-sm dark:text-white flex items-center gap-2">
                                                <FileText size={16} className="text-ios-blue" /> {pendingFile.name}
                                            </h5>
                                            <p className="text-xs text-gray-500 mt-0.5">{backupAnalysis?.size} • v{backupAnalysis?.version}</p>
                                        </div>
                                        <button onClick={cancelImport} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                    </div>

                                    {backupAnalysis && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold">Productos</p>
                                                <p className="text-lg font-black dark:text-white">{backupAnalysis.products}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold">Movimientos</p>
                                                <p className="text-lg font-black dark:text-white">{backupAnalysis.movements}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold">Inventario Real</p>
                                                <p className="text-lg font-black dark:text-white">{backupAnalysis.inventory}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-center flex flex-col justify-center items-center">
                                                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Configuración</p>
                                                {backupAnalysis.hasSettings ? <Check size={18} className="text-green-500" /> : <AlertTriangle size={18} className="text-orange-500" />}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {mode === 'importing' ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                                            <span>{statusText}</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-3 overflow-hidden">
                                            <div className="bg-ios-blue h-full transition-all duration-300 ease-out relative" style={{ width: `${progress}%` }}>
                                                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                                            </div>
                                        </div>
                                        {/* Mini Terminal */}
                                        <div className="bg-black/90 rounded-xl p-3 h-24 overflow-y-auto font-mono text-[10px] text-green-400 space-y-1 custom-scrollbar">
                                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                                            <div className="animate-pulse">_</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20 flex gap-3">
                                            <AlertTriangle size={20} className="text-orange-600 shrink-0" />
                                            <p className="text-xs text-orange-700 dark:text-orange-300 leading-tight">
                                                <b>Advertencia:</b> Esta acción fusionará los datos históricos y de inventario.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={executeRestore}
                                            className="w-full py-4 text-sm font-bold bg-ios-blue hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                        >
                                            <ArrowRight size={18} className="mr-2" /> Confirmar Importación
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Barra de Estado Global si hay proceso activo */}
            {(mode === 'exporting' || mode === 'importing') && (
                <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 w-80 animate-slide-up">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin text-ios-blue" />
                            {mode === 'exporting' ? 'Generando Respaldo' : 'Restaurando Datos'}
                        </span>
                        <span className="text-xs font-black text-ios-blue">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-ios-blue h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 truncate">{logs[logs.length - 1] || 'Procesando...'}</p>
                </div>
            )}

            {/* PWA Screenshots Section */}
            <Card className="p-6">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                    <FileJson size={20} className="text-ios-blue" /> PWA Screenshots
                </h4>
                <p className="text-sm text-gray-500 mb-4">Sube las capturas de pantalla para la instalación de la aplicación (PWA).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold block dark:text-gray-300">Desktop Screenshot (1920x1080)</label>
                        <input
                            type="file"
                            accept="image/jpeg,image/png"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const reader = new FileReader();
                                reader.onload = async (evt) => {
                                    try {
                                        const base64 = evt.target?.result as string;
                                        await api.uploadPWAScreenshot(base64, 'desktop.jpg');
                                        addNotification({ title: 'Éxito', body: 'Captura de Desktop actualizada.', type: 'success' });
                                    } catch (err) {
                                        addNotification({ title: 'Error', body: 'Error al subir imagen.', type: 'warning' });
                                    }
                                };
                                reader.readAsDataURL(file);
                            }}
                            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold block dark:text-gray-300">Mobile Screenshot (1080x1920)</label>
                        <input
                            type="file"
                            accept="image/jpeg,image/png"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const reader = new FileReader();
                                reader.onload = async (evt) => {
                                    try {
                                        const base64 = evt.target?.result as string;
                                        await api.uploadPWAScreenshot(base64, 'mobile.jpg');
                                        addNotification({ title: 'Éxito', body: 'Captura Mobile actualizada.', type: 'success' });
                                    } catch (err) {
                                        addNotification({ title: 'Error', body: 'Error al subir imagen.', type: 'warning' });
                                    }
                                };
                                reader.readAsDataURL(file);
                            }}
                            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                </div>
            </Card>

        </div>
    );
};
