# Documentación Técnica: Sistema Multi-Sede y Gestión de Pedidos

*Última Actualización: 14/02/2026*

Este documento describe la arquitectura y lógica actual para el manejo de múltiples sedes, la distinción entre ventas POS vs Web, y el flujo de trabajo para pedidos Delivery compartidos.

---

## 1. Identificación de Pedidos (POS vs Web)

El sistema distingue automáticamente el origen de una venta basándose en quién la generó.

### Lógica de Inferencia (`write.php` / `config.php`)
Cuando se guarda o lee un pedido, si no tiene etiqueta explícita, se aplica esta regla:

*   **Venta POS (Punto de Venta):**
    *   Tiene un `seller_id` válido (ej: `user_123`).
    *   Generalmente no tiene dirección de envío detallada.
    *   **Etiqueta:** `delivery_method = 'pos'`
*   **Venta Web (Tienda Online):**
    *   El `seller_id` es vacío, `null`, `'web-client'` o `'online'`.
    *   Generalmente tiene dirección completa.
    *   **Etiqueta:** `delivery_method = 'delivery'`

> **Nota:** El valor por defecto en la base de datos es `'pos'` para priorizar la venta física rápida.

---

## 2. Gestión de "Bandeja Compartida" (Delivery Global)

Para maximizar la eficiencia en un entorno multi-sede, los pedidos Web no se asignan rígidamente a una sucursal hasta que son procesados.

### Flujo de Trabajo:
1.  **Entrada:** Un cliente compra en la web. El pedido se guarda con `branch_id = 1` (Sede Principal) por defecto, estado `pending`.
2.  **Visibilidad Global (`read.php`):**
    *   Cualquier sede (Norte, Sur, Este) puede ver este pedido pendiente.
    *   Aparece en el listado con un **borde naranja** distintivo (`isExternalDelivery`).
3.  **Adopción del Pedido (`OrdersModule.tsx`):**
    *   Cuando un operador en la "Sede Norte" hace clic en **"Completar / Entregar"**:
    *   El sistema **transfiere** automáticamente la propiedad del pedido a la "Sede Norte" (`branch_id` cambia).
    *   El stock se descuenta del inventario de la "Sede Norte".

---

## 3. Manejo de Inventario

### Visualización en POS
*   **Stock Local:** Muestra la cantidad física disponible en la sede actual.
*   **Stock Global:** Si no hay stock local, el sistema muestra "Global: X" indicando que el producto existe en la red de sucursales.

### Descuento de Stock (`write.php`)
*   Se descuenta siempre de la `branch_id` final que completó la orden.
*   Si la orden se cancela, el stock regresa a esa misma sede.

---

## 4. Métricas y Dashboard

El Dashboard financiero ahora desglosa las ventas diarias en dos canales:
*   🛒 **POS:** Ventas realizadas por cajeros/vendedores.
*   🌐 **Web:** Ventas automáticas desde la tienda online.

---

## 5. Notas para Desarrolladores

### Archivos Clave Modificados
*   `public/lib/write.php`: Lógica de escritura, inferencia de tipo y reasignación de sede.
*   `public/lib/read.php`: Consulta SQL con `OR` para ver deliveries globales.
*   `public/lib/config.php`: Mappers para asegurar compatibilidad de datos antiguos.
*   `components/admin/OrdersModule.tsx`: Frontend para la gestión visual.
*   `components/admin/DashboardModule.tsx`: Métricas desglosadas.

### Compatibilidad Mono-Sede
Si el sistema opera en modo "Single Store", toda la lógica de `branch_id` se resuelve automáticamente a `1`, manteniendo la funcionalidad intacta.
