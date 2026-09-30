
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
  noindex?: boolean;
  canonicalPath?: string;
}

export const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  image, 
  type = 'website',
  price,
  currency = 'USD',
  availability = true,
  noindex = false,
  canonicalPath
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
  const metaImage = image || settings.appIconUrl || settings.logoUrl || `${window.location.origin}/favicon.png`;

  // URL canónica autoritativa: limpia de parámetros de tracking (?utm_*) y sin fragmentos de hash (#)
  let canonicalUrl = `${window.location.origin}/`;
  if (canonicalPath) {
    canonicalUrl = `${window.location.origin}/${canonicalPath.replace(/^\/+/, '')}`;
  } else {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/product/')) {
      const prodSlug = hash.replace('#/product/', '').split('?')[0];
      canonicalUrl = `${window.location.origin}/product/${prodSlug}`;
    } else if (hash.startsWith('#/shop')) {
      canonicalUrl = `${window.location.origin}/shop`;
    } else if (hash.startsWith('#/about')) {
      canonicalUrl = `${window.location.origin}/about`;
    } else {
      canonicalUrl = `${window.location.origin}/`;
    }
  }

  // Estructura de datos JSON-LD para Google (Rich Snippets)
  let structuredData: any = null;

  if (type === 'product') {
    structuredData = {
      "@context": "https://schema.org/",
      "@graph": [
        {
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
            "url": canonicalUrl,
            "priceCurrency": currency,
            "price": price,
            "availability": availability ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {
              "@type": "Organization",
              "name": settings.storeName
            },
            "hasMerchantReturnPolicy": {
              "@type": "MerchantReturnPolicy",
              "applicableCountry": "VE",
              "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
              "merchantReturnDays": 7,
              "returnMethod": "https://schema.org/ReturnInStore",
              "returnFees": "https://schema.org/FreeReturn"
            }
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Inicio",
              "item": `${window.location.origin}/`
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Catálogo",
              "item": `${window.location.origin}/shop`
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": title || "Producto",
              "item": canonicalUrl
            }
          ]
        }
      ]
    };
  } else {
    structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${window.location.origin}/#website`,
          "url": `${window.location.origin}/`,
          "name": settings.storeName,
          "description": metaDescription,
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": `${window.location.origin}/shop?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": ["OnlineStore", "Organization"],
          "@id": `${window.location.origin}/#organization`,
          "name": settings.storeName,
          "url": `${window.location.origin}/`,
          "logo": {
            "@type": "ImageObject",
            "url": settings.logoUrl || metaImage
          },
          "image": metaImage,
          "description": metaDescription,
          "telephone": settings.whatsappNumber || undefined,
          "address": settings.contactAddress ? {
            "@type": "PostalAddress",
            "streetAddress": settings.contactAddress
          } : undefined
        }
      ]
    };
  }

  return (
    <Helmet>
      {/* Etiquetas Estándar */}
      <title>{siteTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Favicons Dinámicos Oficiales (Mismo Dominio) */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

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
