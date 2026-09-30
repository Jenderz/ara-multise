<?php
/**
 * ============================================================================
 * ARA E-COMMERCE MULTISEDE — ROBOTS.TXT DINÁMICO (MARCA BLANCA)
 * ============================================================================
 * 
 * Reglas de rastreo optimizadas para Googlebot, Googlebot-Image, Bingbot y Applebot.
 * Permite la indexación completa de catálogos, productos, favicons e imágenes,
 * mientras protege endpoints internos de API, panel de administración y caché.
 */

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$STORE_URL = "{$protocol}://{$host}";

echo <<<TXT
# ==============================================================================
# ARA E-COMMERCE MULTISEDE — DIRECTIVAS DE RASTREO SEO
# ==============================================================================

User-agent: *
Allow: /
Allow: /product/
Allow: /uploads/
Allow: /favicon.ico
Allow: /favicon.png
Allow: /apple-touch-icon.png
Allow: /icon.png
Disallow: /api.php
Disallow: /cache/
Disallow: /lib/
Disallow: /migrations/
Disallow: /admin
Disallow: /*?*action=

# Googlebot General
User-agent: Googlebot
Allow: /
Allow: /product/
Allow: /uploads/
Allow: /favicon.ico
Allow: /favicon.png

# Googlebot Imágenes (Crítico para que el Favicon y fotos aparezcan en Google Search)
User-agent: Googlebot-Image
Allow: /uploads/
Allow: /favicon.ico
Allow: /favicon.png
Allow: /apple-touch-icon.png
Allow: /icon.png

# Bingbot
User-agent: bingbot
Allow: /
Allow: /product/
Allow: /uploads/
Allow: /favicon.ico
Allow: /favicon.png

# Enlace al Sitemap XML Dinámico del dominio activo
Sitemap: {$STORE_URL}/sitemap.xml

TXT;
exit;
