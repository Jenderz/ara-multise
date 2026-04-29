<?php
require_once 'lib/config.php';
header('Content-Type: text/plain');

$targetId = '28l173kvf'; // ID taken from user logs

try {
    $pdo = getDBConnection();
    echo "--- CHECKING INVENTORY FOR ID: $targetId ---\n";

    // Check Inventory Table
    $stmt = $pdo->prepare("SELECT * FROM inventory WHERE product_id = ?");
    $stmt->execute([$targetId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "INVENTORY TABLE RECORDS:\n";
    if (empty($rows)) {
        echo "No records found in `inventory` table.\n";
    } else {
        foreach ($rows as $r) {
            echo "Branch: {$r['branch_id']} | Stock: {$r['stock']} | Updated: " . date('Y-m-d H:i:s', $r['updated_at']) . "\n";
        }
    }

    // Check Products Table (Legacy JSON)
    echo "\n--- CHECKING PARENT PRODUCT ---\n";
    $stmtP = $pdo->prepare("SELECT id, title, variants FROM products WHERE variants LIKE ?");
    $stmtP->execute(["%$targetId%"]);
    $products = $stmtP->fetchAll(PDO::FETCH_ASSOC);

    foreach ($products as $p) {
        echo "Parent ID: {$p['id']} | Title: {$p['title']}\n";
        $vars = json_decode($p['variants'], true);
        foreach ($vars as $v) {
            if ($v['id'] == $targetId) {
                echo "Legacy JSON Stock: {$v['stock']}\n";
            }
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
