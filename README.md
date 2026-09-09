# 🛍️ Ara E-commerce & POS Multisede — Manual Técnico y de Arquitectura Senior

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.4.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PHP-8.0+-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP" />
  <img src="https://img.shields.io/badge/MySQL-MariaDB-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
</div>

---

## 📖 Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Estructura del Proyecto y Módulos](#2-estructura-del-proyecto-y-módulos)
3. [Modelo de Datos y Base de Datos](#3-modelo-de-datos-y-base-de-datos)
4. [Motor de Integridad Transaccional de Inventario](#4-motor-de-integridad-transaccional-de-inventario)
5. [Arquitectura y Reglas del Sistema Multisede](#5-arquitectura-y-reglas-del-sistema-multisede)
6. [Punto de Venta (POS) Profesional](#6-punto-de-venta-pos-profesional)
7. [Kardex y Trazabilidad (`product_movements`)](#7-kardex-y-trazabilidad-product_movements)
8. [Guía de Configuración, Despliegue y Troubleshooting](#8-guía-de-configuración-despliegue-y-troubleshooting)

---

## 1. Visión General del Sistema

**Ara E-commerce Multisede** es una solución enterprise para comercio minorista y mayorista omnicanal. Combina:
- **Tienda Web PWA** de alto rendimiento orientada a conversión y pedidos por WhatsApp/Delivery.
- **Punto de Venta (POS)** ágil para cajeros y mostradores con atajos de teclado e impresión térmica.
- **Backoffice Administrativo** con analítica, gestión de existencias, compras, mermas y catálogo.
- **Backend API Gateway modular en PHP 8+** con bloqueo pesimista de concurrencia y tolerancia a fallos.

---

## 2. Estructura del Proyecto y Módulos

```
c:\Users\pc\Documents\ARA\
├── components/                  # Componentes de Interfaz de Usuario
│   ├── admin/                   # Módulos del Panel Administrativo
│   │   ├── pos/                 # POS: POSLayout, POSCart, POSTicketModal, POSProductGrid
│   │   ├── products/            # Productos: ProductFormModal, StockAdjustmentModal, StockBreakdownModal
│   │   ├── InventoryHub.tsx     # Hub central (Productos, Categorías, Analítica)
│   │   ├── InventoryAnalyticsModule.tsx # Métricas de rotación y valorización
│   │   └── OrdersModule.tsx     # Gestión y edición de pedidos
│   ├── CartDrawer.tsx           # Carrito de compras web
│   └── UIComponents.tsx         # Sistema de diseño y átomos UI
├── context/                     # Gestión de Estado Reactivo
│   ├── StoreContext.tsx         # Estado general de tienda y sedes
│   ├── ProductContext.tsx       # Catálogo, mutaciones optimistas y stock local
│   ├── POSContext.tsx           # Carrito POS, pagos, atajos y órdenes en espera
│   ├── CartContext.tsx          # Carrito web y persistencia de pedidos
│   └── AuthContext.tsx          # Autenticación, roles (Admin/Vendedor/Master) y auditoría
├── services/
│   └── api.ts                   # Cliente API fetch con anti-caché y header X-Branch-ID
├── public/                      # Backend PHP y API Gateway
│   ├── api.php                  # Entrada principal y enrutador modular
│   └── lib/
│       ├── config.example.php   # Plantilla de credenciales y helpers JSON/UUID
│       ├── config.php           # Configuración activa del entorno (ignorado en Git)
│       ├── schema.php           # Esquema DDL, migraciones e índices
│       ├── write.php            # Mutaciones: órdenes, productos, borrados y ajustes
│       ├── read.php             # Consultas: catálogo, hidratación de variantes y pedidos
│       └── inventory.php        # Traspasos entre sedes, ajustes de stock y kardex
├── types.ts                     # Definiciones de Tipos TypeScript
└── config.ts                    # Constantes frontend (API_URL, DEFAULT_IMAGE)
```

---

## 3. Modelo de Datos y Base de Datos

El motor de persistencia utiliza MySQL/MariaDB bajo InnoDB. El archivo `public/lib/schema.php` gestiona la creación y migración automática:

### ⚠️ Regla de Oro del Inventario
> La tabla `products` **NO almacena las existencias físicas en una columna**. 
> La única fuente de verdad para el stock reside en la tabla `inventory` indexada por `(product_id, branch_id)`.

### Tablas Principales

| Tabla | Clave Primaria | Propósito y Particularidades |
| :--- | :--- | :--- |
| `products` | `id VARCHAR(255)` | Catálogo maestro. Contiene metadatos, fotos y la estructura JSON en `variants`. |
| `inventory` | `(product_id, branch_id)` | **Existencia real.** Para productos simples, `product_id` es el ID del producto. Para variantes, `product_id` es el ID único de la variante. Además, el producto padre posee una fila que representa la suma consolidada de sus variantes en esa sede. |
| `product_movements` | `id VARCHAR(255)` | Kardex de auditoría inmutable (`entry`, `exit`, `sale`, `adjustment`, `transfer_in`, `transfer_out`). Registra `stock_after` y usuario. |
| `orders` | `id VARCHAR(255)` | Pedidos web y POS. Incluye `branch_id`, `items` (JSON), `status` y el flag crítico `stock_deducted TINYINT(1) DEFAULT 0`. |
| `branches` | `id INT AUTO_INCREMENT` | Sucursales físicas activas. La Sede 1 es la sede principal por defecto. |
| `customers` | `phone VARCHAR(50)` | Directorio de clientes con historial de consumo acumulado. |
| `settings` | `setting_key VARCHAR(255)` | Pares clave-valor de configuración (usuarios, monedas, pasarelas). |

### Índices de Alto Rendimiento Configurados
- `orders(branch_id, date)` y `orders(status)`: Aceleración de filtros en panel y listados.
- `product_movements(product_id, branch_id)` y `product_movements(date)`: Trazabilidad de kardex en milisegundos.
- `products(category)` y `products(barcode_ean)`: Búsqueda rápida y lecturas con pistola de código de barras.

---

## 4. Motor de Integridad Transaccional de Inventario

El archivo `public/lib/write.php` implementa las reglas de negocio más críticas de la plataforma:

### A. Bloqueo Pesimista contra Carreras de Condición (`FOR UPDATE`)
Cuando se procesa o cobra una orden en `handleSaveOrder`:
1. Se inicia una transacción atómica con `$pdo->beginTransaction()`.
2. Se consulta la orden con `SELECT ... FOR UPDATE` para serializar peticiones concurrentes y evitar que dos cajeros o procesos cobren la misma orden simultáneamente.
3. Se verifica la existencia real con `SELECT stock FROM inventory WHERE ... FOR UPDATE`.

### B. Descuento Atómico Estricto
El descuento se ejecuta mediante sentencias condicionales que impiden números negativos:
```sql
UPDATE `inventory` 
SET `stock` = `stock` - :qty, `updated_at` = :time 
WHERE `product_id` = :targetId AND `branch_id` = :branchId AND `stock` >= :qty;
```
Si `rowCount() === 0`, significa que no hay unidades suficientes o hubo un conflicto; la transacción hace `ROLLBACK` y retorna HTTP 409.

### C. Ciclo de Vida del Pedido y Bandera de Idempotencia (`stock_deducted`)
- **Venta Web / WhatsApp:** Nace con estado `pending`. **NO** descuenta stock hasta que un administrador confirma el pedido pasando a `completed`.
- **Venta POS:** Nace con estado `completed` y `processStock: true`. Descuenta inmediatamente en 0ms y marca `stock_deducted = 1`.
- **Edición de Pedidos:** Si un pedido ya tiene `stock_deducted = 1` y se modifican sus productos, el sistema revierte los ítems anteriores y descuenta los nuevos sin duplicar rebajas.
- **Anulación / Cancelación:** Si la orden cancelada tenía `stock_deducted = 1`, devuelve automáticamente las unidades a la sede de origen, registra la entrada en `product_movements` y marca `stock_deducted = 0`.
- **Eliminación (`handleDelete`):** Si un administrador elimina una orden completada, el backend restituye el stock a la sede antes de eliminar el registro físico.
- **Traslado de Sede:** Si una orden completada cambia de sede (ej. de Sede 1 a Sede 2), revierte el stock en la Sede 1 y lo descuenta con chequeo en la Sede 2.

### D. Agregación de Demandas (Multi-Item del Mismo Producto)
Si el carrito incluye el mismo producto o variante en varias líneas (por promociones o notas distintas), el validador consolida primero la cantidad total requerida por cada ID (`$demands[$targetId]`) antes de evaluar el stock disponible, evitando errores prematuros de concurrencia.

---

## 5. Arquitectura y Reglas del Sistema Multisede

El sistema permite operar múltiples tiendas físicas independientes con una sola base de datos y un único catálogo central:

### 1. Concepto de Sede 0 (Vista Global)
- `branchId = 0` es un identificador virtual utilizado por administradores y la tienda online para ver el stock consolidado de toda la empresa.
- **Regla Estricta:** Nunca se debe escribir inventario físico en `branch_id = 0`. `handleSaveProduct` fuerza automáticamente `$effectiveBranchId = $branchId > 0 ? $branchId : 1;`.

### 2. Soporte para `branchStock` Distribuido
Al crear o actualizar productos con variantes o simples, el frontend envía un mapa de existencias:
```json
{
  "id": "var-123",
  "branchStock": {
    "1": 15,
    "2": 30
  }
}
```
`handleSaveProduct` itera cada entrada de `branchStock`, persiste el inventario en su respectiva sede y actualiza la fila padre consolidada.

### 3. Traspasos Seguros entre Sedes (`handleTransferStock`)
Ubicado en `public/lib/inventory.php`:
1. Bloquea el stock en la sede origen (`FOR UPDATE`).
2. Valida existencias y descuenta atómicamente (`AND stock >= :qty`).
3. Registra movimiento `transfer_out` en origen.
4. Suma a la sede destino mediante `ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`.
5. Registra movimiento `transfer_in` en destino.
6. Sincroniza las filas consolidadas de los productos padre en ambas sedes.

### 4. Desglose Multisede Unificado (`handleStockBreakdown`)
Al consultar existencias por sucursal desde el catálogo o modal:
- Si el ID pertenece a una variante específica, consulta el stock de esa variante en cada sede.
- Si el ID pertenece a un producto padre con variantes, ejecuta un `SUM(i.stock)` de todas sus variantes hijas agrupado por sede, entregando el inventario total real por tienda.

---

## 6. Punto de Venta (POS) Profesional

El POS en `components/admin/pos/` está optimizado para velocidad en caja:

### Experiencia Reactiva sin Recarga
- Se erradicó el antiguo `window.location.reload()`.
- La actualización de stock tras la venta es optimista e instantánea mediante `adjustStockLocally` en `ProductContext.tsx`.

### Impresión Térmica de Tickets (`POSTicketModal.tsx`)
- Formato optimizado para rollos térmicos de **80mm y 58mm**.
- Estilos CSS `@media print` para impresión limpia y directa con un clic (`window.print()`).
- Envío directo de resumen del ticket al cliente por **WhatsApp**.

### Atajos de Teclado para Cajeros (`POSCart.tsx`)
- **`F2`**: Enfocar instantáneamente el buscador de productos / lector de código de barras.
- **`F4`**: Abrir la pasarela de cobro rápido.
- **`F8`**: Poner la venta actual en espera (*Hold / Park Order*).

---

## 7. Kardex y Trazabilidad (`product_movements`)

Cada alteración de existencias queda registrada en el kardex:
- **`entry`**: Entradas por compras, devoluciones o restitución por cancelación de venta.
- **`exit`**: Salidas por mermas, daños o vencimiento.
- **`sale`**: Descuento automático por venta en POS o pedido web despachado.
- **`adjustment`**: Ajuste directo por conteo físico en tienda (fija el stock real y registra la variación matemática: `Conteo Físico: Anterior -> Nuevo`).
- **`transfer_out` / `transfer_in`**: Movimientos apareados de traspaso entre sucursales.

---

## 8. Guía de Configuración, Despliegue y Troubleshooting

### Instalación en Servidor (Producción)
1. **Frontend:**
   ```bash
   npm install
   npm run build
   ```
   Desplegar el contenido de la carpeta `dist/` en tu servidor web o CDN.
2. **Backend PHP:**
   - Asegurarse de tener PHP 8.0+ con extensiones `pdo_mysql`, `json`, `curl`.
   - Copiar `public/lib/config.example.php` a `public/lib/config.php` y ajustar credenciales MySQL.
   - El sistema crea y migra automáticamente las tablas e índices en la primera petición.

### Troubleshooting Frecuente

| Síntoma | Causa Probable | Solución |
| :--- | :--- | :--- |
| **HTTP 403 "Security Token Missing"** | La petición no incluye la cabecera `X-App-Token`. | Asegurarse de que el frontend pase el token `'AraEcom_v5_Secure'` configurado en `services/api.ts`. |
| **HTTP 429 "Too Many Requests"** | El rate limiter de `api.php` superó 120 req/min por IP. | Esperar el tiempo indicado en la cabecera `Retry-After` o ajustar `$_rl_max` en `public/api.php`. |
| **Stock aparece en 0 al cambiar de sede** | El producto fue creado en un entorno anterior sin registro en la tabla `inventory`. | Editar el producto o registrar un ajuste en la sede correspondiente para que se genere la fila en `inventory`. |
| **Error 409 al cobrar en POS** | La cantidad en carrito supera las existencias físicas de la sede activa. | Verificar existencias en el selector de sedes o realizar un ajuste/traspaso de inventario. |

---

<div align="center">
  <p><b>Ara E-commerce Multisede</b> — Arquitectura Diseñada para Alta Disponibilidad e Integridad Transaccional</p>
  <p>© 2026 Todos los derechos reservados.</p>
</div>



Opción 1: Script de Actualización y Migración (Recomendado si ya tienes datos)
Copia y pega este bloque en phpMyAdmin. Añade las nuevas columnas, ajusta los tipos para prevenir desbordamientos (Out of Range), crea los índices de alto rendimiento e inicializa la bandera stock_deducted en pedidos ya completados:

sql
-- 1. ASEGURAR TABLAS BÁSICAS FALTANTES
CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `is_active` TINYINT(1) DEFAULT 1
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `inventory` (
  `product_id` VARCHAR(255) NOT NULL,
  `branch_id` INT NOT NULL,
  `stock` INT DEFAULT 0,
  `updated_at` BIGINT,
  PRIMARY KEY (`product_id`, `branch_id`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `product_movements` (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `activity_logs` (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 2. CORREGIR TIPOS DE CAMPOS (Previene error "Out of Range" en IDs y Timestamps)
ALTER TABLE `orders` MODIFY `id` VARCHAR(255);
ALTER TABLE `orders` MODIFY `date` BIGINT;
ALTER TABLE `products` MODIFY `id` VARCHAR(255);
ALTER TABLE `product_movements` MODIFY `id` VARCHAR(255);
ALTER TABLE `product_movements` MODIFY `date` BIGINT;
ALTER TABLE `customers` MODIFY `last_order_date` BIGINT;
-- 3. AÑADIR NUEVAS COLUMNAS (Ignora si ya existen)
-- Columna de Idempotencia en Pedidos
SET @col_orders_stock = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'stock_deducted');
SET @sql_orders_stock = IF(@col_orders_stock = 0, 'ALTER TABLE `orders` ADD COLUMN `stock_deducted` TINYINT(1) DEFAULT 0', 'SELECT "columna stock_deducted ya existe"');
PREPARE stmt1 FROM @sql_orders_stock; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;
-- Columna de Sede en Pedidos
SET @col_orders_branch = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'branch_id');
SET @sql_orders_branch = IF(@col_orders_branch = 0, 'ALTER TABLE `orders` ADD COLUMN `branch_id` INT DEFAULT 1', 'SELECT "columna branch_id ya existe"');
PREPARE stmt2 FROM @sql_orders_branch; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
-- Columnas de Entrega y Totales en Pedidos
SET @col_orders_deliv = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_method');
SET @sql_orders_deliv = IF(@col_orders_deliv = 0, 'ALTER TABLE `orders` ADD COLUMN `delivery_method` VARCHAR(50) DEFAULT "pos"', 'SELECT "delivery_method ya existe"');
PREPARE stmt3 FROM @sql_orders_deliv; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
SET @col_orders_subtotal = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'subtotal');
SET @sql_orders_subtotal = IF(@col_orders_subtotal = 0, 'ALTER TABLE `orders` ADD COLUMN `subtotal` FLOAT DEFAULT 0', 'SELECT "subtotal ya existe"');
PREPARE stmt4 FROM @sql_orders_subtotal; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;
SET @col_orders_discount = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'discount');
SET @sql_orders_discount = IF(@col_orders_discount = 0, 'ALTER TABLE `orders` ADD COLUMN `discount` FLOAT DEFAULT 0', 'SELECT "discount ya existe"');
PREPARE stmt5 FROM @sql_orders_discount; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;
-- Columnas Nuevas en Productos
SET @col_prod_extra = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'extra_categories');
SET @sql_prod_extra = IF(@col_prod_extra = 0, 'ALTER TABLE `products` ADD COLUMN `extra_categories` TEXT DEFAULT NULL', 'SELECT "extra_categories ya existe"');
PREPARE stmt6 FROM @sql_prod_extra; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;
SET @col_prod_barcode = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'barcode_ean');
SET @sql_prod_barcode = IF(@col_prod_barcode = 0, 'ALTER TABLE `products` ADD COLUMN `barcode_ean` VARCHAR(255) DEFAULT ""', 'SELECT "barcode_ean ya existe"');
PREPARE stmt7 FROM @sql_prod_barcode; EXECUTE stmt7; DEALLOCATE PREPARE stmt7;
SET @col_prod_track = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'track_stock');
SET @sql_prod_track = IF(@col_prod_track = 0, 'ALTER TABLE `products` ADD COLUMN `track_stock` TINYINT(1) DEFAULT 1', 'SELECT "track_stock ya existe"');
PREPARE stmt8 FROM @sql_prod_track; EXECUTE stmt8; DEALLOCATE PREPARE stmt8;
SET @col_prod_min = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'min_stock');
SET @sql_prod_min = IF(@col_prod_min = 0, 'ALTER TABLE `products` ADD COLUMN `min_stock` INT DEFAULT 5', 'SELECT "min_stock ya existe"');
PREPARE stmt9 FROM @sql_prod_min; EXECUTE stmt9; DEALLOCATE PREPARE stmt9;
-- Cédula en Clientes
SET @col_cust_ced = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'cedula');
SET @sql_cust_ced = IF(@col_cust_ced = 0, 'ALTER TABLE `customers` ADD COLUMN `cedula` VARCHAR(30) DEFAULT ""', 'SELECT "cedula ya existe"');
PREPARE stmt10 FROM @sql_cust_ced; EXECUTE stmt10; DEALLOCATE PREPARE stmt10;
-- 4. ÍNDICES DE RENDIMIENTO (Acelera búsquedas y kardex)
ALTER TABLE `orders` ADD INDEX `idx_orders_branch_date` (`branch_id`, `date`);
ALTER TABLE `orders` ADD INDEX `idx_orders_status` (`status`);
ALTER TABLE `product_movements` ADD INDEX `idx_product_movements_prod_branch` (`product_id`, `branch_id`);
ALTER TABLE `product_movements` ADD INDEX `idx_product_movements_date` (`date`);
ALTER TABLE `products` ADD INDEX `idx_products_category` (`category`);
ALTER TABLE `products` ADD INDEX `idx_products_barcode` (`barcode_ean`);
-- 5. MIGRACIÓN DE INTEGRIDAD EN PEDIDOS EXISTENTES
-- Marca las órdenes históricas ya completadas como 'stock_deducted = 1' para evitar que se descuenten por error al editarlas
UPDATE `orders` SET `stock_deducted` = 1 WHERE `status` = 'completed';
-- 6. INICIALIZAR SEDE MATRIZ SI NO EXISTE
INSERT IGNORE INTO `branches` (`id`, `name`, `address`, `is_active`) 
SELECT 1, 'Sede Principal', 'Matriz', 1 
WHERE NOT EXISTS (SELECT 1 FROM `branches` WHERE `id` = 1);
















Opción 2: Esquema Completo DDL (Para instalaciones desde cero)
Usa este script si vas a montar una base de datos nueva y vacía:

sql
SET FOREIGN_KEY_CHECKS = 0;
CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `is_active` TINYINT(1) DEFAULT 1
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `products` (
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
  `barcode_ean` VARCHAR(255),
  INDEX `idx_products_category` (`category`),
  INDEX `idx_products_barcode` (`barcode_ean`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `inventory` (
  `product_id` VARCHAR(255) NOT NULL,
  `branch_id` INT NOT NULL,
  `stock` INT DEFAULT 0,
  `updated_at` BIGINT,
  PRIMARY KEY (`product_id`, `branch_id`),
  INDEX `idx_inv_branch` (`branch_id`),
  INDEX `idx_inv_product` (`product_id`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `orders` (
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
  `pickup_branch_id` INT DEFAULT 0,
  `stock_deducted` TINYINT(1) DEFAULT 0,
  INDEX `idx_orders_branch_date` (`branch_id`, `date`),
  INDEX `idx_orders_status` (`status`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `product_movements` (
  `id` VARCHAR(255) PRIMARY KEY,
  `product_id` VARCHAR(255),
  `branch_id` INT DEFAULT 1,
  `user_id` VARCHAR(255),
  `user_name` VARCHAR(255),
  `type` VARCHAR(50),
  `amount` INT,
  `stock_after` INT,
  `reference` TEXT,
  `date` BIGINT,
  INDEX `idx_product_movements_prod_branch` (`product_id`, `branch_id`),
  INDEX `idx_product_movements_date` (`date`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `customers` (
  `phone` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255),
  `cedula` VARCHAR(30) DEFAULT '',
  `address` TEXT,
  `total_spent` FLOAT DEFAULT 0,
  `order_count` INT DEFAULT 0,
  `last_order_date` BIGINT,
  `order_ids` LONGTEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255),
  `image` TEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `coupons` (
  `code` VARCHAR(50) PRIMARY KEY,
  `discount_type` VARCHAR(50),
  `value` FLOAT,
  `active` TINYINT(1) DEFAULT 1
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(255) PRIMARY KEY,
  `setting_value` LONGTEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `endpoint` VARCHAR(500) PRIMARY KEY,
  `p256dh` VARCHAR(255),
  `auth` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `activity_logs` (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Insertar Sede Principal inicial
INSERT IGNORE INTO `branches` (`id`, `name`, `address`, `is_active`) 
VALUES (1, 'Sede Principal', 'Matriz', 1);
SET FOREIGN_KEY_CHECKS = 1;