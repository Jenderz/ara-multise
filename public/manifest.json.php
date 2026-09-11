<?php
/**
 * ARA E-COMMERCE MULTISEDE - MANIFEST DINÁMICO PWA
 * Genera el Web App Manifest en tiempo real utilizando el nombre comercial
 * y la configuración visual guardada en la base de datos (settings).
 */

header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');

// 1. Cargar configuración de base de datos
$configLoaded = false;
if (file_exists(__DIR__ . '/lib/config.php')) {
    require_once __DIR__ . '/lib/config.php';
    $configLoaded = true;
} elseif (file_exists(__DIR__ . '/lib/config.example.php')) {
    require_once __DIR__ . '/lib/config.example.php';
    $configLoaded = true;
}

$settings = [];
if ($configLoaded && function_exists('getDBConnection')) {
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->query("SELECT `setting_key`, `setting_value` FROM `settings` WHERE `setting_key` IN ('storeName', 'seoTitle', 'seoDescription', 'appIconUrl', 'logoUrl', 'primaryColor', 'theme_color')");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    } catch (\Throwable $e) {
        // En caso de error de BD, continuar con valores por defecto seguros
    }
}

// 2. Resolver valores dinámicos
$storeName = trim($settings['storeName'] ?? '');
$seoTitle  = trim($settings['seoTitle'] ?? '');
$seoDesc   = trim($settings['seoDescription'] ?? '');
$appIcon   = trim($settings['appIconUrl'] ?? '');
$logo      = trim($settings['logoUrl'] ?? '');
$themeCol  = trim($settings['primaryColor'] ?? ($settings['theme_color'] ?? '#007AFF'));

// Nombre completo de la App (se muestra en el diálogo de instalación)
$appName = !empty($storeName) ? $storeName : (!empty($seoTitle) ? $seoTitle : 'Tienda Virtual');

// Nombre corto (para el icono en la pantalla de inicio del móvil)
if (!empty($storeName)) {
    $shortName = mb_strlen($storeName) > 12 ? mb_substr($storeName, 0, 12) : $storeName;
} elseif (!empty($seoTitle)) {
    $shortName = mb_strlen($seoTitle) > 12 ? mb_substr($seoTitle, 0, 12) : $seoTitle;
} else {
    $shortName = 'Tienda';
}

$description = !empty($seoDesc) 
    ? $seoDesc 
    : "Tienda oficial de {$appName}. Realiza tus compras y pedidos con la mejor experiencia online.";

// Icono dinámico de la aplicación
$iconUrl = !empty($appIcon) ? $appIcon : (!empty($logo) ? $logo : 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png');

$manifest = [
    'id' => '/?source=pwa',
    'name' => $appName,
    'short_name' => $shortName,
    'start_url' => '/',
    'scope' => '/',
    'display' => 'standalone',
    'display_override' => ['window-controls-overlay', 'standalone', 'minimal-ui'],
    'background_color' => '#F2F2F7',
    'theme_color' => $themeCol,
    'orientation' => 'portrait-primary',
    'launch_handler' => [
        'client_mode' => 'focus-existing'
    ],
    'handle_links' => 'preferred',
    'categories' => ['shopping', 'lifestyle', 'productivity'],
    'description' => $description,
    'icons' => [
        [
            'src' => $iconUrl,
            'sizes' => '192x192',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ],
        [
            'src' => $iconUrl,
            'sizes' => '512x512',
            'type' => 'image/png',
            'purpose' => 'any maskable'
        ]
    ],
    'shortcuts' => [
        [
            'name' => 'Ver Carrito',
            'short_name' => 'Carrito',
            'description' => 'Revisar mi bolsa de compras',
            'url' => '/?action=cart',
            'icons' => [
                [
                    'src' => 'https://cdn-icons-png.flaticon.com/512/1170/1170678.png',
                    'sizes' => '192x192'
                ]
            ]
        ],
        [
            'name' => 'Explorar',
            'short_name' => 'Tienda',
            'description' => 'Buscar productos',
            'url' => '/#/shop',
            'icons' => [
                [
                    'src' => 'https://cdn-icons-png.flaticon.com/512/2832/2832495.png',
                    'sizes' => '192x192'
                ]
            ]
        ]
    ],
    'screenshots' => [
        [
            'src' => '/screenshots/desktop.jpg',
            'sizes' => '1920x1080',
            'type' => 'image/jpeg',
            'form_factor' => 'wide',
            'label' => 'Escritorio: Gestión completa'
        ],
        [
            'src' => '/screenshots/mobile.jpg',
            'sizes' => '1080x1920',
            'type' => 'image/jpeg',
            'form_factor' => 'narrow',
            'label' => 'Móvil: Compra rápida'
        ]
    ]
];

echo json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
