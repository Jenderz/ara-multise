<?php

/**
 * LYBERATE - MODULAR API GATEWAY V4 (CDN ENABLED)
 */

// 1. Cargar Núcleo
require_once 'lib/config.php';
require_once 'lib/schema.php';

// --- SEGURIDAD DE APLICACIÓN (PARA EVITAR BLOQUEOS ANTIVIRUS) ---
if (($_SERVER['HTTP_X_APP_TOKEN'] ?? '') !== 'AraEcom_v5_Secure') {
    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['error' => 'Security Token Missing']);
    exit;
}
// ------------------------------------------------------------- 

// 2. Iniciar DB y Migraciones
$pdo = getDBConnection();
checkAndMigrateDB($pdo);

// 3. Contexto
$branchId = isset($_SERVER['HTTP_X_BRANCH_ID']) ? intval($_SERVER['HTTP_X_BRANCH_ID']) : 1;
if ($branchId < 0) $branchId = 1;

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = safeJsonDecode($rawInput);

// 4. Enrutador Modular
try {
    switch ($action) {
        // --- LECTURA ---
        case 'get_all':
            require_once 'lib/read.php';
            handleGetAll($pdo, $branchId);
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
            $stmt = $pdo->prepare("INSERT INTO `customers` (phone, `name`, address, total_spent, order_count, last_order_date, order_ids) VALUES (:p, :n, :a, :t, :c, :d, :i) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), address=VALUES(address), total_spent=VALUES(total_spent), order_count=VALUES(order_count), last_order_date=VALUES(last_order_date), order_ids=VALUES(order_ids)");
            $stmt->execute([':p' => $input['phone'], ':n' => $input['name'], ':a' => $input['address'], ':t' => floatval($input['totalSpent']), ':c' => intval($input['orderCount']), ':d' => intval($input['lastOrderDate']), ':i' => safeJsonEncode($input['orderIds'])]);
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
            $stmt = $pdo->prepare("INSERT INTO `categories` (id, name, image) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), image=VALUES(image)");
            $stmt->execute([$input['id'], $input['name'], $input['image']]);
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
            require_once 'lib/write.php';
            handleReset($pdo, $input);
            break;
        case 'save_coupon':
            $c = $input;
            $stmt = $pdo->prepare("INSERT INTO `coupons` (code, discount_type, value, active) VALUES (:c, :t, :v, :a) ON DUPLICATE KEY UPDATE discount_type=:t, value=:v, active=:a");
            $stmt->execute([':c' => $c['code'], ':t' => $c['discountType'], ':v' => $c['value'], ':a' => $c['active'] ? 1 : 0]);
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

            // --- UPLOAD HANDLER LOCAL (SIN CDN EXTERNO) ---

            break;

        case 'upload_pwa_screenshot':
            $b64Data = $input['base64'] ?? '';
            $fileName = $input['fileName'] ?? ''; // desktop.jpg or mobile.jpg

            if (empty($b64Data) || empty($fileName)) jsonResponse(['error' => 'Missing data or filename'], 400);

            // Validar nombre de archivo por seguridad
            if (!in_array($fileName, ['desktop.jpg', 'mobile.jpg'])) {
                jsonResponse(['error' => 'Invalid filename. Only desktop.jpg and mobile.jpg are allowed.'], 400);
            }

            // Decodificar Base64
            list($type, $data) = explode(';', $b64Data);
            list(, $data)      = explode(',', $data);
            $imgData = base64_decode($data);

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
            $b64Data = $input['base64'] ?? '';

            if (empty($b64Data)) jsonResponse(['error' => 'Missing data'], 400);

            // Decodificar Base64
            list($type, $data) = explode(';', $b64Data);
            list(, $data)      = explode(',', $data);
            $imgData = base64_decode($data);

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
            $b64Data = $input['base64'] ?? '';
            if (empty($b64Data)) jsonResponse(['error' => 'No data'], 400);

            // Decodificar Base64
            list($type, $data) = explode(';', $b64Data);
            list(, $data)      = explode(',', $data);
            $imgData = base64_decode($data);

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
            if (!empty($sub['endpoint'])) {
                $stmt = $pdo->prepare("INSERT INTO `push_subscriptions` (endpoint, p256dh, auth) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE created_at = NOW()");
                $stmt->execute([$sub['endpoint'], $keys['p256dh'] ?? '', $keys['auth'] ?? '']);
            }
            jsonResponse(['status' => 'success']);
            break;

        default:
            jsonResponse(['message' => 'API LYBERATE 4.0 Modular - OK', 'branch' => $branchId]);
            break;
    }
} catch (\Throwable $e) {
    jsonResponse(['error' => 'Internal Server Error', 'details' => $e->getMessage()], 500);
}
