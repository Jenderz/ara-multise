<?php
/**
 * ============================================================
 *  rates.php — Proxy de Tasas de Cambio con Caché de Servidor
 * ============================================================
 *
 *  Todos los clientes consumen ESTE endpoint en vez de llamar
 *  directamente a las APIs externas.
 *
 *  Estrategia:
 *    - Los datos se guardan en un archivo JSON local (cache/rates_cache.json).
 *    - Solo se hace una petición real a la API externa cuando el
 *      caché tiene más de $TTL_SECONDS segundos de antigüedad.
 *    - Así, 1000 usuarios conectados = 1 req/hora a dolar-vzla.rafnixg.dev,
 *      en lugar de 1000.
 *
 *  TTLs:
 *    BCV Oficial / Euro BCV : 4 horas  (publica 1 vez al día)
 *    Tasa Binance            : 1 hora   (P2P en tiempo real)
 *
 *  HTTP Client:
 *    Usa cURL como método principal (compatible con todos los hostings).
 *    Si cURL no está disponible, hace fallback a file_get_contents.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// ── Configuración ─────────────────────────────────────────────────────────────
define('CACHE_FILE', __DIR__ . '/cache/rates_cache.json');
define('TTL_BCV',     4 * 3600); // 4 horas en segundos
define('TTL_BINANCE', 1 * 3600); // 1 hora  en segundos
define('HTTP_TIMEOUT', 8);        // segundos máximos por petición

// ── Asegurar que existe el directorio de caché ────────────────────────────────
if (!is_dir(__DIR__ . '/cache')) {
    mkdir(__DIR__ . '/cache', 0755, true);
    // Bloquear acceso web directo a la carpeta
    file_put_contents(__DIR__ . '/cache/.htaccess', "Deny from all\n");
}

// ── Leer caché existente ──────────────────────────────────────────────────────
$cache = [];
if (file_exists(CACHE_FILE)) {
    $raw = file_get_contents(CACHE_FILE); // Lectura LOCAL, siempre segura
    if ($raw) $cache = json_decode($raw, true) ?? [];
}

$now = time();

// ── HTTP Client (cURL primero, file_get_contents como fallback) ───────────────
function fetchJson(string $url): ?array
{
    $data = null;

    // ── Intento 1: cURL (preferido en producción) ─────────────────────────────
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => HTTP_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_SSL_VERIFYPEER => true,           // Verificar certificado SSL
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT      => 'AraEcom-RatesProxy/2.0 (cURL)',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);

        $body     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($body && $httpCode === 200 && !$error) {
            $data = json_decode($body, true);
        } else {
            error_log("[rates.php] cURL error para $url — HTTP $httpCode: $error");
        }

    // ── Intento 2: file_get_contents (fallback si cURL no está disponible) ────
    } elseif (ini_get('allow_url_fopen')) {
        $ctx = stream_context_create([
            'http' => [
                'timeout'       => HTTP_TIMEOUT,
                'ignore_errors' => true,
                'header'        => "User-Agent: AraEcom-RatesProxy/2.0 (fopen)\r\nAccept: application/json\r\n",
            ],
            'ssl'  => ['verify_peer' => true],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body) $data = json_decode($body, true);

    } else {
        error_log("[rates.php] Sin método HTTP disponible (ni cURL ni allow_url_fopen).");
    }

    return is_array($data) ? $data : null;
}

// ── Helper: comprobar frescura del caché ──────────────────────────────────────
function isFresh(array $cache, string $key, int $ttl): bool
{
    return isset($cache[$key]['ts']) && (time() - $cache[$key]['ts']) < $ttl;
}

// ── Fetch condicional de cada tasa ────────────────────────────────────────────
$changed = false;

// 1. Dólar BCV Oficial
if (!isFresh($cache, 'bcv', TTL_BCV)) {
    $data = fetchJson('https://ve.dolarapi.com/v1/dolares/oficial');
    if ($data && isset($data['promedio'])) {
        $cache['bcv'] = ['value' => (float)$data['promedio'], 'ts' => $now];
        $changed = true;
    }
}

// 2. Tasa Binance (P2P realtime)
if (!isFresh($cache, 'binance', TTL_BINANCE)) {
    $data = fetchJson('https://dolar-vzla.rafnixg.dev/api/v1/binance/realtime_ves');
    if ($data && isset($data['average_price'])) {
        $cache['binance'] = [
            'value'  => (float)$data['average_price'],
            'median' => (float)($data['median_price'] ?? $data['average_price']),
            'ts'     => $now,
        ];
        $changed = true;
    }
}

// 3. Euro BCV
if (!isFresh($cache, 'euro', TTL_BCV)) {
    $data = fetchJson('https://ve.dolarapi.com/v1/euros/oficial');
    if ($data && isset($data['promedio'])) {
        $cache['euro'] = ['value' => (float)$data['promedio'], 'ts' => $now];
        $changed = true;
    }
}

// ── Persistir caché si hubo cambios ──────────────────────────────────────────
if ($changed) {
    file_put_contents(CACHE_FILE, json_encode($cache, JSON_PRETTY_PRINT));
}

// ── Respuesta al cliente ──────────────────────────────────────────────────────
// _cache incluye metadatos de depuración (antigüedad en minutos de cada tasa)
$response = [
    'bcv'     => $cache['bcv']['value']     ?? null,
    'binance' => $cache['binance']['value'] ?? null,
    'euro'    => $cache['euro']['value']    ?? null,
    '_cache'  => [
        'driver'          => function_exists('curl_init') ? 'curl' : 'fopen',
        'bcv_age_min'     => isset($cache['bcv']['ts'])     ? round(($now - $cache['bcv']['ts'])     / 60, 1) : null,
        'binance_age_min' => isset($cache['binance']['ts']) ? round(($now - $cache['binance']['ts']) / 60, 1) : null,
        'euro_age_min'    => isset($cache['euro']['ts'])    ? round(($now - $cache['euro']['ts'])    / 60, 1) : null,
    ],
];

echo json_encode($response);
