
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { v5 as uuidv5 } from 'uuid';

// UUID Namespace for consistent IDs
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const INPUT_FILE = 'c:/Users/pc/Documents/Products_20250202_20260202.csv';
const OUTPUT_FILE = 'c:/Users/pc/Documents/Products_Ready_For_Import.csv';

function cleanDecimal(val) {
    if (val === undefined || val === null || val === '') return 0.0;
    let s = String(val).trim();
    // Remove quotes and unicode chars that might look like spaces
    s = s.replace(/["']/g, '');

    // Handle "1.222,50" -> 1222.50
    if (s.includes(',') && s.includes('.')) {
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if (lastDot < lastComma) {
            // Dot is thousands, Comma is decimal
            s = s.replace(/\./g, '').replace(',', '.');
        }
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }

    const clean = s.replace(/[^0-9.-]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0.0 : num;
}

function process() {
    console.log(`Reading ${INPUT_FILE}...`);
    try {
        const fileBuffer = fs.readFileSync(INPUT_FILE);
        // Try to detect encoding or just read as buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        let data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        console.log(`Processing ${data.length} rows...`);

        if (data.length === 0) return;

        // Inspect headers of first row to find our columns
        const firstRow = data[0];
        const keys = Object.keys(firstRow);

        const findKey = (candidates) => {
            for (const cand of candidates) {
                const found = keys.find(k =>
                    k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
                    cand.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                );
                if (found) return found;
            }
            // Fallback: look for generic "code" or matches
            return keys.find(k => k.toLowerCase().includes('codig') || k.toLowerCase().includes('code'));
        };

        const colCodigo = findKey(['Código', 'Codigo', 'Code', 'SKU']) || keys[0]; // fallback to col 0
        const colNombre = findKey(['Nombre', 'Name', 'Producto']) || keys[1];
        const colCosto = findKey(['Costo', 'Cost']) || 'Costo';
        const colPrecio = findKey(['Precio', 'Price']) || 'Precio';
        const colStock = findKey(['Stock Actual', 'Stock', 'Inventory']) || 'Stock Actual';
        const colMin = findKey(['Stock Minimo', 'Min Stock']) || 'Stock Minimo';

        console.log(`Mapped Columns: Code=[${colCodigo}], Name=[${colNombre}]`);

        // 1. Group by Normalized Name
        const groups = {};

        for (const row of data) {
            const nombre = row[colNombre] || "Unknown";
            const normName = String(nombre).trim().toLowerCase();
            if (!normName) continue;
            if (!groups[normName]) groups[normName] = [];
            groups[normName].push(row);
        }

        const processedRows = [];

        for (const normName in groups) {
            const group = groups[normName];

            let sysId = '';
            try {
                sysId = uuidv5(normName || 'default', NAMESPACE);
            } catch (e) {
                sysId = 'ID-' + Math.random().toString(36).substr(2, 9);
            }

            const slug = normName.replace(/[^a-z0-9]/g, '-').slice(0, 20).toUpperCase();

            // Use first variant's code to make the base SKU more meaningful? Or just generic.
            // Let's use generic to avoid collision if the user renames the code.
            const skuBase = `GRP-${slug}-${sysId.slice(0, 4)}`;

            for (const row of group) {
                // Clone row
                const newRow = { ...row };

                const code = String(newRow[colCodigo] || '').trim();

                // Add new columns
                newRow['ID_Sistema'] = sysId;
                newRow['SKU_Base'] = skuBase; // This groups them in the system
                newRow['SKU_Variante'] = code; // The specific SKU
                newRow['Tipo'] = 'Variante';
                newRow['Detalle_Variante'] = `Modelo: ${code}`;

                // Clean numbers
                newRow[colCosto] = cleanDecimal(newRow[colCosto]);
                newRow[colPrecio] = cleanDecimal(newRow[colPrecio]);
                newRow[colStock] = parseInt(cleanDecimal(newRow[colStock]) || 0);
                newRow[colMin] = parseInt(cleanDecimal(newRow[colMin]) || 0);

                // Rename columns to clean keys for output (optional, but good for CSV)
                // We'll just ensure the output uses keys that the importer recognizes
                // The importer recognizes 'SKU_Base', 'ID_Sistema', 'Detalle_Variante', 'Tipo'
                // It also inspects 'Código' for SKU Base. We should rename old 'Código' to avoid confusion?
                // The importer logic: `skuBase = getString(row, ['SKU_Base', 'Código'...])`.
                // If we provide `SKU_Base` explicitly, it picks it up before 'Código' in our logic if we put it first?
                // Actually `getString` iterates keys.
                // We should DELETE the old 'Código' key or Rename it to 'Old_Code' to prevent Importer from using it as SKU Base
                // if `SKU_Base` is populated.
                // Wait, Importer iterates the aliases. If 'SKU_Base' exists in the row, `getString` returns it.
                // Yes, as long as 'SKU_Base' is in the aliases list.
                // `getString(row, ['SKU_Base', 'Código'...])`. It checks 'SKU_Base' first. If found, returns it.
                // So adding 'SKU_Base' column is sufficient to override 'Código'.

                processedRows.push(newRow);
            }
        }

        // Write to CSV
        const newSheet = XLSX.utils.json_to_sheet(processedRows);
        const csvContent = XLSX.utils.sheet_to_csv(newSheet);

        fs.writeFileSync(OUTPUT_FILE, csvContent);
        console.log(`Success! Saved to ${OUTPUT_FILE}`);

    } catch (err) {
        console.error("Error:", err);
    }
}

process();
