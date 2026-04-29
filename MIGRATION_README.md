# 📦 Migración de Inventario con Variantes y Transferencias

Este documento describe el proceso completo de migración del sistema de inventario para soportar:

- ✅ **Stock por variante** (no solo por producto)
- ✅ **Transferencias entre sedes** con origen y destino
- ✅ **Auditoría completa** de movimientos de variantes

---

## 🚀 Pasos de Migración

### **Paso 1: Backup de la Base de Datos**

**IMPORTANTE:** Antes de ejecutar cualquier script, haz un backup completo de tu base de datos.

```bash
# Desde la línea de comandos (ajusta las credenciales)
mysqldump -u usuario -p nombre_base_datos > backup_$(date +%Y%m%d_%H%M%S).sql
```

O desde phpMyAdmin:
1. Selecciona la base de datos
2. Ve a la pestaña "Exportar"
3. Haz clic en "Continuar"

---

### **Paso 2: Ejecutar el Script SQL**

Ejecuta el archivo `migration_inventory_variants.sql` en tu base de datos.

**Opción A: Desde phpMyAdmin**
1. Abre phpMyAdmin
2. Selecciona tu base de datos
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido de `migration_inventory_variants.sql`
5. Haz clic en "Continuar"

**Opción B: Desde línea de comandos**
```bash
mysql -u usuario -p nombre_base_datos < migration_inventory_variants.sql
```

**Opción C: Desde MySQL Workbench**
1. Abre MySQL Workbench
2. Conecta a tu servidor
3. Abre el archivo `migration_inventory_variants.sql`
4. Ejecuta el script (⚡ icono de rayo)

---

### **Paso 3: Ejecutar el Script PHP de Migración**

Este script migra los datos de variantes desde el JSON hacia la tabla `inventory`.

```bash
# Navega a la carpeta de migraciones
cd public/migrations

# Ejecuta el script
php migrate_variants_to_inventory.php
```

**Salida esperada:**
```
==================================================================
MIGRACIÓN DE VARIANTES A TABLA INVENTORY
==================================================================

[INFO] Verificando estructura de la base de datos...
[✓] Estructura de base de datos verificada
[INFO] Obteniendo sedes activas...
[✓] Encontradas 1 sede(s) activa(s):
[INFO]   - ID: 1, Nombre: Principal
[INFO] Buscando productos con variantes...
[✓] Encontrados 150 producto(s) con variantes

==================================================================
INICIANDO MIGRACIÓN DE VARIANTES
==================================================================

[INFO] Procesando: [SKU-123] PACK DE 3 PANTALONES
[INFO]   → Encontradas 3 variante(s)
[INFO]   → Variante: SKU-123-1 (ID: i8nr6n23e, Stock: 1)
[✓]     ✓ Migrado a sede 'Principal' con stock 1
...

==================================================================
RESUMEN DE MIGRACIÓN
==================================================================

Productos procesados:        150
Variantes migradas:          450
Variantes omitidas:          0
Registros padre eliminados:  150
Errores:                     0

[✓] ¡Migración completada exitosamente sin errores!
```

---

### **Paso 4: Verificar la Migración**

Ejecuta estas consultas SQL para verificar que todo está correcto:

```sql
-- 1. Ver total de registros en inventory
SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN variant_id IS NULL THEN 1 ELSE 0 END) as sin_variante,
    SUM(CASE WHEN variant_id IS NOT NULL THEN 1 ELSE 0 END) as con_variante
FROM inventory;

-- 2. Ver ejemplo de productos con variantes
SELECT 
    p.code,
    p.title,
    i.variant_id,
    i.stock,
    b.name as sede
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
WHERE i.variant_id IS NOT NULL
LIMIT 10;

-- 3. Verificar que no hay registros padre duplicados
SELECT 
    product_id,
    branch_id,
    COUNT(*) as registros
FROM inventory
WHERE variant_id IS NULL
GROUP BY product_id, branch_id
HAVING COUNT(*) > 1;
-- Debe devolver 0 resultados
```

---

## 🔧 Nuevas Funcionalidades

### **1. Procedimientos Almacenados**

El script crea 3 procedimientos almacenados para facilitar operaciones:

#### **sp_register_sale** - Registrar una venta
```sql
CALL sp_register_sale(
    'product_id',      -- ID del producto
    'variant_id',      -- ID de la variante (NULL si no tiene)
    1,                 -- ID de la sede
    'user_id',         -- ID del usuario
    'Usuario',         -- Nombre del usuario
    2,                 -- Cantidad vendida
    'Venta #12345'     -- Referencia
);
```

#### **sp_register_transfer** - Transferir stock entre sedes
```sql
CALL sp_register_transfer(
    'product_id',      -- ID del producto
    'variant_id',      -- ID de la variante (NULL si no tiene)
    1,                 -- Sede de origen
    2,                 -- Sede de destino
    'user_id',         -- ID del usuario
    'Usuario',         -- Nombre del usuario
    5,                 -- Cantidad a transferir
    'Transferencia manual'
);
```

#### **sp_adjust_inventory** - Ajustar inventario
```sql
CALL sp_adjust_inventory(
    'product_id',      -- ID del producto
    'variant_id',      -- ID de la variante (NULL si no tiene)
    1,                 -- ID de la sede
    'user_id',         -- ID del usuario
    'Usuario',         -- Nombre del usuario
    10,                -- Nuevo stock
    'Ajuste de inventario'
);
```

---

### **2. Vista Detallada de Inventario**

Se crea una vista `v_inventory_detailed` para consultas fáciles:

```sql
SELECT * FROM v_inventory_detailed
WHERE branch_id = 1
LIMIT 10;
```

Columnas disponibles:
- `product_id`, `variant_id`, `branch_id`
- `stock`, `updated_at`
- `product_title`, `product_code`, `product_price`
- `branch_name`, `branch_address`
- `variant_data` (JSON con datos de la variante)

---

### **3. Triggers de Seguridad**

Se crean 2 triggers automáticos:

1. **trg_inventory_check_negative**: Evita que el stock sea negativo
2. **trg_inventory_update_timestamp**: Actualiza automáticamente `updated_at`

---

## 📊 Estructura de Datos Actualizada

### **Tabla `inventory`**

```sql
CREATE TABLE `inventory` (
  `product_id` varchar(255) NOT NULL,
  `variant_id` varchar(255) DEFAULT NULL,  -- NUEVO
  `branch_id` int(11) NOT NULL,
  `stock` int(11) DEFAULT 0,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`product_id`, `branch_id`, `variant_id`)
);
```

**Ejemplos de registros:**

| product_id | variant_id | branch_id | stock |
|------------|------------|-----------|-------|
| prod_123   | NULL       | 1         | 10    |
| prod_456   | var_001    | 1         | 5     |
| prod_456   | var_002    | 1         | 3     |
| prod_456   | var_003    | 1         | 2     |

---

### **Tabla `product_movements`**

```sql
CREATE TABLE `product_movements` (
  `id` varchar(255) NOT NULL,
  `product_id` varchar(255) DEFAULT NULL,
  `variant_id` varchar(255) DEFAULT NULL,           -- NUEVO
  `branch_id` int(11) DEFAULT 1,
  `destination_branch_id` int(11) DEFAULT NULL,     -- NUEVO
  `user_id` varchar(255) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `amount` int(11) DEFAULT NULL,
  `stock_after` int(11) DEFAULT NULL,
  `reference` text DEFAULT NULL,
  `date` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
);
```

**Tipos de movimientos:**
- `sale` - Venta
- `entry` - Entrada de stock
- `exit` - Salida de stock
- `adjustment` - Ajuste manual
- `transfer` - Transferencia entre sedes (NUEVO)

---

## 🔄 Rollback (Deshacer Migración)

Si algo sale mal, puedes revertir los cambios:

```sql
-- Restaurar tabla inventory
DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` LIKE `inventory_backup_20260207`;
INSERT INTO `inventory` SELECT * FROM `inventory_backup_20260207`;

-- Restaurar tabla product_movements
DROP TABLE IF EXISTS `product_movements`;
CREATE TABLE `product_movements` LIKE `product_movements_backup_20260207`;
INSERT INTO `product_movements` SELECT * FROM `product_movements_backup_20260207`;

-- Eliminar procedimientos y triggers
DROP PROCEDURE IF EXISTS `sp_register_sale`;
DROP PROCEDURE IF EXISTS `sp_register_transfer`;
DROP PROCEDURE IF EXISTS `sp_adjust_inventory`;
DROP TRIGGER IF EXISTS `trg_inventory_check_negative`;
DROP TRIGGER IF EXISTS `trg_inventory_update_timestamp`;
DROP VIEW IF EXISTS `v_inventory_detailed`;
```

---

## ⚠️ Problemas Comunes

### **Error: "Column 'variant_id' cannot be null"**

**Causa:** Intentas insertar un registro sin especificar `variant_id`.

**Solución:** Para productos sin variantes, usa `NULL`:
```sql
INSERT INTO inventory (product_id, variant_id, branch_id, stock, updated_at)
VALUES ('prod_123', NULL, 1, 10, UNIX_TIMESTAMP());
```

---

### **Error: "Duplicate entry for key 'PRIMARY'"**

**Causa:** Ya existe un registro con la misma combinación de `(product_id, branch_id, variant_id)`.

**Solución:** Usa `ON DUPLICATE KEY UPDATE`:
```sql
INSERT INTO inventory (product_id, variant_id, branch_id, stock, updated_at)
VALUES ('prod_123', 'var_001', 1, 10, UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
    stock = VALUES(stock),
    updated_at = VALUES(updated_at);
```

---

### **Error: "Stock insuficiente"**

**Causa:** El trigger `trg_inventory_check_negative` evita stock negativo.

**Solución:** Verifica el stock actual antes de hacer operaciones:
```sql
SELECT stock FROM inventory 
WHERE product_id = 'prod_123' 
  AND branch_id = 1 
  AND variant_id = 'var_001';
```

---

## 📞 Soporte

Si encuentras algún problema durante la migración:

1. **Revisa los logs** del script PHP
2. **Verifica los backups** están completos
3. **Consulta la sección de Rollback** si necesitas revertir
4. **Contacta al equipo de desarrollo** con los detalles del error

---

## ✅ Checklist de Migración

- [ ] Backup de base de datos creado
- [ ] Script SQL ejecutado sin errores
- [ ] Script PHP ejecutado exitosamente
- [ ] Verificación de datos completada
- [ ] Procedimientos almacenados funcionando
- [ ] Triggers activados correctamente
- [ ] Vista `v_inventory_detailed` creada
- [ ] Frontend actualizado para usar nueva estructura
- [ ] Pruebas de ventas realizadas
- [ ] Pruebas de transferencias realizadas
- [ ] Documentación actualizada

---

**Fecha de creación:** 2026-02-07  
**Versión:** 1.0  
**Autor:** Sistema de Migración Automática
