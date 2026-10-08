<?php
/**
 * SCRIPT DE SANEAMIENTO Y AUDITORÍA DE INVENTARIO
 * 
 * Uso:
 *   php sanitize_data.php --dry-run   (Solo reporta anomalías sin modificar)
 *   php sanitize_data.php --execute   (Aplica las correcciones en una transacción)
 */

if (php_sapi_name() !== 'cli') {
    die("Este script solo puede ejecutarse desde la línea de comandos (CLI).\n");
}

if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    require_once __DIR__ . '/config.example.php';
}

$pdo = getDBConnection();
$isDryRun = !in_array('--execute', $argv);

echo "========================================================\n";
echo " ARA MULTISEDE - SCRIPT DE AUDITORÍA Y SANEAMIENTO\n";
echo " Modo: " . ($isDryRun ? "[DRY-RUN] (Solo lectura / Reporte)" : "[EJECUCIÓN REAL] (Aplicando cambios)") . "\n";
echo " Fecha Servidor: " . date('Y-m-d H:i:s') . "\n";
echo "========================================================\n\n";

$report = [
    'branch_zero_rows' => 0,
    'inactive_branch_rows' => 0,
    'orphan_inventory' => 0,
    'negative_stock_rows' => 0,
];

if (!$isDryRun) {
    $pdo->beginTransaction();
}

try {
    // 1. Filas de inventario con branch_id = 0
    echo "1. Analizando filas de inventario con branch_id = 0...\n";
    $stmtB0 = $pdo->query("SELECT COUNT(*) FROM `inventory` WHERE `branch_id` = 0");
    $report['branch_zero_rows'] = (int)$stmtB0->fetchColumn();
    echo "   Encontradas: {$report['branch_zero_rows']} filas.\n";

    if ($report['branch_zero_rows'] > 0 && !$isDryRun) {
        $delB0 = $pdo->exec("DELETE FROM `inventory` WHERE `branch_id` = 0");
        echo "   -> Eliminadas {$delB0} filas basura con branch_id = 0.\n";
    }

    // 2. Filas de inventario en sedes inactivas o inexistentes
    echo "\n2. Analizando inventario en sedes inexistentes o inactivas...\n";
    $stmtInact = $pdo->query("SELECT COUNT(*) FROM `inventory` i LEFT JOIN `branches` b ON b.id = i.branch_id WHERE b.id IS NULL OR b.is_active = 0");
    $report['inactive_branch_rows'] = (int)$stmtInact->fetchColumn();
    echo "   Encontradas: {$report['inactive_branch_rows']} filas.\n";

    // 3. Filas huérfanas (ni producto existente ni variante en JSON)
    echo "\n3. Analizando filas huérfanas en inventario...\n";
    $allInvStmt = $pdo->query("SELECT DISTINCT product_id FROM `inventory`");
    $allInvIds = $allInvStmt->fetchAll(PDO::FETCH_COLUMN);

    $prodStmt = $pdo->query("SELECT id, variants FROM `products`");
    $validIds = [];
    while ($pRow = $prodStmt->fetch(PDO::FETCH_ASSOC)) {
        $validIds[$pRow['id']] = true;
        if (!empty($pRow['variants'])) {
            $vars = safeJsonDecode($pRow['variants']);
            if (is_array($vars)) {
                foreach ($vars as $v) {
                    if (!empty($v['id'])) {
                        $validIds[strval($v['id'])] = true;
                    }
                }
            }
        }
    }

    $orphanIds = [];
    foreach ($allInvIds as $invPid) {
        if (!isset($validIds[$invPid])) {
            $orphanIds[] = $invPid;
        }
    }
    $report['orphan_inventory'] = count($orphanIds);
    echo "   Encontradas: {$report['orphan_inventory']} IDs huérfanos en inventory.\n";

    if (!empty($orphanIds) && !$isDryRun) {
        $placeholders = implode(',', array_fill(0, count($orphanIds), '?'));
        $stmtDelOrphans = $pdo->prepare("DELETE FROM `inventory` WHERE product_id IN ($placeholders)");
        $stmtDelOrphans->execute($orphanIds);
        echo "   -> Eliminados {$stmtDelOrphans->rowCount()} registros huérfanos de inventory.\n";
    }

    // 4. Filas con stock negativo
    echo "\n4. Analizando inventario con stock negativo...\n";
    $stmtNeg = $pdo->query("SELECT COUNT(*) FROM `inventory` WHERE `stock` < 0");
    $report['negative_stock_rows'] = (int)$stmtNeg->fetchColumn();
    echo "   Encontradas: {$report['negative_stock_rows']} filas con stock negativo.\n";

    if ($report['negative_stock_rows'] > 0 && !$isDryRun) {
        $stmtFixNeg = $pdo->query("SELECT product_id, branch_id, stock FROM `inventory` WHERE `stock` < 0");
        $fixStmt = $pdo->prepare("UPDATE `inventory` SET `stock` = 0, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?");
        $movStmt = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?, ?, ?, 'system', 'Saneamiento Automático', 'adjustment', ?, 0, 'Corrección de Stock Negativo a 0', ?)");

        while ($rowNeg = $stmtFixNeg->fetch(PDO::FETCH_ASSOC)) {
            $fixStmt->execute([time(), $rowNeg['product_id'], $rowNeg['branch_id']]);
            $movStmt->execute([generateUniqueId(), $rowNeg['product_id'], $rowNeg['branch_id'], abs($rowNeg['stock']), time() * 1000]);
        }
        echo "   -> Corregidas {$report['negative_stock_rows']} filas de stock negativo a 0 y registrados movimientos de auditoría.\n";
    }

    if (!$isDryRun) {
        $pdo->commit();
        echo "\n>>> TRANSACCIÓN COMPLETADA EXITOSAMENTE. Base de datos saneada.\n";
    } else {
        echo "\n>>> Modo DRY-RUN finalizado. Ningún dato fue modificado. Ejecuta con --execute para aplicar los cambios.\n";
    }

} catch (\Throwable $e) {
    if (!$isDryRun && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n[ERROR] Ocurrió una excepción: " . $e->getMessage() . "\n";
    exit(1);
}
