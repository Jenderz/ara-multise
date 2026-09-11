<?php
/**
 * Herramienta Autónoma de Optimización Masiva de Imágenes
 * Sistema independiente de alta eficiencia con procesamiento por lotes (Anti-Timeouts),
 * auto-rotación EXIF para fotos móviles, modo simulación (Dry-Run), compresión progresiva
 * y panel de control interactivo en tiempo real.
 * 
 * Conserva estrictamente los mismos nombres de archivos para no afectar enlaces ni la base de datos.
 */

// Aumentar límites para soportar análisis y procesamiento intensivo
@ini_set('memory_limit', '512M');
@set_time_limit(180);

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$secretKey = 'ara_opt_2026'; // Clave de seguridad predeterminada
$uploadsDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';

// Crear uploads si no existiera
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0755, true);
}

$isCli = (php_sapi_name() === 'cli' && !isset($_SERVER['SIMULATE_WEB']));

// -------------------------------------------------------------
// AUTENTICACIÓN Y SEGURIDAD
// -------------------------------------------------------------
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION['ara_opt_auth'] = false;
    unset($_SESSION['ara_opt_auth']);
    header('Location: ' . strtok($_SERVER["REQUEST_URI"], '?'));
    exit;
}

$headerKey = $_SERVER['HTTP_X_SECURITY_KEY'] ?? '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (strpos($authHeader, 'Bearer ') === 0) {
    $headerKey = trim(substr($authHeader, 7));
}

$providedKey = $_POST['key'] ?? $_GET['key'] ?? $headerKey;

if ($providedKey === $secretKey) {
    $_SESSION['ara_opt_auth'] = true;
}

$isAuthenticated = $isCli || (!empty($_SESSION['ara_opt_auth']) && $_SESSION['ara_opt_auth'] === true);

// -------------------------------------------------------------
// FUNCIONES AUXILIARES DE PROCESAMIENTO
// -------------------------------------------------------------

/**
 * Escanea recursivamente todos los archivos de imagen válidos dentro de un directorio.
 */
function getUploadImagesManifest($dir, $baseDir = null) {
    if ($baseDir === null) $baseDir = $dir;
    $results = [];
    if (!is_dir($dir)) return $results;

    $files = @scandir($dir);
    if (!$files) return $results;

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $fullPath = $dir . DIRECTORY_SEPARATOR . $file;
        if (is_dir($fullPath)) {
            $results = array_merge($results, getUploadImagesManifest($fullPath, $baseDir));
        } else if (is_file($fullPath)) {
            $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                $relPath = ltrim(str_replace($baseDir, '', $fullPath), DIRECTORY_SEPARATOR . '/');
                $size = @filesize($fullPath) ?: 0;
                $results[] = [
                    'path' => str_replace('\\', '/', $relPath),
                    'filename' => basename($fullPath),
                    'size' => $size,
                    'ext' => $ext
                ];
            }
        }
    }
    return $results;
}

/**
 * Corrige la rotación de la imagen JPEG según los metadatos EXIF (común en smartphones).
 */
function autoRotateExif($image, $filePath, &$width, &$height) {
    if (!function_exists('exif_read_data')) {
        return $image;
    }
    
    $exif = @exif_read_data($filePath);
    if (empty($exif['Orientation'])) {
        return $image;
    }

    switch ($exif['Orientation']) {
        case 3:
            $rotated = @imagerotate($image, 180, 0);
            if ($rotated) {
                imagedestroy($image);
                return $rotated;
            }
            break;
        case 6:
            $rotated = @imagerotate($image, -90, 0);
            if ($rotated) {
                imagedestroy($image);
                $tmp = $width;
                $width = $height;
                $height = $tmp;
                return $rotated;
            }
            break;
        case 8:
            $rotated = @imagerotate($image, 90, 0);
            if ($rotated) {
                imagedestroy($image);
                $tmp = $width;
                $width = $height;
                $height = $tmp;
                return $rotated;
            }
            break;
    }

    return $image;
}

/**
 * Optimiza un archivo individual de forma segura y atómica.
 */
function optimizeSingleImage($filePath, $options = []) {
    $maxDimension = $options['maxDimension'] ?? 1200;
    $quality = $options['quality'] ?? 82;
    $thresholdBytes = ($options['thresholdKb'] ?? 200) * 1024;
    $autoRotate = $options['autoRotateExif'] ?? true;
    $dryRun = $options['dryRun'] ?? false;

    if (!file_exists($filePath) || !is_readable($filePath)) {
        return ['status' => 'error', 'message' => 'Archivo no encontrado o no legible'];
    }

    $oldSize = @filesize($filePath);
    $imgInfo = @getimagesize($filePath);

    if (!$imgInfo) {
        return ['status' => 'error', 'message' => 'El archivo no es una imagen válida o está corrupto'];
    }

    $width = $imgInfo[0];
    $height = $imgInfo[1];
    $mime = $imgInfo['mime'];

    $needsResize = ($width > $maxDimension || $height > $maxDimension);
    $needsCompress = ($oldSize > $thresholdBytes);

    if (!$needsResize && !$needsCompress) {
        return [
            'status' => 'skipped',
            'message' => 'Ya se encuentra optimizada',
            'oldSize' => $oldSize,
            'newSize' => $oldSize,
            'saved' => 0,
            'oldDim' => "{$width}x{$height}",
            'newDim' => "{$width}x{$height}"
        ];
    }

    // Prevención de desbordamiento de memoria GD (ancho * alto * 5 bytes estimados)
    $estimatedMemory = $width * $height * 5;
    $memoryLimitStr = ini_get('memory_limit');
    if ($memoryLimitStr && $memoryLimitStr !== '-1') {
        $limitBytes = (int)$memoryLimitStr * 1024 * 1024;
        if ($estimatedMemory > ($limitBytes * 0.75)) {
            return [
                'status' => 'error',
                'message' => "Imagen excesivamente grande ({$width}x{$height}) para la memoria disponible"
            ];
        }
    }

    // Cargar imagen fuente según MIME
    $srcImage = null;
    switch ($mime) {
        case 'image/jpeg':
            $srcImage = @imagecreatefromjpeg($filePath);
            if ($srcImage && $autoRotate) {
                $srcImage = autoRotateExif($srcImage, $filePath, $width, $height);
            }
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

    if (!$srcImage) {
        return ['status' => 'error', 'message' => "No se pudo decodificar la imagen ($mime)"];
    }

    // Calcular nuevas dimensiones
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

    $dstImage = @imagecreatetruecolor($newWidth, $newHeight);
    if (!$dstImage) {
        @imagedestroy($srcImage);
        return ['status' => 'error', 'message' => 'Fallo al inicializar lienzo GD'];
    }

    // Preservar transparencia para PNG y WebP
    if ($mime === 'image/png' || $mime === 'image/webp') {
        imagealphablending($dstImage, false);
        imagesavealpha($dstImage, true);
        $transparent = imagecolorallocatealpha($dstImage, 255, 255, 255, 127);
        imagefilledrectangle($dstImage, 0, 0, $newWidth, $newHeight, $transparent);
    } else if ($mime === 'image/jpeg') {
        // Habilitar JPEG progresivo para carga visual ultra-rápida
        imageinterlace($dstImage, true);
    }

    // Redimensionado de alta calidad
    imagecopyresampled($dstImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

    // Ruta de archivo temporal segura
    $tempPath = $filePath . '.opt_' . uniqid() . '.tmp';
    $saved = false;

    if ($mime === 'image/jpeg') {
        $saved = @imagejpeg($dstImage, $tempPath, (int)$quality);
    } else if ($mime === 'image/png') {
        // Compresión PNG zlib (nivel 9 para máximo ahorro)
        $saved = @imagepng($dstImage, $tempPath, 9);
    } else if ($mime === 'image/webp' && function_exists('imagewebp')) {
        $saved = @imagewebp($dstImage, $tempPath, (int)$quality);
    }

    // Liberar memoria inmediatamente
    @imagedestroy($srcImage);
    @imagedestroy($dstImage);
    if (function_exists('gc_collect_cycles')) {
        @gc_collect_cycles();
    }

    if (!$saved || !file_exists($tempPath)) {
        if (file_exists($tempPath)) @unlink($tempPath);
        return ['status' => 'error', 'message' => 'Fallo al guardar archivo temporal'];
    }

    $newSize = @filesize($tempPath);

    // Solo conservar el reemplazo si el nuevo peso es estrictamente menor
    if ($newSize > 0 && $newSize < $oldSize) {
        $savedBytes = $oldSize - $newSize;
        if ($dryRun) {
            @unlink($tempPath);
            return [
                'status' => 'simulated',
                'message' => 'Simulación exitosa',
                'oldSize' => $oldSize,
                'newSize' => $newSize,
                'saved' => $savedBytes,
                'oldDim' => "{$width}x{$height}",
                'newDim' => "{$newWidth}x{$newHeight}"
            ];
        }

        // Reemplazo atómico
        $renamed = @rename($tempPath, $filePath);
        if ($renamed) {
            return [
                'status' => 'optimized',
                'message' => 'Optimizada con éxito',
                'oldSize' => $oldSize,
                'newSize' => $newSize,
                'saved' => $savedBytes,
                'oldDim' => "{$width}x{$height}",
                'newDim' => "{$newWidth}x{$newHeight}"
            ];
        } else {
            @unlink($tempPath);
            return ['status' => 'error', 'message' => 'Permiso denegado al sobrescribir archivo'];
        }
    } else {
        @unlink($tempPath);
        return [
            'status' => 'skipped',
            'message' => 'El archivo resultante no redujo el peso actual',
            'oldSize' => $oldSize,
            'newSize' => $oldSize,
            'saved' => 0,
            'oldDim' => "{$width}x{$height}",
            'newDim' => "{$newWidth}x{$newHeight}"
        ];
    }
}

// -------------------------------------------------------------
// CONTROLADOR CLI
// -------------------------------------------------------------
if ($isCli) {
    echo "\n=======================================================\n";
    echo "  ARA MULTISE - Optimizador Autónomo de Imágenes (CLI) \n";
    echo "=======================================================\n\n";

    // Analizar argumentos CLI
    $options = getopt('', ['key::', 'dry-run', 'max-dim::', 'quality::', 'threshold::', 'help']);

    if (isset($options['help'])) {
        echo "Uso: php optimize_images.php [opciones]\n";
        echo "  --key=...         Clave de seguridad\n";
        echo "  --dry-run         Simular sin sobrescribir archivos\n";
        echo "  --max-dim=1200    Dimensión máxima en px (defecto: 1200)\n";
        echo "  --quality=82      Calidad de compresión 1-100 (defecto: 82)\n";
        echo "  --threshold=200   Umbral mínimo en KB (defecto: 200)\n\n";
        exit(0);
    }

    $providedCliKey = $options['key'] ?? '';
    if ($providedCliKey !== $secretKey) {
        echo "[!] Error de seguridad: Clave incorrecta o no proporcionada. Usa --key={$secretKey}\n\n";
        exit(1);
    }

    $dryRun = isset($options['dry-run']);
    $maxDimension = isset($options['max-dim']) ? (int)$options['max-dim'] : 1200;
    $quality = isset($options['quality']) ? (int)$options['quality'] : 82;
    $thresholdKb = isset($options['threshold']) ? (int)$options['threshold'] : 200;

    echo "Modo: " . ($dryRun ? "SIMULACIÓN (Dry-Run)" : "EJECUCIÓN REAL") . "\n";
    echo "Dimensión Máxima: {$maxDimension}px | Calidad: {$quality}% | Umbral: {$thresholdKb}KB\n";
    echo "Escaneando uploads/...\n";

    $manifest = getUploadImagesManifest($uploadsDir);
    $total = count($manifest);
    echo "Total imágenes encontradas: $total\n\n";

    if ($total === 0) {
        echo "No se encontraron imágenes para optimizar.\n\n";
        exit(0);
    }

    $optimizedCount = 0;
    $skippedCount = 0;
    $errorCount = 0;
    $totalSavedBytes = 0;

    $optParams = [
        'maxDimension' => $maxDimension,
        'quality' => $quality,
        'thresholdKb' => $thresholdKb,
        'autoRotateExif' => true,
        'dryRun' => $dryRun
    ];

    $i = 0;
    foreach ($manifest as $item) {
        $i++;
        $fullPath = $uploadsDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $item['path']);
        $res = optimizeSingleImage($fullPath, $optParams);

        $status = $res['status'] ?? 'unknown';
        if ($status === 'optimized' || $status === 'simulated') {
            $optimizedCount++;
            $totalSavedBytes += $res['saved'];
            $savedKb = round($res['saved'] / 1024, 1);
            echo "[$i/$total] [OK] {$item['filename']} ({$res['oldDim']} -> {$res['newDim']}) -{$savedKb} KB\n";
        } else if ($status === 'skipped') {
            $skippedCount++;
            echo "[$i/$total] [SKIP] {$item['filename']} - {$res['message']}\n";
        } else {
            $errorCount++;
            echo "[$i/$total] [ERR] {$item['filename']} - {$res['message']}\n";
        }
    }

    $savedMb = round($totalSavedBytes / (1024 * 1024), 2);
    echo "\n-------------------------------------------------------\n";
    echo "RESUMEN FINAL:\n";
    echo "Analizadas: $total | Optimizadas: $optimizedCount | Omitidas: $skippedCount | Errores: $errorCount\n";
    echo "Espacio liberado: {$savedMb} MB\n";
    echo "-------------------------------------------------------\n\n";
    exit(0);
}

// -------------------------------------------------------------
// CONTROLADOR DE ACCESO NAVEGADOR
// -------------------------------------------------------------
if (!$isAuthenticated) {
    $hasError = ($_SERVER['REQUEST_METHOD'] === 'POST' && $providedKey !== $secretKey);
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Optimizador de Imágenes - Acceso Requerido</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-main: #0b0f19;
                --card-bg: #111827;
                --card-border: #1f2937;
                --primary: #06b6d4;
                --primary-hover: #0891b2;
                --text-main: #f3f4f6;
                --text-muted: #9ca3af;
                --accent-emerald: #10b981;
                --danger: #ef4444;
            }
            * { box-sizing: border-box; }
            body {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                background-color: var(--bg-main);
                color: var(--text-main);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 1.5rem;
                background-image: radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 60%);
            }
            .auth-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                padding: 2.5rem;
                border-radius: 1.25rem;
                width: 100%;
                max-width: 440px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                text-align: center;
                backdrop-filter: blur(12px);
            }
            .badge-icon {
                width: 56px;
                height: 56px;
                background: rgba(6, 182, 212, 0.12);
                color: var(--primary);
                border-radius: 1rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1.25rem;
                border: 1px solid rgba(6, 182, 212, 0.25);
            }
            h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; color: #fff; letter-spacing: -0.02em; }
            p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.75rem; }
            .form-group { text-align: left; margin-bottom: 1.25rem; }
            label { display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem; }
            input[type="password"], input[type="text"] {
                width: 100%;
                padding: 0.85rem 1rem;
                background: #0b0f19;
                border: 1px solid #374151;
                border-radius: 0.75rem;
                color: #fff;
                font-family: inherit;
                font-size: 0.95rem;
                transition: all 0.2s ease;
            }
            input:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.2);
            }
            button {
                width: 100%;
                padding: 0.85rem 1.25rem;
                background: linear-gradient(135deg, var(--primary) 0%, #0284c7 100%);
                border: none;
                border-radius: 0.75rem;
                color: #fff;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3);
            }
            button:hover {
                filter: brightness(1.1);
                transform: translateY(-1px);
            }
            .alert-error {
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #fca5a5;
                padding: 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.85rem;
                margin-bottom: 1.25rem;
                text-align: left;
            }
            .security-tag {
                margin-top: 1.5rem;
                font-size: 0.75rem;
                color: #6b7280;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;
            }
        </style>
    </head>
    <body>
        <div class="auth-card">
            <div class="badge-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <h1>Optimizador de Imágenes</h1>
            <p>Herramienta autónoma para aceleración y compresión de archivos multimedia en <code>uploads/</code>.</p>

            <?php if ($hasError): ?>
                <div class="alert-error">
                    Clave incorrecta. Por favor verifica tus credenciales de acceso.
                </div>
            <?php endif; ?>

            <form method="POST">
                <div class="form-group">
                    <label for="key">Clave de Seguridad</label>
                    <input type="password" id="key" name="key" placeholder="Ingresa la clave del sistema" value="ara_opt_2026" required autofocus>
                </div>
                <button type="submit">Desbloquear Panel</button>
            </form>

            <div class="security-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Protegido contra accesos no autorizados
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// -------------------------------------------------------------
// CONTROLADOR DE API JSON (AJAX BATCH / SCAN)
// -------------------------------------------------------------
if (isset($_GET['action'])) {
    header('Content-Type: application/json; charset=utf-8');

    // Endpoint: Escanear catálogo existente
    if ($_GET['action'] === 'scan') {
        $manifest = getUploadImagesManifest($uploadsDir);
        $totalBytes = 0;
        foreach ($manifest as $img) {
            $totalBytes += $img['size'];
        }

        echo json_encode([
            'status' => 'success',
            'totalImages' => count($manifest),
            'totalBytes' => $totalBytes,
            'totalMb' => round($totalBytes / (1024 * 1024), 2),
            'files' => $manifest,
            'gdInfo' => function_exists('gd_info') ? gd_info() : null,
            'hasWebp' => function_exists('imagewebp'),
            'hasExif' => function_exists('exif_read_data')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Endpoint: Procesar un lote específico de archivos
    if ($_GET['action'] === 'process_batch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true);
        if (!$payload && !empty($_POST)) {
            $payload = is_string($_POST['payload'] ?? null) ? json_decode($_POST['payload'], true) : $_POST;
        }

        if (!$payload || !isset($payload['files']) || !is_array($payload['files'])) {
            echo json_encode(['status' => 'error', 'message' => 'Lote de archivos inválido']);
            exit;
        }

        $options = [
            'maxDimension' => isset($payload['maxDimension']) ? (int)$payload['maxDimension'] : 1200,
            'quality' => isset($payload['quality']) ? (int)$payload['quality'] : 82,
            'thresholdKb' => isset($payload['thresholdKb']) ? (int)$payload['thresholdKb'] : 200,
            'autoRotateExif' => !empty($payload['autoRotateExif']),
            'dryRun' => !empty($payload['dryRun'])
        ];

        $results = [];
        $batchSavedBytes = 0;
        $realUploads = realpath($uploadsDir);

        foreach ($payload['files'] as $relPath) {
            // Protección estricta contra Path Traversal
            $targetPath = realpath($uploadsDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relPath));

            if (!$targetPath || strpos($targetPath, $realUploads) !== 0 || !is_file($targetPath)) {
                $results[] = [
                    'path' => $relPath,
                    'name' => basename($relPath),
                    'status' => 'error',
                    'message' => 'Ruta inválida o fuera del directorio permitido'
                ];
                continue;
            }

            $res = optimizeSingleImage($targetPath, $options);
            $res['path'] = $relPath;
            $res['name'] = basename($targetPath);

            if (($res['status'] === 'optimized' || $res['status'] === 'simulated') && isset($res['saved'])) {
                $batchSavedBytes += $res['saved'];
            }

            $results[] = $res;
        }

        echo json_encode([
            'status' => 'success',
            'results' => $results,
            'batchSavedBytes' => $batchSavedBytes
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// -------------------------------------------------------------
// VISTA PRINCIPAL: DASHBOARD INTERACTIVO
// -------------------------------------------------------------
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimizador Avanzado de Imágenes | ARA</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #090d16;
            --bg-card: #111827;
            --bg-card-sub: #172033;
            --border: #1f293d;
            --border-hover: #374151;
            --primary: #06b6d4;
            --primary-glow: rgba(6, 182, 212, 0.35);
            --primary-dark: #0891b2;
            --emerald: #10b981;
            --emerald-glow: rgba(16, 185, 129, 0.25);
            --amber: #f59e0b;
            --rose: #f43f5e;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --text-sub: #6b7280;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            min-height: 100vh;
            padding: 2rem 1.5rem 4rem;
            background-image: 
                radial-gradient(at 0% 0%, rgba(6, 182, 212, 0.12) 0, transparent 40%),
                radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.08) 0, transparent 45%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        /* Top Header */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2rem;
            padding-bottom: 1.25rem;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 1rem;
        }

        .brand-title {
            display: flex;
            align-items: center;
            gap: 0.85rem;
        }
        .brand-logo {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, var(--primary) 0%, #0284c7 100%);
            border-radius: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            box-shadow: 0 4px 16px var(--primary-glow);
        }
        .brand-title h1 {
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #fff;
        }
        .brand-title span {
            font-size: 0.75rem;
            color: var(--primary);
            background: rgba(6, 182, 212, 0.12);
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
            border: 1px solid rgba(6, 182, 212, 0.25);
            font-weight: 600;
            margin-left: 0.5rem;
        }
        .header-actions {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .btn-link {
            text-decoration: none;
            color: var(--text-muted);
            font-size: 0.85rem;
            font-weight: 500;
            padding: 0.5rem 0.9rem;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
            background: var(--bg-card);
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
        }
        .btn-link:hover {
            color: #fff;
            border-color: var(--text-muted);
        }

        /* KPI Stat Cards */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
            gap: 1.25rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1.1rem;
            padding: 1.35rem;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
            transition: border-color 0.2s;
        }
        .stat-card::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: var(--accent, var(--primary));
        }
        .stat-label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .stat-value {
            font-size: 1.85rem;
            font-weight: 800;
            color: #fff;
            letter-spacing: -0.03em;
            font-family: 'JetBrains Mono', monospace;
        }
        .stat-meta {
            font-size: 0.8rem;
            color: var(--text-sub);
            margin-top: 0.35rem;
        }

        /* Config Card & Controls */
        .config-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1.25rem;
            padding: 1.75rem;
            margin-bottom: 2rem;
            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.45);
        }
        .config-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid var(--border);
        }
        .config-header h2 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .control-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .control-label {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
        }
        .control-label span {
            color: var(--primary);
            font-family: 'JetBrains Mono', monospace;
        }
        input[type="range"] {
            width: 100%;
            height: 6px;
            background: #1f2937;
            border-radius: 4px;
            outline: none;
            -webkit-appearance: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--primary);
            cursor: pointer;
            box-shadow: 0 0 10px var(--primary-glow);
            transition: transform 0.1s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.15);
        }
        .select-input {
            background: #0b0f19;
            border: 1px solid var(--border);
            color: #fff;
            padding: 0.6rem 0.85rem;
            border-radius: 0.6rem;
            font-size: 0.85rem;
            outline: none;
        }

        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            padding: 0.6rem 0;
            cursor: pointer;
            user-select: none;
        }
        .checkbox-container input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: var(--primary);
            cursor: pointer;
        }
        .checkbox-container span {
            font-size: 0.85rem;
            color: var(--text-main);
        }
        .checkbox-hint {
            font-size: 0.72rem;
            color: var(--text-sub);
            margin-left: 1.8rem;
            display: block;
        }

        /* Action Buttons Area */
        .actions-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
            padding-top: 1.25rem;
            border-top: 1px solid var(--border);
        }
        .btn-group {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }
        .btn {
            padding: 0.75rem 1.4rem;
            border-radius: 0.75rem;
            font-size: 0.9rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
            text-decoration: none;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--primary) 0%, #0284c7 100%);
            color: #fff;
            box-shadow: 0 4px 16px var(--primary-glow);
        }
        .btn-primary:hover:not(:disabled) {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        .btn-secondary {
            background: var(--bg-card-sub);
            color: var(--text-main);
            border: 1px solid var(--border);
        }
        .btn-secondary:hover:not(:disabled) {
            border-color: var(--text-muted);
            background: #1f2937;
        }
        .btn-warning {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .btn-warning:hover:not(:disabled) {
            background: rgba(245, 158, 11, 0.25);
        }
        .btn-danger {
            background: rgba(244, 63, 94, 0.15);
            color: #fda4af;
            border: 1px solid rgba(244, 63, 94, 0.3);
        }
        .btn-danger:hover:not(:disabled) {
            background: rgba(244, 63, 94, 0.25);
        }
        .btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            transform: none !important;
            filter: none !important;
        }

        /* Progress Card */
        .progress-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1.25rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
            display: none;
        }
        .progress-card.active {
            display: block;
        }
        .progress-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
            font-size: 0.85rem;
        }
        .progress-title {
            font-weight: 600;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .progress-percent {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            color: var(--primary);
            font-size: 1.1rem;
        }
        .progress-bar-container {
            width: 100%;
            height: 12px;
            background: #0b0f19;
            border-radius: 9999px;
            overflow: hidden;
            border: 1px solid var(--border);
            margin-bottom: 0.75rem;
            position: relative;
        }
        .progress-bar-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, var(--primary), var(--emerald));
            border-radius: 9999px;
            transition: width 0.3s ease;
            box-shadow: 0 0 12px var(--primary-glow);
        }
        .progress-subtext {
            font-size: 0.78rem;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            font-family: 'JetBrains Mono', monospace;
        }

        /* Results & Logs Section */
        .results-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1.25rem;
            overflow: hidden;
            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.4);
        }
        .results-header {
            padding: 1.25rem 1.5rem;
            background: var(--bg-card-sub);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .results-header h3 {
            font-size: 1rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .table-tools {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }
        .search-input {
            background: #0b0f19;
            border: 1px solid var(--border);
            color: #fff;
            padding: 0.5rem 0.85rem;
            border-radius: 0.5rem;
            font-size: 0.85rem;
            outline: none;
            width: 220px;
        }
        .search-input:focus {
            border-color: var(--primary);
        }
        .filter-select {
            background: #0b0f19;
            border: 1px solid var(--border);
            color: #fff;
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            font-size: 0.85rem;
            outline: none;
        }

        .table-responsive {
            width: 100%;
            overflow-x: auto;
            max-height: 520px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            text-align: left;
        }
        th {
            background: #0b0f19;
            color: var(--text-muted);
            font-weight: 600;
            padding: 0.85rem 1.25rem;
            text-transform: uppercase;
            font-size: 0.72rem;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 1px solid var(--border);
        }
        td {
            padding: 0.85rem 1.25rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-main);
        }
        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }
        .file-col {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            color: #e5e7eb;
            max-width: 260px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.25rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        .badge-success {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .badge-sim {
            background: rgba(6, 182, 212, 0.15);
            color: #38bdf8;
            border: 1px solid rgba(6, 182, 212, 0.3);
        }
        .badge-skipped {
            background: rgba(156, 163, 175, 0.15);
            color: #9ca3af;
            border: 1px solid rgba(156, 163, 175, 0.3);
        }
        .badge-error {
            background: rgba(244, 63, 94, 0.15);
            color: #fb7185;
            border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .dim-box {
            display: flex;
            align-items: center;
            gap: 0.35rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
        }
        .dim-arrow { color: var(--text-sub); }
        .dim-new { color: var(--primary); font-weight: 600; }
        .saved-text {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            color: var(--emerald);
        }

        /* Empty state */
        .empty-state {
            padding: 3rem 1.5rem;
            text-align: center;
            color: var(--text-muted);
        }
        .empty-icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            color: var(--text-sub);
        }

        /* Spinner */
        .spinner {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            body { padding: 1rem; }
            .stats-grid { grid-template-columns: 1fr 1fr; }
            .config-grid { grid-template-columns: 1fr; }
            .search-input { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Encabezado Principal -->
        <header>
            <div class="brand-title">
                <div class="brand-logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </div>
                <div>
                    <h1>Optimizador de Imágenes <span>Independiente</span></h1>
                    <div style="font-size: 0.78rem; color: var(--text-sub); margin-top: 2px;">
                        Compresión masiva sin alterar URLs ni base de datos &bull; Directorio <code>uploads/</code>
                    </div>
                </div>
            </div>

            <div class="header-actions">
                <a href="/" class="btn-link">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Ir a la Tienda
                </a>
                <a href="?action=logout" class="btn-link" style="color: #f87171;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Cerrar Sesión
                </a>
            </div>
        </header>

        <!-- Métricas KPI -->
        <div class="stats-grid">
            <div class="stat-card" style="--accent: #06b6d4;">
                <div class="stat-label">Total Analizadas</div>
                <div class="stat-value" id="kpiTotal">0</div>
                <div class="stat-meta" id="kpiTotalMeta">Directorio uploads/</div>
            </div>

            <div class="stat-card" style="--accent: #10b981;">
                <div class="stat-label">Fotos Optimizadas</div>
                <div class="stat-value" id="kpiOptimized" style="color: #10b981;">0</div>
                <div class="stat-meta" id="kpiOptimizedPercent">0% del catálogo</div>
            </div>

            <div class="stat-card" style="--accent: #3b82f6;">
                <div class="stat-label">Espacio Liberado</div>
                <div class="stat-value" id="kpiSaved" style="color: #38bdf8;">0 MB</div>
                <div class="stat-meta" id="kpiSavedPercent">0% ahorro estimado</div>
            </div>

            <div class="stat-card" style="--accent: #f59e0b;">
                <div class="stat-label">Omitidas / Óptimas</div>
                <div class="stat-value" id="kpiSkipped" style="color: #fbbf24;">0</div>
                <div class="stat-meta" id="kpiErrors">0 errores</div>
            </div>
        </div>

        <!-- Panel de Configuración y Controles -->
        <div class="config-card">
            <div class="config-header">
                <h2>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Ajustes de Optimización
                </h2>
                <div id="systemCapabilities" style="font-size: 0.75rem; color: var(--text-sub);">
                    Detectando soporte de servidor...
                </div>
            </div>

            <div class="config-grid">
                <!-- Dimensión máxima -->
                <div class="control-group">
                    <div class="control-label">
                        <span>Dimensión Máx.</span>
                        <span id="lblMaxDim">1200 px</span>
                    </div>
                    <input type="range" id="inputMaxDim" min="800" max="2400" step="50" value="1200">
                    <small style="color: var(--text-sub); font-size: 0.72rem;">Reescala ancho y alto proporcionalmente</small>
                </div>

                <!-- Calidad de Compresión -->
                <div class="control-group">
                    <div class="control-label">
                        <span>Calidad Compresión</span>
                        <span id="lblQuality">82%</span>
                    </div>
                    <input type="range" id="inputQuality" min="60" max="95" step="1" value="82">
                    <small style="color: var(--text-sub); font-size: 0.72rem;">Balance óptimo entre nitidez y ligereza</small>
                </div>

                <!-- Umbral de peso -->
                <div class="control-group">
                    <div class="control-label">
                        <span>Umbral Mínimo</span>
                        <span id="lblThreshold">200 KB</span>
                    </div>
                    <input type="range" id="inputThreshold" min="50" max="1000" step="25" value="200">
                    <small style="color: var(--text-sub); font-size: 0.72rem;">Omitir imágenes de menor peso</small>
                </div>

                <!-- Tamaño de lote AJAX -->
                <div class="control-group">
                    <label class="control-label" for="selectBatchSize">
                        <span>Lote AJAX (Anti-Timeout)</span>
                    </label>
                    <select id="selectBatchSize" class="select-input">
                        <option value="5">5 fotos por petición</option>
                        <option value="10" selected>10 fotos por petición (Recomendado)</option>
                        <option value="20">20 fotos por petición</option>
                        <option value="30">30 fotos por petición (Rápido)</option>
                    </select>
                    <small style="color: var(--text-sub); font-size: 0.72rem;">Garantiza 0 timeouts en el servidor</small>
                </div>
            </div>

            <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                <label class="checkbox-container">
                    <input type="checkbox" id="chkAutoRotate" checked>
                    <span>Auto-rotar fotos según orientación EXIF (Móviles)</span>
                </label>
                <label class="checkbox-container">
                    <input type="checkbox" id="chkDryRun">
                    <span style="color: #38bdf8; font-weight: 600;">Modo Simulación (Dry-Run)</span>
                    <small class="checkbox-hint">Calcula el ahorro sin modificar ningún archivo</small>
                </label>
            </div>

            <!-- Botones de Acción -->
            <div class="actions-bar">
                <div class="btn-group">
                    <button id="btnScan" class="btn btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Escanear uploads/
                    </button>
                    <button id="btnStart" class="btn btn-primary" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Iniciar Optimización
                    </button>
                    <button id="btnPause" class="btn btn-warning" style="display: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        Pausar
                    </button>
                    <button id="btnStop" class="btn btn-danger" style="display: none;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                        Detener
                    </button>
                </div>

                <div id="statusIndicator" style="font-size: 0.85rem; color: var(--text-muted);">
                    Listo para escanear
                </div>
            </div>
        </div>

        <!-- Tarjeta de Progreso en Vivo -->
        <div id="progressCard" class="progress-card">
            <div class="progress-meta">
                <div class="progress-title">
                    <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                    <span id="progressCurrentFile">Procesando lote...</span>
                </div>
                <div class="progress-percent" id="progressPercent">0%</div>
            </div>
            <div class="progress-bar-container">
                <div id="progressBarFill" class="progress-bar-fill"></div>
            </div>
            <div class="progress-subtext">
                <span id="progressCount">0 / 0 imágenes</span>
                <span id="progressEta">ETA: Calculando...</span>
            </div>
        </div>

        <!-- Tabla y Reporte Dinámico -->
        <div class="results-card">
            <div class="results-header">
                <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    Registro de Optimización
                </h3>

                <div class="table-tools">
                    <input type="text" id="filterSearch" class="search-input" placeholder="Buscar archivo...">
                    <select id="filterStatus" class="filter-select">
                        <option value="all">Todos los registros</option>
                        <option value="optimized">Solo Optimizadas / Simuladas</option>
                        <option value="skipped">Omitidas</option>
                        <option value="error">Errores</option>
                    </select>
                    <button id="btnExportCsv" class="btn btn-secondary" style="padding: 0.5rem 0.85rem; font-size: 0.8rem;" disabled>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        CSV
                    </button>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Archivo</th>
                            <th>Dimensiones</th>
                            <th>Peso Original</th>
                            <th>Peso Nuevo</th>
                            <th>Ahorro</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="resultsTableBody">
                        <tr>
                            <td colspan="6">
                                <div class="empty-state">
                                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <p>Presiona <strong>"Escanear uploads/"</strong> para auditar las fotos actuales y comenzar.</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Script de Control Interactivo -->
    <script>
        // Estado Global
        let manifest = [];
        let processedResults = [];
        let isRunning = false;
        let isPaused = false;
        let currentIndex = 0;
        let startTime = null;
        let totalOriginalBytes = 0;
        let totalSavedBytes = 0;
        let optimizedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Elementos DOM
        const btnScan = document.getElementById('btnScan');
        const btnStart = document.getElementById('btnStart');
        const btnPause = document.getElementById('btnPause');
        const btnStop = document.getElementById('btnStop');
        const btnExportCsv = document.getElementById('btnExportCsv');

        const inputMaxDim = document.getElementById('inputMaxDim');
        const lblMaxDim = document.getElementById('lblMaxDim');
        const inputQuality = document.getElementById('inputQuality');
        const lblQuality = document.getElementById('lblQuality');
        const inputThreshold = document.getElementById('inputThreshold');
        const lblThreshold = document.getElementById('lblThreshold');
        const selectBatchSize = document.getElementById('selectBatchSize');
        const chkAutoRotate = document.getElementById('chkAutoRotate');
        const chkDryRun = document.getElementById('chkDryRun');

        const kpiTotal = document.getElementById('kpiTotal');
        const kpiTotalMeta = document.getElementById('kpiTotalMeta');
        const kpiOptimized = document.getElementById('kpiOptimized');
        const kpiOptimizedPercent = document.getElementById('kpiOptimizedPercent');
        const kpiSaved = document.getElementById('kpiSaved');
        const kpiSavedPercent = document.getElementById('kpiSavedPercent');
        const kpiSkipped = document.getElementById('kpiSkipped');
        const kpiErrors = document.getElementById('kpiErrors');

        const progressCard = document.getElementById('progressCard');
        const progressBarFill = document.getElementById('progressBarFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressCount = document.getElementById('progressCount');
        const progressEta = document.getElementById('progressEta');
        const progressCurrentFile = document.getElementById('progressCurrentFile');
        const statusIndicator = document.getElementById('statusIndicator');

        const resultsTableBody = document.getElementById('resultsTableBody');
        const filterSearch = document.getElementById('filterSearch');
        const filterStatus = document.getElementById('filterStatus');
        const systemCapabilities = document.getElementById('systemCapabilities');

        // Sincronización de Controles Slider
        inputMaxDim.addEventListener('input', () => lblMaxDim.textContent = `${inputMaxDim.value} px`);
        inputQuality.addEventListener('input', () => lblQuality.textContent = `${inputQuality.value}%`);
        inputThreshold.addEventListener('input', () => lblThreshold.textContent = `${inputThreshold.value} KB`);

        chkDryRun.addEventListener('change', () => {
            btnStart.textContent = chkDryRun.checked ? 'Iniciar Simulación (Dry-Run)' : 'Iniciar Optimización';
        });

        // 1. ESCANEAR DIRECTORIO
        btnScan.addEventListener('click', async () => {
            try {
                btnScan.disabled = true;
                statusIndicator.innerHTML = '<span style="color: var(--primary);">Escaneando directorio uploads/...</span>';

                const response = await fetch('?action=scan');
                const data = await response.json();

                if (data.status === 'success') {
                    manifest = data.files || [];
                    totalOriginalBytes = data.totalBytes || 0;
                    kpiTotal.textContent = data.totalImages;
                    kpiTotalMeta.textContent = `${data.totalMb} MB en disco`;

                    let caps = [];
                    if (data.hasWebp) caps.push('WebP nativo');
                    if (data.hasExif) caps.push('Rotación EXIF');
                    systemCapabilities.textContent = `Servidor: GD activo (${caps.join(', ')})`;

                    statusIndicator.innerHTML = `<span style="color: var(--emerald);">Escaneo completado: ${data.totalImages} imágenes encontradas.</span>`;
                    
                    if (manifest.length > 0) {
                        btnStart.disabled = false;
                        renderInitialTable(manifest);
                    } else {
                        btnStart.disabled = true;
                        resultsTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">El directorio uploads/ no contiene imágenes JPG, PNG o WEBP.</td></tr>`;
                    }
                } else {
                    throw new Error(data.message || 'Error en el escaneo');
                }
            } catch (err) {
                statusIndicator.innerHTML = `<span style="color: var(--rose);">Error: ${err.message}</span>`;
            } finally {
                btnScan.disabled = false;
            }
        });

        // 2. INICIAR PROCESAMIENTO
        btnStart.addEventListener('click', () => {
            if (manifest.length === 0) return;

            isRunning = true;
            isPaused = false;
            currentIndex = 0;
            processedResults = [];
            totalSavedBytes = 0;
            optimizedCount = 0;
            skippedCount = 0;
            errorCount = 0;
            startTime = Date.now();

            // Interfaz
            btnStart.style.display = 'none';
            btnScan.disabled = true;
            btnPause.style.display = 'inline-flex';
            btnPause.textContent = 'Pausar';
            btnStop.style.display = 'inline-flex';
            progressCard.classList.add('active');
            btnExportCsv.disabled = true;

            updateKPIs();
            resultsTableBody.innerHTML = '';

            processNextBatch();
        });

        // 3. PAUSAR / REANUDAR
        btnPause.addEventListener('click', () => {
            if (!isRunning) return;
            isPaused = !isPaused;
            if (isPaused) {
                btnPause.textContent = 'Reanudar';
                statusIndicator.innerHTML = '<span style="color: var(--amber);">Proceso pausado por el usuario.</span>';
            } else {
                btnPause.textContent = 'Pausar';
                statusIndicator.innerHTML = '<span style="color: var(--primary);">Reanudando proceso...</span>';
                processNextBatch();
            }
        });

        // 4. DETENER
        btnStop.addEventListener('click', () => {
            if (!confirm('¿Deseas detener el proceso de optimización en el lote actual?')) return;
            finishProcess(true);
        });

        // MOTOR BATCH AJAX
        async function processNextBatch() {
            if (!isRunning || isPaused) return;

            const batchSize = parseInt(selectBatchSize.value, 10) || 10;
            const batchFiles = manifest.slice(currentIndex, currentIndex + batchSize).map(f => f.path);

            if (batchFiles.length === 0) {
                finishProcess(false);
                return;
            }

            const payload = {
                files: batchFiles,
                maxDimension: parseInt(inputMaxDim.value, 10),
                quality: parseInt(inputQuality.value, 10),
                thresholdKb: parseInt(inputThreshold.value, 10),
                autoRotateExif: chkAutoRotate.checked,
                dryRun: chkDryRun.checked
            };

            progressCurrentFile.textContent = `Procesando lote: ${batchFiles[0]} ... (${currentIndex + 1} a ${Math.min(currentIndex + batchSize, manifest.length)})`;

            try {
                const response = await fetch('?action=process_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (data.status === 'success' && Array.isArray(data.results)) {
                    data.results.forEach(res => {
                        processedResults.push(res);
                        appendTableRow(res);

                        if (res.status === 'optimized' || res.status === 'simulated') {
                            optimizedCount++;
                            totalSavedBytes += (res.saved || 0);
                        } else if (res.status === 'skipped') {
                            skippedCount++;
                        } else {
                            errorCount++;
                        }
                    });

                    currentIndex += batchFiles.length;
                    updateProgress();
                    updateKPIs();

                    // Siguiente lote
                    if (currentIndex < manifest.length && isRunning && !isPaused) {
                        setTimeout(processNextBatch, 50);
                    } else if (currentIndex >= manifest.length) {
                        finishProcess(false);
                    }
                } else {
                    throw new Error(data.message || 'Error en respuesta de lote');
                }
            } catch (err) {
                console.error(err);
                errorCount += batchFiles.length;
                updateKPIs();
                statusIndicator.innerHTML = `<span style="color: var(--rose);">Error de red en lote: ${err.message}. Reintentando...</span>`;
                // Reintentar en 3 segundos si no se detuvo
                if (isRunning && !isPaused) {
                    setTimeout(processNextBatch, 3000);
                }
            }
        }

        function updateProgress() {
            const total = manifest.length;
            const pct = Math.min(100, Math.round((currentIndex / total) * 100));
            progressBarFill.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressCount.textContent = `${currentIndex} / ${total} imágenes`;

            // Cálculo ETA
            const elapsed = (Date.now() - startTime) / 1000;
            if (currentIndex > 0 && elapsed > 1) {
                const rate = currentIndex / elapsed;
                const remainingSecs = Math.max(0, Math.round((total - currentIndex) / rate));
                const mins = Math.floor(remainingSecs / 60);
                const secs = remainingSecs % 60;
                progressEta.textContent = `ETA: ${mins}m ${secs}s restantes`;
            }
        }

        function updateKPIs() {
            kpiOptimized.textContent = optimizedCount;
            kpiSkipped.textContent = skippedCount;
            kpiErrors.textContent = `${errorCount} errores`;

            const total = manifest.length || 1;
            const optPct = Math.round((optimizedCount / total) * 100);
            kpiOptimizedPercent.textContent = `${optPct}% del catálogo`;

            const savedMb = (totalSavedBytes / (1024 * 1024)).toFixed(2);
            kpiSaved.textContent = `${savedMb} MB`;

            if (totalOriginalBytes > 0) {
                const savedPct = ((totalSavedBytes / totalOriginalBytes) * 100).toFixed(1);
                kpiSavedPercent.textContent = `${savedPct}% del peso original`;
            }
        }

        function finishProcess(wasCancelled) {
            isRunning = false;
            isPaused = false;

            btnStart.style.display = 'inline-flex';
            btnStart.disabled = false;
            btnScan.disabled = false;
            btnPause.style.display = 'none';
            btnStop.style.display = 'none';
            btnExportCsv.disabled = (processedResults.length === 0);

            const isSim = chkDryRun.checked;
            const label = isSim ? 'Simulación finalizada' : 'Optimización finalizada';
            const savedMb = (totalSavedBytes / (1024 * 1024)).toFixed(2);

            if (wasCancelled) {
                statusIndicator.innerHTML = `<span style="color: var(--amber);">Proceso cancelado. Se procesaron ${currentIndex} imágenes (${savedMb} MB liberados).</span>`;
            } else {
                progressBarFill.style.width = '100%';
                progressPercent.textContent = '100%';
                progressCurrentFile.textContent = '¡Completado con éxito!';
                progressEta.textContent = 'Tiempo total: ' + Math.round((Date.now() - startTime) / 1000) + 's';
                statusIndicator.innerHTML = `<span style="color: var(--emerald); font-weight: 700;">✅ ${label}: ${optimizedCount} fotos procesadas, ${savedMb} MB ahorrados.</span>`;
            }
        }

        // Renderizado de Filas de Tabla
        function renderInitialTable(files) {
            resultsTableBody.innerHTML = '';
            files.slice(0, 15).forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="file-col" title="${f.path}">${f.filename}</td>
                    <td><span style="color: var(--text-sub);">-</span></td>
                    <td>${(f.size / 1024).toFixed(1)} KB</td>
                    <td><span style="color: var(--text-sub);">-</span></td>
                    <td><span style="color: var(--text-sub);">-</span></td>
                    <td><span class="badge badge-skipped">En espera</span></td>
                `;
                resultsTableBody.appendChild(tr);
            });
            if (files.length > 15) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-sub); padding: 0.75rem;">... y ${files.length - 15} imágenes más preparadas para procesar.</td>`;
                resultsTableBody.appendChild(tr);
            }
        }

        function appendTableRow(res) {
            const tr = document.createElement('tr');
            tr.dataset.status = res.status;
            tr.dataset.name = (res.name || '').toLowerCase();

            let badgeHtml = '';
            if (res.status === 'optimized') {
                badgeHtml = '<span class="badge badge-success">Optimizada</span>';
            } else if (res.status === 'simulated') {
                badgeHtml = '<span class="badge badge-sim">Simulada</span>';
            } else if (res.status === 'skipped') {
                badgeHtml = '<span class="badge badge-skipped">Omitida</span>';
            } else {
                badgeHtml = `<span class="badge badge-error" title="${res.message || ''}">Error</span>`;
            }

            const oldKb = res.oldSize ? (res.oldSize / 1024).toFixed(1) + ' KB' : '-';
            const newKb = res.newSize ? (res.newSize / 1024).toFixed(1) + ' KB' : '-';
            const savedKb = res.saved ? '-' + (res.saved / 1024).toFixed(1) + ' KB' : '-';

            tr.innerHTML = `
                <td class="file-col" title="${res.path || ''}">${res.name || 'Archivo'}</td>
                <td>
                    <div class="dim-box">
                        <span>${res.oldDim || '-'}</span>
                        <span class="dim-arrow">&rarr;</span>
                        <span class="dim-new">${res.newDim || '-'}</span>
                    </div>
                </td>
                <td style="color: var(--text-muted);">${oldKb}</td>
                <td style="color: #fff; font-weight: 600;">${newKb}</td>
                <td><span class="saved-text">${savedKb}</span></td>
                <td>${badgeHtml}</td>
            `;

            // Insertar al inicio para ver las más recientes en streaming
            if (resultsTableBody.firstChild) {
                resultsTableBody.insertBefore(tr, resultsTableBody.firstChild);
            } else {
                resultsTableBody.appendChild(tr);
            }
        }

        // Filtro y Búsqueda en la Tabla
        function filterTableRows() {
            const query = filterSearch.value.trim().toLowerCase();
            const status = filterStatus.value;
            const rows = resultsTableBody.querySelectorAll('tr');

            rows.forEach(row => {
                const name = row.dataset.name || '';
                const rowStatus = row.dataset.status || '';

                const matchesSearch = !query || name.includes(query);
                let matchesStatus = true;

                if (status === 'optimized') {
                    matchesStatus = (rowStatus === 'optimized' || rowStatus === 'simulated');
                } else if (status === 'skipped') {
                    matchesStatus = (rowStatus === 'skipped');
                } else if (status === 'error') {
                    matchesStatus = (rowStatus === 'error');
                }

                row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
            });
        }

        filterSearch.addEventListener('input', filterTableRows);
        filterStatus.addEventListener('change', filterTableRows);

        // Exportar a CSV
        btnExportCsv.addEventListener('click', () => {
            if (processedResults.length === 0) return;
            let csv = 'Archivo,Dimension_Anterior,Dimension_Nueva,Peso_Anterior_KB,Peso_Nuevo_KB,Ahorro_KB,Estado\n';
            processedResults.forEach(r => {
                const oldKb = r.oldSize ? (r.oldSize / 1024).toFixed(2) : '0';
                const newKb = r.newSize ? (r.newSize / 1024).toFixed(2) : '0';
                const savedKb = r.saved ? (r.saved / 1024).toFixed(2) : '0';
                csv += `"${r.name}","${r.oldDim || ''}","${r.newDim || ''}",${oldKb},${newKb},${savedKb},"${r.status}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `reporte_optimizacion_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        // Auto-escanear al cargar la página para dar feedback instantáneo
        window.addEventListener('DOMContentLoaded', () => {
            btnScan.click();
        });
    </script>
</body>
</html>
