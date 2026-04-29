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

// --- CONFIGURACIÓN CDN ---
// ⚠️ CAMBIA ESTOS VALORES POR LOS TUYOS
define('CDN_URL', 'https://tu-dominio.com/cdn/receiver.php');
define('CDN_PUBLIC_BASE', 'https://tu-dominio.com/uploads');
define('CDN_API_KEY', 'TU_API_KEY_AQUI'); // ⚠️ CAMBIAR

// --- MANEJADOR DE ERRORES FATALES ---
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_COMPILE_ERROR)) {
        if (ob_get_length()) ob_clean();
        http_response_code(500);
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Branch-ID");
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(['error' => 'Fatal Server Error', 'details' => $error['message']]);
        exit();
    }
});

// --- HEADERS Y CORS ---
if (ob_get_length()) ob_clean();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Branch-ID");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
    if (!is_string($str) || empty($str)) return [];
    $decoded = json_decode($str, true);
    return (json_last_error() === JSON_ERROR_NONE) ? $decoded : [];
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
    $p['isVisible'] = (bool)$p['is_visible'];
    $p['isFeatured'] = (bool)$p['is_featured'];
    $p['stock'] = (int)($p['stock'] ?? 0);
    $p['globalStock'] = (int)($p['global_stock'] ?? 0);
    $p['minStock'] = (int)($p['min_stock'] ?? 5);
    $p['price'] = (float)$p['price'];
    $p['salePrice'] = (float)($p['sale_price'] ?? 0);
    $p['cost'] = (float)($p['cost'] ?? 0);
    $p['trackStock'] = isset($p['track_stock']) ? (bool)$p['track_stock'] : true;
    $p['images'] = safeJsonDecode($p['images']);
    $p['variantOptions'] = safeJsonDecode($p['variant_options']);
    $p['variants'] = safeJsonDecode($p['variants']);
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
    // Inferencia inteligente para pedidos antiguos o mal formados
    $o['deliveryMethod'] = $o['delivery_method'] ?? (
        (empty($o['seller_id']) || $o['seller_id'] === 'web-client' || $o['seller_id'] === 'online') 
        ? 'delivery' 
        : 'pos'
    );
    $o['pickupBranchId'] = (int)($o['pickup_branch_id'] ?? 0);
    return $o;
}

function mapCustomer($c)
{
    $c['totalSpent'] = (float)($c['total_spent'] ?? 0);
    $c['orderCount'] = (int)($c['order_count'] ?? 0);
    $c['lastOrderDate'] = (int)($c['last_order_date'] ?? 0);
    $c['orderIds'] = safeJsonDecode($c['order_ids']);
    return $c;
}
