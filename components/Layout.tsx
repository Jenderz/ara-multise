
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ShoppingBag, LogOut, ArrowLeft, Home, Search, Heart, Lock, Instagram, Facebook, Twitter, MapPin, Mail, Phone, Moon, Sun, LayoutGrid, ArrowRight, ExternalLink, Store, ChevronDown, Check } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PWAInstallPrompt } from './PWAInstallPrompt';

export const Navbar = () => {
  const { cart, setIsCartOpen, setIsSearchOpen, settings, updateSettings, localDarkMode, toggleLocalDarkMode } = useStore();
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Determinar si el modo oscuro está activo
  const isDark = settings.forceGlobalDarkMode || localDarkMode;

  // --- APP BADGING API (PWA 2026) ---
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (cartCount > 0) {
        navigator.setAppBadge(cartCount).catch(() => { });
      } else {
        navigator.clearAppBadge().catch(() => { });
      }
    }
  }, [cartCount]);

  return (
    <nav
      className="sticky top-0 z-40 w-full border-b border-white/10 transition-colors pt-safe"
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : settings.navbarColor,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.storeName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 bg-ios-blue rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                {settings.storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className={`font-bold text-xl tracking-tight truncate max-w-[150px] sm:max-w-none ${settings.hideStoreName ? 'hidden' : 'block'}`}
              style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}
            >
              {settings.storeName}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 mr-auto ml-12">
            <Link to="/" className="text-sm font-medium transition opacity-80 hover:opacity-100" style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}>Inicio</Link>
            <Link to="/shop" className="text-sm font-medium transition opacity-80 hover:opacity-100" style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}>Tienda</Link>
            <Link to="/wishlist" className="text-sm font-medium transition opacity-80 hover:opacity-100" style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}>Deseos</Link>
            <Link to="/about" className="text-sm font-medium transition opacity-80 hover:opacity-100" style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}>Nosotros</Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLocalDarkMode}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
              style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
              style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
              style={{ color: isDark ? '#FFFFFF' : settings.navbarTextColor }}
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const Footer = () => {
  const { settings } = useStore();

  // Extraer URL del iframe si existe
  const mapSrc = useMemo(() => {
    if (!settings.contactGoogleMaps) return null;
    const srcMatch = settings.contactGoogleMaps.match(/src="([^"]+)"/);
    return srcMatch ? srcMatch[1] : null;
  }, [settings.contactGoogleMaps]);

  return (
    <footer className="bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8 md:pb-8 pb-32">

        {/* Grid Layout Moderno */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">

          {/* Columna 1: Marca y Sobre Nosotros (4 columnas) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.storeName} className="h-12 w-auto object-contain" />
              ) : (
                <div className="w-10 h-10 bg-ios-blue rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                  {settings.storeName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-bold text-2xl text-ios-text dark:text-white tracking-tight">{settings.storeName}</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-light">
              {settings.footerDescription || "Tu tienda de confianza con los mejores productos y la mejor atención."}
            </p>
          </div>

          {/* Columna 2: Enlaces Rápidos (3 columnas) */}
          <div className="lg:col-span-3 lg:col-start-6 space-y-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Explorar</h4>
            <ul className="space-y-4">
              <li>
                <Link to="/shop" className="text-sm text-gray-600 dark:text-gray-300 hover:text-ios-blue transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-ios-blue transition-colors"></span> Catálogo Completo
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="text-sm text-gray-600 dark:text-gray-300 hover:text-ios-blue transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-ios-blue transition-colors"></span> Lista de Deseos
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-gray-600 dark:text-gray-300 hover:text-ios-blue transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-ios-blue transition-colors"></span> Nuestra Historia
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Contacto y Mapa (4 columnas) */}
          <div className="lg:col-span-4 lg:col-start-9 space-y-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ubicación y Contacto</h4>

            <div className="space-y-6">
              {/* Dirección Principal */}
              {settings.contactAddress && (
                <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300 group">
                  <MapPin size={18} className="shrink-0 text-ios-blue mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col gap-1">
                    <span className="leading-snug">{settings.contactAddress}</span>
                    {mapSrc && (
                      <a href={mapSrc} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ios-blue hover:underline flex items-center gap-1 font-bold uppercase trekking-widest">
                        Ver en el mapa <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Direcciones Adicionales */}
              {settings.additionalAddresses && settings.additionalAddresses.map((addr, idx) => (
                <div key={addr.id || idx} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300 group">
                  <MapPin size={18} className="shrink-0 text-ios-blue mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col gap-1">
                    <span className="leading-snug">{addr.address}</span>
                    {addr.mapUrl && (
                      <a href={addr.mapUrl.startsWith('http') ? addr.mapUrl : (addr.mapUrl.match(/src="([^"]+)"/)?.[1] || addr.mapUrl)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ios-blue hover:underline flex items-center gap-1 font-bold uppercase trekking-widest">
                        Ver en el mapa <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-3 pt-2">
                {settings.whatsappNumber && (
                  <a href={`https://wa.me/${String(settings.whatsappNumber).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 hover:text-green-600 transition-colors group p-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent hover:border-green-200 hover:bg-green-50 dark:hover:bg-green-900/10">
                    <Phone size={18} className="text-green-500" />
                    <span className="font-mono font-medium">{settings.whatsappNumber}</span>
                    <ExternalLink size={14} className="ml-auto opacity-50 group-hover:opacity-100" />
                  </a>
                )}
                {settings.contactEmail && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 p-2 pl-0">
                    <Mail size={18} className="text-ios-blue ml-2" />
                    <span>{settings.contactEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* MAPA ESTILIZADO */}
            {mapSrc && (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 group">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="opacity-80 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                ></iframe>
                <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/10 dark:ring-white/10 rounded-2xl"></div>
              </div>
            )}
          </div>
        </div>

        {/* Pie de Página Final (Copyright) */}
        <div className="border-t border-gray-100 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
            <p className="flex items-center gap-2">
              &copy; {settings.storeName} {new Date().getFullYear()}
            </p>
            <span className="hidden md:inline text-gray-300 dark:text-gray-700">|</span>
            <Link to="/admin" className="flex items-center gap-1 opacity-50 hover:opacity-100 hover:text-ios-blue transition p-2" aria-label="Acceso Admin">
              <Lock size={12} />
            </Link>
          </div>

          <div className="flex gap-4 items-center">
            {settings.socialInstagram && (
              <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-all">
                <Instagram size={16} />
              </a>
            )}
            {settings.socialFacebook && (
              <a href={settings.socialFacebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                <Facebook size={16} />
              </a>
            )}
            {settings.socialTwitter && (
              <a href={settings.socialTwitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all">
                <Twitter size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { logout, userRole, settings, branches, currentBranch, switchBranch, currentUser } = useStore();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

  // Lógica: Si el usuario tiene sede asignada y no es admin, ocultar el selector
  const canSwitchBranch = userRole === 'admin' || (!currentUser?.assignedBranchId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      <div
        className="py-4 px-6 shadow-md flex justify-between items-center sticky top-0 z-50 transition-colors border-b border-white/10 pt-safe"
        style={{
          backgroundColor: settings.darkMode ? 'rgba(0, 0, 0, 0.8)' : settings.navbarColor,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: settings.darkMode ? '#FFFFFF' : settings.navbarTextColor
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="hover:bg-black/5 dark:hover:bg-white/10 p-2 rounded-full transition"
            style={{ color: settings.darkMode ? '#FFFFFF' : settings.navbarTextColor }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 bg-ios-blue rounded-lg flex items-center justify-center text-white font-bold">
                {settings.storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none" style={{ color: settings.darkMode ? '#FFFFFF' : settings.navbarTextColor }}>
                {settings.storeName}
              </h1>
              <span className="text-[10px] opacity-70">
                {userRole === 'admin' ? 'Administrador' : 'Vendedor'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">

          {/* SELECTOR GLOBAL DE SEDES (Solo si permitido) */}
          {branches.length > 0 && (
            <div className="relative">
              {canSwitchBranch ? (
                <button
                  onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-ios-text dark:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-transparent hover:border-gray-300 dark:hover:border-white/20"
                >
                  <Store size={16} className="text-ios-blue" />
                  <span className="truncate max-w-[150px] hidden sm:inline">{currentBranch?.name || 'Cargando...'}</span>
                  <ChevronDown size={14} className={`transition-transform ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-lg text-sm font-bold border border-gray-100 dark:border-white/5 cursor-default">
                  <Store size={16} className="text-gray-400" />
                  <span className="truncate max-w-[150px] hidden sm:inline text-gray-500">{currentBranch?.name}</span>
                  <Lock size={12} className="text-gray-300" />
                </div>
              )}

              {isBranchMenuOpen && canSwitchBranch && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBranchMenuOpen(false)}></div>
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden animate-slide-up">
                    <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cambiar Sede Activa</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {/* Opción Global para Admin */}
                      {userRole === 'admin' && (
                        <button
                          onClick={() => { switchBranch(0); setIsBranchMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between group transition-colors ${currentBranch?.id === 0 ? 'bg-purple-100 text-purple-700 font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                        >
                          <span className="truncate">Vista Global (Todas)</span>
                          {currentBranch?.id === 0 && <Check size={14} />}
                        </button>
                      )}
                      {branches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => { switchBranch(branch.id); setIsBranchMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between group transition-colors ${currentBranch?.id === branch.id ? 'bg-ios-blue/10 text-ios-blue font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                        >
                          <span className="truncate">{branch.name}</span>
                          {currentBranch?.id === branch.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm font-medium hover:text-red-500 transition hover:bg-black/5 dark:hover:bg-white/10 px-3 py-1.5 rounded-lg"
            style={{ color: settings.darkMode ? '#FFFFFF' : settings.navbarTextColor }}
          >
            <LogOut size={18} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export const ShopLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // ... [El resto del componente ShopLayout permanece igual] ...
  const { settings, setIsCartOpen } = useStore();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'cart') {
      setIsCartOpen(true);
    }
  }, [location]);

  const getNavLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-500 ${isActive
      ? 'text-ios-blue'
      : 'text-gray-400 dark:text-gray-500'
      }`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-ios-bg dark:bg-black select-none">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pt-4 pb-20 md:pb-12">
        {children}
      </main>
      <Footer />



      {/* Rediseño Menú Móvil Ultra-Slim para máxima ligereza */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[70%] max-w-[280px] z-50">
        <div className="bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.06)] h-[54px] flex items-center px-1.5">

          <Link to="/" className={getNavLinkClass('/')}>
            <div className={`p-2 rounded-full transition-all duration-500 ${location.pathname === '/' ? 'bg-ios-blue/10 scale-105' : ''}`}>
              <Home size={18} strokeWidth={location.pathname === '/' ? 2.5 : 1.5} />
            </div>
          </Link>

          <Link to="/shop" className={getNavLinkClass('/shop')}>
            <div className={`p-2 rounded-full transition-all duration-500 ${location.pathname === '/shop' ? 'bg-ios-blue/10 scale-105' : ''}`}>
              <LayoutGrid size={18} strokeWidth={location.pathname === '/shop' ? 2.5 : 1.5} />
            </div>
          </Link>

          <Link to="/wishlist" className={getNavLinkClass('/wishlist')}>
            <div className={`p-2 rounded-full transition-all duration-500 ${location.pathname === '/wishlist' ? 'bg-ios-blue/10 scale-105' : ''}`}>
              <Heart size={18} strokeWidth={location.pathname === '/wishlist' ? 2.5 : 1.5} className={location.pathname === '/wishlist' ? 'fill-ios-blue' : ''} />
            </div>
          </Link>

        </div>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};
