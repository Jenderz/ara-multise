# Revisión final de cambios manuales (tercera pasada)

Base: el diff sin commitear sobre `bef4f81`. Revisado leyendo el código. No pude ejecutar `tsc` ni `php -l` (los permisos los bloquean); quedan como paso de validación.

## Estado: los 4 problemas y los pendientes anteriores están resueltos

### Problemas originales
1. **Hora del dispositivo** — el servidor pone la fecha de la orden (`time()`), `save_order` devuelve `date`, y `client_date` se guarda aparte. Fechas de reportes y filtros usan `America/Caracas` vía `serverClock.ts`. Aviso de reloj desfasado activo (`NotificationContext`).
2. **"Agotado" inconsistente** — `inventory`/`availableStock` cuentan solo sedes activas y excluyen `branch_id = 0`; frontend unificado en `utils/stock.ts`.
3. **Stock que "queda en 1"** — `save_product` ya no sobrescribe stock existente, `bulk_update_prices` no toca inventario, el POS usa stock local, hay bloqueo optimista con 409, y el snapshot actualiza padre y variantes.
4. **Duplicados en el buscador** — paginación con `pageRef`/`requestId`, deduplicación y `ORDER BY created_at, id`.

### Pendientes de la segunda pasada
- **B1 (reloj)** ✅ `DashboardModule`, `SmartAssistant`, `FinancialAnalytics`, `SellersAnalytics` y `AuthContext` usan `now()`/`startOfBusinessDay`/`getBusinessHour`/`formatBusinessDate`.
- **B2 (contrato `createOrder`)** ✅ Devuelve `CreateOrderResult { orderId, hasSnapshot, date }`; la fecha se rellena con la del servidor vía `setOrders`.
- **B3 (variante sin opciones)** ✅ `addToCart` acepta `variantIdOverride`, rechaza si el producto tiene variantes y no se resuelve ninguna, el escáner pasa el `variantId`, y `POSModals` permite elegir por lista cuando no hay opciones estructuradas.
- **B4 (`batch.php`)** ✅ Las filas de `inventory` sin `branch_id` válido se saltan y se reportan en `skipped`.

## Detalles menores restantes (opcionales, no bloquean)

1. **Import sin uso** en `POSProductGrid.tsx:13`: `getAvailableStock` e `isOutOfStock` ya no se usan (ahora se usa `getLocalStock`). Quitar para evitar avisos de lint.
2. **`OrderEditModal.handleVariantConfirm`** resuelve la variante por `v.sku === variantSku` y no recibe `variantId`. Si una variante no tiene SKU, podría elegir la variante equivocada al editar un pedido. Aceptar el `variantId` (6.º parámetro) como en el POS.
3. **`batch.php` (movimientos)** usa `$mov['branch_id'] ?? 1`; si un movimiento no trae sede, cae en la sede 1. Es menor, pero conviene saltarlo como en `inventory` si no es intencional.
4. `ReceiptModal` / ticket: el `date` viene de `serverNow`. El ticket usa la hora de Caracas vía `formatTime`. Sin acción.

## Paso de despliegue obligatorio (no es código del repo)
En el `lib/config.php` real del servidor deben existir:
- `date_default_timezone_set('America/Caracas');`
- el `SET time_zone = '-04:00'` (ya está en `config.example.php`).

Y antes del primer request:
- **Backup** con `mysqldump` (la migración v11 agrega `client_date` y puede convertir tablas a InnoDB).
- Ejecutar `php public/lib/sanitize_data.php --dry-run` y revisar el conteo. El paso 1 **borra** las filas con `branch_id = 0`: validar en el reporte que no tengan stock real.

## Validación (implementación)
1. Ejecutar `npx tsc --noEmit` (o `tsc --noEmit -p .`) y `php -l` en `public/api.php` y `public/lib/*.php`.
2. Pruebas manuales:
   - **POS, stock 1, sede A** (simple y variante): vender → grid y modal pasan a 0 sin recargar; la segunda venta se bloquea en el cliente y en el servidor.
   - **Stock solo en sede B**: el POS de la sede A muestra AGOTADO y la alerta de "disponible en global".
   - **Variante sin `variantOptions`**: escanear/elegir descuenta la variante, no el padre.
   - **Producto simple, edición concurrente**: abrir edición, vender desde otra terminal, guardar → aparece el 409 y la lista no conserva el valor rechazado.
   - **Producto con variantes**: editar precio no da 409 y el stock no cambia.
   - **Actualización masiva de precios**: `SELECT SUM(stock) FROM inventory` sin cambios antes y después.
   - **Borrar sede con stock** → error; **borrar producto con variantes** → no quedan filas en `inventory`.
   - **Reloj 3 h adelantado**: aviso de reloj desincronizado; "Hoy" correcto en Dashboard, Transacciones, FinancialAnalytics y SmartAssistant.
   - **Venta 21:00 Caracas**: cae en el día correcto en todos los reportes.
