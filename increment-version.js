import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swPath = path.resolve(__dirname, 'sw.js');

try {
    let swContent = fs.readFileSync(swPath, 'utf8');

    // Función para reemplazar versiones con timestamp y contador
    // Esto asegura unicidad absoluta en cada build
    const newVersion = `v${Date.now()}`;

    // Regex para encontrar constantes de cache
    const cacheRegex = /const CACHE_([A-Z]+) = 'tienda-([a-z]+)-v(\d+)';/g;

    let updatedContent = swContent.replace(cacheRegex, (match, type, name, version) => {
        const nextVersion = parseInt(version) + 1;
        console.log(`Updating CACHE_${type}: v${version} -> v${nextVersion}`);
        return `const CACHE_${type} = 'tienda-${name}-v${nextVersion}';`;
    });

    // Agregar fecha de build al inicio para debug
    const header = `// [BUILD] Service Worker Updated: ${new Date().toISOString()}\n`;
    if (!updatedContent.startsWith('// [BUILD]')) {
        updatedContent = header + updatedContent;
    } else {
        updatedContent = updatedContent.replace(/\/\/ \[BUILD\].*\n/, header);
    }

    fs.writeFileSync(swPath, updatedContent);
    console.log('✅ Service Worker versions auto-incremented successfully.');

} catch (error) {
    console.error('❌ Error updating Service Worker version:', error);
    process.exit(1);
}
