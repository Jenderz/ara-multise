<?php
/**
 * Script de Migración: Variantes de Productos a Tabla Inventory
 * 
 * Este script migra el stock de las variantes almacenadas en JSON
 * dentro de la tabla `products` hacia la tabla `inventory` con
 * soporte para variant_id.
 * 
 * IMPORTANTE: Ejecutar DESPUÉS del script SQL migration_inventory_variants.sql
 * 
 * Uso: php migrate_variants_to_inventory.php
 */

// Configuración de errores
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(0); // Sin límite de tiempo

// Detectar la ruta correcta de lib
$libPath = null;
$possiblePaths = [
    __DIR__ . '/../lib/config.php',           // Desde public/migrations/
    __DIR__ . '/lib/config.php',              // Desde raíz del proyecto
    dirname(__DIR__) . '/lib/config.php',     // Alternativa
];

foreach ($possiblePaths as $path) {
    if (file_exists($path)) {
        $libPath = dirname($path);
        break;
    }
}

if ($libPath === null) {
    die("ERROR: No se pudo encontrar la carpeta 'lib' con config.php\n" .
        "Rutas buscadas:\n" . implode("\n", $possiblePaths) . "\n");
}

// Cargar conexión a base de datos
require_once $libPath . '/config.php';
require_once $libPath . '/schema.php';

// Colores para terminal
class Colors {
    const RESET = "\033[0m";
    const GREEN = "\033[32m";
    const YELLOW = "\033[33m";
    const RED = "\033[31m";
    const BLUE = "\033[34m";
    const CYAN = "\033[36m";
}

function log_info($message) {
    echo Colors::BLUE . "[INFO] " . Colors::RESET . $message . "\n";
}

function log_success($message) {
    echo Colors::GREEN . "[✓] " . Colors::RESET . $message . "\n";
}

function log_warning($message) {
    echo Colors::YELLOW . "[⚠] " . Colors::RESET . $message . "\n";
}

function log_error($message) {
    echo Colors::RED . "[✗] " . Colors::RESET . $message . "\n";
}

function log_header($message) {
    echo "\n" . Colors::CYAN . str_repeat("=", 70) . Colors::RESET . "\n";
    echo Colors::CYAN . $message . Colors::RESET . "\n";
    echo Colors::CYAN . str_repeat("=", 70) . Colors::RESET . "\n\n";
}

try {
    log_header("MIGRACIÓN DE VARIANTES A TABLA INVENTORY");
    
    $pdo = getDBConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // ========================================================================
    // PASO 1: Verificar que las columnas existen
    // ========================================================================
    log_info("Verificando estructura de la base de datos...");
    
    $checkInventory = $pdo->query("SHOW COLUMNS FROM inventory LIKE 'variant_id'");
    if ($checkInventory->rowCount() === 0) {
        log_error("La columna 'variant_id' no existe en la tabla 'inventory'");
        log_error("Por favor, ejecuta primero el script SQL: migration_inventory_variants.sql");
        exit(1);
    }
    
    $checkMovements = $pdo->query("SHOW COLUMNS FROM product_movements LIKE 'variant_id'");
    if ($checkMovements->rowCount() === 0) {
        log_warning("La columna 'variant_id' no existe en 'product_movements'");
        log_warning("Los movimientos no incluirán información de variantes");
    }
    
    log_success("Estructura de base de datos verificada");
    
    // ========================================================================
    // PASO 2: Obtener todas las sedes activas
    // ========================================================================
    log_info("Obteniendo sedes activas...");
    
    $branchStmt = $pdo->query("SELECT id, name FROM branches WHERE is_active = 1");
    $branches = $branchStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($branches)) {
        log_error("No se encontraron sedes activas");
        exit(1);
    }
    
    log_success("Encontradas " . count($branches) . " sede(s) activa(s):");
    foreach ($branches as $branch) {
        log_info("  - ID: {$branch['id']}, Nombre: {$branch['name']}");
    }
    
    // ========================================================================
    // PASO 3: Obtener productos con variantes
    // ========================================================================
    log_info("Buscando productos con variantes...");
    
    $stmt = $pdo->query("
        SELECT id, title, code, variants 
        FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]' 
        AND variants != ''
        ORDER BY id
    ");
    
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($products)) {
        log_warning("No se encontraron productos con variantes");
        log_info("Migración completada (sin datos para migrar)");
        exit(0);
    }
    
    log_success("Encontrados " . count($products) . " producto(s) con variantes");
    
    // ========================================================================
    // PASO 4: Migrar variantes a inventory
    // ========================================================================
    log_header("INICIANDO MIGRACIÓN DE VARIANTES");
    
    $pdo->beginTransaction();
    
    $stats = [
        'products_processed' => 0,
        'variants_migrated' => 0,
        'variants_skipped' => 0,
        'errors' => 0,
        'parent_records_deleted' => 0
    ];
    
    foreach ($products as $product) {
        $productId = $product['id'];
        $productTitle = $product['title'];
        $productCode = $product['code'];
        
        log_info("Procesando: [{$productCode}] {$productTitle}");
        
        // Decodificar variantes
        $variants = json_decode($product['variants'], true);
        
        if (!is_array($variants)) {
            log_error("  ✗ El campo 'variants' no es un JSON válido");
            $stats['errors']++;
            continue;
        }
        
        $variantCount = count($variants);
        log_info("  → Encontradas {$variantCount} variante(s)");
        
        foreach ($variants as $index => $variant) {
            // Validar estructura de la variante
            if (!isset($variant['id'])) {
                log_warning("  ⚠ Variante #{$index}: Sin ID, omitiendo");
                $stats['variants_skipped']++;
                continue;
            }
            
            $variantId = $variant['id'];
            $variantStock = isset($variant['stock']) ? intval($variant['stock']) : 0;
            $variantSku = $variant['sku'] ?? 'N/A';
            $variantSelections = isset($variant['selections']) ? json_encode($variant['selections']) : '{}';
            
            log_info("  → Variante: {$variantSku} (ID: {$variantId}, Stock: {$variantStock})");
            
            // Migrar a cada sede
            foreach ($branches as $branch) {
                $branchId = $branch['id'];
                $branchName = $branch['name'];
                
                try {
                    // Verificar si ya existe un registro para esta variante en esta sede
                    $checkStmt = $pdo->prepare("
                        SELECT stock FROM inventory 
                        WHERE product_id = ? AND branch_id = ? AND variant_id = ?
                    ");
                    $checkStmt->execute([$productId, $branchId, $variantId]);
                    $existingStock = $checkStmt->fetchColumn();
                    
                    if ($existingStock !== false) {
                        log_warning("    ⚠ Ya existe en sede '{$branchName}' con stock {$existingStock}, omitiendo");
                        $stats['variants_skipped']++;
                        continue;
                    }
                    
                    // Insertar registro de inventario para la variante
                    $insertStmt = $pdo->prepare("
                        INSERT INTO inventory (product_id, branch_id, variant_id, stock, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                    ");
                    
                    $insertStmt->execute([
                        $productId,
                        $branchId,
                        $variantId,
                        $variantStock,
                        time()
                    ]);
                    
                    log_success("    ✓ Migrado a sede '{$branchName}' con stock {$variantStock}");
                    $stats['variants_migrated']++;
                    
                } catch (PDOException $e) {
                    log_error("    ✗ Error al migrar a sede '{$branchName}': " . $e->getMessage());
                    $stats['errors']++;
                }
            }
        }
        
        // Eliminar registros del producto padre (sin variant_id) si tiene variantes
        try {
            $deleteStmt = $pdo->prepare("
                DELETE FROM inventory 
                WHERE product_id = ? AND variant_id IS NULL
            ");
            $deleteStmt->execute([$productId]);
            $deletedCount = $deleteStmt->rowCount();
            
            if ($deletedCount > 0) {
                log_info("  → Eliminados {$deletedCount} registro(s) del producto padre");
                $stats['parent_records_deleted'] += $deletedCount;
            }
        } catch (PDOException $e) {
            log_warning("  ⚠ No se pudieron eliminar registros del producto padre: " . $e->getMessage());
        }
        
        $stats['products_processed']++;
        echo "\n";
    }
    
    // ========================================================================
    // PASO 5: Confirmar transacción
    // ========================================================================
    $pdo->commit();
    log_success("Transacción confirmada exitosamente");
    
    // ========================================================================
    // PASO 6: Mostrar estadísticas finales
    // ========================================================================
    log_header("RESUMEN DE MIGRACIÓN");
    
    echo "Productos procesados:        " . Colors::CYAN . $stats['products_processed'] . Colors::RESET . "\n";
    echo "Variantes migradas:          " . Colors::GREEN . $stats['variants_migrated'] . Colors::RESET . "\n";
    echo "Variantes omitidas:          " . Colors::YELLOW . $stats['variants_skipped'] . Colors::RESET . "\n";
    echo "Registros padre eliminados:  " . Colors::BLUE . $stats['parent_records_deleted'] . Colors::RESET . "\n";
    echo "Errores:                     " . Colors::RED . $stats['errors'] . Colors::RESET . "\n\n";
    
    // ========================================================================
    // PASO 7: Verificación final
    // ========================================================================
    log_header("VERIFICACIÓN FINAL");
    
    $verifyStmt = $pdo->query("
        SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN variant_id IS NULL THEN 1 ELSE 0 END) as without_variant,
            SUM(CASE WHEN variant_id IS NOT NULL THEN 1 ELSE 0 END) as with_variant,
            SUM(stock) as total_stock
        FROM inventory
    ");
    $verification = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    
    echo "Total de registros en inventory: " . Colors::CYAN . $verification['total_records'] . Colors::RESET . "\n";
    echo "  - Sin variante:                " . Colors::YELLOW . $verification['without_variant'] . Colors::RESET . "\n";
    echo "  - Con variante:                " . Colors::GREEN . $verification['with_variant'] . Colors::RESET . "\n";
    echo "  - Stock total:                 " . Colors::BLUE . $verification['total_stock'] . Colors::RESET . " unidades\n\n";
    
    if ($stats['errors'] > 0) {
        log_warning("Migración completada con {$stats['errors']} error(es)");
        log_warning("Revisa los mensajes anteriores para más detalles");
        exit(1);
    } else {
        log_success("¡Migración completada exitosamente sin errores!");
        log_success("El sistema ahora usa la tabla inventory para gestionar stock de variantes");
        exit(0);
    }
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        log_error("Transacción revertida debido a un error");
    }
    
    log_error("Error de base de datos: " . $e->getMessage());
    log_error("Archivo: " . $e->getFile());
    log_error("Línea: " . $e->getLine());
    exit(1);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
        log_error("Transacción revertida debido a un error");
    }
    
    log_error("Error general: " . $e->getMessage());
    exit(1);
}
