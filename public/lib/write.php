
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
        (id, code, title, description, cost, price, sale_price, images, category, extra_categories, is_visible, is_featured, variant_options, variants, created_at, track_stock, min_stock, barcode_ean) 
        VALUES (:id, :code, :title, :description, :cost, :price, :sale_price, :images, :category, :extra_categories, :is_visible, :is_featured, :variant_options, :variants, :created_at, :track_stock, :min_stock, :barcode_ean) 
        ON DUPLICATE KEY UPDATE 
        code=VALUES(code), title=VALUES(title), description=VALUES(description), cost=VALUES(cost), price=VALUES(price), sale_price=VALUES(sale_price), 
        images=VALUES(images), category=VALUES(category), extra_categories=VALUES(extra_categories), is_visible=VALUES(is_visible), is_featured=VALUES(is_featured), 
        variant_options=VALUES(variant_options), variants=VALUES(variants), track_stock=VALUES(track_stock), min_stock=VALUES(min_stock), barcode_ean=VALUES(barcode_ean)");

    $stmt->execute([
        ':id'               => $p['id'],
        ':code'             => $p['code'] ?? '',
        ':title'            => $p['title'] ?? '',
        ':description'      => $p['description'] ?? '',
        ':cost'             => floatval($p['cost'] ?? 0),
        ':price'            => floatval($p['price'] ?? 0),
        ':sale_price'       => floatval($p['salePrice'] ?? 0),
        ':images'           => safeJsonEncode($p['images'] ?? []),
        ':category'         => $p['category'] ?? 'General',
        // extra_categories: array de strings de categorías adicionales
        ':extra_categories' => safeJsonEncode(
            array_values(array_filter(
                array_map('strval', $p['extraCategories'] ?? []),
                fn($c) => $c !== ''
            ))
        ),
        ':is_visible'       => ($p['isVisible'] ?? true) ? 1 : 0,
        ':is_featured'      => ($p['isFeatured'] ?? false) ? 1 : 0,
        ':variant_options'  => safeJsonEncode($p['variantOptions'] ?? []),
        ':variants'         => safeJsonEncode($p['variants'] ?? []),
        ':created_at'       => time() * 1000, // FORCE SERVER TIME
        ':track_stock'      => ($p['trackStock'] ?? true) ? 1 : 0,
        ':min_stock'        => intval($p['minStock'] ?? 5),
        ':barcode_ean'      => $p['barcodeEan'] ?? ($p['barcode_ean'] ?? '')
    ]);

    // 2. Gestión de Inventario MULTISEDE (PADRE y VARIANTES)
    $effectiveBranchId = $branchId > 0 ? $branchId : 1;
    $hasVariants = !empty($p['variants']) && is_array($p['variants']);
    $invStmt = $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock), updated_at = VALUES(updated_at)");

    if ($hasVariants) {
        $parentBranchSums = [];

        foreach ($p['variants'] as $variant) {
            if (empty($variant['id'])) continue;
            $vId = $variant['id'];

            // Si la variante trae inventario distribuido en branchStock
            if (!empty($variant['branchStock']) && (is_array($variant['branchStock']) || is_object($variant['branchStock']))) {
                foreach ((array)$variant['branchStock'] as $bId => $bStock) {
                    $bId = intval($bId);
                    if ($bId <= 0) continue;
                    $stkVal = max(0, intval($bStock));
                    $invStmt->execute([$vId, $bId, $stkVal, time()]);
                    $parentBranchSums[$bId] = ($parentBranchSums[$bId] ?? 0) + $stkVal;
                }
            } else {
                // Si no trae branchStock, se guarda en la sede activa
                $vStock = max(0, intval($variant['stock'] ?? 0));
                $invStmt->execute([$vId, $effectiveBranchId, $vStock, time()]);
                $parentBranchSums[$effectiveBranchId] = ($parentBranchSums[$effectiveBranchId] ?? 0) + $vStock;
            }
        }

        // Sincronizar stock consolidado del producto padre en cada sede afectada
        foreach ($parentBranchSums as $bId => $sumStock) {
            $invStmt->execute([$p['id'], $bId, $sumStock, time()]);
        }
    } else {
        // Producto simple sin variantes
        if (!empty($p['branchStock']) && (is_array($p['branchStock']) || is_object($p['branchStock']))) {
            foreach ((array)$p['branchStock'] as $bId => $bStock) {
                $bId = intval($bId);
                if ($bId <= 0) continue;
                $stkVal = max(0, intval($bStock));
                $invStmt->execute([$p['id'], $bId, $stkVal, time()]);
            }
        } else {
            $newStockParent = max(0, intval($p['stock'] ?? 0));
            $invStmt->execute([$p['id'], $effectiveBranchId, $newStockParent, time()]);
        }
    }

    // Auditoría para la sede efectiva
    $stmtAfterCheck = $pdo->prepare("SELECT stock FROM `inventory` WHERE product_id = ? AND branch_id = ?");
    $stmtAfterCheck->execute([$p['id'], $effectiveBranchId]);
    $currentParentStock = intval($stmtAfterCheck->fetchColumn() ?: 0);

    if ($currentParentStock !== $prevStock) {
        $diff = $currentParentStock - $prevStock;
        $type = $diff > 0 ? 'entry' : 'exit';
        $userId = $p['userId'] ?? 'system';
        $userName = $p['userName'] ?? ($isNew ? 'Creador' : 'Editor');
        $ref = $isNew ? "Stock Inicial" : "Ajuste Manual";

        $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([generateUniqueId(), $p['id'], $effectiveBranchId, $userId, $userName, $type, abs($diff), $currentParentStock, $ref, time() * 1000]);
    }

    jsonResponse(['status' => 'success']);
}

function handleSaveOrder($pdo, $input, $branchId)
{
    $o = $input;
    $itemsJson = safeJsonEncode($o['items'] ?? []);

    $pdo->beginTransaction();
    try {
        // 1. Verificar orden existente y su estado de stock previo con bloqueo de fila
        $stmtCheck = $pdo->prepare("SELECT status, items, stock_deducted, branch_id FROM `orders` WHERE id = ? FOR UPDATE");
        $stmtCheck->execute([strval($o['id'])]);
        $existingOrder = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        // LÓGICA DE ASIGNACIÓN DE SEDE SEGURA:
        // Si no se especifica sede en la petición, preservar la sede original de la orden existente
        $activeBranchId = intval($o['branchId'] ?? ($o['branch_id'] ?? 0));
        if ($activeBranchId <= 0) {
            if ($existingOrder && !empty($existingOrder['branch_id']) && intval($existingOrder['branch_id']) > 0) {
                $activeBranchId = intval($existingOrder['branch_id']);
            } else {
                $activeBranchId = intval($branchId > 0 ? $branchId : 1);
            }
        }

        $newStatus = $o['status'] ?? 'pending';
        $oldStatus = $existingOrder ? $existingOrder['status'] : null;
        $isDeducted = $existingOrder ? intval($existingOrder['stock_deducted'] ?? 0) : 0;
        $oldBranchId = $existingOrder ? intval($existingOrder['branch_id'] ?: $activeBranchId) : $activeBranchId;

        $stockRestore = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?");
        $movementInsert = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)");
        $stockFetch = $pdo->prepare("SELECT `stock` FROM `inventory` WHERE `product_id` = ? AND `branch_id` = ?");
        $trackStmt = $pdo->prepare("SELECT track_stock, title FROM `products` WHERE `id` = ?");

        // Soporte de configuración para permitir stock negativo (sobregiro en POS)
        $allowNegativeStock = false;
        try {
            $stmtSet = $pdo->prepare("SELECT setting_value FROM `settings` WHERE setting_key = 'allowNegativeStock' OR setting_key = 'allow_negative_stock' LIMIT 1");
            $stmtSet->execute();
            $val = $stmtSet->fetchColumn();
            if ($val !== false) {
                $allowNegativeStock = filter_var($val, FILTER_VALIDATE_BOOLEAN);
            }
        } catch (Exception $ignore) {}

        // 2. RESTAURAR STOCK AL CANCELAR O VOLVER A PENDIENTE (Solo si fue descontado previamente)
        $branchToRestore = (!empty($existingOrder['branch_id']) && intval($existingOrder['branch_id']) > 0) ? intval($existingOrder['branch_id']) : $activeBranchId;

        if ($isDeducted === 1 && ($newStatus === 'cancelled' || $newStatus === 'pending')) {
            $itemsArr = safeJsonDecode($existingOrder['items']);
            foreach ($itemsArr as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;

                    $stockRestore->execute([$qty, time(), $targetId, $branchToRestore]);
                    if ($targetId !== $prodId) {
                        $stockRestore->execute([$qty, time(), $prodId, $branchToRestore]);
                    }

                    $stockFetch->execute([$targetId, $branchToRestore]);
                    $currentStock = $stockFetch->fetchColumn() ?: 0;

                    $refAction = $newStatus === 'cancelled' ? 'Anulación' : 'Retorno a Pendiente';
                    $movementInsert->execute([generateUniqueId(), $targetId, $branchToRestore, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'entry', $qty, intval($currentStock), "$refAction Venta #" . $o['id'], time() * 1000]);
                }
            }
            $isDeducted = 0;
        }

        // 3. AJUSTAR STOCK AL EDITAR PEDIDO YA DESCONTADO (O TRASLADO DE SEDE)
        $oldItemsJson = $existingOrder ? $existingOrder['items'] : '[]';
        $itemsChanged = ($oldItemsJson !== $itemsJson);
        $branchChanged = ($oldBranchId !== $activeBranchId);

        if ($isDeducted === 1 && $oldStatus === 'completed' && $newStatus === 'completed' && ($itemsChanged || $branchChanged)) {
            // A. Revertir items anteriores usando la sede de la orden original
            $itemsArrOld = safeJsonDecode($oldItemsJson);
            foreach ($itemsArrOld as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;

                    $stockRestore->execute([$qty, time(), $targetId, $oldBranchId]);
                    if ($targetId !== $prodId) {
                        $stockRestore->execute([$qty, time(), $prodId, $oldBranchId]);
                    }

                    $stockFetch->execute([$targetId, $oldBranchId]);
                    $currentStock = $stockFetch->fetchColumn() ?: 0;

                    $refReason = $branchChanged ? "Reversión por Cambio de Sede (#{$oldBranchId} -> #{$activeBranchId})" : "Reversión por Edición";
                    $movementInsert->execute([generateUniqueId(), $targetId, $oldBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'entry', $qty, intval($currentStock), "$refReason Venta #" . $o['id'], time() * 1000]);
                }
            }

            // B. Descontar nuevos items con chequeo atómico en la nueva sede
            $itemsArrNew = safeJsonDecode($itemsJson);
            $stockUpdateAtomic = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ? AND `stock` >= ?");
            $stockUpdateNoLimit = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?");

            foreach ($itemsArrNew as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;

                    $trackStmt->execute([$prodId]);
                    $pData = $trackStmt->fetch(PDO::FETCH_ASSOC);
                    $trackStock = $pData ? (bool)($pData['track_stock'] ?? 1) : true;
                    $title = $item['productTitle'] ?? ($pData['title'] ?? $prodId);

                    if ($trackStock) {
                        if ($allowNegativeStock) {
                            $stockUpdateNoLimit->execute([$qty, time(), $targetId, $activeBranchId]);
                        } else {
                            $stockUpdateAtomic->execute([$qty, time(), $targetId, $activeBranchId, $qty]);
                            if ($stockUpdateAtomic->rowCount() === 0) {
                                throw new Exception("Stock insuficiente para '{$title}' en la edición.");
                            }
                        }
                        if ($targetId !== $prodId) {
                            $stockUpdateNoLimit->execute([$qty, time(), $prodId, $activeBranchId]);
                        }
                    } else {
                        $stockUpdateNoLimit->execute([$qty, time(), $targetId, $activeBranchId]);
                        if ($targetId !== $prodId) {
                            $stockUpdateNoLimit->execute([$qty, time(), $prodId, $activeBranchId]);
                        }
                    }

                    $stockFetch->execute([$targetId, $activeBranchId]);
                    $currentStock = $stockFetch->fetchColumn() ?: 0;

                    $movementInsert->execute([generateUniqueId(), $targetId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'POS', 'sale', $qty, intval($currentStock), "Re-Descuento Edición Venta #" . $o['id'], time() * 1000]);
                }
            }
            $o['processStock'] = false;
        }

        // 4. DESCONTAR STOCK EN COMPLETADO NUEVO O TRANSICIÓN A COMPLETED
        $shouldProcessStock = filter_var($o['processStock'] ?? false, FILTER_VALIDATE_BOOLEAN) || (!isset($o['processStock']) && $newStatus === 'completed' && $isDeducted === 0);

        if ($isDeducted === 0 && $newStatus === 'completed' && $shouldProcessStock) {
            $itemsArr = safeJsonDecode($itemsJson);
            $checkStmt = $pdo->prepare("SELECT `stock` FROM `inventory` WHERE `product_id` = ? AND `branch_id` = ? FOR UPDATE");

            // Fase 1: Agregación de demandas para validación de stock consolidada
            $demands = [];
            foreach ($itemsArr as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;
                    $title = $item['productTitle'] ?? $prodId;

                    if (!isset($demands[$targetId])) {
                        $demands[$targetId] = ['qty' => 0, 'prodId' => $prodId, 'title' => $title];
                    }
                    $demands[$targetId]['qty'] += $qty;
                }
            }

            foreach ($demands as $targetId => $d) {
                $prodId = $d['prodId'];
                $totQty = $d['qty'];
                $title = $d['title'];

                $trackStmt->execute([$prodId]);
                $pData = $trackStmt->fetch(PDO::FETCH_ASSOC);
                $trackStock = $pData ? (bool)($pData['track_stock'] ?? 1) : true;

                if ($trackStock) {
                    $checkStmt->execute([$targetId, $activeBranchId]);
                    $curStock = $checkStmt->fetchColumn();

                    // Auto-healing si no existe el registro en la sede
                    if ($curStock === false) {
                        $initialStock = 0;
                        $stmtV = $pdo->prepare("SELECT variants FROM products WHERE id = ?");
                        $stmtV->execute([$prodId]);
                        $prodRow = $stmtV->fetch(PDO::FETCH_ASSOC);
                        if ($prodRow && !empty($prodRow['variants'])) {
                            $vars = safeJsonDecode($prodRow['variants']);
                            foreach ($vars as $v) {
                                if (!empty($v['id']) && $v['id'] === $targetId) {
                                    $initialStock = intval($v['stock'] ?? 0);
                                    if (!empty($v['branchStock']) && isset($v['branchStock'][$activeBranchId])) {
                                        $initialStock = intval($v['branchStock'][$activeBranchId]);
                                    }
                                    break;
                                }
                            }
                        }
                        $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock)")
                            ->execute([$targetId, $activeBranchId, $initialStock, time()]);
                        $curStock = $initialStock;
                    }

                    if (!$allowNegativeStock && intval($curStock) < $totQty) {
                        throw new Exception("Stock insuficiente para '{$title}'. Disponible: {$curStock}, Requerido: {$totQty}");
                    }
                }
            }

            // Fase 2: Descuento atómico y registro de movimientos
            $stockUpdateAtomic = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ? AND `stock` >= ?");
            $stockUpdateNoLimit = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` - ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?");

            foreach ($itemsArr as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;

                    $trackStmt->execute([$prodId]);
                    $pData = $trackStmt->fetch(PDO::FETCH_ASSOC);
                    $trackStock = $pData ? (bool)($pData['track_stock'] ?? 1) : true;
                    $title = $item['productTitle'] ?? ($pData['title'] ?? $prodId);

                    if ($trackStock) {
                        if ($allowNegativeStock) {
                            $stockUpdateNoLimit->execute([$qty, time(), $targetId, $activeBranchId]);
                        } else {
                            $stockUpdateAtomic->execute([$qty, time(), $targetId, $activeBranchId, $qty]);
                            if ($stockUpdateAtomic->rowCount() === 0) {
                                throw new Exception("Conflicto de concurrencia: El stock de '{$title}' cambió durante la venta.");
                            }
                        }
                        if ($targetId !== $prodId) {
                            $stockUpdateNoLimit->execute([$qty, time(), $prodId, $activeBranchId]);
                        }
                    } else {
                        $stockUpdateNoLimit->execute([$qty, time(), $targetId, $activeBranchId]);
                        if ($targetId !== $prodId) {
                            $stockUpdateNoLimit->execute([$qty, time(), $prodId, $activeBranchId]);
                        }
                    }

                    $stockFetch->execute([$targetId, $activeBranchId]);
                    $currentStock = $stockFetch->fetchColumn() ?: 0;

                    $saleType = (!empty($o['deliveryMethod']) && $o['deliveryMethod'] === 'pos') ? 'POS' : 'Web';
                    $refStr = "Venta $saleType #" . $o['id'];
                    $movementInsert->execute([generateUniqueId(), $targetId, $activeBranchId, $o['sellerId'] ?? 'system', $o['sellerName'] ?? 'Sistema', 'sale', $qty, intval($currentStock), $refStr, time() * 1000]);
                }
            }
            $isDeducted = 1;
        }

        // 5. Guardar Orden con estado de stock_deducted actualizado
        $smtInsert = "INSERT INTO `orders` (id, branch_id, customer_name, customer_phone, customer_address, items, subtotal, discount, total, `status`, `date`, payment_method, seller_id, seller_name, delivery_method, pickup_branch_id, stock_deducted) 
        VALUES (:id, :branch_id, :customer_name, :customer_phone, :customer_address, :items, :subtotal, :discount, :total, :status, :date, :payment_method, :seller_id, :seller_name, :delivery_method, :pickup_branch_id, :stock_deducted) 
        ON DUPLICATE KEY UPDATE 
        `status`=VALUES(`status`), 
        `branch_id`=VALUES(`branch_id`), 
        customer_name=VALUES(customer_name), customer_phone=VALUES(customer_phone), customer_address=VALUES(customer_address), items=VALUES(items), subtotal=VALUES(subtotal), discount=VALUES(discount), total=VALUES(total), payment_method=VALUES(payment_method), seller_id=VALUES(seller_id), seller_name=VALUES(seller_name), delivery_method=VALUES(delivery_method), pickup_branch_id=VALUES(pickup_branch_id), stock_deducted=VALUES(stock_deducted)";

        $stmt = $pdo->prepare($smtInsert);
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
            ':status' => $newStatus,
            ':date' => intval($o['date'] ?? (time() * 1000)),
            ':payment_method' => $o['paymentMethod'] ?? '',
            ':seller_id' => $o['sellerId'] ?? '',
            ':seller_name' => $o['sellerName'] ?? '',
            ':delivery_method' => $o['deliveryMethod'] ?? (
                (empty($o['sellerId']) || $o['sellerId'] === 'web-client' || $o['sellerId'] === 'online') ? 'delivery' : 'pos'
            ),
            ':pickup_branch_id' => intval($o['pickupBranchId'] ?? 0),
            ':stock_deducted' => $isDeducted
        ]);

        $pdo->commit();
        jsonResponse(['status' => 'success', 'stock_deducted' => $isDeducted]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => $e->getMessage()], 400);
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
    // Si se elimina una orden que ya había descontado inventario, restituir stock
    if ($table === 'orders') {
        $stmtOrd = $pdo->prepare("SELECT branch_id, items, stock_deducted, status FROM `orders` WHERE `$idField` = ?");
        $stmtOrd->execute([$idValue]);
        $order = $stmtOrd->fetch(PDO::FETCH_ASSOC);

        if ($order && intval($order['stock_deducted'] ?? 0) === 1) {
            $branchId = intval($order['branch_id'] ?: 1);
            $items = safeJsonDecode($order['items'] ?? '[]');

            $stockRestore = $pdo->prepare("UPDATE `inventory` SET `stock` = `stock` + ?, `updated_at` = ? WHERE `product_id` = ? AND `branch_id` = ?");
            $movementInsert = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) VALUES (?,?,?,?,?,?,?,?,?,?)");
            $stockFetch = $pdo->prepare("SELECT `stock` FROM `inventory` WHERE `product_id` = ? AND `branch_id` = ?");

            foreach ($items as $item) {
                if (!empty($item['productId']) && !str_starts_with($item['productId'], 'manual-') && !str_starts_with($item['productId'], 'custom')) {
                    $qty = intval($item['quantity'] ?? 1);
                    $prodId = $item['productId'];
                    $targetId = !empty($item['variantId']) ? $item['variantId'] : $prodId;

                    $stockRestore->execute([$qty, time(), $targetId, $branchId]);
                    $stockFetch->execute([$targetId, $branchId]);
                    $currentStock = $stockFetch->fetchColumn() ?: 0;

                    $movementInsert->execute([
                        generateUniqueId(),
                        $targetId,
                        $branchId,
                        'system',
                        'Administrador',
                        'entry',
                        $qty,
                        intval($currentStock),
                        "Devolución por Eliminación Pedido #" . $idValue,
                        time() * 1000
                    ]);
                }
            }
        }
    }

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
