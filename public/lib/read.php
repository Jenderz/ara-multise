<?php
// Función auxiliar para inyectar stock de variantes
function injectVariantStock($product, $localMap, $globalMap, $branchId = 0)
{
    if (empty($product['variants']) || !is_array($product['variants'])) {
        return $product;
    }

    $localTotal = 0;
    $globalTotal = 0;

    foreach ($product['variants'] as &$variant) {
        // 1. Calcular Stock Local (Sede Actual)
        // Usamos cast a string para asegurar coincidencia con el mapa indexado como string
        $vId = isset($variant['id']) ? (string)$variant['id'] : '';

        if ($vId !== '' && isset($localMap[$vId])) {
            $variant['stock'] = (int)$localMap[$vId];
        } else {
            // STRICT MODE: Si no está en inventory, es 0.
            $variant['stock'] = 0;
        }
        $localTotal += $variant['stock'];

        // 2. Calcular Stock Global (Suma Real de todas las sedes)
        if ($vId !== '' && isset($globalMap[$vId])) {
            $globalTotal += (int)$globalMap[$vId];
        } else {
            // STRICT GLOBAL: Si no hay registros globales, es 0.
            $globalTotal += 0;
        }
    }

    // Asignar totales calculados
    if (!empty($product['variants'])) {
        $product['stock'] = $localTotal; // Stock visible en la sede actual

        // Stock Global Real (Sobrescribe siempre al "Fantasma" de la DB)
        $product['global_stock'] = $globalTotal;
        $product['globalStock'] = $globalTotal;
    }

    return $product;
}

function handleGetAll($pdo, $branchId)
{
    $settings = [];
    $sStmt = $pdo->query("SELECT * FROM `settings`");
    while ($r = $sStmt->fetch()) {
        $v = $r['setting_value'];
        if ($v === 'true') $v = true;
        elseif ($v === 'false') $v = false;
        else {
            $j = json_decode($v, true);
            if (json_last_error() === JSON_ERROR_NONE) $v = $j;
        }
        $settings[$r['setting_key']] = $v;
    }

    $cats = $pdo->query("SELECT * FROM `categories`")->fetchAll();

    // 1. Obtener Productos Base
    // Nota: El stock del PADRE (columna stock en products) es solo referencial o caché.
    // La fuente de verdad para el padre también debería venir de inventory, pero para listados rápidos
    // a veces se usa la tabla products. Aquí haremos un LEFT JOIN para asegurar consistencia.

    if ($branchId > 0) {
        $prodSql = "SELECT p.*, 
                    COALESCE(i.stock, 0) as `stock`,
                    (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `global_stock`
                    FROM `products` p 
                    LEFT JOIN `inventory` i ON p.id = i.product_id AND i.branch_id = :branchId 
                    ORDER BY p.created_at DESC";
        $stmt = $pdo->prepare($prodSql);
        $stmt->execute([':branchId' => $branchId]);
    } else {
        // Vista Global: El stock del padre es la suma de todas las sedes
        $prodSql = "SELECT p.*, 
                    (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `stock`,
                    (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `global_stock`
                    FROM `products` p 
                    ORDER BY p.created_at DESC";
        $stmt = $pdo->prepare($prodSql);
        $stmt->execute();
    }

    $rawProds = $stmt->fetchAll();
    $prods = array_map('mapProduct', $rawProds);

    // 2. Hidratación de Variantes (Optimizado)
    // Obtenemos el stock de TODAS las variantes relevantes.
    // Si es una sede específica, filtramos por ella. Si es global, sumamos.
    $inventoryMap = [];
    $globalInventoryMap = []; // Mapa separado para el stock global real

    if ($branchId > 0) {
        $invStmt = $pdo->prepare("SELECT product_id, stock FROM inventory WHERE branch_id = ?");
        $invStmt->execute([$branchId]);
        while ($row = $invStmt->fetch()) {
            $inventoryMap[(string)$row['product_id']] = $row['stock'];
        }
    } else {
        // Modo Global: Sumamos el stock de cada variante a través de todas las sedes
        // Usamos GROUP BY product_id (que en el caso de variantes es su ID único)
        $invStmt = $pdo->query("SELECT product_id, SUM(stock) as stock FROM inventory GROUP BY product_id");
        while ($row = $invStmt->fetch()) {
            $inventoryMap[(string)$row['product_id']] = $row['stock'];
        }
    }

    // SIEMPRE calculamos el mapa global real para saber disponibilidad en otras sedes
    // (Incluso si estamos en una sede específica y no tenemos stock local, queremos saber si hay global)
    $gStmt = $pdo->query("SELECT product_id, SUM(stock) as stock FROM inventory GROUP BY product_id");
    while ($row = $gStmt->fetch()) {
        $globalInventoryMap[(string)$row['product_id']] = $row['stock'];
    }

    // 3. Inyectar en cada producto
    foreach ($prods as &$p) {
        // CORRECCIÓN: Usamos el mapa global real como tercer argumento
        // Esto asegura que las variantes tengan su global_stock calculado correctamente
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

    $coupons = $pdo->query("SELECT * FROM `coupons`")->fetchAll();
    foreach ($coupons as &$cp) {
        $cp['active'] = (bool)$cp['active'];
    }

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
        $where[] = "p.category = :c";
        $params[':c'] = $cat;
    }

    $whereSql = implode(" AND ", $where);

    // SQL Base (Solo usamos la tabla products para la metadata, el stock lo recalcularemos)
    if ($branchId > 0) {
        $sql = "SELECT p.*, COALESCE(i.stock, 0) as `stock`, (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `global_stock` FROM `products` p LEFT JOIN `inventory` i ON p.id = i.product_id AND i.branch_id = :branchId WHERE $whereSql ORDER BY p.created_at DESC LIMIT $limit OFFSET $offset";
    } else {
        $sql = "SELECT p.*, (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `stock`, (SELECT COALESCE(SUM(`stock`), 0) FROM `inventory` WHERE `product_id` = p.id) as `global_stock` FROM `products` p WHERE $whereSql ORDER BY p.created_at DESC LIMIT $limit OFFSET $offset";
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
            while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = $row['stock'];
        } else {
            // Si es vista global, el "Local" es igual al Global
            $localStmt = $pdo->prepare("SELECT product_id, SUM(stock) as stock FROM inventory WHERE product_id IN ($placeholders) GROUP BY product_id");
            $localStmt->execute($flatParams);
            while ($row = $localStmt->fetch()) $localMap[(string)$row['product_id']] = $row['stock'];
        }

        // 2. Obtener MAPA GLOBAL (Siempre suma de todas las sedes)
        // Esto es necesario para corregir el "Total: 5" fantasma cuando estamos en una sede vacía.
        $globalStmt = $pdo->prepare("SELECT product_id, SUM(stock) as stock FROM inventory WHERE product_id IN ($placeholders) GROUP BY product_id");
        $globalStmt->execute($flatParams);
        while ($row = $globalStmt->fetch()) $globalMap[(string)$row['product_id']] = $row['stock'];
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
    
    // Filtro por vendedor
    if (!empty($_GET['seller']) && $_GET['seller'] !== 'all') {
        $where[] = "`seller_id` = :seller";
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
