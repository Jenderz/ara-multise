
<?php
function checkAndMigrateDB($pdo) {
    try {
        $tables = [
            "products" => "CREATE TABLE IF NOT EXISTS `products` (
                `id` VARCHAR(255) PRIMARY KEY,
                `code` VARCHAR(255),
                `title` VARCHAR(255),
                `description` TEXT,
                `cost` DECIMAL(12,2) DEFAULT 0,
                `price` DECIMAL(12,2) DEFAULT 0,
                `sale_price` DECIMAL(12,2) DEFAULT 0,
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
                `subtotal` DECIMAL(12,2) DEFAULT 0,
                `discount` DECIMAL(12,2) DEFAULT 0,
                `total` DECIMAL(12,2) DEFAULT 0,
                `status` VARCHAR(50) DEFAULT 'pending',
                `date` BIGINT,
                `payment_method` TEXT,
                `seller_id` VARCHAR(255),
                `seller_name` VARCHAR(255),
                `seller_commission` DECIMAL(12,2) DEFAULT 0,
                `commission_rate` DECIMAL(8,2) DEFAULT 0,
                `advisor_id` VARCHAR(255) DEFAULT NULL,
                `advisor_name` VARCHAR(255) DEFAULT NULL,
                `advisor_commission` DECIMAL(12,2) DEFAULT 0,
                `advisor_rate` DECIMAL(8,2) DEFAULT 0,
                `delivery_method` VARCHAR(50) DEFAULT 'pos',
                `pickup_branch_id` INT DEFAULT 0,
                `stock_deducted` TINYINT(1) DEFAULT 0,
                `coupon_code` VARCHAR(50) DEFAULT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "customers" => "CREATE TABLE IF NOT EXISTS `customers` (
                `phone` VARCHAR(50) PRIMARY KEY,
                `name` VARCHAR(255),
                `cedula` VARCHAR(30) DEFAULT '',
                `address` TEXT,
                `total_spent` DECIMAL(12,2) DEFAULT 0,
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
                `value` DECIMAL(12,2) DEFAULT 0,
                `active` TINYINT(1) DEFAULT 1
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",

            "push_subscriptions" => "CREATE TABLE IF NOT EXISTS `push_subscriptions` (
                `endpoint` VARCHAR(500) PRIMARY KEY,
                `p256dh` VARCHAR(255),
                `auth` VARCHAR(255),
                `branch_id` INT DEFAULT 1,
                `user_name` VARCHAR(100) DEFAULT NULL,
                `cart_items` TEXT DEFAULT NULL,
                `cart_updated_at` DATETIME NULL DEFAULT NULL,
                `cart_notified` TINYINT(1) DEFAULT 0,
                `last_active` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                `last_notified_at` DATETIME NULL DEFAULT NULL,
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

        // --- MIGRACIONES CRÍTICAS PARA ARREGLAR ERROR "OUT OF RANGE" Y PRECISIÓN DECIMAL ---
        // Forzamos el cambio de tipos de columna si fueron creados incorrectamente como INT o FLOAT
        $fixes = [
            "ALTER TABLE `orders` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `orders` MODIFY `date` BIGINT",
            "ALTER TABLE `orders` MODIFY `subtotal` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `orders` MODIFY `discount` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `orders` MODIFY `total` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `orders` MODIFY `seller_commission` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `orders` MODIFY `commission_rate` DECIMAL(8,2) DEFAULT 0",
            "ALTER TABLE `products` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `products` MODIFY `cost` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `products` MODIFY `price` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `products` MODIFY `sale_price` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `product_movements` MODIFY `id` VARCHAR(255)",
            "ALTER TABLE `product_movements` MODIFY `date` BIGINT",
            "ALTER TABLE `customers` MODIFY `last_order_date` BIGINT",
            "ALTER TABLE `customers` MODIFY `total_spent` DECIMAL(12,2) DEFAULT 0",
            "ALTER TABLE `coupons` MODIFY `value` DECIMAL(12,2) DEFAULT 0"
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
                'seller_commission' => "DECIMAL(12,2) DEFAULT 0",
                'commission_rate' => "DECIMAL(8,2) DEFAULT 0",
                'advisor_id' => "VARCHAR(255) DEFAULT NULL",
                'advisor_name' => "VARCHAR(255) DEFAULT NULL",
                'advisor_commission' => "DECIMAL(12,2) DEFAULT 0",
                'advisor_rate' => "DECIMAL(8,2) DEFAULT 0",
                'subtotal' => "DECIMAL(12,2) DEFAULT 0",
                'discount' => "DECIMAL(12,2) DEFAULT 0",
                'delivery_method' => "VARCHAR(50) DEFAULT 'pos'",
                'pickup_branch_id' => "INT DEFAULT 0",
                'stock_deducted' => "TINYINT(1) DEFAULT 0",
                'coupon_code' => "VARCHAR(50) DEFAULT NULL"
            ],
            'customers' => [
                'cedula' => "VARCHAR(30) DEFAULT ''"
            ],
            'push_subscriptions' => [
                'branch_id'        => "INT DEFAULT 1",
                'user_name'        => "VARCHAR(100) DEFAULT NULL",
                'cart_items'       => "TEXT DEFAULT NULL",
                'cart_updated_at'  => "DATETIME NULL DEFAULT NULL",
                'cart_notified'    => "TINYINT(1) DEFAULT 0",
                'last_active'      => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
                'last_notified_at' => "DATETIME NULL DEFAULT NULL"
            ]
        ];
        
        foreach($columns_to_check as $table => $cols) {
            foreach($cols as $col => $definition) {
                try {
                    $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $definition");
                } catch (Exception $e) { /* Ignorar si ya existe */ }
            }
        }

        // Índices para evitar Full Table Scans y acelerar consultas
        $indexes = [
            "CREATE INDEX idx_orders_branch_date ON `orders` (`branch_id`, `date`)",
            "CREATE INDEX idx_orders_status ON `orders` (`status`)",
            "CREATE INDEX idx_orders_date ON `orders` (`date`)",
            "CREATE INDEX idx_orders_customer_phone ON `orders` (`customer_phone`)",
            "CREATE INDEX idx_orders_advisor_id ON `orders` (`advisor_id`)",
            "CREATE INDEX idx_product_movements_prod_branch ON `product_movements` (`product_id`, `branch_id`)",
            "CREATE INDEX idx_product_movements_date ON `product_movements` (`date`)",
            "CREATE INDEX idx_products_category ON `products` (`category`)",
            "CREATE INDEX idx_products_barcode ON `products` (`barcode_ean`)",
            "CREATE INDEX idx_products_created_at ON `products` (`created_at`)",
            "CREATE INDEX idx_push_cart_abandoned ON `push_subscriptions` (`cart_updated_at`, `cart_notified`)",
            "CREATE INDEX idx_push_last_active ON `push_subscriptions` (`last_active`, `last_notified_at`)"
        ];
        foreach ($indexes as $idxSql) {
            try {
                $pdo->exec($idxSql);
            } catch (Exception $e) { /* Ignorar si el índice ya existe */ }
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
