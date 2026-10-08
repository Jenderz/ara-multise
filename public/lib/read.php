<?php
// Función auxiliar para inyectar stock de variantes
function injectVariantStock($product, $localMap, $globalMap, $branchId = 0)
{
    if (empty($product['variants']) || !is_array($product['variants'])) {
        $pStock = (int)($product['stock'] ?? 0);
        $pGlobal = (int)($product['global_stock'] ?? $product['globalStock'] ?? $pStock);
        $product['availableStock'] = $pGlobal;
        $product['globalStock']    = $pGlobal;
        $product['isAvailable']    = !($product['trackStock'] ?? true) || $product['availableStock'] > 0;
        return $product;
    }

    $localTotal = 0;
    $globalTotal = 0;

    foreach ($product['variants'] as &$variant) {
        $vId = isset($variant['id']) ? (string)$variant['id'] : '';

        // 1. Calcular Stock Local (Sede Actual)
        if ($vId !== '' && isset($localMap[$vId])) {
            $variant['stock'] = (int)$localMap[$vId];
        } else {
            // STRICT MODE: Si no está en inventory, es 0.
            $variant['stock'] = 0;
        }
        $localTotal += $variant['stock'];

        // 2. Calcular Stock Global / Disponible (solo sedes activas)
        if ($vId !== '' && isset($globalMap[$vId])) {
            $vGlobal = (int)$globalMap[$vId];
        } else {
            $vGlobal = 0;
        }
        $variant['availableStock'] = $vGlobal;
        $variant['globalStock']    = $vGlobal;
        $variant['isAvailable']    = $variant['availableStock'] > 0;
        $globalTotal += $variant['availableStock'];
    }
    unset($variant);

    // Asignar totales calculados al padre
    $product['stock']          = $localTotal; // Stock visible en la sede actual
    $product['global_stock']   = $globalTotal;
    $product['globalStock']    = $globalTotal;
    $product['availableStock'] = $globalTotal;
    $product['isAvailable']    = !($product['trackStock'] ?? true) || $product['availableStock'] > 0;

    return $product;
}

function handleGetAll($pdo, $branchId)
{
    $authUser = getAuthUser($pdo);
    $isStaff = ($authUser && in_array($authUser['role'] ?? '', ['admin', 'master', 'seller', 'cashier']));

    $settings = [];
    $sStmt = $pdo->query("SELECT * FROM `settings`");
    while ($r = $sStmt->fetch()) {
        $v = $r['setting_value'];
        $vLower = is_string($v) ? strtolower(trim($v)) : '';
        if ($v === 'true' || $vLower === 'true' || $v === '1' || $v === 1) $v = true;
        elseif ($v === 'false' || $vLower === 'false' || $v === '0' || $v === 0) $v = false;
        else {
            $j = json_decode($v, true);
            if (json_last_error() === JSON_ERROR_NONE) $v = $j;
        }
        $settings[$r['setting_key']] = $v;
    }

    // BLINDAJE DE SEGURIDAD: Ocultar claves críticas y contraseñas
    unset($settings['app_secret']);
    unset($settings['adminPassword']);
    unset($settings['sellerPassword']);
    unset($settings['masterPassword']);

    if (!$isStaff) {
        // Visitantes públicos: no exponer lista de usuarios ni comisiones
        unset($settings['users']);
        unset($settings['salesAdvisors']);
    } else {
        // Personal autenticado: entregar usuarios pero NUNCA contraseñas
        if (!empty($settings['users']) && is_array($settings['users'])) {
            foreach ($settings['users'] as &$u) {
                unset($u['password']);
            }
        }
    }

    $cats = $pdo->query("SELECT * FROM `categories`")->fetchAll();

    // 1. Obtener Productos Base
    // Nota: El stock del PADRE (columna stock en products) es solo referencial o caché.
    // La fuente de verdad para el padre también debería venir de inventory, pero para listados rápidos
    // a veces se usa la tabla products. Aquí haremos un LEFT JOIN para asegurar consistencia.

    if ($branchId > 0) {
        $prodSql = "SELECT p.*, 
                    COALESCE(i.stock, 0) as `stock`,
                    (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock`
                    FROM `products` p 
                    LEFT JOIN `inventory` i ON p.id = i.product_id AND i.branch_id = :branchId 
                    ORDER BY p.created_at DESC, p.id DESC";
        $stmt = $pdo->prepare($prodSql);
        $stmt->execute([':branchId' => $branchId]);
    } else {
        // Vista Global: El stock del padre es la suma de todas las sedes activas
        $prodSql = "SELECT p.*, 
                    (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `stock`,
                    (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock`
                    FROM `products` p 
                    ORDER BY p.created_at DESC, p.id DESC";
        $stmt = $pdo->prepare($prodSql);
        $stmt->execute();
    }

    $rawProds = $stmt->fetchAll();
    $prods = array_map('mapProduct', $rawProds);

    // Fallback de compatibilidad: garantizar mapeo camelCase de campos de joyería incluso con config.php legado
    foreach ($prods as &$p) {
        if (!isset($p['pricingType']) && isset($p['pricing_type'])) $p['pricingType'] = $p['pricing_type'];
        if (!isset($p['metalType']) && isset($p['metal_type'])) $p['metalType'] = $p['metal_type'];
        if (!isset($p['weightGram']) && isset($p['weight_gram'])) $p['weightGram'] = (float)$p['weight_gram'];
        if (!isset($p['makingCost']) && isset($p['making_cost'])) $p['makingCost'] = (float)$p['making_cost'];
        if (!isset($p['makingCostType']) && isset($p['making_cost_type'])) $p['makingCostType'] = $p['making_cost_type'];
    }
    unset($p);

    // 2. Hidratación de Variantes (Optimizado y filtrando sedes activas)
    // Obtenemos el stock de TODAS las variantes relevantes.
    $inventoryMap = [];
    $globalInventoryMap = []; // Mapa separado para el stock disponible en sedes activas

    if ($branchId > 0) {
        $invStmt = $pdo->prepare("SELECT product_id, stock FROM inventory WHERE branch_id = ?");
        $invStmt->execute([$branchId]);
        while ($row = $invStmt->fetch()) {
            $inventoryMap[(string)$row['product_id']] = (int)$row['stock'];
        }
    } else {
        // Modo Global: Sumamos el stock de cada variante a través de sedes activas (excluyendo branch_id 0)
        $invStmt = $pdo->query("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 GROUP BY i.product_id");
        while ($row = $invStmt->fetch()) {
            $inventoryMap[(string)$row['product_id']] = (int)$row['stock'];
        }
    }

    // SIEMPRE calculamos el mapa global disponible sobre sedes activas (excluye inactivas y branch_id 0)
    $gStmt = $pdo->query("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 GROUP BY i.product_id");
    while ($row = $gStmt->fetch()) {
        $globalInventoryMap[(string)$row['product_id']] = (int)$row['stock'];
    }

    // 3. Inyectar en cada producto
    foreach ($prods as &$p) {
        $p = injectVariantStock($p, $inventoryMap, $globalInventoryMap, $branchId);
    }

    // ... Resto de la función (Orders, Customers, etc)
    if ($branchId > 0) {
        $stmt = $pdo->prepare("SELECT * FROM `orders` WHERE `branch_id` = :bid ORDER BY `date` DESC LIMIT 500");
        $stmt->execute([':bid' => $branchId]);
    } else {
        $stmt = $pdo->query("SELECT * FROM `orders` ORDER BY `date` DESC LIMIT 500");
    }
    $orders = array_map('mapOrder', $stmt->fetchAll());

    $customers = array_map('mapCustomer', $pdo->query("SELECT * FROM `customers` ORDER BY `last_order_date` DESC LIMIT 1000")->fetchAll());

    if (!function_exists('mapCoupon')) {
        function mapCoupon($c)
        {
            return [
                'code' => strtoupper(trim((string)($c['code'] ?? ''))),
                'discountType' => (isset($c['discount_type']) && $c['discount_type'] === 'fixed') || (isset($c['discountType']) && $c['discountType'] === 'fixed') ? 'fixed' : 'percentage',
                'value' => (float)($c['value'] ?? 0),
                'active' => !empty($c['active']),
            ];
        }
    }

    $rawCoupons = $pdo->query("SELECT * FROM `coupons`")->fetchAll();
    $coupons = array_map('mapCoupon', $rawCoupons);

    $branches = array_map(function ($b) {
        $b['isActive'] = (bool)$b['is_active'];
        return $b;
    }, $pdo->query("SELECT * FROM `branches`")->fetchAll());

    jsonResponse([
        'settings' => $settings,
        'categories' => $cats,
        'products' => $prods,
        'orders' => $orders,
        'customers' => $customers,
        'coupons' => $coupons,
        'branches' => $branches
    ]);
}

function handleGetProducts($pdo, $branchId)
{
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, intval($_GET['limit'] ?? 50));
    $offset = ($page - 1) * $limit;
    $search = $_GET['search'] ?? '';
    $cat = $_GET['category'] ?? '';

    $where = ["1=1"];
    $params = [];

    if ($branchId > 0) $params[':branchId'] = $branchId;
    if ($search) {
        $where[] = "(p.title LIKE :s OR p.code LIKE :s OR p.barcode_ean LIKE :s OR p.variants LIKE :s)";
        $params[':s'] = "%$search%";
    }
    if ($cat) {
        // Filtrar por categoría primaria O por alguna categoría extra (multi-categoría)
        $where[] = "(p.category = :c OR (p.extra_categories IS NOT NULL AND p.extra_categories != '[]' AND p.extra_categories LIKE :clike))";
        $params[':c']     = $cat;
        $params[':clike'] = '%' . $cat . '%';
    }

    $whereSql = implode(" AND ", $where);

    // SQL Base (Solo usamos la tabla products para la metadata, el stock lo recalcularemos)
    if ($branchId > 0) {
        $sql = "SELECT p.*, COALESCE(i.stock, 0) as `stock`, (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock` FROM `products` p LEFT JOIN `inventory` i ON p.id = i.product_id AND i.branch_id = :branchId WHERE $whereSql ORDER BY p.created_at DESC, p.id DESC LIMIT $limit OFFSET $offset";
    } else {
        $sql = "SELECT p.*, (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `stock`, (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock` FROM `products` p WHERE $whereSql ORDER BY p.created_at DESC, p.id DESC LIMIT $limit OFFSET $offset";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rawProds = $stmt->fetchAll();
    $data = array_map('mapProduct', $rawProds);

    // Recolección de IDs
    $prodIds = array_column($data, 'id');
    $variantIds = [];
    foreach ($data as $p) {
        if (!empty($p['variants'])) {
            foreach ($p['variants'] as $v) {
                if (isset($v['id'])) $variantIds[] = $v['id'];
            }
        }
    }

    $localMap = [];
    $globalMap = [];
    $allIds = array_merge($prodIds, $variantIds);

    if (!empty($allIds)) {
        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $flatParams = $allIds;

        // 1. Obtener MAPA LOCAL (Depende del branchId)
        if ($branchId > 0) {
            $localStmt = $pdo->prepare("SELECT product_id, stock FROM inventory WHERE branch_id = ? AND product_id IN ($placeholders)");
            $localStmt->execute(array_merge([$branchId], $flatParams));
            while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = (int)$row['stock'];
        } else {
            // Si es vista global, el "Local" es igual al Global sobre sedes activas
            $localStmt = $pdo->prepare("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 AND i.product_id IN ($placeholders) GROUP BY i.product_id");
            $localStmt->execute($flatParams);
            while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = (int)$row['stock'];
        }

        // 2. Obtener MAPA GLOBAL (Solo sedes activas, excluyendo inactivas y branch_id 0)
        $globalStmt = $pdo->prepare("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 AND i.product_id IN ($placeholders) GROUP BY i.product_id");
        $globalStmt->execute($flatParams);
        while ($row = $globalStmt->fetch()) $globalMap[(string)$row['product_id']] = (int)$row['stock'];
    }

    foreach ($data as &$p) {
        $p = injectVariantStock($p, $localMap, $globalMap, $branchId);
    }

    // Conteo total para paginación
    if (isset($params[':branchId'])) unset($params[':branchId']); // Limpiar para el count
    $cStmt = $pdo->prepare("SELECT COUNT(*) FROM `products` p WHERE $whereSql");
    $cStmt->execute($params);

    jsonResponse(['data' => $data, 'pagination' => ['total' => (int)$cStmt->fetchColumn(), 'page' => $page, 'limit' => $limit]]);
}

function handleGetSingleProduct($pdo, $branchId)
{
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        jsonResponse(['error' => 'ID de producto requerido'], 400);
    }

    if ($branchId > 0) {
        $sql = "SELECT p.*, COALESCE(i.stock, 0) as `stock`,
                (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock`
                FROM `products` p
                LEFT JOIN `inventory` i ON p.id = i.product_id AND i.branch_id = :branchId
                WHERE p.id = :id LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':branchId' => $branchId, ':id' => $id]);
    } else {
        $sql = "SELECT p.*,
                (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `stock`,
                (SELECT COALESCE(SUM(i2.stock), 0) FROM `inventory` i2 JOIN `branches` b2 ON b2.id = i2.branch_id AND b2.is_active = 1 WHERE i2.product_id = p.id AND i2.branch_id > 0) as `global_stock`
                FROM `products` p
                WHERE p.id = :id LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
    }

    $raw = $stmt->fetch();
    if (!$raw) {
        jsonResponse(['error' => 'Producto no encontrado'], 404);
    }

    $prod = mapProduct($raw);
    $variantIds = [];
    if (!empty($prod['variants'])) {
        foreach ($prod['variants'] as $v) {
            if (isset($v['id'])) $variantIds[] = $v['id'];
        }
    }

    $allIds = array_merge([$prod['id']], $variantIds);
    $placeholders = implode(',', array_fill(0, count($allIds), '?'));
    $localMap = [];
    $globalMap = [];

    if ($branchId > 0) {
        $localStmt = $pdo->prepare("SELECT product_id, stock FROM inventory WHERE branch_id = ? AND product_id IN ($placeholders)");
        $localStmt->execute(array_merge([$branchId], $allIds));
        while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = (int)$row['stock'];
    } else {
        $localStmt = $pdo->prepare("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 AND i.product_id IN ($placeholders) GROUP BY i.product_id");
        $localStmt->execute($allIds);
        while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = (int)$row['stock'];
    }

    $globalStmt = $pdo->prepare("SELECT i.product_id, SUM(i.stock) as stock FROM inventory i JOIN branches b ON b.id = i.branch_id AND b.is_active = 1 WHERE i.branch_id > 0 AND i.product_id IN ($placeholders) GROUP BY i.product_id");
    $globalStmt->execute($allIds);
    while ($row = $globalStmt->fetch()) $globalMap[(string)$row['product_id']] = (int)$row['stock'];

    $prod = injectVariantStock($prod, $localMap, $globalMap, $branchId);
    jsonResponse($prod);
}

// ... Resto de funciones (GetOrders, GetCustomers) se mantienen igual ...
function handleGetOrders($pdo, $branchId)
{
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, intval($_GET['limit'] ?? 50));
    $offset = ($page - 1) * $limit;
    
    $where = ["1=1"];
    $params = [];
    
    // Filtro por sede
    // Filtro por sede con Lógica de Bandeja Compartida para Delivery
    if ($branchId > 0) {
        // Mostrar pedidos de ESTA sede O pedidos Delivery pendientes (globales)
        // Nota: Si el usuario filtra por branchId, asumimos que quiere ver lo que puede gestionar.
        $where[] = "(`branch_id` = :bid OR (`delivery_method` = 'delivery' AND `status` = 'pending'))";
        $params[':bid'] = $branchId;
    }
    
    // Filtro por estado
    if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
        $where[] = "`status` = :st";
        $params[':st'] = $_GET['status'];
    }
    
    // Filtro por método de pago
    if (!empty($_GET['method']) && $_GET['method'] !== 'all') {
        $where[] = "`payment_method` = :method";
        $params[':method'] = $_GET['method'];
    }
    
    // Filtro por vendedor o asesor
    if (!empty($_GET['seller']) && $_GET['seller'] !== 'all') {
        $where[] = "(`seller_id` = :seller OR `advisor_id` = :seller)";
        $params[':seller'] = $_GET['seller'];
    }
    
    // Filtro por rango de fechas
    if (!empty($_GET['startDate'])) {
        $where[] = "`date` >= :startDate";
        $params[':startDate'] = strtotime($_GET['startDate'] . ' 00:00:00') * 1000;
    }
    
    if (!empty($_GET['endDate'])) {
        $where[] = "`date` <= :endDate";
        $params[':endDate'] = strtotime($_GET['endDate'] . ' 23:59:59') * 1000;
    }
    
    // Búsqueda de texto
    if (!empty($_GET['search'])) {
        $where[] = "(id LIKE :q OR customer_name LIKE :q OR CAST(total AS CHAR) LIKE :q)";
        $params[':q'] = "%" . $_GET['search'] . "%";
    }
    
    $whereSql = implode(" AND ", $where);
    
    // Query principal con paginación
    $sql = "SELECT * FROM `orders` WHERE $whereSql ORDER BY `date` DESC LIMIT :limit OFFSET :offset";
    $stmt = $pdo->prepare($sql);
    
    // Bindear parámetros
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $data = array_map('mapOrder', $stmt->fetchAll());
    
    // Contar total de registros
    $cStmt = $pdo->prepare("SELECT COUNT(*) FROM `orders` WHERE $whereSql");
    foreach ($params as $key => $value) {
        $cStmt->bindValue($key, $value);
    }
    $cStmt->execute();
    $total = (int)$cStmt->fetchColumn();
    
    jsonResponse([
        'data' => $data, 
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => ceil($total / $limit)
        ]
    ]);
}

function handleGetCustomers($pdo)
{
    $search = $_GET['search'] ?? '';
    $limit = intval($_GET['limit'] ?? 50);
    $page = intval($_GET['page'] ?? 1);
    $offset = ($page - 1) * $limit;
    $where = "1=1";
    $params = [];
    if ($search) {
        $where = "(`name` LIKE :s OR `phone` LIKE :s OR `cedula` LIKE :s)";
        $params[':s'] = "%$search%";
    }
    $stmt = $pdo->prepare("SELECT * FROM `customers` WHERE $where ORDER BY `last_order_date` DESC LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    $data = array_map('mapCustomer', $stmt->fetchAll());
    $cStmt = $pdo->prepare("SELECT COUNT(*) FROM `customers` WHERE $where");
    $cStmt->execute($params);
    jsonResponse(['data' => $data, 'pagination' => ['total' => (int)$cStmt->fetchColumn(), 'page' => $page, 'limit' => $limit]]);
}

function handleGetSettings($pdo)
{
    $authUser = getAuthUser($pdo);
    $isStaff = ($authUser && in_array($authUser['role'] ?? '', ['admin', 'master', 'seller', 'cashier']));

    $settings = [];
    $sStmt = $pdo->query("SELECT * FROM `settings`");
    while ($r = $sStmt->fetch()) {
        $v = $r['setting_value'];
        $vLower = is_string($v) ? strtolower(trim($v)) : '';
        if ($v === 'true' || $vLower === 'true' || $v === '1' || $v === 1) $v = true;
        elseif ($v === 'false' || $vLower === 'false' || $v === '0' || $v === 0) $v = false;
        else {
            $j = json_decode($v, true);
            if (json_last_error() === JSON_ERROR_NONE) $v = $j;
        }
        $settings[$r['setting_key']] = $v;
    }

    unset($settings['app_secret']);
    unset($settings['adminPassword']);
    unset($settings['sellerPassword']);
    unset($settings['masterPassword']);

    if (!$isStaff) {
        unset($settings['users']);
        unset($settings['salesAdvisors']);
    } else {
        if (!empty($settings['users']) && is_array($settings['users'])) {
            foreach ($settings['users'] as &$u) {
                unset($u['password']);
            }
        }
    }

    jsonResponse(['settings' => $settings]);
}

