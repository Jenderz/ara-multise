<?php
/**
 * LYBERATE - MÓDULO DE AUTENTICACIÓN Y SESIONES EN BACKEND
 * Proporciona tokens de sesión firmados con HMAC-SHA256, sin fuga de credenciales hacia el frontend.
 */

function getServerSecret($pdo)
{
    static $cachedSecret = null;
    if ($cachedSecret !== null) return $cachedSecret;

    try {
        $stmt = $pdo->prepare("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'app_secret' LIMIT 1");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        if (!empty($val) && strlen($val) >= 32) {
            $cachedSecret = $val;
            return $cachedSecret;
        }

        $newSecret = bin2hex(random_bytes(32));
        $stmtIns = $pdo->prepare("INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES ('app_secret', ?) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)");
        $stmtIns->execute([$newSecret]);
        $cachedSecret = $newSecret;
        return $cachedSecret;
    } catch (\Throwable $e) {
        return 'Lyberate_Enterprise_Secret_Key_2026_Secure';
    }
}

function base64UrlEncode($data)
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data)
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function generateSessionToken($user, $secret, $ttlSeconds = 86400)
{
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'id'          => $user['id'] ?? generateUniqueId(),
        'username'    => $user['username'] ?? '',
        'name'        => $user['name'] ?? '',
        'role'        => $user['role'] ?? 'seller',
        'branchId'    => intval($user['branchId'] ?? ($user['assignedBranchId'] ?? 1)),
        'permissions' => $user['permissions'] ?? [],
        'exp'         => time() + $ttlSeconds
    ]));

    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", $secret, true));
    return "$header.$payload.$signature";
}

function validateSessionToken($token, $secret)
{
    if (empty($token) || !is_string($token)) return null;

    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    list($header, $payload, $signature) = $parts;
    $expectedSig = base64UrlEncode(hash_hmac('sha256', "$header.$payload", $secret, true));

    if (!hash_equals($expectedSig, $signature)) return null;

    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data || !isset($data['exp']) || $data['exp'] < time()) {
        return null; // Token corrupto o expirado
    }

    return $data;
}

function getAuthUser($pdo)
{
    static $cachedUser = null;
    if ($cachedUser !== null) return $cachedUser;

    $authHeader = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) {
        $authHeader = $_SERVER['HTTP_X_ADMIN_TOKEN'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            $lower = strtolower($k);
            if ($lower === 'authorization' || $lower === 'x-admin-token') {
                $authHeader = $v;
                break;
            }
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            $lower = strtolower($k);
            if ($lower === 'authorization' || $lower === 'x-admin-token') {
                $authHeader = $v;
                break;
            }
        }
    }

    // Fallback por query param si los headers fueron removidos por proxy/WAF
    if (empty($authHeader) && !empty($_GET['auth_token'])) {
        $authHeader = $_GET['auth_token'];
    }

    if (empty($authHeader)) return null;

    $token = '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    } else {
        $token = trim($authHeader);
    }

    if (empty($token)) return null;

    $secret = getServerSecret($pdo);
    $cachedUser = validateSessionToken($token, $secret);
    return $cachedUser;
}

function handleLogin($pdo, $input)
{
    $username = trim($input['username'] ?? '');
    $password = strval($input['password'] ?? '');

    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Usuario y contraseña requeridos'], 400);
    }

    // 1. Obtener usuarios de la tabla settings
    $stmt = $pdo->prepare("SELECT `setting_value` FROM `settings` WHERE `setting_key` = 'users' LIMIT 1");
    $stmt->execute();
    $rawUsers = $stmt->fetchColumn();
    $users = safeJsonDecode($rawUsers);

    $inputHash = (strlen($password) === 64 && ctype_xdigit($password)) ? strtolower($password) : hash('sha256', $password);
    $foundUser = null;

    // Buscar en array de usuarios
    if (is_array($users)) {
        foreach ($users as $u) {
            $uName = strtolower(trim($u['username'] ?? ''));
            if ($uName === strtolower($username) && (!isset($u['active']) || $u['active'])) {
                $storedPass = strval($u['password'] ?? '');
                if ($storedPass === $inputHash || $storedPass === $password) {
                    $foundUser = $u;
                    break;
                }
            }
        }
    }

    // 2. Fallback de contraseñas maestras o admin legacy
    if (!$foundUser) {
        $stmtMaster = $pdo->prepare("SELECT `setting_key`, `setting_value` FROM `settings` WHERE `setting_key` IN ('adminPassword', 'masterPassword', 'sellerPassword')");
        $stmtMaster->execute();
        $legacyPasses = [];
        while ($r = $stmtMaster->fetch(PDO::FETCH_ASSOC)) {
            $legacyPasses[$r['setting_key']] = str_replace('"', '', trim($r['setting_value']));
        }

        if (strtolower($username) === 'admin' && !empty($legacyPasses['adminPassword'])) {
            $adminPass = $legacyPasses['adminPassword'];
            if ($adminPass === $inputHash || $adminPass === $password) {
                $foundUser = [
                    'id' => 'admin-master',
                    'username' => 'admin',
                    'name' => 'Administrador Principal',
                    'role' => 'admin',
                    'permissions' => ['all'],
                    'assignedBranchId' => 0
                ];
            }
        }
    }

    if (!$foundUser) {
        // Registrar intento fallido
        try {
            $pdo->prepare("INSERT INTO `activity_logs` (id, user_id, user_name, user_role, action, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                ->execute([generateUniqueId(), 'guest', $username, 'unauthenticated', 'login_failed', 'Intento de inicio de sesión fallido', $_SERVER['REMOTE_ADDR'] ?? '', time() * 1000]);
        } catch (\Throwable $e) {}

        jsonResponse(['error' => 'Credenciales inválidas'], 401);
    }

    // Generar Token
    $secret = getServerSecret($pdo);
    $token = generateSessionToken($foundUser, $secret, 86400); // 24 Horas

    // Registrar inicio de sesión exitoso
    try {
        $pdo->prepare("INSERT INTO `activity_logs` (id, user_id, user_name, user_role, action, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([generateUniqueId(), $foundUser['id'] ?? 'user', $foundUser['name'] ?? $foundUser['username'], $foundUser['role'] ?? 'user', 'login', 'Inicio de sesión exitoso en backend', $_SERVER['REMOTE_ADDR'] ?? '', time() * 1000]);
    } catch (\Throwable $e) {}

    // Limpiar password del objeto devuelto
    unset($foundUser['password']);

    jsonResponse([
        'status' => 'success',
        'token'  => $token,
        'user'   => $foundUser
    ]);
}
