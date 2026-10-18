# Plan de Implementación: Stock Estancado (Baja Rotación)

**Proyecto:** Ara Multise / Ecommerce  
**Módulo:** Estadísticas &gt; Valoración de Inventario  
**Objetivo:** Identificar productos con baja o nula rotación para liberar capital inmovilizado mediante liquidación u ofertas directas, bajo el principio de simplicidad y cero impacto estructural (KISS).

---

## 1. Principios de Diseño y Arquitectura

1. **Cero Impacto Estructural:**
   - Sin tablas nuevas ni cambios en el esquema relacional existente.
   - Sin alteraciones a la lógica de procesamiento de cobros, pedidos ni deducción de stock.
   - Resolución en una sola consulta `SELECT` con tablas derivadas pre-agregadas.

2. **Blindaje de Márgenes (Regla Inquebrantable):**
   - El precio de oferta nunca puede ser inferior al costo del producto ($\text{sale\_price} \ge \text{cost}$).
   - Validación dual: en caliente en el cliente (bloqueo visual y de botón) y estricta en el servidor (HTTP 422 si se vulnera).

3. **Compatibilidad Multisede:**
   - Si se consulta una sede específica (`branch_id > 0`), se analiza el inventario y ventas de dicha sede.
   - Si se consulta la *Vista Global* (`branch_id = 0`), se consolida el stock de todas las sedes activas y las ventas globales.

---

## 2. Archivos Modificados y Creados

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| [`public/lib/read.php`](file:///c:/Users/pc/Documents/WORK/ARA/public/lib/read.php#L496-L650) | Modificado | Función `handleGetStagnantStock` con consulta `SELECT` optimizada. |
| [`public/lib/write.php`](file:///c:/Users/pc/Documents/WORK/ARA/public/lib/write.php#L1155-L1208) | Modificado | Función `handleUpdateProductOffer` con validación estricta de costo. |
| [`public/api.php`](file:///c:/Users/pc/Documents/WORK/ARA/public/api.php#L133-L145) | Modificado | Enrutamiento de `get_stagnant_stock` y `update_product_offer`. |
| [`types.ts`](file:///c:/Users/pc/Documents/WORK/ARA/types.ts#L155-L182) | Modificado | Interfaces `StagnantProduct` y `StagnantStockResponse`. |
| [`services/api.ts`](file:///c:/Users/pc/Documents/WORK/ARA/services/api.ts#L194-L205) | Modificado | Métodos tipados `getStagnantStock` y `updateProductOffer`. |
| [`components/admin/statistics/StagnantStockAnalytics.tsx`](file:///c:/Users/pc/Documents/WORK/ARA/components/admin/statistics/StagnantStockAnalytics.tsx) | **Nuevo** | Vista de tabla, KPIs en cabecera, filtros rápidos (30/60/90d) y modal de liquidación. |
| [`components/admin/statistics/InventoryAnalytics.tsx`](file:///c:/Users/pc/Documents/WORK/ARA/components/admin/statistics/InventoryAnalytics.tsx#L222-L255) | Modificado | Sub-navegación para alternar entre *Auditoría de Movimientos* y *Stock Estancado*. |

---

## 3. Lógica de la Consulta SQL

La consulta implementada en `handleGetStagnantStock` utiliza tablas derivadas para evitar bloqueos por `GROUP BY` masivos sobre `product_movements`:

```sql
SELECT 
    p.id,
    p.code,
    p.title,
    p.category,
    p.cost,
    p.price,
    p.sale_price,
    p.images,
    p.created_at,
    COALESCE(inv.stock, 0) AS stock,
    ROUND(COALESCE(inv.stock, 0) * p.cost, 2) AS capital_retenido,
    COALESCE(sales.unidades_vendidas, 0) AS unidades_vendidas,
    sales.ultima_venta,
    FLOOR((:nowMs - COALESCE(sales.ultima_venta, p.created_at)) / 86400000) AS dias_sin_venta
FROM `products` p
-- 1. Existencias filtradas por sede (o consolidadas si es Global)
INNER JOIN (
    SELECT product_id, SUM(stock) AS stock
    FROM `inventory`
    WHERE (:branchId = 0 OR branch_id = :branchId)
    GROUP BY product_id
    HAVING stock > 0
) inv ON p.id = inv.product_id
-- 2. Ventas agregadas en el periodo solicitado desde product_movements
LEFT JOIN (
    SELECT 
        pm.product_id,
        SUM(CASE WHEN pm.date >= :sinceMs THEN pm.amount ELSE 0 END) AS unidades_vendidas,
        MAX(pm.date) AS ultima_venta
    FROM `product_movements` pm
    WHERE pm.type = 'sale'
      AND (:branchId = 0 OR pm.branch_id = :branchId)
    GROUP BY pm.product_id
) sales ON p.id = sales.product_id
-- 3. Filtro: Productos con al menos 30 días en el sistema
WHERE p.created_at <= :minCreatedAtMs
-- 4. Ordenamiento por mayor impacto de liquidez y menor rotación
ORDER BY capital_retenido DESC, unidades_vendidas ASC
LIMIT 250;
```

---

## 4. Componente de Interfaz de Usuario (UI/UX)

### Cabecera con Métricas Resumen
- **Capital Retenido:** Suma total de `stock * costo` de los productos identificados.
- **Unidades Ociosas:** Cantidad total de artículos físicos sin rotar.
- **Productos Detectados:** Conteo de referencias con baja rotación.

### Filtros
- Selector de periodo rápido: `30 Días`, `60 Días`, `90 Días`.
- Buscador reactivo por título o código de producto.
- Filtro por categoría y selector de sede sincronizado con la tienda.

### Tabla y Semáforo de Severidad
- 🟡 **Alerta (30 - 59 días sin venta):** Rotación lenta temprana.
- 🟠 **Estancado (60 - 89 días sin venta):** Inventario con riesgo de obsolescencia.
- 🔴 **Crítico (90+ días sin venta):** Dinero congelado prioritario para liquidación.

### Modal Ligero de Liquidación
- **Presets de 1 clic:** `[-15%]`, `[-25%]`, `[-35%]`, `[Al Costo]` y `[Quitar Oferta]`.
- **Cálculo en vivo:** Muestra margen de ganancia resultante y dólares recuperables.
- **Bloqueo de seguridad:** Deshabilita el guardado y muestra alerta si el precio es menor al costo.
