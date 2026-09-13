
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useStore } from '../context/StoreContext';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'product';
  price?: number;
  currency?: string;
  availability?: boolean;
}

export const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  image, 
  type = 'website',
  price,
  currency = 'USD',
  availability = true
}) => {
  const { settings } = useStore();
  
  // Asegurar que el nombre de la tienda aparezca siempre y descartar títulos genéricos
  const isGenericSeoTitle = !settings.seoTitle 
    || settings.seoTitle.includes('Tienda Virtual | E-commerce') 
    || settings.seoTitle.includes('Tienda Virtual');
  const cleanSeoTitle = isGenericSeoTitle ? '' : settings.seoTitle;

  const siteTitle = title 
    ? `${title} | ${settings.storeName}` 
    : (cleanSeoTitle 
        ? (cleanSeoTitle.includes(settings.storeName) ? cleanSeoTitle : `${settings.storeName} | ${cleanSeoTitle}`)
        : `${settings.storeName} | Catálogo Online Oficial`);

  const isGenericSeoDesc = !settings.seoDescription 
    || settings.seoDescription.includes('Bienvenido a nuestra tienda online.')
    || settings.seoDescription.includes('Bienvenido a nuestra tienda online');
  const metaDescription = description 
    || (!isGenericSeoDesc 
        ? (settings.seoDescription.includes(settings.storeName) ? settings.seoDescription : `${settings.storeName} — ${settings.seoDescription}`) 
        : `Bienvenido a ${settings.storeName}. Explora nuestro catálogo completo de productos, novedades y ofertas.`);

  // El usuario solicita que la imagen para compartir sea el icono PWA (cuadrado 1:1) en vez del logo rectangular
  const metaImage = image || settings.appIconUrl || settings.logoUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";
  const currentUrl = window.location.href;

  // Estructura de datos JSON-LD para Google (Rich Snippets)
  let structuredData = null;

  if (type === 'product') {
    structuredData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": title,
      "image": [metaImage],
      "description": metaDescription,
      "brand": {
        "@type": "Brand",
        "name": settings.storeName
      },
      "offers": {
        "@type": "Offer",
        "url": currentUrl,
        "priceCurrency": currency,
        "price": price,
        "availability": availability ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "Organization",
          "name": settings.storeName
        }
      }
    };
  } else {
    structuredData = {
      "@context": "https://schema.org",
      "@type": "Store",
      "name": settings.storeName,
      "url": window.location.origin,
      "description": settings.seoDescription,
      "image": settings.logoUrl,
      "telephone": settings.whatsappNumber,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": settings.contactAddress
      }
    };
  }

  // URL canónica limpia del producto (sin hash) para que los bots puedan rastrearla
  // Ej: https://tienda.com/#/product/slug → https://tienda.com/product/slug
  const canonicalUrl = currentUrl.replace('/#/product/', '/product/');

  return (
    <Helmet>
      {/* Etiquetas Estándar */}
      <title>{siteTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / WhatsApp / Facebook */}
      <meta property="og:type" content={type === 'product' ? 'product' : 'website'} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={metaDescription} />
      {/* og:image con todas las propiedades requeridas por WhatsApp */}
      <meta property="og:image" content={metaImage} />
      <meta property="og:image:secure_url" content={metaImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="1200" />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:alt" content={siteTitle} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={settings.storeName} />
      <meta property="og:locale" content="es_ES" />
      {/* Precio del producto (Facebook/Instagram Shopping) */}
      {type === 'product' && price && (
        <meta property="product:price:amount" content={String(price)} />
      )}
      {type === 'product' && (
        <meta property="product:price:currency" content={currency} />
      )}

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:image:alt" content={siteTitle} />

      {/* Datos Estructurados (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};
