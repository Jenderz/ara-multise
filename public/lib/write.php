
<?php
function handleSaveProduct($pdo, $input, $branchId)
{
    $p = $input;
    $prevStock = 0;
    $isNew = true;

    // Verificar stock anterior (Padre)
    if (!empty($p['id'])) {
        $stmtCheck = $pdo->prepare("SELECT stock FROM inventory WHERE product_id = ? AND branch_id = ?");
        $stmtCheck->execute([$p['id'], $branchId]);
        $res = $stmtCheck->fetchColumn();
        if ($res !== false) {
            $prevStock = (int)$res;
            $isNew = false;
        }
    }

    // 1. Guardar Datos Maestros del Producto (JSON variants se guarda como referencia estructural)
    $stmt = $pdo->prepare("INSERT INTO `products` 
        (id, code, title, description, cost, price, sale_price, images, category, is_visible, is_featured, variant_options, variants, created_at, track_stock, min_stock) 
        VALUES (:id, :code, :title, :description, :cost, :price, :sale_price, :images, :category, :is_visible, :is_featured, :variant_options, :variants, :created_at, :track_stock, :min_stock) 
        ON DUPLICATE KEY UPDATE 
        code=VALUES(code), title=VALUES(title), description=VALUES(description), cost=VALUES(cost), price=VALUES(price), sale_price=VALUES(sale_price), 
        images=VALUES(images), category=VALUES(category), is_visible=VALUES(is_visible), is_featured=VALUES(is_featured), 
        variant_options=VALUES(variant_options), variants=VALUES(variants), track_stock=VALUES(track_stock), min_stock=VALUES(min_stock)");

    $stmt->execute([
        ':id' => $p['id'],
        ':code' => $p['code'] ?? '',
        ':title' => $p['title'] ?? '',
        ':description' => $p['description'] ?? '',
        ':cost' => floatval($p['cost'] ?? 0),
        ':price' => floatval($p['price'] ?? 0),
        ':sale_price' => floatval($p['salePrice'] ?? 0),
        ':images' => safeJsonEncode($p['images'] ?? []),
        ':category' => $p['category'] ?? 'General',
        ':is_visible' => ($p['isVisible'] ?? true) ? 1 : 0,
        ':is_featured' => ($p['isFeatured'] ?? false) ? 1 : 0,
        ':variant_options' => safeJsonEncode($p['variantOptions'] ?? []),
        ':variants' => safeJsonEncode($p['variants'] ?? []),
        ':created_at' => time() * 1000, // FORCE SERVER TIME
        ':track_stock' => ($p['trackStock'] ?? true) ? 1 : 0,
        ':min_stock' => intval($p['minStock'] ?? 5)
    ]);

    // 2. Gestión de Inventario (PADRE)
    // Siempre guardamos el registro del padre en inventory
    $newStockParent = intval($p['stock'] ?? 0);

    // Si tiene variantes, el stock del padre es la suma de las variantes para mantener coherencia
    if (!empty($p['variants']) && is_array($p['variants'])) {
        $newStockParent = 0;
        foreach ($p['variants'] as $v) {
            $newStockParent += intval($v['stock'] ?? 0);
        }
    }

    $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock), updated_at = VALUES(updated_at)")
        ->execute([$p['id'], $branchId, $newStockParent, time()]);

    // Auditoría Padre
    if ($newStockParent !== $prevStock) {
        $diff = $newStockParent - $prevStock;
        $type = $diff > 0 ? 'entry' : 'exit';
        $userId = $p['userId'] ?? 'system';
        $userName = $p['userName'] ?? ($isNew ? 'Creador' : 'Editor');
        $ref = $isNew ? "Stock Inicial" : "Ajuste Manual";

        $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([generateUniqueId(), $p['id'], $branchId, $userId, $userName, $type, abs($diff), $newStockParent, $ref, time() * 1000]);
    }

    // 3. Gestión de Inventario (VARIANTES - CRÍTICO PARA MULTISEDE)
    // Desglosamos cada variante y guardamos su stock específico en la tabla inventory usando el ID de la variante
    if (!empty($p['variants']) && is_array($p['variants'])) {
        $invStmt = $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock), updated_at = VALUES(updated_at)");

        foreach ($p['variants'] as $variant) {
            if (empty($variant['id'])) continue;

            // Usamos el ID de la variante como 'product_id' en la tabla inventory
            $vStock = intval($variant['stock'] ?? 0);
            $invStmt->execute([$variant['id'], $branchId, $vStock, time()]);
        }
    }

    jsonResponse(['status' => 'success']);
}

function handleSaveOrder($pdo, $input, $branchId)
{
    $o = $input;
    $itemsJson = safeJsonEncode($o['items'] ?? []);

    $pdo->beginTransaction();
    try {
        $smtInsert = "INSERT INTO `orders` (id, branch_id, customer_name, customer_phone, customer_address, items, subtotal, discount, total, `status`, `date`, payment_method, seller_id, seller_name, delivery_method, pickup_branch_id) VALUES (:id, :branch_id, :customer_name, :customer_phone, :customer_address, :items, :subtotal, :discount, :total, :status, :date, :payment_method, :seller_id, :seller_name, :delivery_method, :pickup_branch_id) 
        ON DUPLICATE KEY UPDATE 
        `status`=VALUES(`status`), 
        `branch_id`=VALUES(`branch_id`), 
        customer_name=VALUES(customer_name), customer_phone=VALUES(customer_phone), customer_address=VALUES(customer_address), items=VALUES(items), subtotal=VALUES(subtotal), discount=VALUES(discount), total=VALUES(total), payment_method=VALUES(payment_method), seller_id=VALUES(seller_id), seller_name=VALUES(seller_name), delivery_method=VALUES(delivery_method), pickup_branch_id=VALUES(pickup_branch_id)";
        
        $stmt = $pdo->prepare($smtInsert);

        // LÓGICA DE ASIGNACIÓN DE SEDE (CRÍTICA):
        // 1. Si viene 'branchId' explícito en el input, ÚSALO (permite reasignar la orden a otra sede).
        // 2. Si NO viene, usa la sede del usuario que está escribiendo ($branchId).
        // 3. Si aún así es 0 o null, usa 1 (Principal).
        $activeBranchId = intval($o['branchId'] ?? ($o['branch_id'] ?? $branchId));
        if ($activeBranchId <= 0) $activeBranchId = 1;

        // --- LÓGICA DE CAMBIO DE ESTADO Y STOCK (NUEVO) ---
        // Verificar estado anterior si existe la orden
        $stmtCheck = $pdo->prepare("SELECT status, items FROM orders WHERE id = ?");
        $stmtCheck->execute([strval($o['id'])]);
        $existingOrder = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        $newStatus = $o['status'] ?? 'pending';
        $oldStatus = $existingOrder ? $existingOrder['status'] : null;

        // 1. RESTAURAR STOCK AL CANCELAR (Si estaba completada)
        if ($oldStatus === 'completed' && $newStatus === 'cancelled') {
            $itemsArr = safeJsonDecode($existingOrder['items']);
            $stockRestore = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ? WHERE `product_id` = ? AND `branch_id` = ?");
            $movementInsert = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)");

            foreach ($itemsArr as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-')) {
                    $qty = intval($item['quantity']);
                    $prodId = $item['productId'];

                    // Restaurar Padre
                    $stockRestore->execute([$qty, $prodId, $activeBranchId]);

                    // Restaurar Variante si existe
                    if (!empty($item['variantId'])) {
                        $stockRestore->execute([$qty, $item['variantId'], $activeBranchId]);
                    }

                    // Log Movimiento
                    $currentStock = $pdo->query("SELECT stock FROM inventory WHERE product_id = '$prodId' AND branch_id = $activeBranchId")->fetchColumn();
                    $movementInsert->execute([generateUniqueId(), $prodId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'entry', $qty, intval($currentStock), "Anulación Venta #" . $o['id'], time() * 1000]);
                }
            }
        }

        // 1.5. AJUSTAR STOCK AL EDITAR PEDIDO COMPLETADO
        $oldItemsJson = $existingOrder ? $existingOrder['items'] : '[]';
        if ($oldStatus === 'completed' && $newStatus === 'completed' && $oldItemsJson !== $itemsJson) {
            $stockRestore = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ? WHERE `product_id` = ? AND `branch_id` = ?");
            $stockUpdate = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ? WHERE `product_id` = ? AND `branch_id` = ?");
            $movementInsert = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)");

            // Revertir items viejos
            $itemsArrOld = safeJsonDecode($oldItemsJson);
            foreach ($itemsArrOld as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-')) {
                    $qty = intval($item['quantity']);
                    $prodId = $item['productId'];
                    $stockRestore->execute([$qty, $prodId, $activeBranchId]);
                    if (!empty($item['variantId'])) {
                        $stockRestore->execute([$qty, $item['variantId'], $activeBranchId]);
                    }
                    $currentStock = $pdo->query("SELECT stock FROM inventory WHERE product_id = '$prodId' AND branch_id = $activeBranchId")->fetchColumn();
                    $movementInsert->execute([generateUniqueId(), $prodId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'entry', $qty, intval($currentStock), "Reversión por Edición Venta #" . $o['id'], time() * 1000]);
                }
            }

            // Descontar items nuevos
            $itemsArrNew = safeJsonDecode($itemsJson);
            foreach ($itemsArrNew as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-')) {
                    $qty = intval($item['quantity']);
                    $prodId = $item['productId'];
                    $stockUpdate->execute([$qty, $prodId, $activeBranchId]);
                    if (!empty($item['variantId'])) {
                        $stockUpdate->execute([$qty, $item['variantId'], $activeBranchId]);
                    }
                    $currentStock = $pdo->query("SELECT stock FROM inventory WHERE product_id = '$prodId' AND branch_id = $activeBranchId")->fetchColumn();
                    $movementInsert->execute([generateUniqueId(), $prodId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'sale', $qty, intval($currentStock), "Re-Descuento Edición Venta #" . $o['id'], time() * 1000]);
                }
            }

            // Como ya se ajustó el stock por la edición, evitamos que processStock lo vuelva a descontar
            $o['processStock'] = false;
        }

        $stmt->execute([
            ':id' => strval($o['id']),
            ':branch_id' => $activeBranchId,
            ':customer_name' => $o['customerName'] ?? '',
            ':customer_phone' => $o['customerPhone'] ?? '',
            ':customer_address' => $o['customerAddress'] ?? '',
            ':items' => $itemsJson,
            ':subtotal' => floatval($o['subtotal'] ?? 0),
            ':discount' => floatval($o['discount'] ?? 0),
            ':total' => floatval($o['total'] ?? 0),
            ':status' => $o['status'] ?? 'pending',
            // FIX: Usar tiempo del servidor para evitar órdenes "invisibles" por reloj desajustado del cliente
            ':date' => time() * 1000,
            ':payment_method' => $o['paymentMethod'] ?? '',
            ':seller_id' => $o['sellerId'] ?? '',
            ':seller_name' => $o['sellerName'] ?? '',
            ':delivery_method' => $o['deliveryMethod'] ?? (
                // Lógica de Inferencia Inteligente para fallback
                (empty($o['sellerId']) || $o['sellerId'] === 'web-client' || $o['sellerId'] === 'online') 
                ? 'delivery' 
                : 'pos'
            ),
            ':pickup_branch_id' => intval($o['pickupBranchId'] ?? 0)
        ]);

        // Procesar descuento de stock
        if (($o['processStock'] ?? false) && $o['status'] === 'completed') {
            $itemsArr = safeJsonDecode($itemsJson);
            $stockUpdate = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ? WHERE `product_id` = ? AND `branch_id` = ?");
            $movementInsert = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)");

            foreach ($itemsArr as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-')) {
                    $qty = intval($item['quantity']);
                    $prodId = $item['productId'];

                    // 1. Descontar del Producto Padre (Para control global)
                    $stockUpdate->execute([$qty, $prodId, $activeBranchId]);

                    // 2. Si es una variante (tiene variantId), descontar de su registro de inventario específico
                    if (!empty($item['variantId'])) {
                        $variantId = $item['variantId'];
                        $stockUpdate->execute([$qty, $variantId, $activeBranchId]);

                        // AUTO-HEALING: Si el update no afectó filas (rowCount == 0),
                        // significa que la variante existe en el JSON pero NO en la tabla inventory.
                        // Debemos crear el registro en inventory "on the fly" usando el stock del JSON.
                        if ($stockUpdate->rowCount() == 0) {
                            // a. Buscar el producto padre para leer su JSON de variantes
                            $stmtProd = $pdo->prepare("SELECT variants FROM products WHERE id = ?");
                            $stmtProd->execute([$prodId]);
                            $prodVariantsJson = $stmtProd->fetchColumn();

                            if ($prodVariantsJson) {
                                $variantsArr = safeJsonDecode($prodVariantsJson);
                                $foundVariant = null;

                                // b. Encontrar la variante específica en el JSON
                                foreach ($variantsArr as $vObj) {
                                    if (isset($vObj['id']) && $vObj['id'] === $variantId) {
                                        $foundVariant = $vObj;
                                        break;
                                    }
                                }

                                // c. Si encontramos la variante, insertamos su stock "legacy" menos la venta actual
                                if ($foundVariant) {
                                    $currentJsonStock = intval($foundVariant['stock'] ?? 0);
                                    $newRealStock = $currentJsonStock - $qty;

                                    // Insertar en inventory
                                    $insertFix = $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?)");
                                    $insertFix->execute([$variantId, $activeBranchId, $newRealStock, time()]);
                                }
                            }
                        }
                    }

                    // Registrar Movimiento
                    $currentStock = $pdo->query("SELECT stock FROM inventory WHERE product_id = '$prodId' AND branch_id = $activeBranchId")->fetchColumn();
                    
                    $saleType = (!empty($o['deliveryMethod']) && $o['deliveryMethod'] === 'pos') ? 'POS' : 'Web';
                    $refStr = "Venta $saleType #" . $o['id'];
                    
                    $movementInsert->execute([generateUniqueId(), $prodId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'Sistema', 'sale', $qty, intval($currentStock), $refStr, time() * 1000]);
                }
            }
        }

        $pdo->commit();
        jsonResponse(['status' => 'success']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => 'Error al guardar pedido', 'details' => $e->getMessage()], 500);
    }
}

function handleSaveSettings($pdo, $input)
{
    foreach ($input as $k => $v) {
        if (is_bool($v)) $val = $v ? 'true' : 'false';
        elseif (is_array($v) || is_object($v)) $val = safeJsonEncode($v);
        else $val = $v;

        $pdo->prepare("INSERT INTO `settings` (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)")->execute([$k, $val]);
    }
    jsonResponse(['status' => 'success']);
}

function handleDelete($pdo, $table, $idField, $idValue)
{
    $pdo->prepare("DELETE FROM `$table` WHERE `$idField` = ?")->execute([$idValue]);

    // Limpieza en cascada manual si es producto
    if ($table === 'products') {
        $pdo->prepare("DELETE FROM `inventory` WHERE product_id = ?")->execute([$idValue]);
        $pdo->prepare("DELETE FROM `product_movements` WHERE product_id = ?")->execute([$idValue]);
    }
    jsonResponse(['status' => 'success']);
}

function handleReset($pdo, $input)
{
    $opts = $input['options'] ?? [];
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    try {
        if (in_array('products', $opts)) {
            $pdo->exec("DELETE FROM `products`");
            $pdo->exec("DELETE FROM `inventory`");
            $pdo->exec("DELETE FROM `product_movements`");
        }
        if (in_array('orders', $opts)) {
            $pdo->exec("DELETE FROM `orders`");
            $pdo->exec("DELETE FROM `product_movements`");
        }
        if (in_array('customers', $opts)) {
            $pdo->exec("DELETE FROM `customers`");
        }
        if (in_array('categories', $opts)) {
            $pdo->exec("DELETE FROM `categories`");
        }
        if (in_array('coupons', $opts)) {
            $pdo->exec("DELETE FROM `coupons`");
        }
        if (in_array('branches', $opts)) {
            $pdo->exec("DELETE FROM `branches` WHERE id != 1");
            $pdo->exec("DELETE FROM `inventory` WHERE branch_id != 1");
        }
        if (in_array('settings', $opts)) {
            $pdo->exec("DELETE FROM `settings` WHERE `setting_key` != 'users'");
            $pdo->exec("DELETE FROM `push_subscriptions`");
        }
    } catch (Exception $e) {
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        jsonResponse(['error' => 'Reset Error', 'details' => $e->getMessage()], 500);
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    jsonResponse(['status' => 'success']);
}

// Nueva función encapsulada para Sedes
function handleSaveBranch($pdo, $input)
{
    // 1. Obtener Plan Tier desde Settings
    $rawPlan = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'planTier'")->fetchColumn();
    $planTier = $rawPlan ? str_replace('"', '', $rawPlan) : 'multi';

    // 2. Si es Single y estamos creando una nueva (no editando), validar conteo
    $b = $input;
    if ($planTier === 'single' && !isset($b['id'])) {
        $count = $pdo->query("SELECT COUNT(*) FROM branches")->fetchColumn();
        if ($count >= 1) {
            jsonResponse(['error' => 'Upgrade Required', 'details' => 'Tu plan actual (Básico) solo permite 1 sede principal.'], 403);
            return;
        }
    }

    if (isset($b['id'])) {
        $pdo->prepare("UPDATE `branches` SET name=?, address=?, is_active=? WHERE id=?")->execute([$b['name'], $b['address'], $b['isActive'] ? 1 : 0, $b['id']]);
    } else {
        $pdo->prepare("INSERT INTO `branches` (name, address, is_active) VALUES (?, ?, ?)")->execute([$b['name'], $b['address'], $b['isActive'] ? 1 : 0]);
    }
    jsonResponse(['status' => 'success']);
}
?>
