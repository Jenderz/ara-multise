
<?php
function handleSaveProduct($pdo, $input, $branchId)
{
    $authUser = getAuthUser($pdo);
    if (!$authUser) {
        jsonResponse(['error' => 'No autorizado. Se requiere sesión activa.'], 401);
    }
    $role = $authUser['role'] ?? '';
    $perms = is_array($authUser['permissions'] ?? null) ? $authUser['permissions'] : [];
    if ($role !== 'admin' && $role !== 'master' && !in_array('products_manage', $perms) && !in_array('all', $perms)) {
        jsonResponse(['error' => 'No autorizado para gestionar productos.'], 403);
    }

    $p = $input;
    $prevStock = 0;
    $prevSalePrice = 0;
    $isNew = true;

    // Verificar stock y oferta anterior (Padre)
    if (!empty($p['id'])) {
        $stmtCheck = $pdo->prepare("SELECT i.stock, pr.sale_price FROM products pr LEFT JOIN inventory i ON (pr.id = i.product_id AND i.branch_id = ?) WHERE pr.id = ?");
        $stmtCheck->execute([$branchId, $p['id']]);
        $res = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($res) {
            $prevStock = (int)($res['stock'] ?? 0);
            $prevSalePrice = floatval($res['sale_price'] ?? 0);
            $isNew = false;
        }
    }

    // 1. Guardar Datos Maestros del Producto (JSON variants se guarda como referencia estructural)
    $stmt = $pdo->prepare("INSERT INTO `products` 
        (id, code, title, description, cost, price, sale_price, images, category, extra_categories, is_visible, is_featured, variant_options, variants, created_at, track_stock, min_stock, barcode_ean, pricing_type, metal_type, weight_gram, making_cost, making_cost_type) 
        VALUES (:id, :code, :title, :description, :cost, :price, :sale_price, :images, :category, :extra_categories, :is_visible, :is_featured, :variant_options, :variants, :created_at, :track_stock, :min_stock, :barcode_ean, :pricing_type, :metal_type, :weight_gram, :making_cost, :making_cost_type) 
        ON DUPLICATE KEY UPDATE 
        code=VALUES(code), title=VALUES(title), description=VALUES(description), cost=VALUES(cost), price=VALUES(price), sale_price=VALUES(sale_price), 
        images=VALUES(images), category=VALUES(category), extra_categories=VALUES(extra_categories), is_visible=VALUES(is_visible), is_featured=VALUES(is_featured), 
        variant_options=VALUES(variant_options), variants=VALUES(variants), track_stock=VALUES(track_stock), min_stock=VALUES(min_stock), barcode_ean=VALUES(barcode_ean),
        pricing_type=VALUES(pricing_type), metal_type=VALUES(metal_type), weight_gram=VALUES(weight_gram), making_cost=VALUES(making_cost), making_cost_type=VALUES(making_cost_type)");

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
        ':barcode_ean'      => $p['barcodeEan'] ?? ($p['barcode_ean'] ?? ''),
        ':pricing_type'     => $p['pricingType'] ?? ($p['pricing_type'] ?? 'fixed'),
        ':metal_type'       => !empty($p['metalType']) ? $p['metalType'] : (!empty($p['metal_type']) ? $p['metal_type'] : null),
        ':weight_gram'      => floatval($p['weightGram'] ?? ($p['weight_gram'] ?? 0)),
        ':making_cost'      => floatval($p['makingCost'] ?? ($p['making_cost'] ?? 0)),
        ':making_cost_type' => $p['makingCostType'] ?? ($p['making_cost_type'] ?? 'fixed')
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

    // Disparo de Web Push automático si el producto entra en oferta
    $currentSalePrice = floatval($p['salePrice'] ?? 0);
    $currentPrice = floatval($p['price'] ?? 0);
    $isVisible = ($p['isVisible'] ?? true);

    if ($isVisible && $currentSalePrice > 0 && $currentSalePrice < $currentPrice && abs($currentSalePrice - $prevSalePrice) > 0.01) {
        try {
            require_once __DIR__ . '/push_sender.php';
            WebPushSender::notifyNewOffer($pdo, $p['title'] ?? 'Producto en Oferta', $currentSalePrice, $currentPrice, $p['id'], $effectiveBranchId);
        } catch (Exception $e) {
            error_log("[WebPush Offer Error] " . $e->getMessage());
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
        // 1. Verificar orden existente y su estado de stock previo con bloqueo de fila
        $stmtCheck = $pdo->prepare("SELECT status, items, stock_deducted, branch_id FROM `orders` WHERE id = ? FOR UPDATE");
        $stmtCheck->execute([strval($o['id'])]);
        $existingOrder = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        // Identificar si la orden proviene del Staff autenticado (POS/Admin) o de un cliente web público
        $authUser = getAuthUser($pdo);
        $isStaff = ($authUser && in_array($authUser['role'] ?? '', ['admin', 'master', 'seller', 'cashier']));

        // LÓGICA DE ASIGNACIÓN DE SEDE INTELIGENTE (por prioridad):
        // P1: pickup/pos con sede explícita → siempre usar esa sede
        // P2: Orden ya existente (edición) → preservar sede original
        // P3: branchId directo enviado desde el frontend → usarlo directamente
        // P4: Delivery Web sin sede → búsqueda inteligente entre sedes activas
        $activeBranchId = intval($o['branchId'] ?? ($o['branch_id'] ?? 0));
        $deliveryMethod = $o['deliveryMethod'] ?? ($o['delivery_method'] ?? 'pos');
        $pickupBranch = intval($o['pickupBranchId'] ?? ($o['pickup_branch_id'] ?? 0));

        if (($deliveryMethod === 'pickup' || $deliveryMethod === 'pos') && $pickupBranch > 0) {
            // P1: Retiro en tienda con sede seleccionada explícitamente
            $activeBranchId = $pickupBranch;

            // Si es un cliente web solicitando retiro en tienda, validar que dicha sede tenga existencias reales
            if (!$isStaff && $deliveryMethod === 'pickup') {
                $itemsArrCheck = safeJsonDecode($itemsJson);
                if (is_array($itemsArrCheck)) {
                    foreach ($itemsArrCheck as $it) {
                        if (!empty($it['productId']) && !str_starts_with($it['productId'], 'manual-') && !str_starts_with($it['productId'], 'custom')) {
                            $tId = !empty($it['variantId']) ? strval($it['variantId']) : strval($it['productId']);
                            $reqQty = max(1, intval($it['quantity'] ?? 1));

                            $pCheck = $pdo->prepare("SELECT track_stock, title FROM `products` WHERE `id` = ? OR variants LIKE ? LIMIT 1");
                            $pCheck->execute([$tId, '%' . $tId . '%']);
                            $pRow = $pCheck->fetch(PDO::FETCH_ASSOC);
                            $tracks = $pRow ? (bool)($pRow['track_stock'] ?? 1) : true;

                            if ($tracks) {
                                $stkCheck = $pdo->prepare("SELECT `stock` FROM `inventory` WHERE `product_id` = ? AND `branch_id` = ?");
                                $stkCheck->execute([$tId, $pickupBranch]);
                                $curAvail = intval($stkCheck->fetchColumn() ?: 0);
                                if ($curAvail < $reqQty) {
                                    $pName = $it['productTitle'] ?? ($pRow['title'] ?? 'el producto seleccionado');
                                    throw new Exception("Lo sentimos, no hay existencias disponibles de '{$pName}' en la sede seleccionada para retiro en tienda.");
                                }
                            }
                        }
                    }
                }
            }
        } elseif ($activeBranchId > 0) {
            // P3: Sede enviada directamente por el frontend (POS, staff, etc.) — ya está asignada
        } elseif ($existingOrder && !empty($existingOrder['branch_id']) && intval($existingOrder['branch_id']) > 0) {
            // P2: Preservar sede original de la orden si ya existe en BD
            $activeBranchId = intval($existingOrder['branch_id']);
        } else {
            // P4: Asignación Inteligente de Sede para Pedidos Web / Delivery (activeBranchId == 0):
            // Buscar la primera sede activa que cuente con existencias suficientes para todos los ítems
            $itemsArrForBranch = safeJsonDecode($itemsJson);
            $requiredItems = [];
            if (is_array($itemsArrForBranch)) {
                foreach ($itemsArrForBranch as $it) {
                    if (!empty($it['productId']) && !str_starts_with($it['productId'], 'manual-') && !str_starts_with($it['productId'], 'custom')) {
                        $tId = !empty($it['variantId']) ? strval($it['variantId']) : strval($it['productId']);
                        $requiredItems[$tId] = ($requiredItems[$tId] ?? 0) + intval($it['quantity'] ?? 1);
                    }
                }
            }

            $activeBranchList = $pdo->query("SELECT id FROM `branches` WHERE is_active = 1 ORDER BY id ASC")->fetchAll(PDO::FETCH_COLUMN);
            $selectedCandidate = 0;

            if (!empty($requiredItems) && !empty($activeBranchList)) {
                foreach ($activeBranchList as $candidateBid) {
                    $candidateBid = intval($candidateBid);
                    $hasAllStock = true;

                    foreach ($requiredItems as $itemProdId => $reqQty) {
                        $stkCheckStmt = $pdo->prepare("SELECT `stock` FROM `inventory` WHERE `product_id` = ? AND `branch_id` = ?");
                        $stkCheckStmt->execute([$itemProdId, $candidateBid]);
                        $avail = $stkCheckStmt->fetchColumn();
                        if ($avail === false || intval($avail) < $reqQty) {
                            $hasAllStock = false;
                            break;
                        }
                    }

                    if ($hasAllStock) {
                        $selectedCandidate = $candidateBid;
                        break;
                    }
                }
            }

            if ($selectedCandidate > 0) {
                $activeBranchId = $selectedCandidate;
            } else {
                // Si ninguna sede individual cuenta con todo el pedido para delivery web, verificar si los productos están totalmente agotados
                if (!$isStaff && !empty($requiredItems)) {
                    foreach ($requiredItems as $itemProdId => $reqQty) {
                        $checkParentStmt = $pdo->prepare("SELECT track_stock, title FROM `products` WHERE `id` = ? OR variants LIKE ? LIMIT 1");
                        $checkParentStmt->execute([$itemProdId, '%' . $itemProdId . '%']);
                        $pRow = $checkParentStmt->fetch(PDO::FETCH_ASSOC);
                        $trackStock = $pRow ? (bool)($pRow['track_stock'] ?? 1) : true;
                        if ($trackStock) {
                            $branchIdsSafe = array_map('intval', $activeBranchList ?: [1]);
                            $inClause = implode(',', $branchIdsSafe);
                            $sumStockStmt = $pdo->query("SELECT COALESCE(SUM(stock), 0) FROM `inventory` WHERE `product_id` = " . $pdo->quote($itemProdId) . " AND `branch_id` IN ({$inClause})");
                            $totalAvailable = intval($sumStockStmt ? $sumStockStmt->fetchColumn() : 0);

                            if ($totalAvailable < $reqQty) {
                                $title = $pRow['title'] ?? "el producto solicitado";
                                throw new Exception("Lo sentimos, '{$title}' no cuenta con existencias suficientes en nuestras sedes (Disponible: {$totalAvailable}, Solicitado: {$reqQty}).");
                            }
                        }
                    }
                }

                // Fallback: sede del header o primera sede activa disponible
                $activeBranchId = intval($branchId > 0 ? $branchId : ($activeBranchList[0] ?? 1));
            }
        }

        $newStatus = $o['status'] ?? 'pending';
        $oldStatus = $existingOrder ? $existingOrder['status'] : null;
        $isDeducted = $existingOrder ? intval($existingOrder['stock_deducted'] ?? 0) : 0;
        $oldBranchId = $existingOrder ? intval($existingOrder['branch_id'] ?: $activeBranchId) : $activeBranchId;

        // 1.1 VALIDACIÓN DE PRECIOS DEL SERVIDOR (PROTECCIÓN CONTRA MANIPULACIÓN DE TOTALES)
        $itemsArr = safeJsonDecode($itemsJson);

        if (!$isStaff && !empty($itemsArr)) {
            $expectedSubtotal = 0;
            $stmtProdPrice = $pdo->prepare("SELECT price, sale_price, variants FROM `products` WHERE id = ?");

            foreach ($itemsArr as $item) {
                $pid = strval($item['productId'] ?? '');
                if (empty($pid) || str_starts_with($pid, 'manual-') || str_starts_with($pid, 'custom')) {
                    throw new Exception("Ítems personalizados no autorizados en pedidos web.");
                }

                $stmtProdPrice->execute([$pid]);
                $pRow = $stmtProdPrice->fetch(PDO::FETCH_ASSOC);
                if (!$pRow) {
                    throw new Exception("Producto no encontrado en el catálogo oficial: " . ($item['productTitle'] ?? $pid));
                }

                $officialPrice = floatval($pRow['price'] ?? 0);
                if (floatval($pRow['sale_price'] ?? 0) > 0 && floatval($pRow['sale_price']) < $officialPrice) {
                    $officialPrice = floatval($pRow['sale_price']);
                }

                if (!empty($item['variantId']) && !empty($pRow['variants'])) {
                    $variants = safeJsonDecode($pRow['variants']);
                    foreach ($variants as $v) {
                        if (isset($v['id']) && strval($v['id']) === strval($item['variantId']) && isset($v['price']) && floatval($v['price']) > 0) {
                            $officialPrice = floatval($v['price']);
                            if (isset($v['salePrice']) && floatval($v['salePrice']) > 0 && floatval($v['salePrice']) < $officialPrice) {
                                $officialPrice = floatval($v['salePrice']);
                            }
                            break;
                        }
                    }
                }

                $qty = max(1, intval($item['quantity'] ?? 1));
                $expectedSubtotal += ($officialPrice * $qty);
            }

            // Validar descuento si se envió
            $expectedDiscount = 0;
            $clientDiscount = floatval($o['discount'] ?? 0);
            if ($clientDiscount > 0) {
                $couponCode = strtoupper(trim(preg_replace('/\s+/', '', strval($o['couponCode'] ?? ($o['coupon'] ?? '')))));
                if (!empty($couponCode)) {
                    $stmtCoup = $pdo->prepare("SELECT discount_type, value, active FROM `coupons` WHERE code = ? AND active = 1");
                    $stmtCoup->execute([$couponCode]);
                    $coup = $stmtCoup->fetch(PDO::FETCH_ASSOC);
                    if ($coup) {
                        if ($coup['discount_type'] === 'fixed') {
                            $expectedDiscount = min($expectedSubtotal, floatval($coup['value']));
                        } else {
                            $expectedDiscount = min($expectedSubtotal, ($expectedSubtotal * (floatval($coup['value']) / 100)));
                        }
                    }
                }
            }

            $expectedTotal = max(0, $expectedSubtotal - $expectedDiscount);
            $clientTotal = floatval($o['total'] ?? 0);

            // Tolerancia de 0.15 para diferencias menores de redondeo de centavos
            if (abs($clientTotal - $expectedTotal) > 0.15) {
                throw new Exception("Discrepancia en el total de la orden. Total calculado: $" . number_format($expectedTotal, 2) . ", recibido: $" . number_format($clientTotal, 2));
            }
        }

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

        // 5. Guardar Orden con estado de stock_deducted actualizado y código de cupón
        $smtInsert = "INSERT INTO `orders` (id, branch_id, customer_name, customer_phone, customer_address, items, subtotal, discount, total, `status`, `date`, payment_method, seller_id, seller_name, seller_commission, commission_rate, advisor_id, advisor_name, advisor_commission, advisor_rate, delivery_method, pickup_branch_id, stock_deducted, coupon_code) 
        VALUES (:id, :branch_id, :customer_name, :customer_phone, :customer_address, :items, :subtotal, :discount, :total, :status, :date, :payment_method, :seller_id, :seller_name, :seller_commission, :commission_rate, :advisor_id, :advisor_name, :advisor_commission, :advisor_rate, :delivery_method, :pickup_branch_id, :stock_deducted, :coupon_code) 
        ON DUPLICATE KEY UPDATE 
        `status`=VALUES(`status`), 
        `branch_id`=VALUES(`branch_id`), 
        customer_name=VALUES(customer_name), customer_phone=VALUES(customer_phone), customer_address=VALUES(customer_address), items=VALUES(items), subtotal=VALUES(subtotal), discount=VALUES(discount), total=VALUES(total), payment_method=VALUES(payment_method), seller_id=VALUES(seller_id), seller_name=VALUES(seller_name), seller_commission=VALUES(seller_commission), commission_rate=VALUES(commission_rate), advisor_id=VALUES(advisor_id), advisor_name=VALUES(advisor_name), advisor_commission=VALUES(advisor_commission), advisor_rate=VALUES(advisor_rate), delivery_method=VALUES(delivery_method), pickup_branch_id=VALUES(pickup_branch_id), stock_deducted=VALUES(stock_deducted), coupon_code=VALUES(coupon_code)";

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
            ':seller_commission' => floatval($o['sellerCommission'] ?? ($o['seller_commission'] ?? 0)),
            ':commission_rate' => floatval($o['commissionRate'] ?? ($o['commission_rate'] ?? 0)),
            ':advisor_id' => !empty($o['advisorId']) ? strval($o['advisorId']) : (!empty($o['advisor_id']) ? strval($o['advisor_id']) : null),
            ':advisor_name' => !empty($o['advisorName']) ? strval($o['advisorName']) : (!empty($o['advisor_name']) ? strval($o['advisor_name']) : null),
            ':advisor_commission' => floatval($o['advisorCommission'] ?? ($o['advisor_commission'] ?? 0)),
            ':advisor_rate' => floatval($o['advisorRate'] ?? ($o['advisor_rate'] ?? 0)),
            ':delivery_method' => $o['deliveryMethod'] ?? (
                (empty($o['sellerId']) || $o['sellerId'] === 'web-client' || $o['sellerId'] === 'online') ? 'delivery' : 'pos'
            ),
            ':pickup_branch_id' => intval($o['pickupBranchId'] ?? ($o['pickup_branch_id'] ?? 0)),
            ':stock_deducted' => $isDeducted,
            ':coupon_code' => !empty($o['couponCode']) ? strtoupper(trim(strval($o['couponCode']))) : (!empty($o['coupon']) ? strtoupper(trim(strval($o['coupon']))) : null)
        ]);

        $pdo->commit();

        // Limpiar carrito de la suscripción push tras completar la orden con éxito
        if (!empty($o['pushEndpoint'])) {
            try {
                $cleanStmt = $pdo->prepare("UPDATE `push_subscriptions` SET cart_items = NULL, cart_updated_at = NULL, cart_notified = 0 WHERE endpoint = ?");
                $cleanStmt->execute([$o['pushEndpoint']]);
            } catch (Exception $e) {}
        }

        jsonResponse(['status' => 'success', 'stock_deducted' => $isDeducted]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['error' => $e->getMessage()], 400);
    }
}

function handleSaveSettings($pdo, $input)
{
    $authUser = getAuthUser($pdo);
    if (!$authUser) {
        jsonResponse(['error' => 'No autorizado. Se requiere sesión activa para modificar la configuración.'], 401);
    }

    $role = $authUser['role'] ?? '';
    $isFullAdmin = ($role === 'admin' || $role === 'master');
    // Si no es administrador principal, solo tiene permiso de registrar asesores de venta (salesAdvisors) desde el POS
    if (!$isFullAdmin) {
        if (!isset($input['salesAdvisors'])) {
            jsonResponse(['error' => 'No autorizado. Se requiere sesión de administrador para modificar la configuración global.'], 403);
        }
        // Para cajeras y personal operativo, procesar exclusivamente salesAdvisors sin bloquear por otras claves
        $input = ['salesAdvisors' => $input['salesAdvisors']];
    }

    // Cargar usuarios actuales de la base de datos para preservar sus contraseñas existentes
    $existingUsersMap = [];
    try {
        $stmtUsers = $pdo->prepare("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'users' LIMIT 1");
        $stmtUsers->execute();
        $rawExUsers = $stmtUsers->fetchColumn();
        $exUsers = safeJsonDecode($rawExUsers);
        if (is_array($exUsers)) {
            foreach ($exUsers as $eu) {
                if (!empty($eu['id'])) {
                    $existingUsersMap[strval($eu['id'])] = $eu;
                }
                if (!empty($eu['username'])) {
                    $existingUsersMap['u_' . strtolower(trim($eu['username']))] = $eu;
                }
            }
        }
    } catch (\Throwable $e) {}

    foreach ($input as $k => $v) {
        // Bloquear sobrescritura de secretos de servidor
        if ($k === 'app_secret') continue;

        // Proteger contraseñas legacy contra vaciado accidental
        if (in_array($k, ['adminPassword', 'sellerPassword', 'masterPassword']) && (empty($v) || trim(strval($v)) === '')) {
            continue;
        }

        // Si se actualizan usuarios, PRESERVAR contraseñas existentes de aquellos que no enviaron nueva contraseña
        if ($k === 'users' && (is_array($v) || is_object($v))) {
            $usersList = is_array($v) ? $v : (array)$v;
            foreach ($usersList as &$u) {
                $uid = strval($u['id'] ?? '');
                $uNameKey = 'u_' . strtolower(trim($u['username'] ?? ''));
                $match = $existingUsersMap[$uid] ?? ($existingUsersMap[$uNameKey] ?? null);

                // Si el frontend no envió contraseña (porque read.php la ocultó por seguridad), restaurar la que está en BD
                if ((empty($u['password']) || trim(strval($u['password'])) === '') && $match && !empty($match['password'])) {
                    $u['password'] = $match['password'];
                }
            }
            unset($u);
            $v = $usersList;
        }

        if (is_bool($v)) $val = $v ? 'true' : 'false';
        elseif (is_array($v) || is_object($v)) $val = safeJsonEncode($v);
        else $val = $v;

        $pdo->prepare("INSERT INTO `settings` (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)")->execute([$k, $val]);
    }

    syncPhysicalManifestFiles($pdo);
    jsonResponse(['status' => 'success']);
}

function syncPhysicalManifestFiles($pdo)
{
    try {
        $stmt = $pdo->query("SELECT `setting_key`, `setting_value` FROM `settings` WHERE `setting_key` IN ('storeName', 'seoTitle', 'seoDescription', 'appIconUrl', 'logoUrl', 'primaryColor')");
        $s = [];
        while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
            $s[$row['setting_key']] = $row['setting_value'];
        }
        $storeName = trim($s['storeName'] ?? '');
        $seoTitle  = trim($s['seoTitle'] ?? '');
        $appName   = !empty($storeName) ? $storeName : (!empty($seoTitle) ? $seoTitle : 'Tienda Virtual');
        $shortName = !empty($storeName) ? (mb_strlen($storeName) > 12 ? mb_substr($storeName, 0, 12) : $storeName) : 'Tienda';
        $iconUrl   = !empty($s['appIconUrl']) ? $s['appIconUrl'] : (!empty($s['logoUrl']) ? $s['logoUrl'] : 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png');
        $themeCol  = !empty($s['primaryColor']) ? $s['primaryColor'] : '#007AFF';
        $desc      = !empty($s['seoDescription']) ? $s['seoDescription'] : "Tienda oficial de {$appName}. Realiza tus pedidos con la mejor experiencia online.";

        $candidateFiles = [
            __DIR__ . '/../manifest.json',
            __DIR__ . '/../../manifest.json',
            __DIR__ . '/../../dist/manifest.json'
        ];

        foreach ($candidateFiles as $file) {
            if (file_exists($file) && is_writable($file)) {
                $content = @file_get_contents($file);
                if ($content) {
                    $json = json_decode($content, true);
                    if (is_array($json)) {
                        $json['id'] = '/?source=pwa';
                        $json['name'] = $appName;
                        $json['short_name'] = $shortName;
                        $json['start_url'] = '/';
                        $json['scope'] = '/';
                        $json['theme_color'] = $themeCol;
                        $json['description'] = $desc;
                        if (!empty($json['icons']) && is_array($json['icons'])) {
                            foreach ($json['icons'] as &$ic) {
                                $ic['src'] = $iconUrl;
                            }
                            unset($ic);
                        }
                        @file_put_contents($file, json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
                    }
                }
            }
        }
    } catch (\Throwable $e) {}
}

function handleDelete($pdo, $table, $idField, $idValue)
{
    $authUser = getAuthUser($pdo);
    if (!$authUser) {
        jsonResponse(['error' => 'No autorizado. Se requiere sesión activa para eliminar registros.'], 401);
    }

    // Blindaje de Seguridad: Whitelist estricta de tablas y campos ID permitidos
    $allowedTables = [
        'products'   => 'id',
        'orders'     => 'id',
        'customers'  => 'phone',
        'categories' => 'id',
        'branches'   => 'id',
        'coupons'    => 'code'
    ];
    if (!isset($allowedTables[$table]) || $allowedTables[$table] !== $idField) {
        jsonResponse(['error' => 'Operación de eliminación no permitida para esta entidad.'], 400);
    }

    $role = $authUser['role'] ?? '';
    $perms = is_array($authUser['permissions'] ?? null) ? $authUser['permissions'] : [];
    $isFullAdmin = ($role === 'admin' || $role === 'master');

    if (!$isFullAdmin) {
        if ($table === 'branches' || $table === 'categories' || $table === 'coupons') {
            jsonResponse(['error' => 'No autorizado. Solo administradores pueden eliminar sedes, categorías o cupones.'], 403);
        }
        if ($table === 'products' && !in_array('products_manage', $perms) && !in_array('all', $perms)) {
            jsonResponse(['error' => 'No autorizado para eliminar productos.'], 403);
        }
    }

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
                        $authUser['id'] ?? 'system',
                        $authUser['name'] ?? 'Administrador',
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
    $authUser = getAuthUser($pdo);
    if (!$authUser) {
        jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
    }
    if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
        jsonResponse(['error' => 'Acceso denegado. Se requiere sesión de administrador para reiniciar la base de datos.'], 403);
    }

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
    $authUser = getAuthUser($pdo);
    if (!$authUser) {
        jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
    }
    if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
        jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador para gestionar sedes.'], 403);
    }

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
