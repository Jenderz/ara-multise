<?php

/**
 * LYBERATE CDN RECEIVER
 * Este archivo debe alojarse en tu servidor CDN o carpeta pública
 */

// CONFIGURACIÓN
define('API_KEY', 'TuClaveMaestraSegura'); // Debe coincidir con la de la tienda
define('UPLOAD_DIR', 'assets'); // Carpeta donde se guardan (debe tener permisos 777)
define('PUBLIC_URL', 'https://tu-dominio.com/assets');

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// 1. Validar Método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// 2. Validar API Key
if (!isset($_POST['key']) || $_POST['key'] !== API_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized Access']);
    exit;
}

// 3. Validar Archivo
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error']);
    exit;
}

// 4. Validar Store ID (Para separar carpetas)
$storeId = isset($_POST['store_id']) ? preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $_POST['store_id']) : 'default';
if (empty($storeId)) $storeId = 'default';

// 5. Crear directorio si no existe
$targetDir = __DIR__ . '/' . UPLOAD_DIR . '/' . $storeId;
if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create directory']);
        exit;
    }
}

// 6. Procesar Archivo
$file = $_FILES['image'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

if (!in_array($ext, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type']);
    exit;
}

// Nombre único
$filename = uniqid('img_') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$targetPath = $targetDir . '/' . $filename;

// 7. Mover y Responder
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    $publicUrl = PUBLIC_URL . '/' . $storeId . '/' . $filename;
    echo json_encode([
        'status' => 'success',
        'url' => $publicUrl,
        'store' => $storeId
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
}
