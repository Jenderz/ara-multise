# 🛍️ Ara E-commerce Multisede

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2.0-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
</div>

## 📋 Descripción

**Ara E-commerce Multisede** es una plataforma de comercio electrónico profesional con gestión completa de inventario, punto de venta (POS), y soporte para múltiples sucursales. Desarrollada como Progressive Web App (PWA) instalable en cualquier dispositivo.

### ✨ Características Principales

- 🏢 **Sistema Multisede** - Gestión de múltiples sucursales con inventario independiente
- 🛒 **E-commerce Completo** - Catálogo, carrito, variantes de productos, wishlist
- 📊 **Panel Admin Avanzado** - Dashboard, reportes, estadísticas con gráficos
- 💳 **POS Integrado** - Punto de venta para vendedores
- 📱 **PWA** - Instalable, funciona offline, push notifications
- 🎨 **Diseño Premium** - UI moderna estilo iOS con glassmorphism y modo oscuro
- 🤖 **IA Integrada** - Asistente inteligente con Gemini AI
- 📸 **CDN de Imágenes** - Carga optimizada automática a CDN externo
- 🔐 **Sistema de Roles** - Admin, Vendedor, Master con permisos granulares
- 📈 **Analytics** - Productos más vendidos, reportes de ventas, CRM

---

## 🚀 Inicio Rápido

### Prerrequisitos

- **Node.js** 18+ ([Descargar](https://nodejs.org/))
- **PHP** 8.0+ con MySQL
- **Servidor Web** (Apache/Nginx) o XAMPP/WAMP

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/ara-multisede.git
   cd ara-multisede
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   # Copiar archivo de ejemplo
   cp .env.local.example .env.local
   
   # Editar y agregar tu API Key de Gemini
   # GEMINI_API_KEY=tu_api_key_aqui
   ```

4. **Configurar Backend**
   ```bash
   # Copiar archivo de configuración
   cp public/lib/config.example.php public/lib/config.php
   
   # Editar public/lib/config.php con tus credenciales:
   # - Base de datos (host, nombre, usuario, contraseña)
   # - CDN API Key
   ```

5. **Crear base de datos**
   - Crear una base de datos MySQL
   - Las tablas se crearán automáticamente en la primera ejecución

6. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

7. **Abrir en navegador**
   ```
   http://localhost:5173
   ```

---

## 📦 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

---

## 🏗️ Estructura del Proyecto

```
ara-multisede/
├── 📁 components/          # Componentes React
│   ├── admin/             # Módulos del panel admin
│   ├── Layout.tsx         # Layout principal
│   ├── ProductCard.tsx    # Tarjeta de producto
│   └── ...
├── 📁 context/            # Contextos de estado global
│   ├── StoreContext.tsx   # Estado principal
│   ├── AuthContext.tsx    # Autenticación
│   └── ...
├── 📁 pages/              # Páginas principales
│   ├── Home.tsx           # Landing page
│   ├── Shop.tsx           # Catálogo
│   ├── Admin.tsx          # Panel admin
│   └── ...
├── 📁 services/           # Servicios
│   ├── api.ts             # Cliente API
│   └── geminiService.ts   # IA
├── 📁 public/             # Backend PHP
│   ├── api.php            # Gateway API
│   └── lib/               # Librerías PHP
├── App.tsx                # Componente raíz
├── types.ts               # Tipos TypeScript
└── config.ts              # Configuración
```

---

## 🔧 Configuración

### Frontend (`config.ts`)

```typescript
export const API_URL = 'https://tu-dominio.com/api.php';
export const DEFAULT_IMAGE = 'URL_imagen_placeholder';
```

### Backend (`public/lib/config.php`)

```php
// Base de datos
$host = 'localhost';
$db   = 'nombre_base_datos';
$user = 'usuario';
$pass = 'contraseña';

// CDN
define('CDN_URL', 'https://tu-dominio.com/cdn/receiver.php');
define('CDN_API_KEY', 'tu_api_key');
```

---

## 🎨 Personalización

### Temas y Colores

Edita desde el panel de administración:
- **Admin → Configuración → Apariencia**
- Color primario
- Color de navbar
- Modo oscuro
- Fuente personalizada

### Hero Section

Configura el carrusel principal:
- **Admin → Configuración → Hero**
- Múltiples slides
- Imágenes desktop/mobile
- Alineación y efectos

---

## 📱 PWA - Instalación

La aplicación puede instalarse como app nativa:

1. **En Chrome/Edge**: Click en el ícono de instalación en la barra de direcciones
2. **En móviles**: "Agregar a pantalla de inicio"

### Características PWA

- ✅ Funciona offline
- ✅ Caché inteligente
- ✅ Push notifications
- ✅ Atajos de app
- ✅ Actualización controlada

---

## 🔐 Seguridad

### Archivos Sensibles

**NUNCA subir a Git:**
- `public/lib/config.php` (credenciales DB)
- `.env.local` (API keys)
- Archivos con contraseñas

### Buenas Prácticas

1. Cambiar contraseñas por defecto
2. Usar HTTPS en producción
3. Habilitar `CURLOPT_SSL_VERIFYPEER` en producción
4. Rotar API keys periódicamente
5. Limitar permisos de usuarios

---

## 🚢 Despliegue

### Frontend (Vercel/Netlify)

```bash
npm run build
# Subir carpeta dist/
```

### Backend (cPanel/VPS)

1. Subir carpeta `public/` al servidor
2. Configurar `config.php`
3. Asegurar permisos de escritura en uploads
4. Configurar CORS si es necesario

---

## 🤝 Contribuir

Las contribuciones son bienvenidas:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

---

## 🆘 Soporte

Para soporte o consultas:
- 📧 Email: soporte@tudominio.com
- 💬 WhatsApp: [Tu número]
- 🌐 Web: https://tudominio.com

---

## 🙏 Agradecimientos

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Recharts](https://recharts.org/)

---

<div align="center">
  <p>Hecho con ❤️ por tu equipo</p>
  <p>© 2026 Ara E-commerce Multisede</p>
</div>
