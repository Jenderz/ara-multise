
<?php
function handleBatchWrite($pdo, $input, $branchId) {
    $authUser = getAuthUser($pdo);
    if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
        jsonResponse(['error' => 'No autorizado. Se requiere sesión de administrador para importaciones masivas.'], 403);
    }

    $type = $input['type'] ?? '';
    $items = $input['items'] ?? [];
    
    if (empty($items)) jsonResponse(['status' => 'success', 'message' => 'Empty batch']);

    $pdo->beginTransaction();
    try {
        if ($type === 'products') {
            $stmt = $pdo->prepare("INSERT INTO `products` 
            (id, code, title, description, cost, price, sale_price, images, category, extra_categories, is_visible, is_featured, variant_options, variants, created_at, track_stock, min_stock, barcode_ean) 
            VALUES (:id, :code, :title, :description, :cost, :price, :sale_price, :images, :category, :extra_categories, :is_visible, :is_featured, :variant_options, :variants, :created_at, :track_stock, :min_stock, :barcode_ean) 
            ON DUPLICATE KEY UPDATE 
            code=VALUES(code), title=VALUES(title), description=VALUES(description), cost=VALUES(cost), price=VALUES(price), sale_price=VALUES(sale_price), 
            images=VALUES(images), category=VALUES(category), extra_categories=VALUES(extra_categories), is_visible=VALUES(is_visible), is_featured=VALUES(is_featured), 
            variant_options=VALUES(variant_options), variants=VALUES(variants), track_stock=VALUES(track_stock), min_stock=VALUES(min_stock), barcode_ean=VALUES(barcode_ean)");
            
            // Preparar statement para inventario (usado tanto para padre como variantes)
            $stockStmt = $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock), updated_at = VALUES(updated_at)");

            foreach ($items as $p) {
                // Sanitización Blindada para evitar doble encoding
                $images = is_string($p['images'] ?? '') ? $p['images'] : safeJsonEncode($p['images'] ?? []);
                $vOptions = is_string($p['variantOptions'] ?? '') ? $p['variantOptions'] : safeJsonEncode($p['variantOptions'] ?? []);
                $variantsStr = is_string($p['variants'] ?? '') ? $p['variants'] : safeJsonEncode($p['variants'] ?? []);

                $extraCats = $p['extraCategories'] ?? [];
                if (is_string($extraCats)) {
                    // Soporte CSV: "Cat A|Cat B" o "Cat A,Cat B"
                    $extraCats = array_map('trim', preg_split('/[|,]/', $extraCats));
                }
                $extraCatsJson = safeJsonEncode(array_values(array_filter($extraCats, fn($c) => is_string($c) && $c !== '')));

                $stmt->execute([
                    ':id'               => $p['id'] ?? generateUniqueId(), 
                    ':code'             => $p['code'] ?? '', 
                    ':title'            => $p['title'] ?? 'Sin Nombre', 
                    ':description'      => $p['description'] ?? '', 
                    ':cost'             => floatval($p['cost'] ?? 0),
                    ':price'            => floatval($p['price'] ?? 0), 
                    ':sale_price'       => floatval($p['salePrice'] ?? 0), 
                    ':images'           => $images,
                    ':category'         => $p['category'] ?? 'General', 
                    ':extra_categories' => $extraCatsJson,
                    ':is_visible'       => ($p['isVisible'] ?? true) ? 1 : 0, 
                    ':is_featured'      => ($p['isFeatured'] ?? false) ? 1 : 0,
                    ':variant_options'  => $vOptions,
                    ':variants'         => $variantsStr,
                    ':created_at'       => $p['createdAt'] ?? time()*1000, 
                    ':track_stock'      => ($p['trackStock'] ?? true) ? 1 : 0, 
                    ':min_stock'        => intval($p['minStock'] ?? 5),
                    ':barcode_ean'      => $p['barcodeEan'] ?? ($p['barcode_ean'] ?? '')
                ]);
                
                // 1. Insertar stock del PADRE (Suma total)
                if (isset($p['stock'])) {
                    $stockStmt->execute([$p['id'], $branchId, intval($p['stock']), time()]);
                }

                // 2. Insertar stock de las VARIANTES (Individual)
                if (!empty($p['variants']) && is_array($p['variants'])) {
                    foreach ($p['variants'] as $variant) {
                        if (isset($variant['id'])) {
                            $vStock = isset($variant['stock']) ? intval($variant['stock']) : 0;
                            $stockStmt->execute([$variant['id'], $branchId, $vStock, time()]);
                        }
                    }
                }
            }
        }
        elseif ($type === 'inventory') {
            // Importación explícita de tabla de inventario (Multisede)
            $stmt = $pdo->prepare("INSERT INTO `inventory` (product_id, branch_id, stock, updated_at) VALUES (:pid, :bid, :st, :ua) ON DUPLICATE KEY UPDATE stock=VALUES(stock), updated_at=VALUES(updated_at)");
            foreach($items as $inv) {
                $stmt->execute([
                    ':pid' => $inv['product_id'],
                    ':bid' => $inv['branch_id'] ?? 1,
                    ':st' => $inv['stock'],
                    ':ua' => $inv['updated_at'] ?? time()
                ]);
            }
        }
        elseif ($type === 'product_movements') {
            // Importación de historial de movimientos
            $stmt = $pdo->prepare("INSERT INTO `product_movements` (id, product_id, branch_id, user_id, user_name, type, amount, stock_after, reference, date) 
            VALUES (:id, :pid, :bid, :uid, :uname, :type, :amt, :after, :ref, :date) 
            ON DUPLICATE KEY UPDATE reference=VALUES(reference)"); 
            
            foreach($items as $mov) {
                $stmt->execute([
                    ':id' => $mov['id'] ?? generateUniqueId(),
                    ':pid' => $mov['product_id'],
                    ':bid' => $mov['branch_id'] ?? 1,
                    ':uid' => $mov['user_id'] ?? 'system',
                    ':uname' => $mov['user_name'] ?? 'System',
                    ':type' => $mov['type'] ?? 'adjustment',
                    ':amt' => $mov['amount'] ?? 0,
                    ':after' => $mov['stock_after'] ?? 0,
                    ':ref' => $mov['reference'] ?? '',
                    ':date' => $mov['date'] ?? time()*1000
                ]);
            }
        }
        elseif ($type === 'orders') {
            $stmt = $pdo->prepare("INSERT INTO `orders` 
            (id, branch_id, customer_name, customer_phone, customer_address, items, total, subtotal, discount, `status`, `date`, payment_method, seller_id, seller_name, seller_commission, commission_rate, delivery_method, pickup_branch_id, stock_deducted, coupon_code) 
            VALUES (:id, :branch_id, :customer_name, :customer_phone, :customer_address, :items, :total, :subtotal, :discount, :status, :date, :payment_method, :seller_id, :seller_name, :seller_commission, :commission_rate, :delivery_method, :pickup_branch_id, :stock_deducted, :coupon_code) 
            ON DUPLICATE KEY UPDATE 
            `status`=VALUES(`status`), customer_name=VALUES(customer_name), customer_phone=VALUES(customer_phone), 
            customer_address=VALUES(customer_address), items=VALUES(items), total=VALUES(total), subtotal=VALUES(subtotal), discount=VALUES(discount),
            payment_method=VALUES(payment_method), seller_id=VALUES(seller_id), seller_name=VALUES(seller_name),
            seller_commission=VALUES(seller_commission), commission_rate=VALUES(commission_rate), delivery_method=VALUES(delivery_method), pickup_branch_id=VALUES(pickup_branch_id), stock_deducted=VALUES(stock_deducted), coupon_code=VALUES(coupon_code)");
            
            foreach ($items as $o) {
                $itemsJson = is_string($o['items']) ? $o['items'] : safeJsonEncode($o['items'] ?? []);
                $stmt->execute([
                    ':id' => $o['id'] ?? generateUniqueId(), 
                    ':branch_id' => intval($o['branchId'] ?? ($o['branch_id'] ?? $branchId)), 
                    ':customer_name' => $o['customerName'] ?? ($o['customer_name'] ?? 'Cliente'),
                    ':customer_phone' => $o['customerPhone'] ?? ($o['customer_phone'] ?? ''), 
                    ':customer_address' => $o['customerAddress'] ?? ($o['customer_address'] ?? ''),
                    ':items' => $itemsJson, 
                    ':total' => floatval($o['total'] ?? 0),
                    ':subtotal' => floatval($o['subtotal'] ?? $o['total'] ?? 0),
                    ':discount' => floatval($o['discount'] ?? 0),
                    ':status' => $o['status'] ?? 'pending', 
                    ':date' => $o['date'] ?? time()*1000, 
                    ':payment_method' => $o['paymentMethod'] ?? ($o['payment_method'] ?? 'Efectivo'),
                    ':seller_id' => $o['sellerId'] ?? ($o['seller_id'] ?? 'web-client'), 
                    ':seller_name' => $o['sellerName'] ?? ($o['seller_name'] ?? 'Tienda'),
                    ':seller_commission' => floatval($o['sellerCommission'] ?? ($o['seller_commission'] ?? 0)),
                    ':commission_rate' => floatval($o['commissionRate'] ?? ($o['commission_rate'] ?? 0)),
                    ':delivery_method' => $o['deliveryMethod'] ?? ($o['delivery_method'] ?? 'pos'),
                    ':pickup_branch_id' => intval($o['pickupBranchId'] ?? ($o['pickup_branch_id'] ?? 0)),
                    ':stock_deducted' => !empty($o['stockDeducted']) ? 1 : 0,
                    ':coupon_code' => !empty($o['couponCode']) ? strtoupper(trim(strval($o['couponCode']))) : (!empty($o['coupon_code']) ? strtoupper(trim(strval($o['coupon_code']))) : null)
                ]);
            }
        }
        elseif ($type === 'customers') {
            $stmt = $pdo->prepare("INSERT INTO `customers` (phone, `name`, address, total_spent, order_count, last_order_date, order_ids) 
            VALUES (:p, :n, :a, :t, :c, :d, :i) 
            ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), address=VALUES(address), total_spent=VALUES(total_spent), order_count=VALUES(order_count), last_order_date=VALUES(last_order_date), order_ids=VALUES(order_ids)");
            
            foreach ($items as $c) {
                if (empty($c['phone'])) continue;
                $orderIdsJson = is_string($c['orderIds'] ?? []) ? $c['orderIds'] : safeJsonEncode($c['orderIds'] ?? []);
                $stmt->execute([
                    ':p' => $c['phone'], ':n' => $c['name'] ?? '', ':a' => $c['address'] ?? '', 
                    ':t' => floatval($c['totalSpent'] ?? ($c['total_spent'] ?? 0)), 
                    ':c' => intval($c['orderCount'] ?? ($c['order_count'] ?? 0)), 
                    ':d' => intval($c['lastOrderDate'] ?? ($c['last_order_date'] ?? 0)), 
                    ':i' => $orderIdsJson
                ]);
            }
        }
        elseif ($type === 'categories') {
            $stmt = $pdo->prepare("INSERT INTO `categories` (id, name, image) VALUES (:id, :name, :image) ON DUPLICATE KEY UPDATE name=VALUES(name), image=VALUES(image)");
            foreach ($items as $c) {
                if(empty($c['id'])) continue;
                $stmt->execute([':id' => $c['id'], ':name' => $c['name'] ?? '', ':image' => $c['image'] ?? '']);
            }
        }
        elseif ($type === 'users') {
            // Importación de Usuarios (Almacenados en tabla settings como JSON)
            $stmtU = $pdo->prepare("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'users' LIMIT 1");
            $stmtU->execute();
            $existingUsers = safeJsonDecode($stmtU->fetchColumn()) ?: [];
            $usersMap = [];
            foreach ($existingUsers as $eu) {
                $k = !empty($eu['id']) ? strval($eu['id']) : strtolower(trim($eu['username'] ?? ''));
                $usersMap[$k] = $eu;
            }

            foreach ($items as $u) {
                if (empty($u['username'])) continue;
                $uId = strval($u['id'] ?? generateUniqueId());
                $uKey = $uId ?: strtolower(trim($u['username']));
                $existingMatch = $usersMap[$uKey] ?? null;
                $rawPass = strval($u['password'] ?? '');
                $passToStore = !empty($rawPass) ? ((strlen($rawPass) === 64 && ctype_xdigit($rawPass)) ? $rawPass : hash('sha256', $rawPass)) : ($existingMatch['password'] ?? '');

                $usersMap[$uKey] = [
                    'id' => $uId,
                    'name' => $u['name'] ?? 'Usuario',
                    'username' => $u['username'],
                    'password' => $passToStore,
                    'role' => $u['role'] ?? 'seller',
                    'branchId' => intval($u['branchId'] ?? ($u['branch_id'] ?? 1)),
                    'assignedBranchId' => intval($u['assignedBranchId'] ?? ($u['assigned_branch_id'] ?? 0)),
                    'permissions' => is_array($u['permissions'] ?? null) ? $u['permissions'] : safeJsonDecode($u['permissions'] ?? '[]'),
                    'active' => isset($u['active']) ? (bool)$u['active'] : true,
                    'createdAt' => $u['createdAt'] ?? ($u['created_at'] ?? (time() * 1000))
                ];
            }
            $stmtSaveU = $pdo->prepare("INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES ('users', ?) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)");
            $stmtSaveU->execute([safeJsonEncode(array_values($usersMap))]);
        }
        elseif ($type === 'settings') {
            // Importación de Configuración Global (guardado clave por clave en tabla settings)
            $s = isset($items[0]) && is_array($items[0]) ? $items[0] : $items;
            if (is_array($s)) {
                $stmtS = $pdo->prepare("INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)");
                foreach ($s as $sk => $sv) {
                    if ($sk === 'app_secret') continue;
                    $sVal = is_bool($sv) ? ($sv ? 'true' : 'false') : (is_array($sv) || is_object($sv) ? safeJsonEncode($sv) : strval($sv));
                    $stmtS->execute([$sk, $sVal]);
                }
            }
        }
        
        $pdo->commit();
        jsonResponse(['status' => 'success', 'count' => count($items)]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Batch Error', 'details' => $e->getMessage()], 500);
    }
}
?>
