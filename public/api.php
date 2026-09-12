<?php

/**
 * LYBERATE - MODULAR API GATEWAY V4
 */

// ════════════════════════════════════════════════════════════════════
// RATE LIMITER — Protección contra ráfagas (Imunify360 / Firewall)
// Límite: 120 peticiones por minuto por IP (= 2 req/seg).
// Si se excede → HTTP 429. El frontend lo ignora con gracia.
// ════════════════════════════════════════════════════════════════════
$_rl_ip     = $_SERVER['HTTP_CF_CONNECTING_IP'] 
    ?? (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]) : null)
    ?? ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$_rl_file   = sys_get_temp_dir() . '/rl_' . md5($_rl_ip) . '.json';
$_rl_now    = time();
$_rl_window = 60;  // ventana de 60 segundos
$_rl_max    = 120; // máximo 120 req/min por IP

$_rl_data = @json_decode(@file_get_contents($_rl_file), true)
    ?: ['count' => 0, 'start' => $_rl_now];

if ($_rl_now - $_rl_data['start'] >= $_rl_window) {
    $_rl_data = ['count' => 0, 'start' => $_rl_now];
}
$_rl_data['count']++;

if ($_rl_data['count'] > $_rl_max) {
    http_response_code(429);
    header('Content-Type: application/json');
    header('Retry-After: ' . ($_rl_window - ($_rl_now - $_rl_data['start'])));
    echo json_encode(['error' => 'Too Many Requests']);
    exit;
}
@file_put_contents($_rl_file, json_encode($_rl_data), LOCK_EX);
// ════════════════════════════════════════════════════════════════════

// 1. Cargar Núcleo
if (file_exists(__DIR__ . '/lib/config.php')) {
    require_once __DIR__ . '/lib/config.php';
} else {
    require_once __DIR__ . '/lib/config.example.php';
}
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/auth.php';

// --- SEGURIDAD DE APLICACIÓN (PARA EVITAR BLOQUEOS ANTIVIRUS) ---
if (($_SERVER['HTTP_X_APP_TOKEN'] ?? '') !== 'AraEcom_v5_Secure') {
    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['error' => 'Security Token Missing']);
    exit;
}
// ------------------------------------------------------------- 

// 2. Iniciar DB y Migraciones Condicionales (Previene bloqueo DDL en cada request)
$pdo = getDBConnection();

$schemaLock = __DIR__ . '/.schema_version';
$currentSchemaVersion = 10;
if (!file_exists($schemaLock) || intval(@file_get_contents($schemaLock)) < $currentSchemaVersion) {
    checkAndMigrateDB($pdo);
    @file_put_contents($schemaLock, strval($currentSchemaVersion));
}

// 3. Contexto
$branchId = isset($_SERVER['HTTP_X_BRANCH_ID']) ? intval($_SERVER['HTTP_X_BRANCH_ID']) : 1;
if ($branchId < 0) $branchId = 1;

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = safeJsonDecode($rawInput);

// 4. Enrutador Modular
try {
    switch ($action) {
        // --- AUTENTICACIÓN & MIGRACIONES ---
        case 'login':
            handleLogin($pdo, $input);
            break;
        case 'migrate':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador.'], 403);
            }
            checkAndMigrateDB($pdo);
            @file_put_contents(__DIR__ . '/.schema_version', strval($currentSchemaVersion));
            jsonResponse(['status' => 'success', 'message' => 'Base de datos migrada e indexada correctamente.']);
            break;

        // --- LECTURA ---
        case 'get_all':
            require_once 'lib/read.php';
            handleGetAll($pdo, $branchId);
            break;
        case 'get_settings':
            require_once 'lib/read.php';
            handleGetSettings($pdo);
            break;
        case 'get_products':
            require_once 'lib/read.php';
            handleGetProducts($pdo, $branchId);
            break;
        case 'get_orders':
            require_once 'lib/read.php';
            handleGetOrders($pdo, $branchId);
            break;
        case 'get_customers':
            require_once 'lib/read.php';
            handleGetCustomers($pdo);
            break;

        // --- ESCRITURA ---
        case 'save_product':
            require_once 'lib/write.php';
            handleSaveProduct($pdo, $input, $branchId);
            break;
        case 'save_order':
            require_once 'lib/write.php';
            handleSaveOrder($pdo, $input, $branchId);
            break;
        case 'save_customer':
            require_once 'lib/write.php';
            $stmt = $pdo->prepare("INSERT INTO `customers` (phone, `name`, cedula, address, total_spent, order_count, last_order_date, order_ids) VALUES (:p, :n, :cedula, :a, :t, :c, :d, :i) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), cedula=VALUES(cedula), address=VALUES(address), total_spent=VALUES(total_spent), order_count=VALUES(order_count), last_order_date=VALUES(last_order_date), order_ids=VALUES(order_ids)");
            $stmt->execute([':p' => $input['phone'], ':n' => $input['name'], ':cedula' => $input['cedula'] ?? '', ':a' => $input['address'], ':t' => floatval($input['totalSpent']), ':c' => intval($input['orderCount']), ':d' => intval($input['lastOrderDate']), ':i' => safeJsonEncode($input['orderIds'])]);
            jsonResponse(['status' => 'success']);
            break;
        case 'save_settings':
            require_once 'lib/write.php';
            handleSaveSettings($pdo, $input);
            break;

        // --- BATCH (Respaldo) ---
        case 'batch_write':
            require_once 'lib/batch.php';
            handleBatchWrite($pdo, $input, $branchId);
            break;

        // --- INVENTARIO ---
        case 'adjust_stock':
            require_once 'lib/inventory.php';
            handleAdjustStock($pdo, $input, $branchId);
            break;
        case 'transfer_stock':
            require_once 'lib/inventory.php';
            handleTransferStock($pdo, $input);
            break;
        case 'get_movements':
            require_once 'lib/inventory.php';
            handleGetMovements($pdo);
            break;
        case 'get_stock_breakdown':
            require_once 'lib/inventory.php';
            handleStockBreakdown($pdo);
            break;
        case 'get_product_history':
            $stmt = $pdo->prepare("SELECT * FROM `product_movements` WHERE `product_id` = ? ORDER BY `date` DESC LIMIT 100");
            $stmt->execute([$_GET['product_id']]);
            jsonResponse($stmt->fetchAll());
            break;

        // --- OTROS (Simples) ---
        case 'delete_product':
            require_once 'lib/write.php';
            handleDelete($pdo, 'products', 'id', $input['id']);
            break;
        case 'delete_order':
            require_once 'lib/write.php';
            handleDelete($pdo, 'orders', 'id', $input['id']);
            break;
        case 'delete_customer':
            require_once 'lib/write.php';
            handleDelete($pdo, 'customers', 'phone', $input['phone']);
            break;
        case 'save_category':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador para gestionar categorías.'], 403);
            }

            $catId   = $input['id'] ?? '';
            $catName = trim($input['name'] ?? '');
            $catImg  = $input['image'] ?? '';

            // Verificar si es una categoría nueva antes de insertar
            $checkCat = $pdo->prepare("SELECT id FROM `categories` WHERE id = ?");
            $checkCat->execute([$catId]);
            $isNewCategory = ($checkCat->fetchColumn() === false);

            $stmt = $pdo->prepare("INSERT INTO `categories` (id, name, image) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), image=VALUES(image)");
            $stmt->execute([$catId, $catName, $catImg]);

            if ($isNewCategory && !empty($catName)) {
                try {
                    require_once __DIR__ . '/lib/push_sender.php';
                    WebPushSender::notifyNewCategory($pdo, $catName, $catId, $catImg);
                } catch (Exception $e) {
                    error_log("[WebPush Category Error] " . $e->getMessage());
                }
            }

            jsonResponse(['status' => 'success']);
            break;
        case 'delete_category':
            require_once 'lib/write.php';
            handleDelete($pdo, 'categories', 'id', $input['id']);
            break;
        case 'save_branch':
            require_once 'lib/write.php';
            handleSaveBranch($pdo, $input);
            break;
        case 'delete_branch':
            require_once 'lib/write.php';
            handleDelete($pdo, 'branches', 'id', $input['id']);
            break;
        case 'reset_database':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere sesión de administrador para reiniciar la base de datos.'], 403);
            }
            require_once 'lib/write.php';
            handleReset($pdo, $input);
            break;
        case 'save_coupon':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador para gestionar cupones.'], 403);
            }
            $c = $input;
            $code = strtoupper(trim(preg_replace('/\s+/', '', (string)($c['code'] ?? ''))));
            if (empty($code)) {
                jsonResponse(['error' => 'Código de cupón requerido'], 400);
            }
            $discountType = (isset($c['discountType']) && $c['discountType'] === 'fixed') || (isset($c['discount_type']) && $c['discount_type'] === 'fixed') ? 'fixed' : 'percentage';
            $value = floatval($c['value'] ?? 0);
            $active = isset($c['active']) ? ($c['active'] ? 1 : 0) : 1;
            $stmt = $pdo->prepare("INSERT INTO `coupons` (code, discount_type, value, active) VALUES (:c, :t, :v, :a) ON DUPLICATE KEY UPDATE discount_type=:t, value=:v, active=:a");
            $stmt->execute([':c' => $code, ':t' => $discountType, ':v' => $value, ':a' => $active]);

            if ($active == 1) {
                try {
                    require_once __DIR__ . '/lib/push_sender.php';
                    $discText = $discountType === 'percentage' ? "{$value}% de descuento" : "\${$value} de descuento";
                    WebPushSender::notifyNewCoupon($pdo, $code, $discText);
                } catch (Exception $e) {
                    error_log("[WebPush Coupon Error] " . $e->getMessage());
                }
            }

            jsonResponse(['status' => 'success']);
            break;
        case 'delete_coupon':
            require_once 'lib/write.php';
            handleDelete($pdo, 'coupons', 'code', $input['code']);
            break;

        // --- LOGS & ACTIVIDAD ---
        case 'get_logs':
            require_once 'lib/logs.php';
            handleGetLogs($pdo);
            break;
        case 'log_activity':
            require_once 'lib/logs.php';
            handleLogActivity($pdo, $input);
            break;
        case 'clear_logs':
            require_once 'lib/logs.php';
            handleClearLogs($pdo);
            break;

        case 'upload_pwa_screenshot':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador.'], 403);
            }
            $b64Data = $input['base64'] ?? '';
            $fileName = $input['fileName'] ?? ''; // desktop.jpg or mobile.jpg

            if (empty($b64Data) || empty($fileName)) jsonResponse(['error' => 'Missing data or filename'], 400);

            // Validar nombre de archivo por seguridad
            if (!in_array($fileName, ['desktop.jpg', 'mobile.jpg'])) {
                jsonResponse(['error' => 'Invalid filename. Only desktop.jpg and mobile.jpg are allowed.'], 400);
            }

            // Decodificar Base64 de forma robusta
            $cleanB64 = (strpos($b64Data, ',') !== false) ? substr($b64Data, strpos($b64Data, ',') + 1) : $b64Data;
            $imgData = base64_decode($cleanB64);
            if ($imgData === false) jsonResponse(['error' => 'Invalid base64 image data'], 400);

            // Directorio screenshots en raíz
            $screenshotsDir = __DIR__ . '/screenshots';
            if (!is_dir($screenshotsDir)) {
                mkdir($screenshotsDir, 0755, true);
            }

            $filePath = $screenshotsDir . '/' . $fileName;

            if (file_put_contents($filePath, $imgData)) {
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'];
                // Usar ?t=timestamp para evitar cache
                $publicUrl = $protocol . '://' . $host . '/screenshots/' . $fileName . '?t=' . time();
                jsonResponse(['url' => $publicUrl, 'status' => 'success']);
            } else {
                jsonResponse(['error' => 'Failed to save PWA screenshot'], 500);
            }
            break;

        case 'update_pwa_icon':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Sesión expirada o no iniciada.'], 401);
            }
            if ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master') {
                jsonResponse(['error' => 'Acceso denegado. Se requiere rol de administrador.'], 403);
            }
            $b64Data = $input['base64'] ?? '';
            if (empty($b64Data)) jsonResponse(['error' => 'Missing data'], 400);

            // Decodificar Base64 de forma robusta
            $cleanB64 = (strpos($b64Data, ',') !== false) ? substr($b64Data, strpos($b64Data, ',') + 1) : $b64Data;
            $imgData = base64_decode($cleanB64);
            if ($imgData === false) jsonResponse(['error' => 'Invalid base64 image data'], 400);

            // Ruta al icono principal
            $iconPath = __DIR__ . '/icon.png';

            if (file_put_contents($iconPath, $imgData)) {
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'];
                $publicUrl = $protocol . '://' . $host . '/icon.png?t=' . time();
                jsonResponse(['url' => $publicUrl, 'status' => 'success']);
            } else {
                jsonResponse(['error' => 'Failed to save PWA Icon'], 500);
            }
            break;

        case 'upload_image_stealth':
            $authUser = getAuthUser($pdo);
            if (!$authUser) {
                jsonResponse(['error' => 'No autorizado. Se requiere sesión activa para subir imágenes.'], 401);
            }
            $b64Data = $input['base64'] ?? '';
            if (empty($b64Data)) jsonResponse(['error' => 'No data'], 400);

            // Decodificar Base64 de forma robusta
            $cleanB64 = (strpos($b64Data, ',') !== false) ? substr($b64Data, strpos($b64Data, ',') + 1) : $b64Data;
            $imgData = base64_decode($cleanB64);
            if ($imgData === false) jsonResponse(['error' => 'Invalid base64 image data'], 400);

            // Blindaje de seguridad: límite máximo de 10 MB para proteger memoria del servidor
            if (strlen($imgData) > 10 * 1024 * 1024) {
                jsonResponse(['error' => 'El archivo de imagen supera el límite permitido de 10 MB'], 400);
            }

            // Identificar Dominio/Tienda
            $host = $_SERVER['HTTP_HOST'];
            $storeFolder = preg_replace('/^www\./', '', $host);
            $storeFolder = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $storeFolder);

            // Crear directorio local si no existe
            $uploadDir = __DIR__ . '/uploads/' . $storeFolder;
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            // Generar nombre único
            $filename = 'img_' . uniqid() . '_' . bin2hex(random_bytes(4)) . '.jpg';
            $filePath = $uploadDir . '/' . $filename;

            // Guardar archivo
            if (file_put_contents($filePath, $imgData)) {
                // Construir URL pública (sin /public/ porque es la raíz del sitio)
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $publicUrl = $protocol . '://' . $host . '/uploads/' . $storeFolder . '/' . $filename;

                jsonResponse(['url' => $publicUrl]);
            } else {
                jsonResponse(['error' => 'Failed to save file'], 500);
            }
            break;

        case 'subscribe_push':
            $sub = $input;
            $keys = $sub['keys'] ?? [];
            $endpoint = $sub['endpoint'] ?? '';
            if (!empty($endpoint)) {
                $p256dh   = $keys['p256dh'] ?? '';
                $auth     = $keys['auth'] ?? '';
                $bId      = !empty($sub['branchId']) ? intval($sub['branchId']) : 1;
                $userName = !empty($sub['userName']) ? trim($sub['userName']) : null;
                $cartJson = !empty($sub['cart']) ? safeJsonEncode($sub['cart']) : null;
                $cartUpdated = $cartJson ? date('Y-m-d H:i:s') : null;

                $stmt = $pdo->prepare("INSERT INTO `push_subscriptions` 
                    (endpoint, p256dh, auth, branch_id, user_name, cart_items, cart_updated_at, cart_notified, last_active) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW()) 
                    ON DUPLICATE KEY UPDATE 
                    p256dh = VALUES(p256dh), 
                    auth = VALUES(auth), 
                    branch_id = VALUES(branch_id), 
                    user_name = COALESCE(VALUES(user_name), user_name),
                    cart_items = COALESCE(VALUES(cart_items), cart_items),
                    cart_updated_at = COALESCE(VALUES(cart_updated_at), cart_updated_at),
                    last_active = NOW()");
                $stmt->execute([$endpoint, $p256dh, $auth, $bId, $userName, $cartJson, $cartUpdated]);
            }
            jsonResponse(['status' => 'success']);
            break;

        case 'sync_push_activity':
            $endpoint = $input['endpoint'] ?? '';
            if (!empty($endpoint)) {
                $hasCart = array_key_exists('cart', $input);
                $cart = $input['cart'] ?? [];
                $cartEmpty = empty($cart);
                $cartJson = $cartEmpty ? null : safeJsonEncode($cart);

                if ($hasCart) {
                    $stmt = $pdo->prepare("UPDATE `push_subscriptions` SET 
                        cart_items = :cart, 
                        cart_updated_at = :cart_time, 
                        cart_notified = 0, 
                        last_active = NOW() 
                        WHERE endpoint = :endpoint");
                    $stmt->execute([
                        ':cart' => $cartJson,
                        ':cart_time' => $cartEmpty ? null : date('Y-m-d H:i:s'),
                        ':endpoint' => $endpoint
                    ]);
                } else {
                    $stmt = $pdo->prepare("UPDATE `push_subscriptions` SET last_active = NOW() WHERE endpoint = ?");
                    $stmt->execute([$endpoint]);
                }
            }
            jsonResponse(['status' => 'success']);
            break;

        case 'test_push':
            $authUser = getAuthUser($pdo);
            if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
                jsonResponse(['error' => 'No autorizado. Se requiere rol de administrador.'], 403);
            }
            require_once __DIR__ . '/lib/push_sender.php';
            $storeName = WebPushSender::getStoreName($pdo);
            $endpoint = $input['endpoint'] ?? '';
            $testPayload = [
                'title' => "🔔 Notificación de Prueba - {$storeName}",
                'body'  => "El sistema Web Push nativo de {$storeName} está activo y funcionando correctamente.",
                'icon'  => './icon.png',
                'url'   => './'
            ];

            if (!empty($endpoint)) {
                $stmt = $pdo->prepare("SELECT p256dh, auth FROM `push_subscriptions` WHERE endpoint = ?");
                $stmt->execute([$endpoint]);
                $sub = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($sub) {
                    $res = WebPushSender::sendNotification($pdo, $endpoint, $sub['p256dh'], $sub['auth'], $testPayload);
                    if (!$res['success']) {
                        jsonResponse([
                            'status' => 'error',
                            'error'  => $res['error'] ?: ('El servicio Push rechazó la entrega (Código HTTP ' . $res['statusCode'] . ')'),
                            'result' => $res
                        ], 400);
                    }
                    jsonResponse(['status' => 'success', 'result' => $res]);
                } else {
                    jsonResponse(['error' => 'Endpoint no registrado en la base de datos'], 404);
                }
            } else {
                $res = WebPushSender::broadcast($pdo, $testPayload);
                if ($res['total'] === 0) {
                    jsonResponse([
                        'status' => 'error',
                        'error'  => 'No hay ningún dispositivo suscrito a notificaciones aún en la base de datos.',
                        'broadcast_result' => $res
                    ], 400);
                }
                jsonResponse(['status' => 'success', 'broadcast_result' => $res]);
            }
            break;

        case 'send_custom_push':
            $authUser = getAuthUser($pdo);
            if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
                jsonResponse(['error' => 'No autorizado. Se requiere rol de administrador.'], 403);
            }
            require_once __DIR__ . '/lib/push_sender.php';
            $title = trim($input['title'] ?? '');
            $body  = trim($input['body'] ?? '');
            $url   = trim($input['url'] ?? './');
            $targetBranch = !empty($input['branchId']) ? intval($input['branchId']) : null;

            if (empty($body)) {
                jsonResponse(['error' => 'El mensaje de la notificación no puede estar vacío.'], 400);
            }

            if (empty($title)) {
                $title = WebPushSender::getStoreName($pdo);
            }

            $payload = [
                'title' => $title,
                'body'  => $body,
                'icon'  => !empty($input['icon']) ? $input['icon'] : './icon.png',
                'url'   => $url
            ];

            $res = WebPushSender::broadcast($pdo, $payload, $targetBranch);
            jsonResponse([
                'status' => 'success',
                'message' => "Notificación enviada a {$res['success']} dispositivos.",
                'stats' => $res
            ]);
            break;

        case 'get_push_stats':
            $authUser = getAuthUser($pdo);
            if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
                jsonResponse(['error' => 'No autorizado.'], 403);
            }
            try {
                $stmt = $pdo->query("SELECT 
                    COUNT(*) as total_subscribers,
                    COUNT(CASE WHEN last_active >= (NOW() - INTERVAL 30 DAY) THEN 1 END) as active_30d,
                    COUNT(CASE WHEN cart_items IS NOT NULL AND cart_items != '' AND cart_items != '[]' THEN 1 END) as carts_pending
                    FROM `push_subscriptions`");
                $data = $stmt->fetch(PDO::FETCH_ASSOC);
                jsonResponse([
                    'total' => intval($data['total_subscribers'] ?? 0),
                    'active30d' => intval($data['active_30d'] ?? 0),
                    'cartsPending' => intval($data['carts_pending'] ?? 0)
                ]);
            } catch (Exception $e) {
                jsonResponse(['total' => 0, 'active30d' => 0, 'cartsPending' => 0]);
            }
            break;

        default:
            jsonResponse(['message' => 'API LYBERATE 4.0 Modular - OK', 'branch' => $branchId]);
            break;
    }
} catch (\Throwable $e) {
    jsonResponse(['error' => 'Internal Server Error', 'details' => $e->getMessage()], 500);
}
