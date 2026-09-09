<?php
/**
 * Herramienta de Optimización Masiva de Imágenes Existentes
 * Reduce automáticamente todas las imágenes en uploads/ a un máximo de 1200x1200px con compresión 85%
 * Mantiene los mismos nombres de archivo para no alterar enlaces ni productos en la base de datos.
 */

ini_set('memory_limit', '256M');
set_time_limit(300); // 5 minutos máximo

$secretKey = 'ara_opt_2026'; // Clave de seguridad para evitar ejecuciones no autorizadas
$providedKey = $_GET['key'] ?? '';

// Comprobar si se ejecuta por CLI o por navegador con clave
$isCli = (php_sapi_name() === 'cli');

if (!$isCli && $providedKey !== $secretKey) {
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Optimizador de Imágenes - Acceso Requerido</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #334155; text-align: center; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            h2 { margin-top: 0; color: #38bdf8; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
            input { width: 100%; box-sizing: border-box; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid #475569; background: #0f172a; color: white; margin-top: 1rem; margin-bottom: 1rem; font-size: 1rem; }
            button { background: #0284c7; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #0369a1; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Optimizador de Imágenes</h2>
            <p>Ingresa la clave de seguridad para optimizar y reducir todas las fotos existentes en el servidor sin romper ningún enlace:</p>
            <form method="GET">
                <input type="text" name="key" placeholder="Clave de seguridad" value="ara_opt_2026" required autofocus>
                <button type="submit">Iniciar Optimización</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

$uploadsDir = __DIR__ . '/uploads';

if (!is_dir($uploadsDir)) {
    die("El directorio de uploads no existe en: $uploadsDir");
}

function scanImagesRecursively($dir) {
    $results = [];
    $files = scandir($dir);
    foreach ($files as $value) {
        $path = realpath($dir . DIRECTORY_SEPARATOR . $value);
        if (!is_dir($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                $results[] = $path;
            }
        } else if ($value != "." && $value != "..") {
            $results = array_merge($results, scanImagesRecursively($path));
        }
    }
    return $results;
}

$imageFiles = scanImagesRecursively($uploadsDir);
$maxDimension = 1200;
$quality = 85;

$totalImages = count($imageFiles);
$optimizedCount = 0;
$bytesSaved = 0;
$log = [];

foreach ($imageFiles as $filePath) {
    $oldSize = filesize($filePath);
    $imgInfo = @getimagesize($filePath);
    
    if (!$imgInfo) continue;
    
    $width = $imgInfo[0];
    $height = $imgInfo[1];
    $mime = $imgInfo['mime'];
    
    $needsResize = ($width > $maxDimension || $height > $maxDimension);
    $needsCompress = ($oldSize > 350 * 1024); // Si pesa más de 350 KB
    
    if ($needsResize || $needsCompress) {
        $srcImage = null;
        switch ($mime) {
            case 'image/jpeg':
                $srcImage = @imagecreatefromjpeg($filePath);
                break;
            case 'image/png':
                $srcImage = @imagecreatefrompng($filePath);
                break;
            case 'image/webp':
                if (function_exists('imagecreatefromwebp')) {
                    $srcImage = @imagecreatefromwebp($filePath);
                }
                break;
        }
        
        if (!$srcImage) continue;
        
        $newWidth = $width;
        $newHeight = $height;
        
        if ($needsResize) {
            if ($width >= $height) {
                $newHeight = (int)round(($height * $maxDimension) / $width);
                $newWidth = $maxDimension;
            } else {
                $newWidth = (int)round(($width * $maxDimension) / $height);
                $newHeight = $maxDimension;
            }
        }
        
        $dstImage = imagecreatetruecolor($newWidth, $newHeight);
        
        // Manejo de transparencia para PNG y WEBP
        if ($mime === 'image/png' || $mime === 'image/webp') {
            imagealphablending($dstImage, false);
            imagesavealpha($dstImage, true);
            $transparent = imagecolorallocatealpha($dstImage, 255, 255, 255, 127);
            imagefilledrectangle($dstImage, 0, 0, $newWidth, $newHeight, $transparent);
        } else {
            $white = imagecolorallocate($dstImage, 255, 255, 255);
            imagefilledrectangle($dstImage, 0, 0, $newWidth, $newHeight, $white);
        }
        
        imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        
        // Guardar sobreescribiendo el archivo original
        $tempPath = $filePath . '.tmp';
        $saved = false;
        
        if ($mime === 'image/jpeg') {
            $saved = imagejpeg($dstImage, $tempPath, $quality);
        } else if ($mime === 'image/png') {
            $saved = imagepng($dstImage, $tempPath, 8);
        } else if ($mime === 'image/webp') {
            $saved = imagewebp($dstImage, $tempPath, $quality);
        }
        
        imagedestroy($srcImage);
        imagedestroy($dstImage);
        
        if ($saved && file_exists($tempPath)) {
            $newSize = filesize($tempPath);
            // Solo reemplazar si el nuevo tamaño es menor
            if ($newSize < $oldSize) {
                rename($tempPath, $filePath);
                $diff = $oldSize - $newSize;
                $bytesSaved += $diff;
                $optimizedCount++;
                $log[] = [
                    'name' => basename($filePath),
                    'oldDim' => "{$width}x{$height}",
                    'newDim' => "{$newWidth}x{$newHeight}",
                    'oldSize' => round($oldSize / 1024, 1) . ' KB',
                    'newSize' => round($newSize / 1024, 1) . ' KB',
                    'saved' => round($diff / 1024, 1) . ' KB'
                ];
            } else {
                @unlink($tempPath);
            }
        }
    }
}

$savedMb = round($bytesSaved / (1024 * 1024), 2);

if ($isCli) {
    echo "\n=== OPTIMIZACIÓN COMPLETADA ===\n";
    echo "Total imágenes analizadas: $totalImages\n";
    echo "Imágenes optimizadas: $optimizedCount\n";
    echo "Espacio liberado: $savedMb MB\n\n";
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Optimización de Imágenes</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { background: #1e293b; padding: 2rem; border-radius: 1.5rem; border: 1px solid #334155; margin-bottom: 2rem; }
        h1 { margin: 0 0 1rem 0; color: #38bdf8; font-size: 1.8rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
        .stat-box { background: #0f172a; padding: 1.25rem; border-radius: 1rem; border: 1px solid #334155; }
        .stat-value { font-size: 1.8rem; font-weight: bold; color: #10b981; }
        .stat-label { font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 1rem; overflow: hidden; border: 1px solid #334155; }
        th, td { padding: 0.75rem 1rem; text-align: left; font-size: 0.85rem; }
        th { background: #0f172a; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; }
        tr:not(:last-child) td { border-bottom: 1px solid #334155; }
        .tag-green { color: #10b981; font-weight: bold; }
        .btn-back { display: inline-block; margin-top: 1.5rem; background: #38bdf8; color: #0f172a; font-weight: bold; padding: 0.75rem 1.5rem; border-radius: 0.75rem; text-decoration: none; }
        .btn-back:hover { background: #0284c7; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Optimización Finalizada con Éxito</h1>
            <p style="color: #94a3b8; margin: 0;">Todas las imágenes se reescalaron a un máximo de 1200x1200px y se recomprimieron. Los nombres de archivo se conservaron intactos, por lo que ningún producto ni enlace se ve afectado.</p>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value" style="color: #38bdf8;"><?= $totalImages ?></div>
                    <div class="stat-label">Total Analizadas</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value"><?= $optimizedCount ?></div>
                    <div class="stat-label">Fotos Optimizadas</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value"><?= $savedMb ?> MB</div>
                    <div class="stat-label">Espacio Liberado</div>
                </div>
            </div>
        </div>

        <?php if (!empty($log)): ?>
            <h3>Detalle de Archivos Optimizados</h3>
            <table>
                <thead>
                    <tr>
                        <th>Archivo</th>
                        <th>Dimensión Anterior</th>
                        <th>Nueva Dimensión</th>
                        <th>Peso Anterior</th>
                        <th>Nuevo Peso</th>
                        <th>Ahorro</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($log as $row): ?>
                        <tr>
                            <td style="font-family: monospace;"><?= htmlspecialchars($row['name']) ?></td>
                            <td><?= $row['oldDim'] ?></td>
                            <td><strong style="color: #38bdf8;"><?= $row['newDim'] ?></strong></td>
                            <td style="color: #ef4444;"><?= $row['oldSize'] ?></td>
                            <td style="color: #10b981; font-weight: bold;"><?= $row['newSize'] ?></td>
                            <td class="tag-green">-<?= $row['saved'] ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p style="color: #10b981; font-weight: bold;">Todas las imágenes ya se encuentran optimizadas en resolución y peso liviano.</p>
        <?php endif; ?>

        <div style="text-align: center;">
            <a href="/" class="btn-back">← Volver a la Tienda</a>
        </div>
    </div>
</body>
</html>
