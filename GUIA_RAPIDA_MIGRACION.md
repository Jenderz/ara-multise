# 🚀 Guía Rápida de Migración de Variantes

## Pasos para Migrar

### 1️⃣ Ejecutar el Script SQL

**Opción A: Desde phpMyAdmin (Recomendado)**
1. Abre phpMyAdmin en tu navegador
2. Selecciona la base de datos `qluilsmq_carruselve`
3. Ve a la pestaña **SQL**
4. Abre el archivo `migration_simple_variants.sql`
5. Copia TODO el contenido
6. Pégalo en el editor SQL
7. Haz clic en **Continuar**

**Opción B: Desde línea de comandos**
```bash
mysql -u TU_USUARIO -p qluilsmq_carruselve < migration_simple_variants.sql
```

---

### 2️⃣ Ejecutar el Script PHP

```bash
# Navega a la carpeta
cd c:\Users\User\Downloads\ara-multise-main\ara-multise-main\public\migrations

# Ejecuta el script
php migrate_variants_to_inventory.php
```

**Salida esperada:**
```
==================================================================
MIGRACIÓN DE VARIANTES A TABLA INVENTORY
==================================================================

[✓] Estructura de base de datos verificada
[✓] Encontradas 1 sede(s) activa(s)
[✓] Encontrados XXX producto(s) con variantes

[INFO] Procesando productos...
[✓] Migrado exitosamente

==================================================================
RESUMEN DE MIGRACIÓN
==================================================================

Productos procesados:        XXX
Variantes migradas:          XXX
Errores:                     0

[✓] ¡Migración completada exitosamente!
```

---

### 3️⃣ Verificar la Migración

Ejecuta esta consulta en phpMyAdmin:

```sql
-- Ver productos con variantes migrados
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
```

Deberías ver registros con `variant_id` no nulo.

---

## ⚠️ Si algo sale mal

Ejecuta este script para revertir:

```sql
DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` LIKE `inventory_backup_20260207`;
INSERT INTO `inventory` SELECT * FROM `inventory_backup_20260207`;

DROP TABLE IF EXISTS `product_movements`;
CREATE TABLE `product_movements` LIKE `product_movements_backup_20260207`;
INSERT INTO `product_movements` SELECT * FROM `product_movements_backup_20260207`;
```

---

## 📞 ¿Necesitas ayuda?

Si encuentras algún error:
1. Copia el mensaje de error completo
2. Revisa los backups en las tablas `*_backup_20260207`
3. Puedes revertir en cualquier momento

---

**¡Listo para empezar!** 🚀
