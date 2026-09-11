<?php

/**
 * ARA ECOMMERCE V 2.0 - CRON JOB DE NOTIFICACIONES AUTOMÁTICAS
 *
 * Configuración en cPanel:
 * Frecuencia recomendada: Cada 1 hora (0 * * * *) o cada 30 minutos (*/30 * * * *)
 *
 * Comando CLI en cPanel:
 * /usr/local/bin/php /home/TU_USUARIO/public_html/cron_notifications.php
 *
 * O llamada cURL / Web:
 * curl -s "https://tudominio.com/cron_notifications.php?token=AraEcom_v5_Secure" > /dev/null 2>&1
 */

// 1. Cargar entorno y dependencias
if (file_exists(__DIR__ . '/lib/config.php')) {
    require_once __DIR__ . '/lib/config.php';
} else {
    require_once __DIR__ . '/lib/config.example.php';
}
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/push_sender.php';

// 2. Control de Acceso: Permitir si corre por línea de comandos (CLI) o con el token de seguridad
$isCli = (php_sapi_name() === 'cli' || defined('STDIN'));
$providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_APP_TOKEN'] ?? '');

if (!$isCli && $providedToken !== 'AraEcom_v5_Secure') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Acceso denegado. Token inválido o ausente.']);
    exit();
}

try {
    $pdo = getDBConnection();

    // 3. Ejecutar automatización de carritos abandonados (> 2 horas)
    $cartNotified = WebPushSender::sendAbandonedCartReminders($pdo);

    // 4. Ejecutar automatización de clientes inactivos (> 15 días)
    $inactiveNotified = WebPushSender::sendInactiveUserReminders($pdo, 15);

    $result = [
        'status' => 'success',
        'message' => 'Cron de notificaciones ejecutado correctamente.',
        'abandoned_cart_sent' => $cartNotified,
        'inactive_users_sent' => $inactiveNotified,
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if ($isCli) {
        echo "[ARA CRON " . date('Y-m-d H:i:s') . "] Ejecución completada. Carrito abandonado: {$cartNotified}, Inactivos: {$inactiveNotified}\n";
    } else {
        header('Content-Type: application/json');
        echo json_encode($result);
    }
} catch (Exception $e) {
    if ($isCli) {
        echo "[ARA CRON ERROR] " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Error en ejecución del Cron', 'details' => $e->getMessage()]);
    }
}
