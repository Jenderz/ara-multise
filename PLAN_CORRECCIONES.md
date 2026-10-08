Se basa en una revisión del código; no cambié ningún archivo de la app ni hice pruebas. Revisé personalmente las dos causas más importantes (el buscador del POS y el guardado de productos).

1. Horarios mal con la hora del dispositivo. La fecha de cada venta la pone el teléfono o el PC (CartContext.tsx:245) y el servidor la guarda tal cual (write.php:635). Además, los filtros de fechas mezclan la hora UTC con la de Caracas, así que desde las 20:00 las ventas caen en el día siguiente. Tampoco hay forma de que la app consulte la hora del servidor.

Solución: que el servidor ponga la fecha de las ventas y que haya una consulta de la hora del servidor.
La app usará esa hora corregida y mostrará siempre la hora de Caracas, aunque el dispositivo tenga otra.
Si el reloj del dispositivo está desfasado, aparecerá un aviso.
2. "Agotado" aunque las variantes tienen cantidad. Cada pantalla calcula el stock de una forma distinta:

La tarjeta de la tienda suma todas las sedes, incluidas las inactivas y una "sede 0" que crea la importación masiva.
El detalle del producto solo cuenta las sedes activas.
El POS mira solo la sede actual.
Además, al cambiar rápido de variante en el detalle, la respuesta de una variante anterior puede pisar la de la actual.

Solución: que el servidor calcule una sola disponibilidad (solo sedes activas) y que todas las pantallas usen la misma función.
Limpiar los registros de stock basura que quedan de importaciones y sedes borradas.
3. Queda 1 y deja facturar otra vez. El descuento de stock en el servidor funciona bien. Hay dos fallos:

El POS no se entera de la venta: guarda su propia lista de productos y no la actualiza, así que sigue mostrando "1u".
El stock vendido "vuelve": al guardar un producto se reescribe la cantidad con la que tenía la pantalla al abrirse. El caso más grave es la actualización masiva de precios (FinanceTab.tsx), que reescribe el stock de todos los productos con los valores cargados al abrir la app. Así se deshacen todas las ventas hechas desde entonces.
Solución:

Guardar un producto ya no cambia su stock; los cambios de cantidad van por la función de ajuste existente, que deja registro.
La actualización de precios toca solo precios.
El POS se actualiza con el stock que devuelve el servidor después de cada venta.
4. Productos repetidos en el buscador del POS. Después de cada búsqueda, el scroll infinito vuelve a pedir la primera página y la agrega a la lista (POSProductGrid.tsx:164-204). También influyen respuestas viejas que llegan tarde y un orden poco estable en la consulta a la base de datos.

Solución: corregir el conteo de páginas, descartar las respuestas viejas, quitar repetidos al juntar resultados y fijar el orden de la consulta.
El plan también incluye una fase previa de copia de seguridad y comprobaciones en el servidor. Hay que revisar el config.php real, que no está en el repositorio, y confirmar que las tablas usen InnoDB; si no, los bloqueos de stock no funcionan. Incluye además una lista de pruebas por problema, un script para limpiar datos que primero solo reporta, el orden de despliegue y los riesgos. El total estimado es de unos 8-10 días.

Se puede empezar el primer día con:

el arreglo completo del buscador;
que el servidor ponga la fecha de las ventas;
refrescar el POS después de cada venta;
sacar la actualización masiva de precios del guardado de productos.




# Plan de Corrección: Tiempo, Stock y Buscador POS

> Versión base: `v2.1.0` (commit `bef4f81`)
> Alcance: 4 incidencias reportadas en producción.
> Principio rector: **el servidor es la única fuente de verdad** para la hora y para el stock. El cliente solo muestra datos y pide cambios. No se fija ningún valor absoluto que haya calculado el cliente.

---

## 0. Diagnóstico resumido

| # | Síntoma | Causa raíz confirmada | Archivos clave |
|---|---------|----------------------|----------------|
| 1 | Si el reloj del PC o teléfono está mal, los horarios salen mal | La fecha de la orden la pone el cliente (`Date.now()`) y el servidor la guarda tal cual. Los filtros mezclan UTC (`toISOString`) con la hora local de PHP. MySQL no tiene `time_zone` y no existe un endpoint de hora del servidor. | `context/CartContext.tsx:245`, `public/lib/write.php:635`, `TransactionsModule.tsx:35-36,109,143-159`, `public/lib/read.php:326-334`, `DashboardModule.tsx:95-133`, `AuthContext.tsx:62`, `push_sender.php:511` |
| 2 | Dice "Agotado" pero las variantes en Admin tienen cantidad | Hay 3 fuentes de stock distintas: (a) `globalStock` suma todas las filas, incluidas las de sedes inactivas y `branch_id=0`; (b) el desglose usa solo sedes activas; (c) el POS usa la sede actual. Además, el detalle del producto tiene una carrera entre respuestas de variantes y hay una copia de stock dentro del JSON `products.variants`. | `ProductCard.tsx:22-41`, `ProductDetail.tsx:66-77,153-167`, `POSProductGrid.tsx:476-545`, `read.php:3-44,92-106`, `batch.php:66-77`, `inventory.php:377-382` |
| 3 | Queda 1 unidad, se factura y deja facturar otra vez (el stock "siempre queda en 1") | (a) El grid del POS tiene su propia copia de `products` y no se refresca tras la venta. (b) `save_product` **sobrescribe el stock con valores absolutos** tomados de datos viejos (actualización masiva de precios en `FinanceTab`, edición normal, y en vista Global lo escribe en la sede 1). (c) El "auto-healing" de la venta recrea el stock desde el JSON viejo. (d) Si `variantOptions` está vacío se elige la primera variante. | `POSProductGrid.tsx:18`, `POSContext.tsx:104-118,319-324`, `write.php:109-153,542-561`, `FinanceTab.tsx:125-138`, `ProductContext.tsx:46-65` |
| 4 | Productos repetidos en el buscador del POS | (a) Después de un reset, `page` no avanza: el scroll infinito vuelve a pedir la página 1 y la **agrega** a la lista. (b) Las respuestas asíncronas no se cancelan y pueden llegar fuera de orden. (c) `ORDER BY created_at` sin desempate: con `LIMIT/OFFSET` un mismo producto puede salir en dos páginas. | `POSProductGrid.tsx:164-204`, `read.php:228-230` |

> Nota: el backend de venta (`handleSaveOrder`) **sí descuenta bien**: usa transacción, `FOR UPDATE` y `UPDATE ... AND stock >= ?`. El bug 3 está en lo que se hace **antes** (UI desactualizada) y **después** (sobrescrituras absolutas).

---

## 1. Estrategia general y orden de ejecución

Se ordena por **impacto en dinero e inventario** y por **riesgo de cada cambio**:

1. **Fase 0. Preparación** (backup y verificación del entorno).
2. **Fase 1. Integridad de stock** (problema 3). Es crítico: hoy se pierde o se "regenera" inventario.
3. **Fase 2. Consistencia de "Agotado"** (problema 2).
4. **Fase 3. Buscador POS** (problema 4). Cambio rápido y de bajo riesgo; puede ir en paralelo con la Fase 1.
5. **Fase 4. Tiempo autoritativo del servidor** (problema 1).
6. **Fase 5. Limpieza de datos, pruebas de regresión y despliegue.**

Cada fase va en **un commit/PR independiente** y se puede revertir por separado.

---

## Fase 0. Preparación (obligatoria)

- [ ] **Backup completo de la BD** (`mysqldump --single-transaction`) antes de tocar nada.
- [ ] Verificar en el servidor el `lib/config.php` real (no está en el repo):
  - `date_default_timezone_set('America/Caracas')` presente.
  - Motor de las tablas: `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();`. **Todas deben ser InnoDB.** Si alguna es MyISAM, las transacciones y el `FOR UPDATE` se ignoran sin aviso. Migrar con `ALTER TABLE x ENGINE=InnoDB`.
  - Zona horaria de MySQL: `SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP();`.
- [ ] Revisar qué `sw.js` llega a producción (`public/sw.js` frente al compilado de `src/sw.ts`). Ambos apuntan a `dist/sw.js`.
- [ ] Consultas de diagnóstico para medir cuántos datos están corruptos (guardar el resultado como línea base):
  ```sql
  -- Filas de inventario en branch 0 o en sedes inexistentes/inactivas
  SELECT i.* FROM inventory i LEFT JOIN branches b ON b.id = i.branch_id
  WHERE i.branch_id = 0 OR b.id IS NULL OR b.is_active = 0;

  -- Filas huérfanas (ni producto ni variante existente)
  SELECT i.product_id FROM inventory i
  LEFT JOIN products p ON p.id = i.product_id
  WHERE p.id IS NULL
    AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.variants LIKE CONCAT('%"', i.product_id, '"%'));

  -- Productos aparentemente duplicados
  SELECT title, code, COUNT(*) c FROM products GROUP BY title, code HAVING c > 1;

  -- Stock negativo
  SELECT * FROM inventory WHERE stock < 0;
  ```

---

## Fase 1. Integridad de stock (Problema 3)

### 1.1 Prohibir sobrescrituras absolutas de stock al guardar un producto
**Archivo:** `public/lib/write.php` (`handleSaveProduct`, líneas 108-170)

- **Cambio de contrato:** `save_product` deja de escribir stock en filas que ya existen. Solo:
  - **Crea** filas de inventario para variantes o productos **nuevos** (`INSERT IGNORE`, o `INSERT ... ON DUPLICATE KEY UPDATE stock = stock`).
  - El stock inicial solo se respeta cuando la fila no existe.
- Todo cambio de cantidad sobre un producto existente pasa por **`adjust_stock`** (ya existe en `inventory.php`, con transacción, movimiento y auditoría).
- **Alternativa compatible** (si el formulario necesita seguir editando stock): bloqueo optimista.
  - El cliente envía `expectedStock` (el valor que leyó) junto con `stock` (el nuevo).
  - El servidor hace `UPDATE inventory SET stock = :new WHERE product_id = ? AND branch_id = ? AND stock = :expected`.
  - Si `rowCount() === 0`, responde `409 STOCK_CHANGED` con el valor actual.
  - Mejor aún: convertir la diferencia en un `delta` y registrarlo como movimiento "Ajuste manual".
- **Eliminar** `$effectiveBranchId = $branchId > 0 ? $branchId : 1;` en la ruta de stock. En vista Global (`branchId = 0`) **no se toca el inventario** (el formulario muestra una suma y no se puede guardar en la sede 1).
- Envolver todo `handleSaveProduct` en `beginTransaction / commit / rollBack`.

### 1.2 Actualización masiva de precios sin tocar el stock
**Archivos:** `components/admin/settings/FinanceTab.tsx:125-138`, `context/ProductContext.tsx:46-65`

- Crear un endpoint específico `bulk_update_prices` que reciba `[{id, price, salePrice, variants:[{id, price, salePrice}]}]` y actualice **solo columnas de precio** (y solo el precio dentro del JSON de variantes, conservando el resto del JSON tal como está en BD, leído con `FOR UPDATE`).
- `updateMultipleProducts` deja de reenviar el producto completo.

### 1.3 Edición en el formulario del producto
**Archivos:** `ProductsModule.tsx:50-83`, `ProductFormModal.tsx`

- Al abrir el modal, pedir el producto **fresco** al servidor (`get_product`) y no usar la copia de la lista.
- Mostrar el stock en modo lectura con un botón "Ajustar stock" que llama a `adjust_stock` con delta y motivo.
- Si se mantiene la edición directa, enviar `expectedStock` (ver 1.1) y manejar el `409` con el mensaje: *"El stock cambió (ahora X). Recarga antes de guardar."*

### 1.4 Eliminar el "auto-healing" desde el JSON
**Archivos:** `write.php:542-561`, `inventory.php:154-188`

- Si no existe la fila de inventario de la variante en esa sede, **el stock es 0** y la venta falla con "Stock insuficiente". No se debe sembrar desde `products.variants[].stock`.
- Dejar de persistir `stock` y `branchStock` dentro del JSON `variants` en `save_product` (hacer `unset` antes de `json_encode`). El JSON guarda **atributos**; la tabla `inventory` guarda **cantidades**.
- Comparaciones de IDs con `(string)$a === (string)$b`.

### 1.5 POS: refrescar después de cada venta y no confiar en el stock local
**Archivos:** `components/admin/pos/POSProductGrid.tsx`, `context/POSContext.tsx`

- Hacer que la respuesta de `save_order` devuelva **el stock resultante** de cada `targetId` afectado: `{ stockAfter: { [id]: n } }`.
- En `confirmCheckout`, al recibir el resultado:
  - aplicar `stockAfter` al estado del grid del POS **y** a `ProductContext` (un único `applyStockSnapshot(map)`);
  - o, como mínimo, disparar `loadProducts(true)` del grid (con un evento o callback `onSaleCompleted`).
- Al recibir un error de stock (`409` o "Stock insuficiente"): refrescar el grid y el carrito y mostrar las cantidades reales.
- Refrescar el grid cuando la pestaña recupera el foco (`visibilitychange`) y cada N segundos (por ejemplo 60 s) si el POS está abierto, para cubrir las ventas hechas desde otros dispositivos.
- `maxStock`: usar `Number.isFinite(n) ? n : 0` en lugar de `Number(x) ?? 0` (`POSContext.tsx:108-110`).
- Carritos aparcados (`lyberate_pos_parked`): al recuperarlos, revalidar el stock con el servidor.

### 1.6 Selección de variante robusta
**Archivos:** `POSProductGrid.tsx:207,477`, `POSContext.tsx:104-106`, `write.php:64`

- `hasVariants` se define como `variants.length > 0` (no se exige `variantOptions`).
- Si `variantOptions` está vacío pero hay variantes, abrir el modal con la lista de variantes por nombre o SKU. **Nunca** elegir la primera por defecto (`find` con objeto vacío).
- Validación en backend (`save_product`): rechazar variantes cuyas `selections` no correspondan a `variantOptions`.

### 1.7 Coherencia de la fila "padre consolidada"
- **Opción recomendada:** dejar de mantener una fila de inventario para el padre de productos con variantes. El stock del padre **siempre se calcula** (`SUM` de las variantes) en lectura, como ya hace `injectVariantStock`. Esto elimina las desincronizaciones de `write.php:594-596`, `840-862` e `inventory.php:58-73`.
- Si se mantiene la fila: corregir `handleDelete('orders')` para que también restaure el padre, y sustituir la búsqueda `variants LIKE ? LIMIT 10` por un mapa variante→producto fiable.

### 1.8 Defensas adicionales
- Confirmar que `allowNegativeStock` está en `false` por defecto y que solo un admin puede activarlo.
- `track_stock = 0`: definir el comportamiento (no descontar, o descontar sin límite) y documentarlo.
- Generar el ID de la orden en el servidor, o con `crypto.randomUUID()` en el cliente, para evitar colisiones con `stock_deducted=1`.

---

## Fase 2. "Agotado" consistente (Problema 2)

### 2.1 Una sola definición de disponibilidad, calculada en el servidor
**Archivo:** `public/lib/read.php`

- Definir en el backend:
  - `stock`: stock en la sede de contexto (POS o sede seleccionada).
  - `availableStock`: `SUM(i.stock)` **solo de sedes activas** (`JOIN branches b ON b.id = i.branch_id AND b.is_active = 1`), excluyendo `branch_id = 0`.
  - `isAvailable`: `availableStock > 0` (o `true` si `track_stock = 0`).
  - Para variantes: el mismo par `stock / availableStock` por variante dentro de `injectVariantStock`.
- `globalStock` pasa a ser un alias de `availableStock` (para no romper el frontend) hasta eliminarlo.

### 2.2 Frontend: un único helper
- Crear `utils/stock.ts` con:
  ```ts
  export const getAvailableStock = (p: Product, v?: Variant) => ...
  export const isOutOfStock = (p: Product, v?: Variant) => ...
  export const getBranchStock = (p: Product, v?: Variant) => ... // POS
  ```
- Reemplazar la lógica dispersa en `ProductCard.tsx`, `Shop.tsx`, `Home.tsx`, `Wishlist.tsx`, `DynamicPillDock.tsx`, `ProductDetail.tsx`, `POSProductGrid.tsx`, `POSModals.tsx`, `DashboardModule.tsx` e `InventoryAnalytics.tsx`.
- En un producto con variantes, "Agotado" del producto = **todas** las variantes en 0 (no el valor de la fila padre).
- Eliminar las lecturas de `branchStock` (el campo está inactivo y es engañoso).

### 2.3 Carrera de respuestas en el detalle del producto
**Archivo:** `pages/ProductDetail.tsx:66-77`
- Usar `AbortController` o un `requestId` incremental: ignorar respuestas que no correspondan a la variante seleccionada en ese momento.
- Limpiar `branchAvailability` al cambiar de variante, y mostrar "Consultando…" en lugar de "Agotado" mientras carga.

### 2.4 Corregir el origen de filas basura
- `batch.php:66-77`: si `branchId = 0`, rechazar la importación de stock o pedir la sede de destino explícitamente.
- Reimportación (`ProductImporter.tsx:255-286`): reutilizar el ID de variante existente (emparejar por SKU o `selections`) en lugar de `generateId()`. Al finalizar, borrar las filas de `inventory` de variantes que ya no existen en el producto.
- `handleDelete('branches')`: al desactivar o borrar una sede, decidir qué hacer con su inventario (transferir o archivar) y no dejar filas activas sumando.
- `handleDelete('products')`: borrar las filas de `inventory` del producto y de sus variantes.

### 2.5 Caché y datos viejos
- Añadir en `api.php` las cabeceras `Cache-Control: no-store, no-cache, must-revalidate` y `Pragma: no-cache` (por si hay CDN o Cloudflare).
- Refrescar `ProductContext` en `visibilitychange` (máximo 1 vez por minuto).
- Service Worker: notificar las nuevas versiones de forma más visible en el POS (los terminales pueden quedarse con un bundle viejo).

---

## Fase 3. Buscador POS sin duplicados (Problema 4)

**Archivo:** `components/admin/pos/POSProductGrid.tsx:164-204`

### 3.1 Paginación correcta
- Usar un `useRef` para la página siguiente a pedir (no estado): después de un reset con éxito, `nextPage = 2`; después de un append con éxito, `nextPage++`.
- Usar `loadingRef` (ref) en lugar del estado `loading` dentro del guard, para evitar cierres con valores viejos en el `IntersectionObserver`.

### 3.2 Cancelar o ignorar respuestas obsoletas
- `requestIdRef`: cada reset incrementa el id; cualquier respuesta con un id distinto se descarta (también los appends en vuelo de la búsqueda anterior).
- Opcional: permitir que `api.getProducts` acepte un `signal` de `AbortController` y abortar la petición anterior.

### 3.3 Deduplicación defensiva al fusionar
```ts
setProducts(prev => {
  const base = reset ? [] : prev;
  const seen = new Set(base.map(p => p.id));
  return [...base, ...res.data.filter(p => !seen.has(p.id))];
});
```

### 3.4 Orden determinista en SQL
**Archivo:** `public/lib/read.php:228,230`
- `ORDER BY p.created_at DESC, p.id DESC` (desempate estable para `LIMIT/OFFSET`).
- Opcional: priorizar coincidencias exactas de código o código de barras en la búsqueda.

### 3.5 Duplicados reales en datos
- Revisar el resultado de la consulta de Fase 0. Si hay productos realmente duplicados por importaciones sin ID, preparar un script de **fusión manual asistida** (no automático): conservar el ID con ventas, sumar el inventario y archivar el resto.
- Importador: emparejar por `code`/SKU cuando falta la columna ID, para no crear duplicados.

---

## Fase 4. Hora autoritativa del servidor (Problema 1)

### 4.1 Backend: una sola zona y una sola hora
- En `config.php` (y `config.example.php`):
  ```php
  date_default_timezone_set('America/Caracas');
  // Tras conectar PDO:
  $pdo->exec("SET time_zone = '-04:00'");
  ```
  Así `NOW()` de MySQL y `date()` de PHP coinciden (corrige el cron de carritos abandonados, `push_sender.php:511`).
- Guardar los timestamps **siempre en epoch ms UTC generados por el servidor**.
- **`save_order` (`write.php:635`): ignorar `$o['date']` del cliente** y usar `time()*1000` al crear la orden. Al actualizar, conservar la fecha original.
  - Excepción controlada: ventas offline sincronizadas después (si existen). Aceptar `clientDate` solo como dato informativo en una columna aparte; no usarlo para reportes.
- Igual para `createdAt` en `batch.php:59` y `save_product`: el servidor decide.

### 4.2 Endpoint de hora del servidor
- Nuevo `action=server_time` → `{ now: <ms>, tz: 'America/Caracas', offsetMinutes: -240 }`. Opcionalmente añadir `serverTime` a todas las respuestas de `api.php` y la cabecera `X-Server-Time`.

### 4.3 Frontend: reloj corregido
- Crear `utils/serverClock.ts`:
  ```ts
  let skew = 0; // serverNow - Date.now()
  export const syncServerClock = async () => { /* mide con RTT/2 */ };
  export const now = () => Date.now() + skew;
  export const BUSINESS_TZ = 'America/Caracas';
  export const startOfBusinessDay = (ms = now()) => ...; // calculado en BUSINESS_TZ
  export const toBusinessDateString = (ms) => ...;       // 'YYYY-MM-DD' en BUSINESS_TZ
  export const formatTime = (ms) => new Intl.DateTimeFormat('es-VE', { timeZone: BUSINESS_TZ, ... }).format(ms);
  ```
- Sincronizar al iniciar la app, al volver el foco y cada 10 min. Si `|skew| > 2 min`, mostrar en el POS y el Admin un aviso: *"La hora de este dispositivo es incorrecta"* (solo informativo; el sistema sigue funcionando con la hora del servidor).
- Reemplazar `Date.now()` / `new Date()` de lógica de negocio por `now()`:
  - `CartContext.tsx:245`, `POSContext.tsx:347`, `ProductsModule.tsx:75`, `ProductImporter.tsx:229`.
  - "Hoy", "7d" y "30d": `DashboardModule.tsx:95-133,201-222`, `FinancialAnalytics.tsx`, `SellersAnalytics.tsx`, `SmartAssistant.tsx`, `InventoryAnalyticsModule.tsx:126-130`.
  - Filtros de fecha: `TransactionsModule.tsx:35-36,109,143-159` deben usar `toBusinessDateString` (no `toISOString`, que es UTC).
  - Sesión: `AuthContext.tsx:62` debe usar `now()` para comparar con `exp`.
- **Visualización:** sustituir `toLocaleTimeString()` / `toLocaleDateString()` sin zona por `formatTime` / `formatDate` con `timeZone: BUSINESS_TZ` (OrdersModule, OrderDetailsModal, CustomerDetailModal, TransactionsModule, DashboardModule, POSCart, ReceiptModal, InventoryAnalytics, UsersModule, SecurityTab). Así todos los dispositivos muestran la hora de la tienda, aunque el teléfono esté en otra zona horaria o con la hora mal.
- Gráfico de "hoy": cubrir de 00:00 a 24:00, no solo desde las 08:00.
- Si en el futuro se agrega lógica "Abierto/Cerrado" con `businessHours`, debe usar `now()` + `BUSINESS_TZ` (hoy es solo texto libre).

### 4.4 Datos históricos
- Script de diagnóstico: órdenes cuyo `date` difiere mucho de `created_at` (si existe) o tiene fecha futura. Corregir **solo** con un criterio claro y con backup previo.

---

## Fase 5. Pruebas, migración y despliegue

### 5.1 Pruebas manuales obligatorias (checklist de regresión)
**Stock**
- [ ] Producto simple con stock 1 → venta en POS → el grid muestra 0/AGOTADO sin recargar → una segunda venta es rechazada.
- [ ] Lo mismo con una variante.
- [ ] Dos terminales venden la última unidad a la vez → solo una venta pasa.
- [ ] Vender, y después en Admin editar el precio del producto (con el modal abierto desde antes) → el stock **no** vuelve.
- [ ] Actualización masiva de precios → el stock no cambia en ningún producto.
- [ ] Editar en vista Global → no se modifica el inventario de la sede 1.
- [ ] Cancelar y borrar una orden → el stock se restaura una sola vez (variante y padre).
- [ ] Producto con variantes y `variantOptions` vacío → el POS pide elegir la variante.

**Agotado**
- [ ] Una variante con stock > 0 en una sede activa → card, detalle y POS (de esa sede) coinciden en "disponible".
- [ ] El stock solo en una sede inactiva → se muestra "Agotado" en todas las vistas.
- [ ] Cambiar rápido de variante en el detalle → no se muestra el estado de otra variante.

**Buscador**
- [ ] Búsqueda con más de 24 resultados + scroll → no hay IDs repetidos (validar con `new Set(ids).size === ids.length` en dev).
- [ ] Escribir rápido y borrar → la lista final corresponde a la última búsqueda.
- [ ] Sin warnings de keys duplicadas en la consola.

**Hora**
- [ ] Poner el PC 3 horas adelantado o en otra zona horaria → la venta queda con la hora real del servidor, los reportes de "Hoy" son correctos y aparece el aviso de reloj desfasado.
- [ ] Venta a las 21:00 hora de Caracas → aparece en el día correcto en Transacciones.
- [ ] La sesión no expira antes de tiempo con el reloj adelantado.

### 5.2 Pruebas automatizadas sugeridas
- Unitarias para `utils/stock.ts` y `utils/serverClock.ts` (Vitest).
- Pruebas PHP de `handleSaveOrder` y `handleSaveProduct` contra una BD de prueba: concurrencia (dos transacciones), stock 1 → 0, sin sobrescritura.

### 5.3 Script de saneamiento de datos (después de desplegar Fases 1 y 2)
1. Backup.
2. Mover las filas `branch_id = 0` a la sede correcta, o borrarlas tras revisión manual.
3. Borrar las filas huérfanas de inventario (variantes inexistentes).
4. Recalcular o eliminar las filas padre consolidadas (según la decisión de 1.7).
5. Revisar el stock negativo y registrar movimientos de ajuste con su motivo.
6. Todo dentro de una transacción con un modo `--dry-run` que solo reporte.

### 5.4 Despliegue
- Orden: **backend primero** (compatible con el frontend viejo: los campos nuevos son aditivos y `globalStock` sigue como alias), después el frontend.
- Subir la versión del SW para forzar la actualización en los terminales POS.
- Monitorear `product_movements` las primeras 48 h: buscar "Ajuste Manual" inesperados o stock que sube sin una entrada asociada.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|-------|-----------|
| Cambiar el contrato de `save_product` rompe el formulario o el importador | Bloqueo optimista con `expectedStock` en lugar de prohibir por completo; flag de compatibilidad temporal. |
| Ignorar la fecha del cliente afecta las ventas offline | Columna `client_date` informativa; los reportes usan siempre la fecha del servidor. |
| El saneamiento borra stock real | `--dry-run`, backup y revisión manual de cada fila antes de ejecutar. |
| Tablas MyISAM anulan el bloqueo | Verificación en Fase 0 y migración a InnoDB. |
| Terminales con un bundle viejo siguen sobrescribiendo stock | El backend rechaza las escrituras absolutas sin `expectedStock` (la protección está en el servidor y no depende del cliente). |

---

## 7. Estimación

| Fase | Esfuerzo | Riesgo |
|------|----------|--------|
| 0. Preparación | 0.5 d | Bajo |
| 1. Integridad de stock | 2-3 d | Alto (crítico) |
| 2. Agotado consistente | 1.5-2 d | Medio |
| 3. Buscador POS | 0.5 d | Bajo |
| 4. Hora del servidor | 1.5-2 d | Medio |
| 5. Pruebas + saneamiento + deploy | 1.5 d | Medio |
| **Total** | **~8-10 días** | |

**Quick wins** (se pueden desplegar el día 1): la Fase 3 completa, ignorar `date` del cliente en `save_order` (4.1), refrescar el grid del POS tras la venta (1.5) y sacar `FinanceTab` del flujo `save_product` (1.2).
