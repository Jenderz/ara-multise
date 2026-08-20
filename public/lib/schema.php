
<?php
function checkAndMigrateDB($pdo) {
    try {
        $tables = [
            "products" => "CREATE TABLE IF NOT EXISTS `products` (
                `id` VARCHAR(255) PRIMARY KEY,
                `code` VARCHAR(255),
                `title` VARCHAR(255),
                `description` TEXT,
                `cost` FLOAT DEFAULT 0,
                `price` FLOAT DEFAULT 0,
                `sale_price` FLOAT DEFAULT 0,
                `images` LONGTEXT,
                `category` VARCHAR(255),
                `extra_categories` TEXT DEFAULT NULL,
                `is_visible` TINYINT(1) DEFAULT 1,
                `is_featured` TINYINT(1) DEFAULT 0,
                `variant_options` LONGTEXT,
                `variants` LONGTEXT,
                `created_at` BIGINT,
                `track_stock` TINYINT(1) DEFAULT 1,
                `min_stock` INT DEFAULT 5,
                `barcode_ean` VARCHAR(255)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            
            "orders" => "CREATE TABLE IF NOT EXISTS `orders` (
                `id` VARCHAR(255) PRIMARY KEY,
                `branch_id` INT DEFAULT 1,
                `customer_name` VARCHAR(255),
                `customer_phone` VARCHAR(255),
                `customer_address` TEXT,
                `items` LONGTEXT,
                `subtotal` FLOAT DEFAULT 0,
                `discount` FLOAT DEFAULT 0,
                `total` FLOAT DEFAULT 0,
                `status` VARCHAR(50) DEFAULT 'pending',
                `date` BIGINT,
                `payment_method` TEXT,
                `seller_id` VARCHAR(255),
                `seller_name` VARCHAR(255),
                `delivery_method` VARCHAR(50) DEFAULT 'pos',
                `pickup_branch_id` INT DEFAULT 0
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "customers" => "CREATE TABLE IF NOT EXISTS `customers` (
                `phone` VARCHAR(50) PRIMARY KEY,
                `name` VARCHAR(255),
                `cedula` VARCHAR(30) DEFAULT '',
                `address` TEXT,
                `total_spent` FLOAT DEFAULT 0,
                `order_count` INT DEFAULT 0,
                `last_order_date` BIGINT,
                `order_ids` LONGTEXT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "settings" => "CREATE TABLE IF NOT EXISTS `settings` (
                `setting_key` VARCHAR(255) PRIMARY KEY,
                `setting_value` LONGTEXT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "branches" => "CREATE TABLE IF NOT EXISTS `branches` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(255) NOT NULL,
                `address` TEXT,
                `is_active` TINYINT(1) DEFAULT 1
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "inventory" => "CREATE TABLE IF NOT EXISTS `inventory` (
                `product_id` VARCHAR(255) NOT NULL,
                `branch_id` INT NOT NULL,
                `stock` INT DEFAULT 0,
                `updated_at` BIGINT,
                PRIMARY KEY (`product_id`, `branch_id`)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "product_movements" => "CREATE TABLE IF NOT EXISTS `product_movements` (
                `id` VARCHAR(255) PRIMARY KEY,
                `product_id` VARCHAR(255),
                `branch_id` INT DEFAULT 1,
                `user_id` VARCHAR(255),
                `user_name` VARCHAR(255),
                `type` VARCHAR(50),
                `amount` INT,
                `stock_after` INT,
                `reference` TEXT,
                `date` BIGINT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "categories" => "CREATE TABLE IF NOT EXISTS `categories` (
                `id` VARCHAR(255) PRIMARY KEY,
                `name` VARCHAR(255),
                `image` TEXT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "coupons" => "CREATE TABLE IF NOT EXISTS `coupons` (
                `code` VARCHAR(50) PRIMARY KEY,
                `discount_type` VARCHAR(50),
                `value` FLOAT,
                `active` TINYINT(1) DEFAULT 1
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "push_subscriptions" => "CREATE TABLE IF NOT EXISTS `push_subscriptions` (
                `endpoint` VARCHAR(500) PRIMARY KEY,
                `p256dh` VARCHAR(255),
                `auth` VARCHAR(255),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "activity_logs" => "CREATE TABLE IF NOT EXISTS `activity_logs` (
                `id` VARCHAR(255) PRIMARY KEY,
                `user_id` VARCHAR(255),
                `user_name` VARCHAR(255),
                `user_role` VARCHAR(50),
                `action` VARCHAR(255),
                `details` TEXT,
                `ip_address` VARCHAR(50),
                `timestamp` BIGINT,
                INDEX (`timestamp`),
                INDEX (`user_id`)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        ];

        foreach ($tables as $sql) $pdo->exec($sql);

        // --- MIGRACIONES CRÍTICAS PARA ARREGLAR ERROR "OUT OF RANGE" ---
        // Forzamos el cambio de tipos de columna si fueron creados incorrectamente como INT
        $fixes = [
            "ALTER TABLE `orders` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `orders` MODIFY `date` BIGINT",
            "ALTER TABLE `products` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `product_movements` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `product_movements` MODIFY `date` BIGINT",
            "ALTER TABLE `customers` MODIFY `last_order_date` BIGINT"
        ];

        foreach ($fixes as $sql) {
            try {
                $pdo->exec($sql);
            } catch (Exception $e) {
                // Ignorar error si la columna ya es correcta o tabla no existe aún
            }
        }

        // Migración de Columnas Faltantes
        $columns_to_check = [
            'products' => [
                'track_stock'      => "TINYINT(1) DEFAULT 1",
                'min_stock'        => "INT DEFAULT 5",
                'barcode_ean'      => "VARCHAR(255)",
                'extra_categories' => "TEXT DEFAULT NULL",  // Multi-categoría
            ],
            'orders' => [
                'branch_id' => "INT DEFAULT 1", 
                'seller_id' => "VARCHAR(255)", 
                'seller_name' => "VARCHAR(255)",
                'subtotal' => "FLOAT DEFAULT 0",
                'discount' => "FLOAT DEFAULT 0",
                'delivery_method' => "VARCHAR(50) DEFAULT 'pos'",
                'pickup_branch_id' => "INT DEFAULT 0"
            ],
            'customers' => [
                'cedula' => "VARCHAR(30) DEFAULT ''"
            ]
        ];
        
        foreach($columns_to_check as $table => $cols) {
            foreach($cols as $col => $definition) {
                try {
                    $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $definition");
                } catch (Exception $e) { /* Ignorar si ya existe */ }
            }
        }

        // Sede Principal Default
        $stmt = $pdo->query("SELECT COUNT(*) FROM `branches`");
        if ($stmt && $stmt->fetchColumn() == 0) { 
            $pdo->exec("INSERT INTO `branches` (`id`, `name`, `address`, `is_active`) VALUES (1, 'Sede Principal', 'Matriz', 1)"); 
        }
    } catch (Exception $e) {
        error_log("Migración Error: " . $e->getMessage());
    }
}
?>
