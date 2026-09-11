
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { NotificationProvider } from './context/NotificationContext';
import { Home } from './pages/Home';
import { CartDrawer } from './components/CartDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { NotificationSystem } from './components/NotificationSystem';
import { RefreshCw } from 'lucide-react';

// Lazy Loading para dividir el código y reducir el peso inicial (Code Splitting)
const Shop = lazy(() => import('./pages/Shop').then(module => ({ default: module.Shop })));
const Wishlist = lazy(() => import('./pages/Wishlist').then(module => ({ default: module.Wishlist })));
const ProductDetail = lazy(() => import('./pages/ProductDetail').then(module => ({ default: module.ProductDetail })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));

// Preloader Genérico "Tecnología Lyberate" - Versión Minimalista
const GenericPreloader = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-50 dark:bg-black transition-colors duration-500">
            <div className="flex flex-col items-center gap-8 animate-fade-in p-6">

                {/* Animación de Carga Central Minimalista */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    {/* Anillo exterior sutil */}
                    <div className="absolute inset-0 border-2 border-gray-100 dark:border-white/5 rounded-full"></div>
                    {/* Anillo de carga fino */}
                    <div className="absolute inset-0 border-2 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
                    {/* Logo Central */}
                    <div className="absolute inset-0 flex items-center justify-center p-5">
                        <img
                            src="https://orgemac.com/api/uploads/img_1767849584_a1254615.png"
                            alt="Lyberate"
                            className="w-full h-full object-contain opacity-90"
                        />
                    </div>
                </div>

                {/* Texto de Marca Minimalista */}
                <div className="text-center space-y-4">
                    <h1 className="text-xs md:text-sm font-light text-gray-500 dark:text-gray-400 tracking-[0.4em] uppercase">
                        Tecnología Lyberate
                    </h1>
                    {/* Puntos de carga sutiles */}
                    <div className="flex justify-center gap-1.5 opacity-30">
                        <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-0.5 h-0.5 bg-gray-400 dark:bg-white rounded-full animate-bounce"></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE DE AVISO DE ACTUALIZACIÓN ---
const UpdatePrompt = () => {
    const [showUpdate, setShowUpdate] = useState(false);

    useEffect(() => {
        // Escuchar el evento personalizado desde index.tsx
        const handleUpdateAvailable = () => setShowUpdate(true);
        window.addEventListener('sw-update-available', handleUpdateAvailable);
        return () => window.removeEventListener('sw-update-available', handleUpdateAvailable);
    }, []);

    const reloadPage = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg && reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                    window.location.reload();
                }
            });
        } else {
            window.location.reload();
        }
    };

    if (!showUpdate) return null;

    return (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] left-4 right-4 z-[200] animate-slide-up">
            <div className="bg-ios-text/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-black p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-ios-blue rounded-full flex items-center justify-center animate-pulse">
                        <RefreshCw size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight">Nueva versión disponible</p>
                        <p className="text-[10px] opacity-80">Actualiza para ver los cambios.</p>
                    </div>
                </div>
                <button
                    onClick={reloadPage}
                    className="px-4 py-2 bg-white dark:bg-black text-black dark:text-white text-xs font-bold rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                    ACTUALIZAR
                </button>
            </div>
        </div>
    );
};

// Componente Wrapper que decide qué renderizar basado en el estado de carga del Store
const AppContent = () => {
    const { loading, settings } = useStore();

    // --- ACTUALIZACIÓN DINÁMICA DE METADATOS NATIVOS PWA ---
    useEffect(() => {
        if (!settings) return;

        // 1. Actualizar título del documento
        if (settings.storeName) {
            document.title = settings.storeName;
        }

        // 2. Actualizar icono para dispositivos Apple (iOS WebClip)
        const appIcon = settings.appIconUrl || "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";
        let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
        if (appleLink) {
            appleLink.href = appIcon;
        }

        // 3. Actualizar nombre de la app en la pantalla de inicio de iOS
        let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement;
        if (appleTitle && settings.storeName) {
            appleTitle.content = settings.storeName.substring(0, 12);
        }

        // 4. Actualizar color de la barra de estado según tema y color primario
        if (settings.primaryColor) {
            const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
            themeMetas.forEach(meta => {
                meta.setAttribute('content', settings.darkMode ? "#000000" : settings.primaryColor);
            });
        }
    }, [settings]);

    if (loading) {
        return <GenericPreloader />;
    }

    return (
        <Router>
            <div className="font-sans text-ios-text antialiased selection:bg-ios-blue/20">
                <Suspense fallback={<GenericPreloader />}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/wishlist" element={<Wishlist />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/product/:id" element={<ProductDetail />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
                <CartDrawer />
                <SearchOverlay />
                <NotificationSystem />
                <UpdatePrompt />
            </div>
        </Router>
    );
};

const App: React.FC = () => {
    return (
        <StoreProvider>
            <NotificationProvider>
                <AppContent />
            </NotificationProvider>
        </StoreProvider>
    );
};

export default App;
