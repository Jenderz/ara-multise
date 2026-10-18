# Revisión de Implementación: Plan Stock Estancado (Baja Rotación)

**Fecha:** 2026-10-18
**Plan revisado:** `PLAN_STOCK_ESTANCADO.md`
**Veredicto:** ✅ Implementado correctamente, con 3 desviaciones menores funcionales (ninguna bloqueante).

---

## 1. Verificación punto por punto

| Requisito del Plan | Estado | Evidencia |
| :--- | :--- | :--- |
| Consulta SELECT con tablas derivadas pre-agregadas | ✅ | `public/lib/read.php:496-648` (`handleGetStagnantStock`) |
| Validación servidor `sale_price >= cost` con HTTP 422 | ✅ | `public/lib/write.php:1186-1190` |
| Validación dual en cliente (bloqueo visual + botón) | ✅ | `StagnantStockAnalytics.tsx:123,150,616-622,671` (`isBelowCost` deshabilita guardado y muestra alerta roja) |
| Multisede: sede específica vs Vista Global | ✅ | Dos ramas de consulta en `read.php:515-604`; selector de sede en `StagnantStockAnalytics.tsx:318-331` |
| Enrutamiento de ambos endpoints | ✅ | `public/api.php:133-136` y `147-150` |
| Interfaces tipadas | ✅ | `types.ts:155-181` — campos coinciden 1:1 con el JSON del backend |
| Métodos API tipados | ✅ | `services/api.ts:194-203` |
| KPIs: Capital Retenido, Unidades Ociosas, Productos Detectados | ✅ | `StagnantStockAnalytics.tsx:244-290` |
| Filtros 30/60/90d + búsqueda + categoría + sede | ✅ | `StagnantStockAnalytics.tsx:197-333` |
| Semáforo 🟡30-59 / 🟠60-89 / 🔴90+ | ✅ | `StagnantStockAnalytics.tsx:372-383` — umbrales exactos |
| Modal: presets -15%/-25%/-35%/Al Costo/Quitar Oferta | ✅ | `StagnantStockAnalytics.tsx:548-595` |
| Modal: cálculo en vivo (descuento, margen, liquidez) | ✅ | `StagnantStockAnalytics.tsx:116-128,624-638` |
| Sub-navegación Auditoría vs Stock Estancado | ✅ | `InventoryAnalytics.tsx:222-251` |
| Cero impacto en cobros/pedidos/stock | ✅ | La oferta ya se aplica en POS preexistente: `components/admin/pos/POSModals.tsx:78-93` y `POSProductGrid.tsx:586-592` usan `salePrice` |

**Seguridad adicional (no estaba en el plan, correcto igualmente):**
- Auth de lectura solo para staff (`admin|master|seller|cashier`) — `read.php:498-502`.
- Auth de escritura para `admin|master|products_manage|all` — `write.php:1157-1165`.
- El mensaje de error 422 del servidor se propaga al modal vía `fetchApi` (`services/api.ts:102-108`).

---

## 2. Desviaciones menores detectadas (funcionalmente equivalentes)

1. **Consulta dividida en dos ramas** en lugar de una sola con `(:branchId = 0 OR branch_id = :branchId)` — equivalente y evita duplicación de placeholders. Sin acción.
2. **Vista Global excluye inventario con `branch_id <= 0`** (`read.php:582`, `WHERE i.branch_id > 0`). Si existiera stock almacenado bajo `branch_id = 0` (almacén central legacy), no aparecería en la vista Global. Verificar si hay filas en `inventory` con `branch_id = 0`; si no las hay, sin acción.
3. **KPIs calculados sobre las 250 filas del `LIMIT 250`** — el "Capital Retenido" total solo suma el top 250 por capital. Coincide con el plan, pero es consciente del límite.

**Observación menor:** `InventoryAnalytics.tsx:251` renderiza `<StagnantStockAnalytics />` sin pasar `onProductUpdated`; la prop es opcional, así que la grilla de productos/POS no se refresca en caliente tras guardar una oferta (requiere recarga de datos). No es defecto, solo refresco diferido.

---

## 3. Validación recomendada (pendiente de ejecución)

**Resultados de validación (2026-10-18, sesión de revisión local):**

1. ✅ `npm run build` — compila sin errores (2193 módulos, PWA generado). Adicionalmente `npx tsc --noEmit` pasa sin errores de tipos.
2. ✅ **Desviación #2 resuelta a nivel de código** (sin acceso a BD local, no existe `config.php` en este entorno):
   - `public/lib/inventory.php:11-12` — `handleAdjustStock` coerciona `targetBid <= 0` a sede 1, por lo que **nunca se crean filas de inventory con `branch_id = 0`**.
   - `public/lib/sanitize_data.php:41-50` — el script de saneamiento del propio proyecto clasifica las filas `branch_id = 0` como "basura" y las elimina. Conclusión: excluir `branch_id = 0` en la Vista Global es correcto y consistente.
   - `public/lib/read.php:231` — el listado principal de productos usa la misma convención (`branch_id > 0` + join a sedes activas), por lo que la vista de stock estancado es coherente con el resto de la app.
3. ⚠️ Smoke tests de endpoints (GET `get_stagnant_stock`, 422 en `update_product_offer`) y verificación visual en POS: **no ejecutables desde este entorno** (no hay `config.php`, PHP CLI ni MySQL local). Requieren el servidor desplegado con sesión de admin.

1. Compilación TypeScript: `npm run build` — confirmar que `types.ts` y el nuevo componente no rompen el build.
2. Smoke test del endpoint (con sesión de admin activa):
   `GET api.php?action=get_stagnant_stock&days=30&branch_id=0`
   → debe devolver `data[]` + `summary`.
3. Smoke test de validación: intentar `update_product_offer` con precio < costo → debe responder HTTP 422 con el mensaje de error.
4. Verificar en la BD: `SELECT COUNT(*) FROM inventory WHERE branch_id = 0;` — para resolver la desviación #2.
5. En el POS, confirmar que un producto con oferta muestra el precio `salePrice` y no el precio regular.
