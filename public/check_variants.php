<?php
/**
 * Script para verificar si las variantes existen en la tabla inventory
 * Uso: php check_variants.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Intentar cargar configuración
$configFile = __DIR__ . '/lib/config.php';
if (!file_exists($configFile)) {
    // Fallback si estamos en la raíz
    $configFile = 'lib/config.php';
}

if (file_exists($configFile)) {
    require_once $configFile;
    require_once dirname($configFile) . '/schema.php'; // Usualmente al lado de config
    $pdo = getDBConnection();
} else {
    // Configuración manual si no encuentra el archivo
    $host = 'localhost';
    $db   = 'qluilsmq_carruselve';
    $user = 'qluilsmq_carruselve';
    $pass = ''; // Pon tu contraseña aquí si el require falla
    
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    } catch (PDOException $e) {
        die("Error conexión: " . $e->getMessage());
    }
}

echo "========================================\n";
echo " VERIFICADOR DE VARIANTES EN INVENTARIO \n";
echo "========================================\n\n";

// 1. Obtener 5 productos que tengan variantes
$stmt = $pdo->query("SELECT id, title, variants FROM products WHERE variants IS NOT NULL AND variants != '' AND variants != '[]' LIMIT 5");
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($products)) {
    die("No se encontraron productos con variantes para analizar.\n");
}

foreach ($products as $p) {
    echo "Producto: " . $p['title'] . "\n";
    echo "ID Padre: " . $p['id'] . "\n";
    
    $variants = json_decode($p['variants'], true);
    
    if (!is_array($variants)) {
        echo "  [ERROR] JSON de variantes inválido.\n\n";
        continue;
    }
    
    echo "  Total Variantes en JSON: " . count($variants) . "\n";
    
    $foundCount = 0;
    
    foreach ($variants as $v) {
        $vId = $v['id'] ?? 'SIN_ID';
        $vSku = $v['sku'] ?? 'SIN_SKU';
        
        // Verificar si este ID de variante existe en la tabla inventory
        // En tu sistema actual, el product_id en inventory ES el ID de la variante
        $chk = $pdo->prepare("SELECT stock FROM inventory WHERE product_id = ?");
        $chk->execute([$vId]);
        $stock = $chk->fetchColumn();
        
        if ($stock !== false) {
            echo "    [OK] Variante $vId ($vSku) -> Stock en Inventory: $stock\n";
            $foundCount++;
        } else {
            echo "    [X]  Variante $vId ($vSku) -> NO ESTÁ en Inventory\n";
        }
    }
    
    if ($foundCount == count($variants)) {
        echo "  => ESTADO: CORRECTO (Todas las variantes están en inventario)\n";
    } elseif ($foundCount > 0) {
         echo "  => ESTADO: PARCIAL ($foundCount encontradas de " . count($variants) . ")\n";
    } else {
         echo "  => ESTADO: VACÍO (Ninguna variante está en el inventario)\n";
    }
    echo "----------------------------------------\n";
}
