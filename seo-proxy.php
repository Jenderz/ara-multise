<?php
/**
 * ============================================================================
 * ARA E-COMMERCE MULTISEDE — SEO & OPEN GRAPH PRE-RENDERER (MARCA BLANCA)
 * ============================================================================
 * 
 * Genera HTML estático pre-renderizado para motores de búsqueda (Googlebot,
 * Bingbot, Applebot) y bots de redes sociales (WhatsApp, Facebook, Twitter, etc.).
 * 
 * Mejoras de Nivel Senior:
 * 1. Cumplimiento estricto con Google Search Central para Favicons:
 *    - Inclusión canónica de <link rel="icon"> y <link rel="apple-touch-icon">
 *      apuntando al dominio de la tienda activa (/favicon.ico y /favicon.png).
 * 2. Marcado estructurado Schema.org (JSON-LD):
 *    - Home: WebSite con SearchAction (Sitelinks Searchbox) + OnlineStore / Organization
 *    - Producto: Product con Precios, Moneda, Disponibilidad, Vendedor, Fotos y BreadcrumbList
 * 3. Eliminación de loops de redirección: Se eliminó el meta-refresh a la misma URL en la raíz
 *    para que Googlebot no descarte la página como redirección fallida o soft-404.
 * 4. Caché de alto rendimiento segmentada por dominio para soporte nativo Marca Blanca.
 */

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: index, follow');

$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$cleanHost = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $host);
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$STORE_URL = "{$protocol}://{$host}";

$API_ENDPOINT = "{$STORE_URL}/api.php?action=get_all&t=" . time();
$APP_TOKEN    = 'AraEcom_v5_Secure';

$CACHE_DIR    = __DIR__ . '/cache/seo/';
$CACHE_TTL    = 3600; // 1 hora
$HTTP_TIMEOUT = 5;

if (!is_dir($CACHE_DIR)) {
    @mkdir($CACHE_DIR, 0755, true);
    @file_put_contents($CACHE_DIR . '.htaccess', "Deny from all\n");
}

$slug = trim($_GET['slug'] ?? '');
$mode = trim($_GET['mode'] ?? '');

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (empty($slug)) {
    if (empty($mode) || $mode === 'store') {
        if (strpos($requestPath, '/shop') === 0) {
            $mode = 'shop';
        } elseif (strpos($requestPath, '/about') === 0) {
            $mode = 'about';
        } else {
            $mode = 'store';
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MODO 1: PÁGINA PRINCIPAL / TIENDA / CATÁLOGO / ABOUT (sin slug de producto)
// ════════════════════════════════════════════════════════════════════════════
if (empty($slug) || in_array($mode, ['store', 'shop', 'about'])) {
    $forceRefresh = isset($_GET['clear_cache']) || isset($_GET['t']);
    $cacheKey = $mode . '_' . md5($host);
    $cacheFile = $CACHE_DIR . $cacheKey . '.html';
    if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $CACHE_TTL) {
        echo file_get_contents($cacheFile);
        exit;
    }

    $storeName      = '';
    $seoTitle       = '';
    $seoDesc        = '';
    $appIconUrl     = '';
    $logoUrl        = '';
    $whatsappNumber = '';
    $contactEmail   = '';
    $contactAddress = '';

    // 1. Consultar base de datos directamente
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
                $stmt = $pdo->query("SELECT `setting_key`, `setting_value` FROM `settings` WHERE `setting_key` IN ('storeName', 'seoTitle', 'seoDescription', 'appIconUrl', 'logoUrl', 'whatsappNumber', 'contactEmail', 'contactAddress')");
                $sMap = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $sMap[$row['setting_key']] = $row['setting_value'];
                }
                if (!empty($sMap['storeName']))      $storeName      = trim($sMap['storeName']);
                if (!empty($sMap['seoTitle']))       $seoTitle       = trim($sMap['seoTitle']);
                if (!empty($sMap['seoDescription'])) $seoDesc        = trim($sMap['seoDescription']);
                if (!empty($sMap['appIconUrl']))     $appIconUrl     = trim($sMap['appIconUrl']);
                if (!empty($sMap['logoUrl']))        $logoUrl        = trim($sMap['logoUrl']);
                if (!empty($sMap['whatsappNumber'])) $whatsappNumber = trim($sMap['whatsappNumber']);
                if (!empty($sMap['contactEmail']))   $contactEmail   = trim($sMap['contactEmail']);
                if (!empty($sMap['contactAddress'])) $contactAddress = trim($sMap['contactAddress']);
            } catch (\Throwable $e) {}
        }

    // 2. Fallback por API interna
    if ((empty($storeName) || $storeName === 'Tienda') && function_exists('curl_init')) {
        $ch = curl_init($API_ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $HTTP_TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-App-Token: ' . $APP_TOKEN,
                'X-Branch-ID: 1',
            ],
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        if ($res) {
            $apiData = json_decode($res, true);
            $st = $apiData['settings'] ?? [];
            if (!empty($st['storeName']))      $storeName      = trim($st['storeName']);
            if (!empty($st['seoTitle']))       $seoTitle       = trim($st['seoTitle']);
            if (!empty($st['seoDescription'])) $seoDesc        = trim($st['seoDescription']);
            if (!empty($st['appIconUrl']))     $appIconUrl     = trim($st['appIconUrl']);
            if (!empty($st['logoUrl']))        $logoUrl        = trim($st['logoUrl']);
            if (!empty($st['whatsappNumber'])) $whatsappNumber = trim($st['whatsappNumber']);
            if (!empty($st['contactEmail']))   $contactEmail   = trim($st['contactEmail']);
            if (!empty($st['contactAddress'])) $contactAddress = trim($st['contactAddress']);
        }
    }

    // Fallback inteligente para el nombre comercial
    if (empty($storeName) || $storeName === 'Tienda' || $storeName === 'Mi Tienda Virtual') {
        $clean = preg_replace('/^www\./i', '', $host);
        $clean = preg_replace('/\..+$/', '', $clean);
        $storeName = !empty($clean) ? ucwords(str_replace(['-', '_'], ' ', $clean)) : 'Tienda Oficial';
    }

    // Título SEO
    $isGenericTitle = empty($seoTitle) 
        || stripos($seoTitle, 'Tienda Virtual | E-commerce Profesional') !== false 
        || stripos($seoTitle, 'Tienda Virtual') !== false;

    if ($isGenericTitle) {
        $finalTitle = "{$storeName} | Tienda Online Oficial";
    } else {
        $finalTitle = (stripos($seoTitle, $storeName) === false) ? "{$storeName} | {$seoTitle}" : $seoTitle;
    }

    // Descripción SEO
    $isGenericDesc = empty($seoDesc) 
        || stripos($seoDesc, 'Bienvenido a nuestra tienda online.') !== false 
        || stripos($seoDesc, 'Bienvenido a nuestra tienda online') !== false;

    if ($isGenericDesc) {
        $finalDesc = "Bienvenido a {$storeName}. Explora nuestro catálogo de productos, novedades y ofertas exclusivas.";
    } else {
        $finalDesc = (stripos($seoDesc, $storeName) === false) ? "{$storeName} — {$seoDesc}" : $seoDesc;
    }

    if ($mode === 'shop') {
        $finalTitle = "Catálogo de Productos | {$storeName}";
        $finalDesc = "Explora nuestro catálogo completo de productos en {$storeName}. Encuentra las mejores ofertas y novedades.";
        $pageCanonical = "{$STORE_URL}/shop";
    } elseif ($mode === 'about') {
        $finalTitle = "Sobre Nosotros | {$storeName}";
        $finalDesc = "Conoce más sobre {$storeName}, nuestra historia, valores y compromiso con nuestros clientes.";
        $pageCanonical = "{$STORE_URL}/about";
    } else {
        $pageCanonical = "{$STORE_URL}/";
    }

    // Imagen principal (Prioridad al icono cuadrado para WhatsApp/Google)
    $selectedImage = !empty($appIconUrl) ? $appIconUrl : (!empty($logoUrl) ? $logoUrl : "{$STORE_URL}/favicon.png");
    if (strpos($selectedImage, 'http://') !== 0 && strpos($selectedImage, 'https://') !== 0 && strpos($selectedImage, '//') !== 0) {
        $selectedImage = rtrim($STORE_URL, '/') . '/' . ltrim($selectedImage, '/');
    }

    $brandLogo = !empty($logoUrl) ? $logoUrl : $selectedImage;
    if (strpos($brandLogo, 'http://') !== 0 && strpos($brandLogo, 'https://') !== 0 && strpos($brandLogo, '//') !== 0) {
        $brandLogo = rtrim($STORE_URL, '/') . '/' . ltrim($brandLogo, '/');
    }

    $safeTitle = htmlspecialchars($finalTitle, ENT_QUOTES, 'UTF-8');
    $safeName  = htmlspecialchars($storeName, ENT_QUOTES, 'UTF-8');
    $safeDesc  = htmlspecialchars(mb_substr($finalDesc, 0, 220), ENT_QUOTES, 'UTF-8');
    $safeImage = htmlspecialchars($selectedImage, ENT_QUOTES, 'UTF-8');
    $safeLogo  = htmlspecialchars($brandLogo, ENT_QUOTES, 'UTF-8');

    // Schema.org JSON-LD para Google Search
    $schemaGraph = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'WebSite',
                '@id' => "{$STORE_URL}/#website",
                'url' => "{$STORE_URL}/",
                'name' => $storeName,
                'description' => $finalDesc,
                'inLanguage' => 'es',
                'potentialAction' => [
                    '@type' => 'SearchAction',
                    'target' => [
                        '@type' => 'EntryPoint',
                        'urlTemplate' => "{$STORE_URL}/shop?q={search_term_string}"
                    ],
                    'query-input' => 'required name=search_term_string'
                ]
            ],
            [
                '@type' => ['OnlineStore', 'Organization'],
                '@id' => "{$STORE_URL}/#organization",
                'name' => $storeName,
                'url' => "{$STORE_URL}/",
                'logo' => [
                    '@type' => 'ImageObject',
                    '@id' => "{$STORE_URL}/#logo",
                    'url' => $safeLogo,
                    'contentUrl' => $safeLogo,
                    'caption' => $storeName
                ],
                'image' => $safeImage,
                'description' => $finalDesc,
                'telephone' => !empty($whatsappNumber) ? $whatsappNumber : null,
                'email' => !empty($contactEmail) ? $contactEmail : null,
                'address' => !empty($contactAddress) ? [
                    '@type' => 'PostalAddress',
                    'streetAddress' => $contactAddress
                ] : null
            ]
        ]
    ];

    if ($mode === 'shop') {
        $schemaGraph['@graph'][] = [
            '@type' => 'CollectionPage',
            '@id' => "{$STORE_URL}/shop#webpage",
            'url' => "{$STORE_URL}/shop",
            'name' => $safeTitle,
            'description' => $safeDesc,
            'isPartOf' => ['@id' => "{$STORE_URL}/#website"]
        ];
    } elseif ($mode === 'about') {
        $schemaGraph['@graph'][] = [
            '@type' => 'AboutPage',
            '@id' => "{$STORE_URL}/about#webpage",
            'url' => "{$STORE_URL}/about",
            'name' => $safeTitle,
            'description' => $safeDesc,
            'isPartOf' => ['@id' => "{$STORE_URL}/#website"]
        ];
    }
    $jsonLd = json_encode($schemaGraph, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$safeTitle}</title>
  <meta name="description" content="{$safeDesc}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="{$pageCanonical}">

  <!-- ═══════════════════════════════════════════════════════════════
       FAVICON OFICIAL DINÁMICO (Directrices Google Search Central)
       ═══════════════════════════════════════════════════════════════ -->
  <link rel="icon" type="image/x-icon" href="{$STORE_URL}/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="{$STORE_URL}/favicon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="{$STORE_URL}/favicon.png">
  <link rel="shortcut icon" href="{$STORE_URL}/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="{$STORE_URL}/apple-touch-icon.png">
  <link rel="manifest" href="{$STORE_URL}/manifest.json">

  <!-- Open Graph — WhatsApp, Facebook, Telegram -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="{$safeTitle}">
  <meta property="og:description" content="{$safeDesc}">
  <meta property="og:url" content="{$pageCanonical}">
  <meta property="og:site_name" content="{$safeName}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:image" content="{$safeImage}">
  <meta property="og:image:secure_url" content="{$safeImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:image:alt" content="{$safeName}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{$safeTitle}">
  <meta name="twitter:description" content="{$safeDesc}">
  <meta name="twitter:image" content="{$safeImage}">

  <!-- Google Rich Snippets / Schema.org -->
  <script type="application/ld+json">
{$jsonLd}
  </script>
</head>
<body>
  <header>
    <h1>{$safeName}</h1>
    <p>{$safeDesc}</p>
  </header>
  <main>
    <a href="{$STORE_URL}/#/shop">Ir al Catálogo de Productos</a>
  </main>
  <script>
    // Si un usuario humano accede por error directo a este proxy, enviarlo a la SPA
    if (!/bot|crawler|spider|google|bing|yahoo|facebook|whatsapp|telegram|twitter|slack/i.test(navigator.userAgent)) {
      var dest = '{$STORE_URL}/';
      var m = '{$mode}';
      if (m === 'shop') dest = '{$STORE_URL}/#/shop';
      else if (m === 'about') dest = '{$STORE_URL}/#/about';
      window.location.replace(dest);
    }
  </script>
</body>
</html>
HTML;

    @file_put_contents($cacheFile, $html);
    echo $html;
    exit;
}

// ════════════════════════════════════════════════════════════════════════════
// MODO 2: DETALLE DE PRODUCTO (/product/slug--id)
// ════════════════════════════════════════════════════════════════════════════
$slugParts = explode('--', $slug);
$productId = end($slugParts);

if (empty($productId)) {
    if (file_exists(__DIR__ . '/index.html')) {
        readfile(__DIR__ . '/index.html');
    } else {
        header("Location: {$STORE_URL}/");
    }
    exit;
}

$cacheFile = $CACHE_DIR . 'prod_' . md5($host . '_' . $productId) . '.html';
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $CACHE_TTL) {
    echo file_get_contents($cacheFile);
    exit;
}

$product   = null;
$storeName = 'Tienda Oficial';

// 1. Intentar consultar BD directamente
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
            $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = :id LIMIT 1");
            $stmt->execute([':id' => $productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);

            $stmtSt = $pdo->query("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'storeName' LIMIT 1");
            $stRow = $stmtSt->fetch(PDO::FETCH_ASSOC);
            if (!empty($stRow['setting_value'])) {
                $storeName = trim($stRow['setting_value']);
            }
        } catch (\Throwable $e) {}
    }

// 2. Si no se halló en BD, consultar la API interna
if (!$product && function_exists('curl_init')) {
    $ch = curl_init($API_ENDPOINT);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $HTTP_TIMEOUT,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-App-Token: ' . $APP_TOKEN,
            'X-Branch-ID: 1',
        ],
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    if ($res) {
        $apiData = json_decode($res, true);
        if (!empty($apiData['products']) && is_array($apiData['products'])) {
            foreach ($apiData['products'] as $p) {
                if (isset($p['id']) && (string)$p['id'] === (string)$productId) {
                    $product = $p;
                    break;
                }
            }
        }
        if (!empty($apiData['settings']['storeName'])) {
            $storeName = trim($apiData['settings']['storeName']);
        }
    }
}

// Fallback si no encontramos el producto
if (!$product) {
    if (file_exists(__DIR__ . '/index.html')) {
        readfile(__DIR__ . '/index.html');
    } else {
        header("Location: {$STORE_URL}/");
    }
    exit;
}

$title = htmlspecialchars($product['title'] ?? 'Producto', ENT_QUOTES, 'UTF-8');
$description = htmlspecialchars(
    mb_substr(strip_tags($product['description'] ?? 'Producto disponible en nuestra tienda online.'), 0, 220),
    ENT_QUOTES, 'UTF-8'
);

// Extraer imagen
$images = [];
if (!empty($product['images'])) {
    $decoded = is_string($product['images']) ? json_decode($product['images'], true) : $product['images'];
    if (is_array($decoded)) $images = $decoded;
}
if (empty($images) && !empty($product['image'])) {
    $images[] = $product['image'];
}
$firstImage = !empty($images[0]) ? $images[0] : "{$STORE_URL}/favicon.png";
if (strpos($firstImage, 'http://') !== 0 && strpos($firstImage, 'https://') !== 0 && strpos($firstImage, '//') !== 0) {
    $firstImage = rtrim($STORE_URL, '/') . '/' . ltrim($firstImage, '/');
}
$imageUrl = htmlspecialchars($firstImage, ENT_QUOTES, 'UTF-8');

$rawPrice = !empty($product['salePrice']) && $product['salePrice'] > 0 ? $product['salePrice'] : ($product['price'] ?? 0);
$price = number_format((float)$rawPrice, 2, '.', '');
$currency = 'USD';

$canonicalUrl = htmlspecialchars("{$STORE_URL}/product/{$slug}", ENT_QUOTES, 'UTF-8');
$hashUrl      = htmlspecialchars("{$STORE_URL}/#/product/{$slug}", ENT_QUOTES, 'UTF-8');
$safeStore    = htmlspecialchars($storeName, ENT_QUOTES, 'UTF-8');

// Schema.org Product
$productSchema = [
    '@context' => 'https://schema.org/',
    '@type' => 'Product',
    'name' => $product['title'] ?? 'Producto',
    'image' => [$imageUrl],
    'description' => strip_tags($product['description'] ?? ''),
    'sku' => (string)($product['id'] ?? $productId),
    'brand' => [
        '@type' => 'Brand',
        'name' => $storeName
    ],
    'offers' => [
        '@type' => 'Offer',
        'url' => $canonicalUrl,
        'priceCurrency' => $currency,
        'price' => $price,
        'priceValidUntil' => date('Y-12-31'),
        'itemCondition' => 'https://schema.org/NewCondition',
        'availability' => 'https://schema.org/InStock',
        'seller' => [
            '@type' => 'Organization',
            'name' => $storeName
        ],
        'hasMerchantReturnPolicy' => [
            '@type' => 'MerchantReturnPolicy',
            'applicableCountry' => 'VE',
            'returnPolicyCategory' => 'https://schema.org/MerchantReturnFiniteReturnWindow',
            'merchantReturnDays' => 7,
            'returnMethod' => 'https://schema.org/ReturnInStore',
            'returnFees' => 'https://schema.org/FreeReturn'
        ]
    ]
];
$jsonLdProduct = json_encode($productSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$breadcrumbSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'BreadcrumbList',
    'itemListElement' => [
        [
            '@type' => 'ListItem',
            'position' => 1,
            'name' => 'Inicio',
            'item' => "{$STORE_URL}/"
        ],
        [
            '@type' => 'ListItem',
            'position' => 2,
            'name' => 'Catálogo',
            'item' => "{$STORE_URL}/shop"
        ],
        [
            '@type' => 'ListItem',
            'position' => 3,
            'name' => $product['title'] ?? 'Producto',
            'item' => $canonicalUrl
        ]
    ]
];
$jsonLdBreadcrumb = json_encode($breadcrumbSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$title} | {$safeStore}</title>
  <meta name="description" content="{$description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="{$canonicalUrl}">

  <!-- Favicons Dinámicos -->
  <link rel="icon" type="image/x-icon" href="{$STORE_URL}/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="{$STORE_URL}/favicon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="{$STORE_URL}/favicon.png">
  <link rel="shortcut icon" href="{$STORE_URL}/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="{$STORE_URL}/apple-touch-icon.png">
  <link rel="manifest" href="{$STORE_URL}/manifest.json">

  <!-- Open Graph -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="{$title} | {$safeStore}">
  <meta property="og:description" content="{$description}">
  <meta property="og:url" content="{$canonicalUrl}">
  <meta property="og:site_name" content="{$safeStore}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:image" content="{$imageUrl}">
  <meta property="og:image:secure_url" content="{$imageUrl}">
  <meta property="og:image:width" content="1000">
  <meta property="og:image:height" content="1000">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="{$title}">
  <meta property="product:price:amount" content="{$price}">
  <meta property="product:price:currency" content="{$currency}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{$title} | {$safeStore}">
  <meta name="twitter:description" content="{$description}">
  <meta name="twitter:image" content="{$imageUrl}">
  <meta name="twitter:image:alt" content="{$title}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
{$jsonLdProduct}
  </script>
  <script type="application/ld+json">
{$jsonLdBreadcrumb}
  </script>
</head>
<body>
  <article>
    <h1>{$title}</h1>
    <p><strong>Tienda:</strong> {$safeStore}</p>
    <p><strong>Precio:</strong> {$price} {$currency}</p>
    <p>{$description}</p>
    <img src="{$imageUrl}" alt="{$title}" style="max-width: 400px; height: auto;">
    <p><a href="{$hashUrl}">Ver producto completo en la tienda</a></p>
  </article>
  <script>
    // Redirigir a usuario humano sólo si no es un rastreador/bot con motor JS
    if (!/bot|crawler|spider|google|bing|yahoo|facebook|whatsapp|telegram|twitter|slack/i.test(navigator.userAgent)) {
      window.location.replace('{$hashUrl}');
    }
  </script>
</body>
</html>
HTML;

@file_put_contents($cacheFile, $html);
echo $html;
exit;
