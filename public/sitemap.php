<?php
/**
 * ============================================================================
 * ARA E-COMMERCE MULTISEDE — SITEMAP XML DINÁMICO (MARCA BLANCA)
 * ============================================================================
 * 
 * Genera un sitemap XML dinámico y compatible con Google Search Console, Bing
 * y buscadores internacionales.
 * 
 * Cumple con el estándar Sitemaps 0.9 y la extensión Google Image Sitemap:
 * - Página de Inicio (Prioridad 1.0, diaria)
 * - Catálogo / Tienda (Prioridad 0.8, diaria)
 * - Todos los productos activos (/product/slug--id) con sus fotos para Google Images
 * - Timestamps precisos de última modificación (<lastmod>)
 * - Caché inteligente de 2 horas en cache/sitemaps/ para alto rendimiento
 */

error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex, follow'); // Evita indexar el XML como contenido pero permite seguir los enlaces

$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$cleanHost = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $host);
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$STORE_URL = "{$protocol}://{$host}";

$CACHE_DIR = __DIR__ . '/cache/sitemaps/';
if (!is_dir($CACHE_DIR)) {
    @mkdir($CACHE_DIR, 0755, true);
    @file_put_contents($CACHE_DIR . '.htaccess', "Deny from all\n");
}

$cacheFile = $CACHE_DIR . "sitemap_{$cleanHost}.xml";
$cacheTTL = 7200; // 2 horas

$forceRefresh = isset($_GET['refresh']) || isset($_GET['clear_cache']);
if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTTL) {
    readfile($cacheFile);
    exit;
}

// Funciones para generación de slug idéntico a frontend
function sitemap_slugify($text) {
    $text = mb_strtolower($text, 'UTF-8');
    if (function_exists('iconv')) {
        $translit = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($translit !== false) {
            $text = $translit;
        }
    }
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/\s+/', '-', trim($text));
    $text = preg_replace('/-+/', '-', $text);
    return substr($text, 0, 60);
}

function sitemap_generateSlug($title, $id) {
    $s = sitemap_slugify($title);
    return (!empty($s) ? $s : 'producto') . '--' . $id;
}

// 1. Obtener productos de la base de datos o API
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
            $stmt = $pdo->query("SELECT `id`, `title`, `images`, `image`, `price`, `created_at` FROM `products` WHERE (`is_visible` = 1 OR `is_visible` IS NULL) ORDER BY `id` DESC LIMIT 10000");
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {}
    }

// Fallback por API interna si no se pudo conectar directamente a BD
if (empty($products) && function_exists('curl_init')) {
    $apiUrl = "{$STORE_URL}/api.php?action=get_all&t=" . time();
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
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
        if (!empty($json['products']) && is_array($json['products'])) {
            $products = $json['products'];
        }
    }
}

$nowIso = date('Y-m-d');

// Construir XML
$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
$xml .= '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

// Página Principal
$xml .= "  <url>\n";
$xml .= "    <loc>" . htmlspecialchars($STORE_URL . '/', ENT_XML1, 'UTF-8') . "</loc>\n";
$xml .= "    <lastmod>{$nowIso}</lastmod>\n";
$xml .= "    <changefreq>daily</changefreq>\n";
$xml .= "    <priority>1.0</priority>\n";
$xml .= "  </url>\n";

// Catálogo / Tienda (URL canónica limpia según estándar Sitemaps.org sin hash)
$xml .= "  <url>\n";
$xml .= "    <loc>" . htmlspecialchars($STORE_URL . '/shop', ENT_XML1, 'UTF-8') . "</loc>\n";
$xml .= "    <lastmod>{$nowIso}</lastmod>\n";
$xml .= "    <changefreq>daily</changefreq>\n";
$xml .= "    <priority>0.8</priority>\n";
$xml .= "  </url>\n";

// Sobre Nosotros
$xml .= "  <url>\n";
$xml .= "    <loc>" . htmlspecialchars($STORE_URL . '/about', ENT_XML1, 'UTF-8') . "</loc>\n";
$xml .= "    <lastmod>{$nowIso}</lastmod>\n";
$xml .= "    <changefreq>monthly</changefreq>\n";
$xml .= "    <priority>0.5</priority>\n";
$xml .= "  </url>\n";

// Productos
foreach ($products as $p) {
    $id = trim($p['id'] ?? '');
    if (empty($id)) continue;

    $title = trim($p['title'] ?? 'Producto');
    $slug = sitemap_generateSlug($title, $id);
    $prodUrl = $STORE_URL . '/product/' . $slug;

    $rawDate = $p['updated_at'] ?? ($p['created_at'] ?? null);
    $updated = $nowIso;
    if (!empty($rawDate)) {
        if (is_numeric($rawDate)) {
            $ts = ($rawDate > 9999999999) ? (int)($rawDate / 1000) : (int)$rawDate;
            $updated = date('Y-m-d', $ts);
        } elseif (preg_match('/^\d{4}-\d{2}-\d{2}/', $rawDate, $m)) {
            $updated = $m[0];
        }
    }

    // Obtener imágenes del producto
    $imgs = [];
    if (!empty($p['images'])) {
        $decoded = is_string($p['images']) ? json_decode($p['images'], true) : $p['images'];
        if (is_array($decoded)) {
            $imgs = $decoded;
        }
    }
    if (empty($imgs) && !empty($p['image'])) {
        $imgs[] = $p['image'];
    }

    $xml .= "  <url>\n";
    $xml .= "    <loc>" . htmlspecialchars($prodUrl, ENT_XML1, 'UTF-8') . "</loc>\n";
    $xml .= "    <lastmod>{$updated}</lastmod>\n";
    $xml .= "    <changefreq>weekly</changefreq>\n";
    $xml .= "    <priority>0.9</priority>\n";

    // Incorporar imágenes en Google Images Sitemap
    $imgCount = 0;
    foreach ($imgs as $img) {
        if ($imgCount >= 5) break; // Máximo 5 imágenes por URL según estándar
        $img = trim($img);
        if (empty($img)) continue;

        if (strpos($img, 'http://') !== 0 && strpos($img, 'https://') !== 0 && strpos($img, '//') !== 0) {
            $img = rtrim($STORE_URL, '/') . '/' . ltrim($img, '/');
        }

        $xml .= "    <image:image>\n";
        $xml .= "      <image:loc>" . htmlspecialchars($img, ENT_XML1, 'UTF-8') . "</image:loc>\n";
        $xml .= "      <image:title>" . htmlspecialchars($title, ENT_XML1, 'UTF-8') . "</image:title>\n";
        $xml .= "    </image:image>\n";
        $imgCount++;
    }

    $xml .= "  </url>\n";
}

$xml .= '</urlset>';

@file_put_contents($cacheFile, $xml);
echo $xml;
exit;
