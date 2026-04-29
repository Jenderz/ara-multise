
<?php
function handleAdjustStock($pdo, $input, $branchId)
{
    $p = $input;
    $targetBid = $p['targetBranchId'] ?? $branchId;
    $pdo->prepare("INSERT IGNORE INTO `inventory` (product_id, branch_id, stock) VALUES (?, ?, 0)")->execute([$p['productId'], $targetBid]);

    $mod = ($p['type'] === 'entry' || $p['type'] === 'transfer_in' || $p['type'] === 'return') ? $p['amount'] : -$p['amount'];

    $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?")
        ->execute([$mod, time(), $p['productId'], $targetBid]);

    $after = $pdo->query("SELECT `stock` FROM `inventory` WHERE `product_id` = '{$p['productId']}' AND `branch_id` = $targetBid")->fetchColumn();

    $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)")
        ->execute([generateUniqueId(), $p['productId'], $targetBid, $p['userId'], $p['userName'], $p['type'], $p['amount'], $after, $p['reference'], time() * 1000]);

    jsonResponse(['status' => 'success']);
}

function handleTransferStock($pdo, $input)
{
    // DEBUG ENTRY
    file_put_contents('debug_stock.txt', date('Y-m-d H:i:s') . " [TRANSFER_START] Payload: " . json_encode($input) . "\n", FILE_APPEND);

    $p = $input;

    // Validaciones Básicas
    if ($p['amount'] <= 0) jsonResponse(['error' => 'Cantidad inválida'], 400);
    if ($p['fromBranchId'] == $p['toBranchId']) jsonResponse(['error' => 'La sede destino debe ser diferente'], 400);

    // --- FIX: RESOLUCIÓN DE ID DE VARIANTE ---
    // El frontend envía el ID del Padre + Nombre de Variante.
    // Debemos encontrar el ID REAL de la variante para afectar el inventario correcto.
    if ((!empty($p['variantName']) || !empty($p['variantSku'])) && !empty($p['productId'])) {
        $stmtV = $pdo->prepare("SELECT variants FROM products WHERE id = ?");
        $stmtV->execute([$p['productId']]);
        $prodRow = $stmtV->fetch();

        if ($prodRow && !empty($prodRow['variants'])) {
            $vars = json_decode($prodRow['variants'], true);
            if (is_array($vars)) {
                foreach ($vars as $v) {
                    // Criterios de coincidencia: ID explícito (si viniera), SKU o Nombre/Opción
                    $match = false;
                    if (isset($p['variantId']) && $v['id'] == $p['variantId']) $match = true;
                    elseif (isset($p['variantSku']) && isset($v['sku']) && $v['sku'] == $p['variantSku']) $match = true;
                    elseif (isset($p['variantName']) && isset($v['name']) && $v['name'] == $p['variantName']) $match = true; // Legacy "name"
                    elseif (isset($p['variantName']) && isset($v['option']) && $v['option'] == $p['variantName']) $match = true; // New "option"

                    if ($match && isset($v['id'])) {
                        file_put_contents('debug_stock.txt', date('Y-m-d H:i:s') . " [FIX] Swapped Parent ID {$p['productId']} for Variant ID {$v['id']}\n", FILE_APPEND);
                        $p['productId'] = $v['id']; // <--- SWAP ID
                        break;
                    }
                }
            }
        }
    }

    $pdo->beginTransaction();
    try {
        // 1. Verificar Stock en Origen
        $stmtCheck = $pdo->prepare("SELECT stock FROM `inventory` WHERE product_id = ? AND branch_id = ?");
        $stmtCheck->execute([$p['productId'], $p['fromBranchId']]);
        $currentStock = $stmtCheck->fetchColumn();

        if ($currentStock === false) {
            // AUTO-HEALING (TRANSFERENCIA):
            // La columna 'stock' no existe en la tabla products para productos simples legacy.
            // Por lo tanto, el healing principal se enfoca en VARIANTE (dentro del JSON variants).

            $legacyStock = 0;
            $foundLegacy = false;

            // Intentar encontrar como VARIANTE (dentro del JSON variants de un padre)
            // BUG FIX: Usar un bucle para manejar falsos positivos del LIKE (ej. buscar "5" y encontrar "55")
            $stmtVar = $pdo->prepare("SELECT variants FROM products WHERE variants LIKE ? LIMIT 50");
            $stmtVar->execute(['%' . $p['productId'] . '%']);

            while ($parent = $stmtVar->fetch()) {
                if (!empty($parent['variants'])) {
                    $variants = json_decode($parent['variants'], true);
                    if (is_array($variants)) {
                        foreach ($variants as $v) {
                            // Comparación estricta o laxa dependiendo del tipo de dato, aquí string compare es seguro
                            if (isset($v['id']) && (string)$v['id'] === (string)$p['productId']) {
                                $legacyStock = (int)($v['stock'] ?? 0);
                                $foundLegacy = true;
                                break 2; // Salir de ambos bucles
                            }
                        }
                    }
                }
            }

            if ($foundLegacy) {
                // Curar: Crear el registro en inventory
                $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?)")
                    ->execute([(string)$p['productId'], $p['fromBranchId'], $legacyStock, time()]);

                $currentStock = $legacyStock;
            } else {
                // Si falla, es un error real de stock no encontrado
                throw new Exception("Stock no encontrado: No existe registro en inventario ni datos legacy recuperables.");
            }
        }

        if ($currentStock < $p['amount']) {
            throw new Exception("Stock insuficiente en la sede de origen. Disponible: " . ($currentStock ?: 0));
        }

        // 3. Descontar de Origen
        $normId = (string)$p['productId'];
        file_put_contents('debug_stock.txt', date('Y-m-d H:i:s') . " [TRANSFER] Deducting $normId from Branch {$p['fromBranchId']} Amount {$p['amount']}\n", FILE_APPEND);

        $updStmt = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ? WHERE `product_id` = ? AND `branch_id` = ?");
        $updStmt->execute([$p['amount'], $normId, $p['fromBranchId']]);

        file_put_contents('debug_stock.txt', date('Y-m-d H:i:s') . " [TRANSFER] RowCount: " . $updStmt->rowCount() . "\n", FILE_APPEND);

        if ($updStmt->rowCount() === 0) {
            throw new Exception("Error crítico: No se pudo descontar el stock. Verifique si el producto cambió mientras operaba.");
        }

        // 2. Construir Referencia Detallada (Incluyendo Variante)
        $variantInfo = "";
        if (!empty($p['variantSku']) && $p['variantSku'] !== $p['productId']) {
            $variantInfo = " [" . ($p['variantName'] ?? $p['variantSku']) . "]";
        }

        $stockAfterOrigin = $currentStock - $p['amount'];

        // 4. Registrar Movimiento Salida
        $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([generateUniqueId(), (string)$p['productId'], $p['fromBranchId'], $p['userId'], $p['userName'], 'transfer_out', $p['amount'], $stockAfterOrigin, "Traspaso a Sede #" . $p['toBranchId'] . $variantInfo, time() * 1000]);

        // 5. Sumar a Destino (Crear fila si no existe)
        $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, 0, ?) ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`)")
            ->execute([(string)$p['productId'], $p['toBranchId'], time()]);

        $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ? WHERE `product_id` = ? AND `branch_id` = ?")
            ->execute([$p['amount'], (string)$p['productId'], $p['toBranchId']]);

        // Obtener stock final destino para el log
        $stockAfterDest = $pdo->query("SELECT stock FROM `inventory` WHERE product_id = '{$p['productId']}' AND branch_id = {$p['toBranchId']}")->fetchColumn();

        // 6. Registrar Movimiento Entrada en Destino
        $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([generateUniqueId(), $p['productId'], $p['toBranchId'], $p['userId'], $p['userName'], 'transfer_in', $p['amount'], $stockAfterDest, "Recibido de Sede #" . $p['fromBranchId'] . $variantInfo, time() * 1000]);

        $pdo->commit();
        jsonResponse(['status' => 'success']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

function handleGetMovements($pdo)
{
    // Parámetros de paginación
    $page = intval($_GET['page'] ?? 1);
    $limit = intval($_GET['limit'] ?? 50);
    $offset = ($page - 1) * $limit;
    
    // Parámetros de filtrado
    $productId = $_GET['product_id'] ?? '';
    $movementType = $_GET['type'] ?? '';
    $searchText = $_GET['search'] ?? '';
    
    // Construir query con filtros
    $whereConditions = [];
    $params = [];
    
    if (!empty($productId)) {
        $whereConditions[] = "m.product_id = ?";
        $params[] = $productId;
    }
    
    if (!empty($movementType) && $movementType !== 'all') {
        $whereConditions[] = "m.type = ?";
        $params[] = $movementType;
    }
    
    if (!empty($searchText)) {
        $whereConditions[] = "(m.reference LIKE ? OR p.title LIKE ? OR p.code LIKE ?)";
        $searchParam = '%' . $searchText . '%';
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }
    
    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
    
    // Query para contar total de registros (para paginación)
    $countSql = "SELECT COUNT(*) as total FROM `product_movements` m LEFT JOIN `products` p ON m.product_id = p.id $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Query principal con paginación
    $sql = "SELECT m.*, p.title as `product_title`, p.code as `product_code` 
            FROM `product_movements` m 
            LEFT JOIN `products` p ON m.product_id = p.id 
            $whereClause 
            ORDER BY m.date DESC 
            LIMIT ? OFFSET ?";
    
    $stmt = $pdo->prepare($sql);
    
    // Bindear parámetros de filtros
    $paramIndex = 1;
    foreach ($params as $param) {
        $stmt->bindValue($paramIndex++, $param);
    }
    
    // Bindear LIMIT y OFFSET como enteros
    $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
    $stmt->bindValue($paramIndex, $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // POST-PROCESSING: Resolver títulos para IDs de Variantes que no cruzaron con products
    foreach ($rows as &$r) {
        if (empty($r['product_title'])) {
            // Intento de recuperación por Variante
            // Buscamos algún producto que contenga este ID en su JSON de variantes
            $stmtV = $pdo->prepare("SELECT title, variants FROM products WHERE variants LIKE ? LIMIT 1");
            $stmtV->execute(['%' . $r['product_id'] . '%']);
            $parent = $stmtV->fetch();

            if ($parent) {
                $r['product_title'] = $parent['title']; // Título del Padre
            } else {
                $r['product_title'] = "Producto Eliminado o ID Desconocido";
            }
        }
    }

    jsonResponse([
        'movements' => $rows,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalRecords,
            'totalPages' => ceil($totalRecords / $limit)
        ]
    ]);
}

function handleStockBreakdown($pdo)
{
    $stmt = $pdo->prepare("SELECT b.id as `branchId`, b.name as `branchName`, COALESCE(i.stock, 0) as `stock` FROM `branches` b LEFT JOIN `inventory` i ON b.id = i.branch_id AND i.product_id = ? WHERE b.is_active = 1");
    $stmt->execute([$_GET['product_id']]);
    jsonResponse($stmt->fetchAll());
}
?>