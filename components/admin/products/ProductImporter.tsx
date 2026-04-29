
import React, { useState, useRef } from 'react';
import { Button } from '../../UIComponents';
import { FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Upload, X, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../../services/api';
import { generateId } from '../Shared';
import { Category, Product, ProductVariant, VariantOption } from '../../../types';

interface ProductImporterProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingCategories: Category[];
}

export const ProductImporter: React.FC<ProductImporterProps> = ({ isOpen, onClose, onSuccess, existingCategories }) => {
    const [step, setStep] = useState<'upload' | 'processing' | 'result'>('upload');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [stats, setStats] = useState({ total: 0, newCategories: 0, variantsCount: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-5), `> ${msg}`]);
    };

    // --- NORMALIZACIÓN DE CATEGORÍAS ---
    const getCategoryMap = () => {
        const map = new Map<string, string>();
        existingCategories.forEach(c => {
            if (c.name) map.set(c.name.trim().toLowerCase(), c.name.trim());
        });
        return map;
    };

    // --- HELPERS DE PARSEO ---
    const parseBool = (val: any) => {
        if (typeof val === 'string') {
            const v = val.trim().toUpperCase();
            return v === 'S' || v === 'SI' || v === 'YES' || v === 'TRUE' || v === '1';
        }
        return !!val;
    };

    const parseNum = (val: any) => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;

        let s = String(val).trim();
        // Limpiar comillas o basura común en CSVs mal codificados
        s = s.replace(/["']/g, '');

        // Detección inteligente de formato europeo/latino (1.000,00) vs inglés (1,000.00)
        // Si hay punto y coma..
        if (s.includes(',') && s.includes('.')) {
            const lastDot = s.lastIndexOf('.');
            const lastComma = s.lastIndexOf(',');

            // Si el punto está ANTES de la coma (1.200,50), el punto es miles y la coma decimal
            if (lastDot < lastComma) {
                s = s.replace(/\./g, '').replace(',', '.');
            }
            // Si la coma está ANTES del punto (1,200.50), la coma es miles (se elimina sola en el regex final)
        }
        else if (s.includes(',')) {
            // Solo hay coma (12,50). Asumimos decimal.
            s = s.replace(',', '.');
        }

        const clean = s.replace(/[^0-9.-]+/g, "");
        return parseFloat(clean) || 0;
    };

    const cleanHeader = (h: string) => h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    const getVal = (row: any, keys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const k of keys) {
            const cleanK = cleanHeader(k);
            const foundKey = rowKeys.find(rk => cleanHeader(rk) === cleanK);
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
                return String(row[foundKey]).trim();
            }
        }
        return '';
    };

    // Helper específico para parsear "COLORES: ROSA" o "TALLA: L"
    const parseVariantString = (detail: string): Record<string, string> => {
        const selections: Record<string, string> = {};
        if (!detail || detail === 'N/A') return selections;

        const parts = detail.split(',').map(s => s.trim());

        parts.forEach(part => {
            if (part.includes(':')) {
                const [key, val] = part.split(':');
                let cleanKey = key.trim();
                // Normalizaciones comunes
                if (cleanKey.toUpperCase().includes('COLOR')) cleanKey = 'Color';
                else if (cleanKey.toUpperCase().includes('TALLA')) cleanKey = 'Talla';
                else cleanKey = cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).toLowerCase();

                selections[cleanKey] = val.trim();
            } else {
                selections['Opción'] = part;
            }
        });
        return selections;
    };

    const processFile = async (file: File) => {
        setStep('processing');
        setProgress(0);
        setLogs([]);

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                addLog("Leyendo archivo...");
                const data = evt.target?.result;
                const wb = XLSX.read(data, { type: 'array', codepage: 65001 });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" }); // raw:false evita el parseo incorrecto de comas

                if (rawData.length === 0) throw new Error("El archivo está vacío.");

                addLog(`Analizando ${rawData.length} filas...`);

                const categoryMap = getCategoryMap();
                const categoriesToCreate = new Map<string, Category>();

                // Mapa para agrupar productos
                const groupedProducts = new Map<string, any>();

                const genericVariantKeys = [
                    { key: 'Talla', aliases: ['size', 'talla', 'dimension'] },
                    { key: 'Color', aliases: ['color', 'colour', 'tono'] },
                    { key: 'Material', aliases: ['material', 'fabric'] },
                    { key: 'Estilo', aliases: ['style', 'estilo', 'modelo'] },
                ];

                rawData.forEach((row: any) => {
                    // 1. Identificación: Título normalizado para agrupación flexible
                    const rawTitle = getVal(row, ['Nombre*', 'Nombre', 'Title', 'Product Name', 'Name', 'Producto']);
                    // Identificadores
                    const sysId = getVal(row, ['ID_Sistema', 'ID']);
                    const rawSku = getVal(row, ['Código', 'Codigo', 'Code', 'SKU', 'SKU_Base']); // El código de la fila actual
                    const code = rawSku || generateId().slice(0, 8).toUpperCase();

                    const title = rawTitle || "Producto Sin Nombre";

                    // 2. Datos Base
                    const description = getVal(row, ['Descripción', 'Descripcion', 'Description']);
                    const categoryName = getVal(row, ['Categoría', 'Categoria', 'Category', 'Departamento', 'Categoria*']) || 'General';
                    const categoryImage = getVal(row, ['Imagen_Categoría', 'Imagen Categoria']);

                    // Precios y Stock (Usar el parser robusto)
                    const cost = parseNum(getVal(row, ['Costo', 'Cost']));
                    const price = parseNum(getVal(row, ['Precio', 'Price', 'Precio Venta']));
                    const salePrice = parseNum(getVal(row, ['Precio_Oferta', 'Sale Price', 'Oferta']));
                    const stock = parseNum(getVal(row, ['Stock', 'Stock actual', 'Stock Actual', 'Cantidad', 'Inventario']));
                    const minStock = parseNum(getVal(row, ['Stock_Minimo', 'Min Stock', 'Stock Minimo']));

                    const isVisible = parseBool(getVal(row, ['Visible', 'Mostrar']) || 'SI');

                    const imagesStr = getVal(row, ['Imagenes_Globales', 'Imágenes', 'Images', 'Imagen']);
                    const rowImages = imagesStr ? imagesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const variantImage = getVal(row, ['Imagen_Variante', 'Imagen Variante']);

                    // Detect options (Talla, Color...)
                    let rowSelections: Record<string, string> = {};
                    const variantDetail = getVal(row, ['Detalle_Variante', 'Variantes', 'Opciones']);

                    if (variantDetail) {
                        rowSelections = parseVariantString(variantDetail);
                    } else {
                        genericVariantKeys.forEach(vk => {
                            const val = getVal(row, [vk.key, ...vk.aliases]);
                            if (val) rowSelections[vk.key] = val;
                        });
                    }

                    const hasVariantInfo = Object.keys(rowSelections).length > 0;

                    // Group by name ONLY if there is variant info, otherwise use code (SKU)
                    const groupKey = sysId || (hasVariantInfo ? rawTitle.trim().toLowerCase() : code);

                    // 3. Procesar Categoría
                    const normalizedCatName = categoryName.toLowerCase().trim();
                    let finalCategoryName = categoryMap.get(normalizedCatName);

                    if (!finalCategoryName) {
                        if (!categoriesToCreate.has(normalizedCatName)) {
                            categoriesToCreate.set(normalizedCatName, {
                                id: generateId(),
                                name: categoryName.trim(),
                                image: categoryImage || ''
                            });
                        }
                        finalCategoryName = categoryName.trim();
                    }

                    // 4. Inicializar Grupo si no existe
                    if (!groupedProducts.has(groupKey)) {
                        groupedProducts.set(groupKey, {
                            product: {
                                id: sysId || generateId(),
                                code: code, // Código del primer producto (base)
                                title: title,
                                description: description,
                                cost: cost,
                                price: price,
                                salePrice: salePrice,
                                stock: 0, // Se sumará dinámicamente
                                minStock: minStock,
                                trackStock: true,
                                isVisible: isVisible,
                                isFeatured: false,
                                category: finalCategoryName,
                                images: rowImages,
                                variantOptions: [],
                                variants: [],
                                createdAt: Date.now()
                            },
                            tempVariants: [],
                            optionsFound: new Set<string>(),
                            baseVariantCreated: false, // Flag para saber si ya convertimos el base a variante
                            rowsCount: 0
                        });
                    }

                    const group = groupedProducts.get(groupKey);
                    group.rowsCount++;

                    // Si esta fila tiene imágenes y el grupo no, usarlas
                    if (group.product.images.length === 0 && rowImages.length > 0) {
                        group.product.images = rowImages;
                    }

                    // 5. Lógica de Variantes
                    // ES variante si el SKU es diferente al SKU base del grupo O si tiene info de variante explícita
                    let isVariant = (code !== group.product.code) || hasVariantInfo;
                    // Si se detecta como variante
                    if (isVariant) {
                        // CASO ESPECIAL: Es la primera variante detectada, pero el grupo ya tenía un "producto base" (la fila 1).
                        // Debemos convertir esa fila 1 en una variante retroactivamente para no perder su stock/codigo independientemente.
                        if (!group.baseVariantCreated && group.rowsCount > 1) {
                            // Crear variante para el 'padre' usando sus propios datos iniciales
                            group.tempVariants.push({
                                id: generateId(),
                                sku: group.product.code,
                                // Si no tenía opciones, asignamos una por defecto
                                selections: { 'Referencia': group.product.code },
                                price: group.product.price,
                                stock: group.product.stock, // El stock que llevábamos acumulado (fila 1)
                                image: group.product.images[0] || ''
                            });

                            group.optionsFound.add('Referencia');
                            group.baseVariantCreated = true;
                            // Resetear stock base porque ahora es suma de variantes
                            group.product.stock = 0;
                        }

                        // Ahora procesamos la fila actual como variante
                        // Si no encontramos opciones explicitas (Color, etc), usamos el Código como "Referencia"
                        if (Object.keys(rowSelections).length === 0) {
                            rowSelections['Referencia'] = code;
                        }

                        Object.keys(rowSelections).forEach(k => group.optionsFound.add(k));

                        group.tempVariants.push({
                            id: generateId(),
                            sku: code,
                            selections: rowSelections,
                            price: price > 0 ? price : group.product.price,
                            stock: stock,
                            image: variantImage || (rowImages.length > 0 ? rowImages[0] : '')
                        });

                        group.product.stock += stock;

                    } else {
                        // Es la primera fila (Base), solo acumulamos datos
                        group.product.stock += stock;
                        // Actualizar precios si vienen 0
                        if (group.product.price === 0) group.product.price = price;
                        if (group.product.cost === 0) group.product.cost = cost;
                    }
                });

                // --- 6. Consolidación Final ---
                const productsToImport: Product[] = [];
                let totalVariantsCount = 0;

                groupedProducts.forEach((group) => {
                    const p = group.product;

                    // Si se generaron variantes válidas
                    if (group.tempVariants.length > 0) {
                        const options: VariantOption[] = [];

                        // Consolidar opciones
                        group.optionsFound.forEach((optName: string) => {
                            const uniqueValues = new Set<string>();
                            // Recolectar valores de todas las variantes, si alguna no tiene esa opción, poner "General"
                            group.tempVariants.forEach((v: any) => {
                                const val = v.selections[optName] || '-';
                                uniqueValues.add(val);
                                // Rellenar para consistencia
                                v.selections[optName] = val;
                            });

                            options.push({
                                name: optName,
                                values: Array.from(uniqueValues),
                                type: optName.toLowerCase().includes('color') ? 'color' : 'text'
                            });
                        });

                        p.variantOptions = options;
                        p.variants = group.tempVariants;
                        totalVariantsCount += group.tempVariants.length;
                    }

                    productsToImport.push(p);
                });

                setStats({
                    total: productsToImport.length,
                    newCategories: categoriesToCreate.size,
                    variantsCount: totalVariantsCount
                });

                // --- 7. Envío a API ---
                if (categoriesToCreate.size > 0) {
                    addLog(`Creando ${categoriesToCreate.size} categorías nuevas...`);
                    await api.importBatch('categories', Array.from(categoriesToCreate.values()));
                }

                const BATCH_SIZE = 50;
                let processedCount = 0;
                const total = productsToImport.length;

                for (let i = 0; i < total; i += BATCH_SIZE) {
                    const chunk = productsToImport.slice(i, i + BATCH_SIZE);
                    addLog(`Importando ${processedCount + 1} - ${Math.min(processedCount + BATCH_SIZE, total)}...`);
                    await api.importBatch('products', chunk);
                    processedCount += chunk.length;
                    setProgress(Math.round((processedCount / total) * 100));
                    await new Promise(r => setTimeout(r, 10));
                }

                setStep('result');
                onSuccess();

            } catch (err: any) {
                console.error(err);
                addLog(`ERROR CRÍTICO: ${err.message}`);
                setStep('upload');
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-white/10 animate-slide-up relative">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="text-green-600" /> Importador CSV/Excel
                    </h3>
                    {step !== 'processing' && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full dark:text-white"><X size={20} /></button>
                    )}
                </div>

                <div className="p-8">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div
                                    className="border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 rounded-2xl p-10 cursor-pointer hover:border-ios-blue hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 transition-all group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="w-16 h-16 bg-white dark:bg-white/10 rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Upload size={24} className="text-gray-400 group-hover:text-ios-blue" />
                                    </div>
                                    <p className="font-bold text-gray-600 dark:text-gray-300">Seleccionar Archivo</p>
                                    <p className="text-xs text-gray-400 mt-2">Compatible con tu CSV de inventario</p>
                                </div>
                                <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => {
                                    if (e.target.files?.[0]) processFile(e.target.files[0]);
                                }} />
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex gap-3">
                                <HelpCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">Compatibilidad Inteligente Activada</span>
                                    <p className="mt-1 opacity-80 leading-relaxed">
                                        El sistema detectará automáticamente columnas como "ID_Sistema", "Detalle_Variante" e "Imagen_Categoría" para reconstruir tu catálogo exactamente como lo tienes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center justify-center py-4">
                                <Loader2 size={48} className="text-ios-blue animate-spin mb-4" />
                                <h4 className="text-xl font-black dark:text-white">{progress}%</h4>
                                <p className="text-sm text-gray-500">Procesando datos...</p>
                            </div>

                            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                <div className="bg-ios-blue h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>

                            <div className="bg-black/90 rounded-xl p-4 h-32 overflow-y-auto font-mono text-[10px] text-green-400 space-y-1 custom-scrollbar shadow-inner">
                                {logs.map((log, i) => <div key={i}>{log}</div>)}
                                <div className="animate-pulse">_</div>
                            </div>
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-600 animate-bounce">
                                <CheckCircle2 size={40} />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold dark:text-white mb-2">¡Carga Completada!</h4>
                                <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <div className="bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl">
                                        <span className="font-black block text-lg">{stats.total}</span> Productos
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl">
                                        <span className="font-black block text-lg">{stats.variantsCount}</span> Variantes
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl">
                                        <span className="font-black block text-lg">{stats.newCategories}</span> Categorías
                                    </div>
                                </div>
                            </div>
                            <Button onClick={onClose} className="w-full py-4 text-lg font-bold bg-ios-blue text-white shadow-lg">
                                Finalizar
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
