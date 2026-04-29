
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
  
  const siteTitle = title ? `${title} | ${settings.storeName}` : settings.seoTitle || settings.storeName;
  const metaDescription = description || settings.seoDescription || "La mejor tienda online para tus compras.";
  const metaImage = image || settings.logoUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";
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

  return (
    <Helmet>
      {/* Etiquetas Estándar */}
      <title>{siteTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={settings.storeName} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />

      {/* Datos Estructurados (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};
