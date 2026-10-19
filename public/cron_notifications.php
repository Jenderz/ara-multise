<?php

/**
 * ARA ECOMMERCE V 2.0 - CRON JOB DE NOTIFICACIONES AUTOMÁTICAS
 *
 * Configuración en cPanel / CloudPanel:
 * Frecuencia recomendada: Cada 1 hora (0 * * * *) o cada 30 minutos (0,30 * * * *)
 *
 * Comando CLI:
 * php /home/TU_USUARIO/htdocs/tudominio.com/cron_notifications.php
 *
 * O llamada cURL / Web:
 * curl -s "https://tudominio.com/cron_notifications.php?token=AraEcom_v5_Secure" > /dev/null 2>&1
 */

$isCli = (php_sapi_name() === 'cli' || defined('STDIN'));

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
}

try {
    // 1. Control de Acceso: Permitir si corre por línea de comandos (CLI) o con el token de seguridad
    $providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_APP_TOKEN'] ?? '');

    if (!$isCli && $providedToken !== 'AraEcom_v5_Secure') {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado. Token inválido o ausente.']);
        exit();
    }

    // 2. Cargar entorno y dependencias
    if (file_exists(__DIR__ . '/lib/config.php')) {
        require_once __DIR__ . '/lib/config.php';
    } elseif (file_exists(__DIR__ . '/lib/config.example.php')) {
        require_once __DIR__ . '/lib/config.example.php';
    } else {
        throw new \RuntimeException('No se encontró el archivo de configuración config.php en lib/');
    }

    if (!file_exists(__DIR__ . '/lib/schema.php')) {
        throw new \RuntimeException('No se encontró el archivo lib/schema.php');
    }
    require_once __DIR__ . '/lib/schema.php';

    if (!file_exists(__DIR__ . '/lib/push_sender.php')) {
        throw new \RuntimeException('No se encontró el archivo lib/push_sender.php');
    }
    require_once __DIR__ . '/lib/push_sender.php';

    $pdo = getDBConnection();

    // Asegurar que las tablas existan si es una instalación limpia
    $schemaLock = __DIR__ . '/.schema_version';
    $currentSchemaVersion = 12;
    if (!file_exists($schemaLock) || intval(@file_get_contents($schemaLock)) < $currentSchemaVersion) {
        if (function_exists('checkAndMigrateDB')) {
            checkAndMigrateDB($pdo);
            @file_put_contents($schemaLock, strval($currentSchemaVersion));
        }
    }

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
        echo json_encode($result);
    }
} catch (\Throwable $e) {
    if ($isCli) {
        echo "[ARA CRON ERROR] " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error en ejecución del Cron', 'details' => $e->getMessage()]);
    }
}
