# Guía de Despliegue en Nginx / CloudPanel

Esta carpeta contiene las plantillas de configuración optimizadas para ejecutar **ARA E-commerce Multisede** en servidores **Nginx** (especialmente en **CloudPanel** o VPS con Ubuntu/Debian).

---

## 🚀 Despliegue en CloudPanel (Paso a Paso)

### 1. Crear el Sitio en CloudPanel
1. Entra a tu panel de **CloudPanel**.
2. Ve a **Sites** ➡️ **Add Site** ➡️ **Create a PHP Site**.
3. Configura:
   * **Domain Name:** `tudominio.com` (o subdominio).
   * **PHP Version:** Selecciona **PHP 8.2** (o PHP 8.3).
   * **Site User:** Crea o selecciona el usuario del sitio.

### 2. Configurar el Vhost (Nginx)
1. En la lista de sitios, haz clic en tu dominio y entra a la pestaña **Vhost**.
2. Copia todo el contenido del archivo [`nginx/cloudpanel.conf`](./cloudpanel.conf).
3. Pégalo en el editor de CloudPanel y haz clic en **Save**.
   > *Nota:* CloudPanel sustituirá automáticamente las variables `{{domain_name}}`, `{{root_directory}}`, `{{ssl_certificate}}`, etc.

### 3. Crear la Base de Datos
1. Ve a la pestaña **Databases** en CloudPanel.
2. Crea una nueva base de datos MySQL/MariaDB y un usuario con contraseña segura.
3. Importa el volcado SQL inicial de la tienda mediante phpMyAdmin o consola.

### 4. Compilar y Subir los Archivos
1. En tu máquina local, compila la aplicación para producción:
   ```bash
   npm run build
   ```
2. Sube el contenido de la carpeta `dist/` al directorio raíz del sitio en CloudPanel:
   `/home/[usuario]/htdocs/[tudominio.com]/`
3. En la carpeta `lib/` del servidor, crea tu archivo `config.php` (basado en `lib/config.example.php`) con las credenciales de la base de datos que creaste en el paso 3.

### 5. Activar Certificado SSL
1. En CloudPanel, ve a la pestaña **SSL/TLS**.
2. Haz clic en **New Let's Encrypt Certificate** y pulsa **Create and Install**.

---

## 🛡️ Ventajas de esta Configuración Nginx

* **Enrutamiento SPA Limpio:** Todas las rutas frontend de React/Vite cargan sin recargar la página (`try_files $uri $uri/ /index.html;`).
* **Protección Anti-HTML en API:** Si `api.php` no existe o falla, Nginx devuelve un código de error HTTP nativo (`404` o `500`), **nunca** devuelve `index.html`.
* **SEO Bots Dinámicos:** WhatsApp, Telegram y Facebook son detectados y redirigidos automáticamente a `seo-proxy.php` para generar tarjetas Open Graph reales.
* **Seguridad Reforzada:**
  * Bloqueo total de acceso directo a `/lib/` (donde están las credenciales y lógica PHP interna).
  * Bloqueo de ejecución de PHP en `/uploads/` (inmunidad contra subida de scripts maliciosos).
  * Ocultamiento de archivos sensibles (`.env`, `.git`, `composer.json`).
* **Caché Ultra Rápida:** Assets estáticos con hash cacheados por 1 año, y Service Worker con directiva `no-store` para actualizaciones inmediatas.
