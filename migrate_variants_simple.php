<?php
/**
 * Script Simple de Migración de Variantes
 * 
 * Coloca este archivo en la RAÍZ de tu proyecto (donde está la carpeta public/)
 * y ejecútalo con: php migrate_variants_simple.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=================================================================\n";
echo "MIGRACIÓN SIMPLE DE VARIANTES A TABLA INVENTORY\n";
echo "=================================================================\n\n";

// Configuración de base de datos - AJUSTA ESTOS VALORES
$DB_HOST = 'localhost';
$DB_NAME = 'qluilsmq_carruselve';  // Ajusta si es diferente
$DB_USER = 'qluilsmq_carruselve';  // Ajusta tu usuario
$DB_PASS = 'TU_PASSWORD_AQUI';     // ⚠️ CAMBIA ESTO

echo "[INFO] Conectando a la base de datos...\n";

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    echo "[✓] Conexión exitosa\n\n";
} catch (PDOException $e) {
    die("[✗] Error de conexión: " . $e->getMessage() . "\n");
}

// Verificar que las columnas existen
echo "[INFO] Verificando estructura de base de datos...\n";

$checkInventory = $pdo->query("SHOW COLUMNS FROM inventory LIKE 'variant_id'");
if ($checkInventory->rowCount() === 0) {
    die("[✗] ERROR: La columna 'variant_id' no existe en 'inventory'.\n" .
        "    Por favor ejecuta primero el script SQL: migration_simple_variants.sql\n");
}
echo "[✓] Estructura verificada\n\n";

// Obtener sedes activas
echo "[INFO] Obteniendo sedes activas...\n";
$branches = $pdo->query("SELECT id, name FROM branches WHERE is_active = 1")->fetchAll();

if (empty($branches)) {
    die("[✗] No se encontraron sedes activas\n");
}

echo "[✓] Encontradas " . count($branches) . " sede(s):\n";
foreach ($branches as $branch) {
    echo "    - ID: {$branch['id']}, Nombre: {$branch['name']}\n";
}
echo "\n";

// Obtener productos con variantes
echo "[INFO] Buscando productos con variantes...\n";

$stmt = $pdo->query("
    SELECT id, title, code, variants 
    FROM products 
    WHERE variants IS NOT NULL 
    AND variants != '[]' 
    AND variants != ''
    ORDER BY id
");

$products = $stmt->fetchAll();

if (empty($products)) {
    echo "[✓] No se encontraron productos con variantes para migrar\n";
    exit(0);
}

echo "[✓] Encontrados " . count($products) . " producto(s) con variantes\n\n";

// Iniciar migración
echo "=================================================================\n";
echo "INICIANDO MIGRACIÓN\n";
echo "=================================================================\n\n";

$pdo->beginTransaction();

$stats = [
    'products' => 0,
    'variants' => 0,
    'skipped' => 0,
    'errors' => 0
];

foreach ($products as $product) {
    $productId = $product['id'];
    $productTitle = $product['title'];
    $productCode = $product['code'];
    
    echo "[INFO] Procesando: [{$productCode}] {$productTitle}\n";
    
    $variants = json_decode($product['variants'], true);
    
    if (!is_array($variants)) {
        echo "  [✗] Error: variants no es un JSON válido\n";
        $stats['errors']++;
        continue;
    }
    
    echo "  → Encontradas " . count($variants) . " variante(s)\n";
    
    foreach ($variants as $variant) {
        if (!isset($variant['id'])) {
            echo "  [⚠] Variante sin ID, omitiendo\n";
            $stats['skipped']++;
            continue;
        }
        
        $variantId = $variant['id'];
        $variantStock = isset($variant['stock']) ? intval($variant['stock']) : 0;
        $variantSku = $variant['sku'] ?? 'N/A';
        
        echo "  → Variante: {$variantSku} (ID: {$variantId}, Stock: {$variantStock})\n";
        
        foreach ($branches as $branch) {
            $branchId = $branch['id'];
            $branchName = $branch['name'];
            
            try {
                // Verificar si ya existe
                $check = $pdo->prepare("
                    SELECT stock FROM inventory 
                    WHERE product_id = ? AND branch_id = ? AND variant_id = ?
                ");
                $check->execute([$productId, $branchId, $variantId]);
                
                if ($check->fetchColumn() !== false) {
                    echo "    [⚠] Ya existe en '{$branchName}', omitiendo\n";
                    $stats['skipped']++;
                    continue;
                }
                
                // Insertar
                $insert = $pdo->prepare("
                    INSERT INTO inventory (product_id, branch_id, variant_id, stock, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                ");
                
                $insert->execute([
                    $productId,
                    $branchId,
                    $variantId,
                    $variantStock,
                    time()
                ]);
                
                echo "    [✓] Migrado a '{$branchName}' con stock {$variantStock}\n";
                $stats['variants']++;
                
            } catch (PDOException $e) {
                echo "    [✗] Error: " . $e->getMessage() . "\n";
                $stats['errors']++;
            }
        }
    }
    
    // Eliminar registro del producto padre
    try {
        $delete = $pdo->prepare("DELETE FROM inventory WHERE product_id = ? AND variant_id IS NULL");
        $delete->execute([$productId]);
        $deletedCount = $delete->rowCount();
        
        if ($deletedCount > 0) {
            echo "  → Eliminados {$deletedCount} registro(s) del producto padre\n";
        }
    } catch (PDOException $e) {
        echo "  [⚠] No se pudieron eliminar registros padre: " . $e->getMessage() . "\n";
    }
    
    $stats['products']++;
    echo "\n";
}

$pdo->commit();

// Resumen
echo "=================================================================\n";
echo "RESUMEN DE MIGRACIÓN\n";
echo "=================================================================\n\n";

echo "Productos procesados:  {$stats['products']}\n";
echo "Variantes migradas:    {$stats['variants']}\n";
echo "Variantes omitidas:    {$stats['skipped']}\n";
echo "Errores:               {$stats['errors']}\n\n";

if ($stats['errors'] > 0) {
    echo "[⚠] Migración completada con errores\n";
    exit(1);
} else {
    echo "[✓] ¡Migración completada exitosamente!\n";
    exit(0);
}
