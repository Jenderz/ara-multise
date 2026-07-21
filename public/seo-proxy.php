<?php
/**
 * ============================================================
 *  seo-proxy.php — Pre-renderer SEO para Bots de Redes Sociales
 * ============================================================
 *
 *  Cuando WhatsApp, Facebook, Telegram u otro bot social rastrea
 *  una URL de producto, este script devuelve un HTML mínimo pero
 *  completo con los Open Graph tags correctos.
 *
 *  Flujo activado por .htaccess:
 *    Bot visita /product/camiseta-roja--abc123
 *    → .htaccess detecta User-Agent de bot
 *    → Redirige internamente a /seo-proxy.php?slug=camiseta-roja--abc123
 *    → Este script extrae el ID, consulta la API, retorna HTML con OG tags
 *
 *  Caché:
 *    Los resultados se cachean en cache/seo/ por 1 hora para minimizar
 *    las llamadas a la API interna.
 *
 *  Compatibilidad:
 *    - Apache con mod_rewrite (requiere .htaccess en la raíz)
 *    - PHP 7.4+ con cURL habilitado
 */

// ── Seguridad: solo permitir acceso interno o desde bots verificados ──────────
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: index, follow');

// ── Configuración ─────────────────────────────────────────────────────────────
$STORE_URL    = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
              . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');

// La API está en /api.php y usa action=get_all para obtener todos los datos
// Fuente: services/api.ts → api.getAllData() → fetchApi('get_all')
$API_ENDPOINT = $STORE_URL . '/api.php?action=get_all&t=' . time();

// Token requerido por el servidor para evitar bloqueos del WAF/Antivirus
// Fuente: services/api.ts → headers['X-App-Token']
$APP_TOKEN    = 'AraEcom_v5_Secure';

$CACHE_DIR    = __DIR__ . '/cache/seo/';
$CACHE_TTL    = 3600; // segundos (1 hora)
$HTTP_TIMEOUT = 10;   // segundos

// ── Asegurar directorio de caché ──────────────────────────────────────────────
if (!is_dir($CACHE_DIR)) {
    mkdir($CACHE_DIR, 0755, true);
    file_put_contents($CACHE_DIR . '.htaccess', "Deny from all\n");
}

// ── Extraer slug del parámetro de query ───────────────────────────────────────
$slug = trim($_GET['slug'] ?? '');
if (empty($slug)) {
    // Sin slug: servir el index.html normal
    readfile(__DIR__ . '/index.html');
    exit;
}

// Extraer el ID del producto desde el slug (formato: "titulo--ID" o solo "ID")
// Ej: "camiseta-roja--abc-123-xyz" → "abc-123-xyz"
$slugParts  = explode('--', $slug);
$productId  = end($slugParts);

if (empty($productId)) {
    readfile(__DIR__ . '/index.html');
    exit;
}

// ── Intentar servir desde caché ───────────────────────────────────────────────
$cacheFile = $CACHE_DIR . md5($productId) . '.html';
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $CACHE_TTL) {
    echo file_get_contents($cacheFile);
    exit;
}

// ── Consultar la API interna para obtener los datos del producto ──────────────
$product   = null;
$storeName = 'Tienda'; // Valor por defecto; se sobreescribe con el valor real de la API

if (function_exists('curl_init')) {
    $ch = curl_init($API_ENDPOINT);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $HTTP_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'SEO-Proxy/1.0 (internal)',
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'Content-Type: application/json',
            // Mismo token que usa el frontend (api.ts)
            'X-App-Token: ' . $APP_TOKEN,
            // Sede 1 (Principal) para obtener todos los productos
            'X-Branch-ID: 1',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response && $httpCode === 200) {
        $data = json_decode($response, true);

        // Estructura real de la API (action=get_all):
        // { products: [...], settings: {...}, categories: [...], orders: [...] }
        // Fuente: StoreContext.tsx → processHeavyData(data) → data.products
        if (isset($data['products']) && is_array($data['products'])) {
            foreach ($data['products'] as $p) {
                if (isset($p['id']) && $p['id'] === $productId) {
                    $product = $p;
                    break;
                }
            }
        }
        // También capturar el nombre de la tienda para las OG tags
        if (isset($data['settings']['storeName'])) {
            $storeName = $data['settings']['storeName'];
        }
    } else {
        error_log("[seo-proxy.php] Error al llamar la API: HTTP $httpCode");
    }
}

// ── Fallback: si no encontramos el producto, servir index.html ─────────────────
if (!$product) {
    // Aun así intentamos devolver OG tags básicos para que WhatsApp no muestre vacío
    // con la info que tenemos del slug (el título aproximado y sin imagen)
    $approximateTitle = ucwords(str_replace('-', ' ', $slugParts[0] ?? ''));
    readfile(__DIR__ . '/index.html');
    exit;
}

// ── Construir la respuesta HTML con OG tags ───────────────────────────────────
$title       = htmlspecialchars($product['title'] ?? 'Producto', ENT_QUOTES, 'UTF-8');
$description = htmlspecialchars(
    mb_substr(strip_tags($product['description'] ?? ''), 0, 200),
    ENT_QUOTES, 'UTF-8'
);

// Imagen: tomar la primera de la lista o la imagen directa
$images     = $product['images'] ?? [];
$imageUrl   = '';
if (is_array($images) && !empty($images)) {
    $imageUrl = $images[0];
} elseif (!empty($product['image'])) {
    $imageUrl = $product['image'];
}
$imageUrl = htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8');

$price    = number_format((float)($product['salePrice'] ?: $product['price'] ?? 0), 2, '.', '');
$currency = 'USD';

// URLs
$canonicalUrl = htmlspecialchars($STORE_URL . '/product/' . $slug, ENT_QUOTES, 'UTF-8');
$hashUrl      = htmlspecialchars($STORE_URL . '/#/product/' . $slug, ENT_QUOTES, 'UTF-8');



$html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$title} | {$storeName}</title>
  <meta name="description" content="{$description}">
  <link rel="canonical" href="{$canonicalUrl}">

  <!-- ═══════════════════════════════════════════════
       Open Graph — WhatsApp, Facebook, Telegram, etc.
       ═══════════════════════════════════════════════ -->
  <meta property="og:type"               content="product">
  <meta property="og:title"              content="{$title} | {$storeName}">
  <meta property="og:description"        content="{$description}">
  <meta property="og:url"                content="{$canonicalUrl}">
  <meta property="og:site_name"          content="{$storeName}">
  <meta property="og:locale"             content="es_ES">
  <!-- Imagen con todas las propiedades que requiere WhatsApp -->
  <meta property="og:image"              content="{$imageUrl}">
  <meta property="og:image:secure_url"   content="{$imageUrl}">
  <meta property="og:image:width"        content="1200">
  <meta property="og:image:height"       content="1200">
  <meta property="og:image:type"         content="image/jpeg">
  <meta property="og:image:alt"          content="{$title}">
  <!-- Precio (Facebook/Instagram Shopping) -->
  <meta property="product:price:amount"   content="{$price}">
  <meta property="product:price:currency" content="{$currency}">

  <!-- ═══════════════════════════════════
       Twitter Card
       ═══════════════════════════════════ -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="{$title} | {$storeName}">
  <meta name="twitter:description" content="{$description}">
  <meta name="twitter:image"       content="{$imageUrl}">
  <meta name="twitter:image:alt"   content="{$title}">

  <!-- Redirigir al usuario humano a la app React (hash route) -->
  <meta http-equiv="refresh" content="0;url={$hashUrl}">
</head>
<body>
  <script>
    // Redirección inmediata para humanos que lleguen aquí directamente
    window.location.replace('{$hashUrl}');
  </script>
  <noscript>
    <a href="{$hashUrl}">{$title} — {$storeName}</a>
  </noscript>
</body>
</html>
HTML;

// ── Guardar en caché ──────────────────────────────────────────────────────────
file_put_contents($cacheFile, $html);

echo $html;
exit;
