<?php
// lib/logs.php

function handleGetLogs($pdo)
{
    $authUser = getAuthUser($pdo);
    if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
        jsonResponse(['error' => 'No autorizado. Se requiere rol de administrador para consultar registros de auditoría.'], 403);
    }

    // Parámetros de Paginación y Búsqueda
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, intval($_GET['limit'] ?? 50));
    $offset = ($page - 1) * $limit;

    $search = $_GET['search'] ?? '';
    $userId = $_GET['user_id'] ?? ($_GET['userId'] ?? '');

    $where = ["1=1"];
    $params = [];

    // Filtros
    if (!empty($search)) {
        $where[] = "(user_name LIKE :s OR action LIKE :s OR details LIKE :s)";
        $params[':s'] = "%$search%";
    }

    if (!empty($userId)) {
        $where[] = "user_id = :u";
        $params[':u'] = $userId;
    }

    $whereSql = implode(" AND ", $where);

    // Consulta de Datos
    $sql = "SELECT * FROM `activity_logs` 
            WHERE $whereSql 
            ORDER BY `timestamp` DESC 
            LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Consulta de Conteo Total
    $countSql = "SELECT COUNT(*) FROM `activity_logs` WHERE $whereSql";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = $stmtCount->fetchColumn();

    // Normalización defensiva para soportar camelCase (TypeScript) y snake_case (SQL nativo)
    $formatted = array_map(function ($row) {
        return [
            'id' => $row['id'] ?? '',
            'userId' => $row['user_id'] ?? '',
            'userName' => $row['user_name'] ?? 'Sistema',
            'userRole' => $row['user_role'] ?? 'system',
            'action' => $row['action'] ?? 'other',
            'details' => $row['details'] ?? '',
            'ipAddress' => $row['ip_address'] ?? '',
            'timestamp' => isset($row['timestamp']) ? (int)$row['timestamp'] : (time() * 1000),
            // Compatibilidad retroactiva con componentes que consumen snake_case
            'user_id' => $row['user_id'] ?? '',
            'user_name' => $row['user_name'] ?? 'Sistema',
            'user_role' => $row['user_role'] ?? 'system',
            'ip_address' => $row['ip_address'] ?? '',
        ];
    }, $data);

    jsonResponse([
        'data' => $formatted,
        'pagination' => [
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
            'pages' => max(1, (int)ceil($total / $limit))
        ]
    ]);
}

function handleLogActivity($pdo, $input)
{
    if (empty($input['userId']) || empty($input['action'])) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $id = uniqid('log_');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    $stmt = $pdo->prepare("INSERT INTO `activity_logs` 
        (id, user_id, user_name, user_role, action, details, ip_address, timestamp) 
        VALUES (:id, :uid, :uname, :role, :action, :details, :ip, :ts)");

    $stmt->execute([
        ':id' => $id,
        ':uid' => $input['userId'],
        ':uname' => $input['userName'] ?? 'Unknown',
        ':role' => $input['userRole'] ?? 'unknown',
        ':action' => $input['action'],
        ':details' => is_array($input['details']) ? json_encode($input['details']) : ($input['details'] ?? ''),
        ':ip' => $ip,
        ':ts' => time() * 1000 // JS timestamp (ms)
    ]);

    jsonResponse(['status' => 'logged', 'id' => $id]);
}

function handleClearLogs($pdo)
{
    $authUser = getAuthUser($pdo);
    if (!$authUser || ($authUser['role'] !== 'admin' && $authUser['role'] !== 'master')) {
        jsonResponse(['error' => 'No autorizado. Se requiere rol de administrador para vaciar registros de auditoría.'], 403);
    }

    $pdo->exec("TRUNCATE TABLE `activity_logs`");
    jsonResponse(['status' => 'success']);
}
