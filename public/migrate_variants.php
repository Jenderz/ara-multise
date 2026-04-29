<?php

/**
 * SCRIPT DE MIGRACIÓN MASIVA DE VARIANTES
 * 
 * Este script recorre todos los productos con variantes que aún están en formato "Legacy" (JSON)
 * y genera sus registros correspondientes en la tabla `inventory` para la Sede Principal (Branch 1).
 * 
 * Esto completa la transición al nuevo modelo de base de datos.
 */

require_once 'lib/config.php';
require_once 'lib/schema.php';

header('Content-Type: text/plain');

try {
    $pdo = getDBConnection();

    echo "Iniciando migración de variantes...\n";

    // 1. Obtener todos los productos con variantes
    $stmt = $pdo->query("SELECT id, title, variants FROM products WHERE variants IS NOT NULL AND variants != '' AND variants != '[]'");
    $products = $stmt->fetchAll();

    $countProd = 0;
    $countVar = 0;

    $pdo->beginTransaction();

    foreach ($products as $p) {
        $variants = json_decode($p['variants'], true);

        if (!is_array($variants) || empty($variants)) continue;

        $variantSum = 0;
        $migratedThisProd = false;

        foreach ($variants as $v) {
            // Solo migrar si tiene ID y Stock definido
            if (isset($v['id'])) {
                $vId = $v['id'];
                $stock = (int)($v['stock'] ?? 0);
                $variantSum += $stock;

                // INSERT IGNORE: Si ya existe (ya fue migrado o editado), no lo tocamos.
                // Solo creamos los que faltan. Asignamos a Branch 1 (Sede Principal).
                $stmtVar = $pdo->prepare("INSERT IGNORE INTO inventory (product_id, branch_id, stock, updated_at) VALUES (?, 1, ?, ?)");
                $stmtVar->execute([$vId, $stock, time()]);

                if ($stmtVar->rowCount() > 0) {
                    $countVar++;
                    $migratedThisProd = true;
                }
            }
        }

        // Opcional: También aseguramos que el PADRE tenga su registro sumario en inventory
        // Esto ayuda a las consultas de Global Stock
        $stmtParent = $pdo->prepare("INSERT INTO inventory (product_id, branch_id, stock, updated_at) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock)");
        $stmtParent->execute([$p['id'], $variantSum, time()]);

        if ($migratedThisProd) {
            $countProd++;
            echo "Migrado: {$p['title']} (ID: {$p['id']}) - Total Variantes: " . count($variants) . "\n";
        }
    }

    $pdo->commit();

    echo "\n--- MIGRACIÓN COMPLETADA ---\n";
    echo "Productos Procesados: $countProd\n";
    echo "Variantes Individuales Creadas en Inventario: $countVar\n";
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo "ERROR CRÍTICO: " . $e->getMessage();
}
