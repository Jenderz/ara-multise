<?php

/**
 * ARA ECOMMERCE V 2.0 - WEB PUSH NATIVE SENDER (RFC 8291 + RFC 8292)
 *
 * Motor autosuficiente de notificaciones Web Push para cPanel.
 * No requiere Composer ni dependencias externas: utiliza exclusivamente
 * OpenSSL y cURL nativos de PHP (compatibles con PHP 7.4, 8.0, 8.1, 8.2, 8.3).
 */

class WebPushSender
{
    // Par de llaves VAPID generado para ARA E-commerce (Curva NIST P-256 / prime256v1)
    const DEFAULT_VAPID_PUBLIC_KEY = 'BMS4ALXFLZGF2W_KYT9Gf8ZbmA8r4RjyEgyikAZO3j56is92_0XyddxO75G9VWDBY9wfG3YUUPPawtYdr-0GpFI';

    const DEFAULT_VAPID_PRIVATE_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgZpU4xSAAXCrr2lUX\nIducgnHS9Fj2av3+/pcLGeF6+UahRANCAATEuAC1xS2RhdlvymE/Rn/GW5gPK+EY\n8hIMopAGTt4+eorPdv9F8nXcTu+RvVVgwWPcHxt2FFDz2sLWHa/tBqRS\n-----END PRIVATE KEY-----\n";

    const DEFAULT_SUBJECT = 'mailto:notificaciones@ara.com';

    /**
     * Obtiene la clave pública VAPID (permite sobreescritura en config.php si existe).
     */
    public static function getPublicKey()
    {
        return defined('VAPID_PUBLIC_KEY') ? VAPID_PUBLIC_KEY : self::DEFAULT_VAPID_PUBLIC_KEY;
    }

    /**
     * Obtiene la clave privada VAPID en PEM (permite sobreescritura en config.php si existe).
     */
    public static function getPrivateKeyPem()
    {
        return defined('VAPID_PRIVATE_KEY_PEM') ? VAPID_PRIVATE_KEY_PEM : self::DEFAULT_VAPID_PRIVATE_KEY_PEM;
    }

    public static function getSubject()
    {
        return defined('VAPID_SUBJECT') ? VAPID_SUBJECT : self::DEFAULT_SUBJECT;
    }

    /**
     * Codifica a Base64 URL-Safe sin padding '='
     */
    public static function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Decodifica Base64 URL-Safe
     */
    public static function base64UrlDecode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    /**
     * Convierte una firma ASN.1 DER generada por OpenSSL a formato JOSE IEEE P1363 (R||S de 64 bytes)
     */
    private static function derToJoseSignature($der)
    {
        if (strlen($der) < 8 || ord($der[0]) !== 0x30) {
            return false;
        }

        $offset = 2;
        if (ord($der[1]) & 0x80) {
            $offset += (ord($der[1]) & 0x7f);
        }

        if (ord($der[$offset++]) !== 0x02) return false;
        $rLen = ord($der[$offset++]);
        $r = substr($der, $offset, $rLen);
        $offset += $rLen;

        if (ord($der[$offset++]) !== 0x02) return false;
        $sLen = ord($der[$offset++]);
        $s = substr($der, $offset, $sLen);

        // Limpiar ceros sobrantes de ASN.1 y rellenar exactamente a 32 bytes cada componente
        $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
        $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);

        return $r . $s;
    }

    /**
     * Genera el token JWT VAPID (RFC 8292) firmado con ES256
     */
    public static function generateVapidJwt($endpoint)
    {
        $parts = parse_url($endpoint);
        if (!$parts || !isset($parts['scheme']) || !isset($parts['host'])) {
            return null;
        }

        $audience = $parts['scheme'] . '://' . $parts['host'];
        // Para endpoints heredados de Google GCM, el aud DEBE ser https://fcm.googleapis.com
        if ($parts['host'] === 'android.googleapis.com') {
            $audience = 'https://fcm.googleapis.com';
        } elseif (!empty($parts['port']) && !(($parts['scheme'] === 'https' && $parts['port'] == 443) || ($parts['scheme'] === 'http' && $parts['port'] == 80))) {
            $audience .= ':' . $parts['port'];
        }

        $header = ['typ' => 'JWT', 'alg' => 'ES256'];
        $payload = [
            'aud' => $audience,
            'exp' => time() + 43200, // 12 horas
            'sub' => self::getSubject()
        ];

        $encodedHeader = self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $encodedPayload = self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $signInput = $encodedHeader . '.' . $encodedPayload;

        $privKey = openssl_pkey_get_private(self::getPrivateKeyPem());
        if (!$privKey) {
            error_log("[WebPush] No se pudo cargar la clave privada VAPID.");
            return null;
        }

        $signatureDer = '';
        $success = openssl_sign($signInput, $signatureDer, $privKey, OPENSSL_ALGO_SHA256);
        if (!$success) {
            error_log("[WebPush] Error al firmar JWT con OpenSSL.");
            return null;
        }

        $joseSig = self::derToJoseSignature($signatureDer);
        if (!$joseSig) {
            error_log("[WebPush] Error al convertir firma ASN.1 a JOSE.");
            return null;
        }

        return $signInput . '.' . self::base64UrlEncode($joseSig);
    }

    /**
     * Encripta el payload siguiendo la especificación RFC 8291 (aes128gcm)
     */
    public static function encryptPayload($payloadJson, $p256dhBase64, $authBase64)
    {
        $clientPubKey = self::base64UrlDecode($p256dhBase64);
        $clientAuth   = self::base64UrlDecode($authBase64);

        if (strlen($clientPubKey) !== 65 || strlen($clientAuth) < 16) {
            return null;
        }

        // 1. Convertir la clave pública del cliente (65 bytes) a PEM SPKI P-256
        $spkiHeader = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');
        $clientPem = "-----BEGIN PUBLIC KEY-----\n" .
            chunk_split(base64_encode($spkiHeader . $clientPubKey), 64, "\n") .
            "-----END PUBLIC KEY-----\n";

        // 2. Generar par de claves efímeras locales EC P-256
        $localResource = openssl_pkey_new([
            'curve_name' => 'prime256v1',
            'private_key_type' => OPENSSL_KEYTYPE_EC,
        ]);

        if (!$localResource) {
            return null;
        }

        $localDetails = openssl_pkey_get_details($localResource);
        if (!$localDetails || empty($localDetails['ec']['x']) || empty($localDetails['ec']['y'])) {
            return null;
        }

        // Normalizar coordenadas X e Y a exactamente 32 bytes cada una (relleno a la izquierda con 0x00)
        $localX = str_pad($localDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT);
        $localY = str_pad($localDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);
        $localPubKey = "\x04" . $localX . $localY;

        if (strlen($localPubKey) !== 65) {
            return null;
        }

        // 3. Obtener secreto compartido mediante ECDH
        if (!function_exists('openssl_pkey_derive')) {
            return null;
        }

        $sharedSecret = openssl_pkey_derive($clientPem, $localResource);
        if (!$sharedSecret) {
            return null;
        }
        $sharedSecret = str_pad($sharedSecret, 32, "\x00", STR_PAD_LEFT);

        // 4. Derivar Pseudo-Random Key (PRK) con HKDF
        $context = "WebPush: info\0" . $clientPubKey . $localPubKey;
        $prk = hash_hkdf('sha256', $sharedSecret, 32, $context, $clientAuth);

        // 5. Generar Salt de 16 bytes y derivar CEK (16 bytes) y Nonce (12 bytes)
        $salt = random_bytes(16);
        $cek   = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\0", $salt);

        // 6. Cifrar con AES-128-GCM (el padding delimiter es 0x02 según RFC 8291 Section 5)
        $record = $payloadJson . "\x02";
        $tag = '';
        $ciphertext = openssl_encrypt($record, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);

        if ($ciphertext === false) {
            return null;
        }

        // 7. Empaquetar cuerpo RFC 8291: Salt (16) + RS (4) + idlen (1) + localPubKey (65) + ciphertext + tag (16)
        $recordSize = pack('N', 4096);
        $idLen = chr(65);
        $body = $salt . $recordSize . $idLen . $localPubKey . $ciphertext . $tag;

        return $body;
    }

    /**
     * Envía una notificación Web Push a un endpoint específico.
     * Retorna array con ['success' => bool, 'statusCode' => int, 'error' => string]
     */
    public static function sendNotification($pdo, $endpoint, $p256dh, $auth, $payloadArray)
    {
        $jwt = self::generateVapidJwt($endpoint);
        if (!$jwt) {
            return ['success' => false, 'statusCode' => 0, 'error' => 'No se pudo generar el token JWT'];
        }

        $headers = [
            'Authorization: vapid t=' . $jwt . ', k=' . self::getPublicKey(),
            'Crypto-Key: p256ecdsa=' . self::getPublicKey(),
            'TTL: 86400',
            'Urgency: high'
        ];

        $payloadJson = json_encode($payloadArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $encryptedBody = null;

        if (!empty($p256dh) && !empty($auth)) {
            $encryptedBody = self::encryptPayload($payloadJson, $p256dh, $auth);
        }

        if ($encryptedBody !== null) {
            $headers[] = 'Content-Type: application/octet-stream';
            $headers[] = 'Content-Encoding: aes128gcm';
            $postFields = $encryptedBody;
        } else {
            // Push sin payload (despierta al Service Worker para que muestre la notificación por defecto)
            $headers[] = 'Content-Length: 0';
            $postFields = '';
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $endpoint,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postFields,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true
        ]);

        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError  = curl_error($ch);
        curl_close($ch);

        // 201 Created = Entregado con éxito al push service
        if ($statusCode === 201 || $statusCode === 200) {
            return ['success' => true, 'statusCode' => $statusCode, 'error' => null];
        }

        // 404 / 410 = La suscripción ya no existe o fue revocada por el usuario
        if ($statusCode === 404 || $statusCode === 410) {
            try {
                $stmt = $pdo->prepare("DELETE FROM `push_subscriptions` WHERE `endpoint` = ?");
                $stmt->execute([$endpoint]);
            } catch (Exception $e) {}
            return ['success' => false, 'statusCode' => $statusCode, 'error' => 'Suscripción expirada (eliminada de la BD)'];
        }

        return [
            'success' => false,
            'statusCode' => $statusCode,
            'error' => $curlError ?: ("HTTP " . $statusCode . ": " . substr($response, 0, 150))
        ];
    }

    /**
     * Envía una notificación masiva (Broadcast) a todas las suscripciones activas.
     */
    public static function broadcast($pdo, $payloadArray, $branchId = null)
    {
        try {
            if ($branchId) {
                $stmt = $pdo->prepare("SELECT endpoint, p256dh, auth FROM `push_subscriptions` WHERE branch_id = ? OR branch_id IS NULL");
                $stmt->execute([$branchId]);
            } else {
                $stmt = $pdo->query("SELECT endpoint, p256dh, auth FROM `push_subscriptions`");
            }

            $subs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $total = count($subs);
            $successCount = 0;
            $failedCount = 0;

            foreach ($subs as $sub) {
                $res = self::sendNotification($pdo, $sub['endpoint'], $sub['p256dh'], $sub['auth'], $payloadArray);
                if ($res['success']) {
                    $successCount++;
                } else {
                    $failedCount++;
                }
            }

            return [
                'total' => $total,
                'success' => $successCount,
                'failed' => $failedCount
            ];
        } catch (Exception $e) {
            return ['total' => 0, 'success' => 0, 'failed' => 0, 'error' => $e->getMessage()];
        }
    }

    /**
     * Obtiene dinámicamente el título o nombre de la tienda configurado en `settings`
     */
    public static function getStoreName($pdo)
    {
        try {
            $stmt = $pdo->query("SELECT setting_value FROM `settings` WHERE setting_key IN ('storeName', 'store_name', 'seoTitle') ORDER BY FIELD(setting_key, 'storeName', 'store_name', 'seoTitle') LIMIT 1");
            if ($stmt) {
                $val = $stmt->fetchColumn();
                if ($val !== false && $val !== null) {
                    $decoded = json_decode($val, true);
                    $name = (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) ? $decoded : $val;
                    if (!empty(trim(strval($name)))) {
                        return trim(strval($name));
                    }
                }
            }
        } catch (Exception $e) {}

        return 'Tienda Virtual';
    }

    /**
     * Obtiene las plantillas de mensajes automáticos desde settings o las predeterminadas
     */
    public static function getTemplates($pdo)
    {
        $defaults = [
            'offer' => [
                'title' => "🔥 ¡Oferta Relámpago en {tienda}!",
                'body'  => "{producto} con {descuento}% de descuento. ¡Aprovecha antes de que se agote!"
            ],
            'coupon' => [
                'title' => "🎟️ ¡Nuevo Cupón en {tienda}!",
                'body'  => "Usa el código {cupon} para obtener {descuento} en tu próxima compra."
            ],
            'category' => [
                'title' => "✨ ¡Nueva Categoría en {tienda}!",
                'body'  => "Descubre nuestra nueva sección: {categoria}. ¡Explora todos los productos disponibles!"
            ],
            'abandonedCart' => [
                'title' => "🛒 ¡Tus compras en {tienda} te esperan!",
                'body'  => "{saludo}Dejaste '{producto}' en tu carrito. Completa tu pedido antes de que se agoten."
            ],
            'inactiveUsers' => [
                'title' => "✨ ¡Te extrañamos en {tienda}!",
                'body'  => "{saludo}Tenemos nuevos productos y ofertas esperándote en la tienda hoy."
            ]
        ];

        try {
            $stmt = $pdo->prepare("SELECT setting_value FROM `settings` WHERE setting_key = 'pushTemplates' LIMIT 1");
            $stmt->execute();
            $val = $stmt->fetchColumn();
            if (!empty($val)) {
                $saved = json_decode($val, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($saved)) {
                    foreach ($defaults as $key => $tpl) {
                        if (!empty($saved[$key]['title'])) {
                            $defaults[$key]['title'] = $saved[$key]['title'];
                        }
                        if (!empty($saved[$key]['body'])) {
                            $defaults[$key]['body'] = $saved[$key]['body'];
                        }
                    }
                }
            }
        } catch (Exception $e) {}

        return $defaults;
    }

    /**
     * Reemplaza variables {nombre} en una plantilla de texto
     */
    public static function interpolate($templateStr, $vars)
    {
        $search = [];
        $replace = [];
        foreach ($vars as $k => $v) {
            $search[] = '{' . $k . '}';
            $replace[] = strval($v);
        }
        return str_replace($search, $replace, $templateStr);
    }

    /**
     * AUTOMATIZACIÓN 1: Notificar oferta nueva de producto
     */
    public static function notifyNewOffer($pdo, $productTitle, $salePrice, $originalPrice, $productId, $branchId = null)
    {
        $templates = self::getTemplates($pdo);
        $storeName = self::getStoreName($pdo);
        $discountPercent = $originalPrice > 0 ? round((($originalPrice - $salePrice) / $originalPrice) * 100) : 0;
        
        $vars = [
            'tienda'    => $storeName,
            'producto'  => $productTitle,
            'descuento' => $discountPercent
        ];

        $title = self::interpolate($templates['offer']['title'], $vars);
        $body  = self::interpolate($templates['offer']['body'], $vars);
        
        $payload = [
            'title' => $title,
            'body'  => $body,
            'icon'  => './icon.png',
            'url'   => "./?product={$productId}"
        ];

        return self::broadcast($pdo, $payload, $branchId);
    }

    /**
     * AUTOMATIZACIÓN 2: Notificar nuevo cupón de descuento
     */
    public static function notifyNewCoupon($pdo, $couponCode, $discountText)
    {
        $templates = self::getTemplates($pdo);
        $storeName = self::getStoreName($pdo);

        $vars = [
            'tienda'    => $storeName,
            'cupon'     => $couponCode,
            'descuento' => $discountText
        ];

        $title = self::interpolate($templates['coupon']['title'], $vars);
        $body  = self::interpolate($templates['coupon']['body'], $vars);

        $payload = [
            'title' => $title,
            'body'  => $body,
            'icon'  => './icon.png',
            'url'   => './'
        ];

        return self::broadcast($pdo, $payload);
    }

    /**
     * AUTOMATIZACIÓN 3: Notificar nueva categoría creada
     */
    public static function notifyNewCategory($pdo, $categoryName, $categoryId, $categoryImage = null)
    {
        $templates = self::getTemplates($pdo);
        $storeName = self::getStoreName($pdo);

        $vars = [
            'tienda'    => $storeName,
            'categoria' => $categoryName
        ];

        $title = self::interpolate($templates['category']['title'], $vars);
        $body  = self::interpolate($templates['category']['body'], $vars);

        $payload = [
            'title' => $title,
            'body'  => $body,
            'icon'  => !empty($categoryImage) ? $categoryImage : './icon.png',
            'url'   => "./?category=" . urlencode($categoryName)
        ];

        return self::broadcast($pdo, $payload);
    }

    /**
     * AUTOMATIZACIÓN 4: Recordatorio de Carrito Abandonado (Ejecutado por Cron)
     * Busca suscripciones con carrito actualizado hace más de 2 horas y menos de 48 horas,
     * que no hayan sido notificadas aún (cart_notified = 0).
     */
    public static function sendAbandonedCartReminders($pdo)
    {
        $notified = 0;
        $templates = self::getTemplates($pdo);
        $storeName = self::getStoreName($pdo);
        try {
            $stmt = $pdo->query("SELECT endpoint, p256dh, auth, cart_items, user_name 
                FROM `push_subscriptions` 
                WHERE `cart_items` IS NOT NULL 
                  AND `cart_items` != '' 
                  AND `cart_items` != '[]'
                  AND `cart_notified` = 0
                  AND `cart_updated_at` <= (NOW() - INTERVAL 2 HOUR)
                  AND `cart_updated_at` >= (NOW() - INTERVAL 48 HOUR)
                LIMIT 50");

            $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($candidates as $row) {
                $cart = json_decode($row['cart_items'], true);
                if (empty($cart) || !is_array($cart)) continue;

                $count = count($cart);
                $firstItemName = $cart[0]['productTitle'] ?? 'productos';
                if ($count > 1) {
                    $firstItemName .= " y " . ($count - 1) . " más";
                }
                $greeting = !empty($row['user_name']) ? "¡Hola {$row['user_name']}! " : "";

                $vars = [
                    'tienda'   => $storeName,
                    'producto' => $firstItemName,
                    'saludo'   => $greeting
                ];

                $title = self::interpolate($templates['abandonedCart']['title'], $vars);
                $body  = self::interpolate($templates['abandonedCart']['body'], $vars);

                $res = self::sendNotification($pdo, $row['endpoint'], $row['p256dh'], $row['auth'], [
                    'title' => $title,
                    'body'  => $body,
                    'icon'  => './icon.png',
                    'url'   => './?open_cart=1'
                ]);

                if ($res['success']) {
                    $updateStmt = $pdo->prepare("UPDATE `push_subscriptions` SET `cart_notified` = 1, `last_notified_at` = NOW() WHERE `endpoint` = ?");
                    $updateStmt->execute([$row['endpoint']]);
                    $notified++;
                }
            }
        } catch (Exception $e) {
            error_log("[Cron Push] Error en sendAbandonedCartReminders: " . $e->getMessage());
        }

        return $notified;
    }

    /**
     * AUTOMATIZACIÓN 5: Clientes Inactivos (Ejecutado por Cron)
     * Usuarios que llevan más de 15 días sin interactuar con la app, y no han recibido
     * push en los últimos 15 días.
     */
    public static function sendInactiveUserReminders($pdo, $inactiveDays = 15)
    {
        $notified = 0;
        $days = max(1, intval($inactiveDays));
        $templates = self::getTemplates($pdo);
        $storeName = self::getStoreName($pdo);
        try {
            $stmt = $pdo->prepare("SELECT endpoint, p256dh, auth, user_name 
                FROM `push_subscriptions` 
                WHERE `last_active` <= (NOW() - INTERVAL ? DAY)
                  AND (`last_notified_at` IS NULL OR `last_notified_at` <= (NOW() - INTERVAL ? DAY))
                LIMIT 50");
            $stmt->execute([$days, $days]);

            $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($candidates as $row) {
                $greeting = !empty($row['user_name']) ? "¡Hola {$row['user_name']}! " : "";
                
                $vars = [
                    'tienda' => $storeName,
                    'saludo' => $greeting
                ];

                $title = self::interpolate($templates['inactiveUsers']['title'], $vars);
                $body  = self::interpolate($templates['inactiveUsers']['body'], $vars);

                $res = self::sendNotification($pdo, $row['endpoint'], $row['p256dh'], $row['auth'], [
                    'title' => $title,
                    'body'  => $body,
                    'icon'  => './icon.png',
                    'url'   => './'
                ]);

                if ($res['success']) {
                    $updateStmt = $pdo->prepare("UPDATE `push_subscriptions` SET `last_notified_at` = NOW() WHERE `endpoint` = ?");
                    $updateStmt->execute([$row['endpoint']]);
                    $notified++;
                }
            }
        } catch (Exception $e) {
            error_log("[Cron Push] Error en sendInactiveUserReminders: " . $e->getMessage());
        }

        return $notified;
    }
}
