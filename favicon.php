<?php
/**
 * ============================================================================
 * ARA E-COMMERCE MULTISEDE — FAVICON & APP ICON DINÁMICO (MARCA BLANCA)
 * ============================================================================
 * 
 * Resuelve y sirve dinámicamente el favicon oficial y los iconos de la aplicación
 * (/favicon.ico, /favicon.png, /apple-touch-icon.png) según la configuración
 * guardada en la base de datos (settings: appIconUrl o logoUrl) para cada tienda
 * o dominio (SaaS / Marca Blanca).
 * 
 * Beneficios SEO Senior:
 * 1. Cumple al 100% las directrices de Google Search Central para Favicons:
 *    - Servido desde el mismo dominio que la web.
 *    - URL canónica y estable (/favicon.ico y /favicon.png).
 *    - Tipo MIME correcto (image/x-icon, image/png).
 *    - Caché HTTP eficiente (ETag, Last-Modified, Cache-Control).
 * 2. Si el icono de la tienda es un archivo local en uploads/, lo sirve directamente.
 * 3. Si es una URL externa (CDN/S3), la descarga y cachea localmente para que
 *    Googlebot-Image nunca sufra bloqueos de hotlinking (403 Forbidden).
 * 4. Fallback visual garantizado (nunca devuelve 404 ni HTML a Googlebot).
 */

error_reporting(0);
ini_set('display_errors', 0);

$type = isset($_GET['type']) ? strtolower(trim($_GET['type'])) : 'favicon.ico';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$cleanHost = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $host);

$CACHE_DIR = __DIR__ . '/cache/favicons/';
if (!is_dir($CACHE_DIR)) {
    @mkdir($CACHE_DIR, 0755, true);
    @file_put_contents($CACHE_DIR . '.htaccess', "Deny from all\n");
}

// 1. Obtener appIconUrl y logoUrl de la base de datos (Búsqueda universal de config.php)
$appIconUrl = '';
$logoUrl    = '';

$configCandidates = [
    __DIR__ . '/lib/config.php',
    __DIR__ . '/public/lib/config.php',
    dirname(__DIR__) . '/lib/config.php',
    dirname(__DIR__) . '/public/lib/config.php'
];
foreach ($configCandidates as $candidate) {
    if (file_exists($candidate)) {
        require_once $candidate;
        break;
    }
}

if (function_exists('getDBConnection')) {
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->query("SELECT `setting_key`, `setting_value` FROM `settings` WHERE `setting_key` IN ('appIconUrl', 'logoUrl')");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($row['setting_key'] === 'appIconUrl') $appIconUrl = trim($row['setting_value'] ?? '');
            if ($row['setting_key'] === 'logoUrl')    $logoUrl    = trim($row['setting_value'] ?? '');
        }
    } catch (\Throwable $e) {}
}

// Fallback por API interna si no se pudo conectar directamente a BD
if (empty($appIconUrl) && empty($logoUrl) && function_exists('curl_init')) {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $apiUrl = "{$protocol}://{$host}/api.php?action=get_all&t=" . time();
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 3,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-App-Token: AraEcom_v5_Secure',
            'X-Branch-ID: 1',
        ],
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    if ($res) {
        $json = json_decode($res, true);
        if (!empty($json['settings']['appIconUrl'])) $appIconUrl = trim($json['settings']['appIconUrl']);
        if (!empty($json['settings']['logoUrl']))    $logoUrl    = trim($json['settings']['logoUrl']);
    }
}

// 2. Determinar la fuente del icono (Prioridad 1: Icono de App cuadrado 1:1, Prioridad 2: Logo)
$targetIcon = !empty($appIconUrl) ? $appIconUrl : (!empty($logoUrl) ? $logoUrl : '');

// Filtrar URLs placeholders genéricas de flaticon si el usuario aún no ha configurado nada
if (stripos($targetIcon, 'flaticon.com') !== false && !empty($logoUrl) && stripos($logoUrl, 'flaticon.com') === false) {
    $targetIcon = $logoUrl;
}

$localFileToServe = null;
$mimeType = ($type === 'favicon.ico') ? 'image/x-icon' : 'image/png';

if (!empty($targetIcon)) {
    // Extraer ruta limpia sin parámetros query (?t=...)
    $rawPath = parse_url($targetIcon, PHP_URL_PATH);
    $relPath = ltrim($rawPath ?? '', '/');
    $fileName = basename($relPath);

    // Lista de posibles rutas físicas en disco
    $possibleDiskPaths = [
        __DIR__ . '/' . $relPath,
        __DIR__ . '/uploads/' . $fileName,
        __DIR__ . '/public/uploads/' . $fileName,
        dirname(__DIR__) . '/' . $relPath,
        dirname(__DIR__) . '/public/' . $relPath,
        dirname(__DIR__) . '/public/uploads/' . $fileName,
        dirname(__DIR__) . '/uploads/' . $fileName
    ];

    foreach ($possibleDiskPaths as $tryPath) {
        if (!empty($fileName) && file_exists($tryPath) && is_file($tryPath) && filesize($tryPath) > 50) {
            $localFileToServe = $tryPath;
            break;
        }
    }

    // Si no está en disco local y es una URL completa (http/https): Descargar y cachear
    if (!$localFileToServe && (strpos($targetIcon, 'http://') === 0 || strpos($targetIcon, 'https://') === 0 || strpos($targetIcon, '//') === 0)) {
        $cacheHash = md5($targetIcon);
        $cachedFile = $CACHE_DIR . "fav_{$cleanHost}_{$cacheHash}.png";
        $cacheTTL = 604800; // 7 días de persistencia

        if (file_exists($cachedFile) && (time() - filemtime($cachedFile)) < $cacheTTL && filesize($cachedFile) > 0) {
            $localFileToServe = $cachedFile;
        } elseif (function_exists('curl_init')) {
            $ch = curl_init($targetIcon);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ]);
            $imgData = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && !empty($imgData) && strlen($imgData) > 50) {
                @file_put_contents($cachedFile, $imgData);
                $localFileToServe = $cachedFile;
            }
        }
    }
}

// 3. Fallback a icon.png si no se encontró el icono personalizado
if (!$localFileToServe || !file_exists($localFileToServe)) {
    $fallbackIcons = [
        __DIR__ . '/icon.png',
        __DIR__ . '/public/icon.png',
        dirname(__DIR__) . '/icon.png',
        dirname(__DIR__) . '/public/icon.png'
    ];
    foreach ($fallbackIcons as $fb) {
        if (file_exists($fb) && is_file($fb) && filesize($fb) > 50) {
            $localFileToServe = $fb;
            break;
        }
    }
}

// 4. Si encontramos un archivo válido en disco, detectamos su MIME real y lo servimos
if ($localFileToServe && file_exists($localFileToServe)) {
    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : null;
    if ($finfo) {
        $detectedMime = finfo_file($finfo, $localFileToServe);
        finfo_close($finfo);
        if ($detectedMime) {
            $mimeType = $detectedMime;
        }
    }

    if ($type === 'favicon.ico' && $mimeType !== 'image/x-icon') {
        $mimeType = 'image/png';
    }

    $lastModified = filemtime($localFileToServe);
    $etag = '"' . md5($localFileToServe . $lastModified . filesize($localFileToServe)) . '"';

    if (
        (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) ||
        (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && @strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) >= $lastModified)
    ) {
        header('HTTP/1.1 304 Not Modified');
        exit;
    }

    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($localFileToServe));
    header('Cache-Control: public, max-age=604800, stale-while-revalidate=86400');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastModified) . ' GMT');
    header('ETag: ' . $etag);
    header('Access-Control-Allow-Origin: *');
    header('X-Content-Type-Options: nosniff');
    readfile($localFileToServe);
    exit;
}

// 5. Fallback SVG dinámico con la inicial del dominio (Garantiza 200 OK en cualquier escenario)
$initial = !empty($host) ? strtoupper(substr(preg_replace('/^www\./i', '', $host), 0, 1)) : 'A';
$svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#007AFF"/>
      <stop offset="100%" stop-color="#0051A8"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#bg)"/>
  <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="96" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">{$initial}</text>
</svg>
SVG;

header('Content-Type: image/svg+xml');
header('Cache-Control: public, max-age=86400');
header('Access-Control-Allow-Origin: *');
echo $svg;
exit;
