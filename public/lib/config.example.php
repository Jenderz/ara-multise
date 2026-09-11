<?php

/**
 * LYBERATE - ARCHIVO DE CONFIGURACIÓN DE EJEMPLO
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo como "config.php" en la misma carpeta
 * 2. Actualiza los valores con tus credenciales reales
 * 3. NUNCA subas config.php a Git (está en .gitignore)
 */

// --- CONFIGURACIÓN DE ENTORNO ---
ob_start();
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

@ini_set('memory_limit', '1024M');
@ini_set('max_execution_time', '1200');
date_default_timezone_set('America/Caracas');


// --- MANEJADOR DE ERRORES FATALES ---
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_COMPILE_ERROR)) {
        if (ob_get_length()) ob_clean();
        http_response_code(500);
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Branch-ID, X-App-Token, X-Admin-Token");
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(['error' => 'Fatal Server Error', 'details' => $error['message']]);
        exit();
    }
});

// --- HEADERS Y CORS ---
if (ob_get_length()) ob_clean();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Branch-ID, X-App-Token, X-Admin-Token");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- CONFIGURACIÓN WEB PUSH VAPID (OPCIONAL: POR DEFECTO YA ESTÁ PRECONFIGURADO) ---
// define('VAPID_PUBLIC_KEY', 'BMS4ALXFLZGF2W_KYT9Gf8ZbmA8r4RjyEgyikAZO3j56is92_0XyddxO75G9VWDBY9wfG3YUUPPawtYdr-0GpFI');
// define('VAPID_SUBJECT', 'mailto:notificaciones@ara.com');

// --- CONEXIÓN A BASE DE DATOS ---
function getDBConnection()
{
    // ⚠️ AJUSTA ESTOS DATOS A TU SERVIDOR
    $host = 'localhost';
    $db   = 'nombre_de_tu_base_datos'; // ⚠️ CAMBIAR
    $user = 'root';                     // ⚠️ CAMBIAR
    $pass = '';                         // ⚠️ CAMBIAR
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => true,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];

    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (\PDOException $e) {
        jsonResponse(['error' => 'Error de conexión a la DB', 'details' => $e->getMessage()], 500);
    }
}

// --- HELPERS JSON Y UTILS ---
function jsonResponse($data, $code = 200)
{
    if (ob_get_length()) ob_clean();
    http_response_code($code);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        echo json_encode(['error' => 'JSON Encoding Error', 'details' => json_last_error_msg()]);
    } else {
        echo $json;
    }
    exit();
}

function safeJsonDecode($str)
{
    if (is_array($str)) return $str;
    if (!is_string($str) || empty(trim($str))) return [];
    $decoded = json_decode($str, true);
    return (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) ? $decoded : [];
}

function safeJsonEncode($data)
{
    if (is_string($data)) return $data;
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function generateUniqueId()
{
    try {
        return bin2hex(random_bytes(16));
    } catch (Exception $e) {
        return uniqid('', true) . mt_rand(1000, 9999);
    }
}

// --- MAPPERS DE OBJETOS ---
function mapProduct($p)
{
    $p['isVisible']        = (bool)$p['is_visible'];
    $p['isFeatured']       = (bool)$p['is_featured'];
    $p['stock']            = (int)($p['stock'] ?? 0);
    $p['globalStock']      = (int)($p['global_stock'] ?? 0);
    $p['minStock']         = (int)($p['min_stock'] ?? 5);
    $p['price']            = (float)$p['price'];
    $p['salePrice']        = (float)($p['sale_price'] ?? 0);
    $p['cost']             = (float)($p['cost'] ?? 0);
    $p['trackStock']       = isset($p['track_stock']) ? (bool)$p['track_stock'] : true;
    $p['barcodeEan']       = $p['barcode_ean'] ?? ($p['barcodeEan'] ?? '');
    $p['images']           = safeJsonDecode($p['images']);
    $p['variantOptions']   = safeJsonDecode($p['variant_options']);
    $p['variants']         = safeJsonDecode($p['variants']);
    // Multi-categoría: deserializar array de categorías adicionales
    $rawExtra = $p['extra_categories'] ?? null;
    $p['extraCategories']  = (!empty($rawExtra) && $rawExtra !== 'null')
        ? array_values(array_filter(safeJsonDecode($rawExtra), fn($c) => is_string($c) && $c !== ''))
        : [];
    return $p;
}

function mapOrder($o)
{
    $o['items'] = safeJsonDecode($o['items']);
    $o['total'] = (float)$o['total'];
    $o['subtotal'] = (float)($o['subtotal'] ?? 0);
    $o['discount'] = (float)($o['discount'] ?? 0);
    $o['date'] = (int)$o['date'];
    $o['branchId'] = (int)($o['branch_id'] ?? 1);
    $o['customerName'] = $o['customer_name'] ?? 'Cliente';
    $o['customerPhone'] = $o['customer_phone'] ?? '';
    $o['customerAddress'] = $o['customer_address'] ?? '';
    $o['paymentMethod'] = $o['payment_method'] ?? 'Por Definir';
    $o['sellerId'] = $o['seller_id'] ?: 'web-client';
    $o['sellerName'] = $o['seller_name'] ?: 'Tienda Online';
    $o['sellerCommission'] = (float)($o['seller_commission'] ?? 0);
    $o['commissionRate'] = (float)($o['commission_rate'] ?? 0);
    $o['advisorId'] = !empty($o['advisor_id']) ? $o['advisor_id'] : ($o['advisorId'] ?? null);
    $o['advisorName'] = !empty($o['advisor_name']) ? $o['advisor_name'] : ($o['advisorName'] ?? null);
    $o['advisorCommission'] = (float)($o['advisor_commission'] ?? ($o['advisorCommission'] ?? 0));
    $o['advisorRate'] = (float)($o['advisor_rate'] ?? ($o['advisorRate'] ?? 0));
    // Inferencia inteligente para pedidos antiguos o mal formados
    $o['deliveryMethod'] = $o['delivery_method'] ?? (
        (empty($o['seller_id']) || $o['seller_id'] === 'web-client' || $o['seller_id'] === 'online') 
        ? 'delivery' 
        : 'pos'
    );
    $o['pickupBranchId'] = (int)($o['pickup_branch_id'] ?? 0);
    $o['stockDeducted'] = (bool)($o['stock_deducted'] ?? 0);
    $o['couponCode'] = !empty($o['coupon_code']) ? $o['coupon_code'] : ($o['couponCode'] ?? null);
    return $o;
}

function mapCustomer($c)
{
    $c['totalSpent'] = (float)($c['total_spent'] ?? 0);
    $c['orderCount'] = (int)($c['order_count'] ?? 0);
    $c['lastOrderDate'] = (int)($c['last_order_date'] ?? 0);
    $c['orderIds'] = safeJsonDecode($c['order_ids']);
    $c['cedula'] = $c['cedula'] ?? '';
    return $c;
}

function mapCoupon($c)
{
    return [
        'code' => strtoupper(trim((string)($c['code'] ?? ''))),
        'discountType' => (isset($c['discount_type']) && $c['discount_type'] === 'fixed') || (isset($c['discountType']) && $c['discountType'] === 'fixed') ? 'fixed' : 'percentage',
        'value' => (float)($c['value'] ?? 0),
        'active' => !empty($c['active']),
    ];
}
