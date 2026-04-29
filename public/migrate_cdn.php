<?php
/**
 * Herramienta de Migración al CDN
 * Ejecuta esto una vez para mover tus imágenes locales al servidor remoto.
 */
require_once 'lib/config.php';

// Aumentar límites para la migración
ini_set('memory_limit', '2048M');
ini_set('max_execution_time', '0');

echo "<h1>Iniciando Migración al CDN...</h1>";
echo "<p>Destino: " . CDN_URL . "</p>";

// 1. Identificar Tienda
$host = $_SERVER['HTTP_HOST'];
$storeFolder = preg_replace('/^www\./', '', $host);
$storeFolder = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $storeFolder);

echo "<p>Tienda ID: <strong>$storeFolder</strong></p>";

$pdo = getDBConnection();

// Función Helper para subir
function uploadToCDN($localPath, $storeFolder) {
    if (!file_exists($localPath)) return false;
    
    $cFile = new CURLFile(realpath($localPath), mime_content_type($localPath), basename($localPath));
    $postData = [
        'key' => CDN_API_KEY,
        'store_id' => $storeFolder,
        'image' => $cFile
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, CDN_URL);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $json = json_decode($response, true);
        return $json['url'] ?? false;
    }
    return false;
}

// --- MIGRAR PRODUCTOS ---
echo "<h3>Migrando Productos...</h3>";
$products = $pdo->query("SELECT id, title, images, variants FROM products")->fetchAll();
$updatedCount = 0;

foreach ($products as $p) {
    $images = json_decode($p['images'], true) ?: [];
    $variants = json_decode($p['variants'], true) ?: [];
    $changed = false;

    // Imágenes Principales
    foreach ($images as $k => $imgUrl) {
        if (strpos($imgUrl, 'http') === false || strpos($imgUrl, $_SERVER['HTTP_HOST']) !== false) {
            // Es local
            $relativePath = str_replace(["http://" . $_SERVER['HTTP_HOST'] . "/", "https://" . $_SERVER['HTTP_HOST'] . "/"], "", $imgUrl);
            // Limpiar query params si existen
            $relativePath = explode('?', $relativePath)[0];
            
            // Intentar encontrar el archivo físico
            if (file_exists($relativePath)) {
                $newUrl = uploadToCDN($relativePath, $storeFolder);
                if ($newUrl) {
                    $images[$k] = $newUrl;
                    $changed = true;
                    echo "Subido: $relativePath -> $newUrl <br>";
                }
            }
        }
    }

    // Variantes
    foreach ($variants as $k => $v) {
        if (!empty($v['image'])) {
            $imgUrl = $v['image'];
            if (strpos($imgUrl, 'http') === false || strpos($imgUrl, $_SERVER['HTTP_HOST']) !== false) {
                $relativePath = str_replace(["http://" . $_SERVER['HTTP_HOST'] . "/", "https://" . $_SERVER['HTTP_HOST'] . "/"], "", $imgUrl);
                $relativePath = explode('?', $relativePath)[0];
                
                if (file_exists($relativePath)) {
                    $newUrl = uploadToCDN($relativePath, $storeFolder);
                    if ($newUrl) {
                        $variants[$k]['image'] = $newUrl;
                        $changed = true;
                        echo "Variante Subida: $relativePath -> $newUrl <br>";
                    }
                }
            }
        }
    }

    if ($changed) {
        $stmt = $pdo->prepare("UPDATE products SET images = ?, variants = ? WHERE id = ?");
        $stmt->execute([json_encode($images, JSON_UNESCAPED_SLASHES), json_encode($variants, JSON_UNESCAPED_SLASHES), $p['id']]);
        $updatedCount++;
    }
}
echo "<p><strong>Productos actualizados: $updatedCount</strong></p>";

// --- MIGRAR CATEGORÍAS ---
echo "<h3>Migrando Categorías...</h3>";
$cats = $pdo->query("SELECT id, image FROM categories")->fetchAll();
$catCount = 0;

foreach ($cats as $c) {
    $imgUrl = $c['image'];
    if (!empty($imgUrl) && (strpos($imgUrl, 'http') === false || strpos($imgUrl, $_SERVER['HTTP_HOST']) !== false)) {
        $relativePath = str_replace(["http://" . $_SERVER['HTTP_HOST'] . "/", "https://" . $_SERVER['HTTP_HOST'] . "/"], "", $imgUrl);
        $relativePath = explode('?', $relativePath)[0];
        if (file_exists($relativePath)) {
            $newUrl = uploadToCDN($relativePath, $storeFolder);
            if ($newUrl) {
                $pdo->prepare("UPDATE categories SET image = ? WHERE id = ?")->execute([$newUrl, $c['id']]);
                $catCount++;
                echo "Categoría Subida: $relativePath -> $newUrl <br>";
            }
        }
    }
}
echo "<p><strong>Categorías actualizadas: $catCount</strong></p>";

// --- MIGRAR SETTINGS (Logo, etc) ---
echo "<h3>Migrando Configuración...</h3>";
$settings = $pdo->query("SELECT * FROM settings WHERE setting_key IN ('logoUrl', 'appIconUrl', 'homeHeroImage', 'homeBannerImage', 'giftBannerImage')")->fetchAll();
foreach ($settings as $s) {
    $imgUrl = $s['setting_value'];
    if (!empty($imgUrl) && (strpos($imgUrl, 'http') === false || strpos($imgUrl, $_SERVER['HTTP_HOST']) !== false)) {
        $relativePath = str_replace(["http://" . $_SERVER['HTTP_HOST'] . "/", "https://" . $_SERVER['HTTP_HOST'] . "/"], "", $imgUrl);
        $relativePath = explode('?', $relativePath)[0];
        if (file_exists($relativePath)) {
            $newUrl = uploadToCDN($relativePath, $storeFolder);
            if ($newUrl) {
                $pdo->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?")->execute([$newUrl, $s['setting_key']]);
                echo "Setting {$s['setting_key']} actualizado.<br>";
            }
        }
    }
}

echo "<h2>¡Migración Completada!</h2>";
?>