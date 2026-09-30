
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { NotificationProvider } from './context/NotificationContext';
import { Home } from './pages/Home';
import { CartDrawer } from './components/CartDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { NotificationSystem } from './components/NotificationSystem';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { RefreshCw } from 'lucide-react';

// Lazy Loading para dividir el código y reducir el peso inicial (Code Splitting)
const Shop = lazy(() => import('./pages/Shop').then(module => ({ default: module.Shop })));
const Wishlist = lazy(() => import('./pages/Wishlist').then(module => ({ default: module.Wishlist })));
const ProductDetail = lazy(() => import('./pages/ProductDetail').then(module => ({ default: module.ProductDetail })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));

// Preloader Minimalista "Tecnología Lyberate"
const GenericPreloader = () => {
    return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-black transition-colors duration-300">
            <style>{`
                @keyframes gentle-float {
                    0% { transform: translateY(0px); }
                    100% { transform: translateY(-5px); }
                }
                @keyframes shimmer-glide {
                    0% { transform: translate(-2200px, -2200px); }
                    30%, 100% { transform: translate(2200px, 2200px); }
                }
                @keyframes track-runner {
                    0% { left: -45%; }
                    100% { left: 100%; }
                }
            `}</style>
            <div className="flex flex-col items-center justify-center">
                {/* Isotipo SVG reducido y refinado */}
                <svg
                    className="w-[84px] h-[84px] block drop-shadow-[0_10px_18px_rgba(126,34,206,0.12)]"
                    style={{ animation: 'gentle-float 3.5s ease-in-out infinite alternate' }}
                    viewBox="0 0 2048 2048"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient id="Gradient1" x1="588.142" x2="865.275" y1="411.729" y2="110.386" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#ad50ed"/>
                            <stop offset="1" stopColor="#cc68ff"/>
                        </linearGradient>

                        <linearGradient id="Gradient2" x1="650.756" x2="1120.67" y1="719.615" y2="601.777" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#471586"/>
                            <stop offset="1" stopColor="#7c2fc0"/>
                        </linearGradient>

                        <linearGradient id="Gradient3" x1="611.92" x2="1197.31" y1="1431.41" y2="920.996" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#431482"/>
                            <stop offset="1" stopColor="#963ddc"/>
                        </linearGradient>

                        <linearGradient id="Gradient4" x1="462.685" x2="1171.42" y1="1674.89" y2="909.2" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#6927a9"/>
                            <stop offset="1" stopColor="#b956f8"/>
                        </linearGradient>

                        <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
                            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.1"/>
                            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8"/>
                            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.1"/>
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                        </linearGradient>

                        <mask id="logo-silhouette">
                            <path fill="#ffffff" d="m516.68 316.015 1.65-1.024c9.154-5.761 20.585-15.303 29.579-21.695a992 992 0 0 1 55.45-35.989 865.7 865.7 0 0 1 225.763-95.649c26.542-7.25 57.965-12.817 82.635-19.96-83.176 84.878-140.661 186.15-186.429 294.884 57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201 66.87 187.886 211.769 340.816 390.941 426.096 167.98 79.95 361.95 88.39 540.32 42.84 6.96-2.22 14.3-3.98 21.36-5.94 33.72-9.38 67.07-21.07 99.71-33.67 35.78-13.81 69.48-31.02 103.48-48.55 21.39-12.08 37.58-22.59 58.23-36.23-3.17 19.04-23.5 63.84-32.07 81.91l-9.69 18.12a972.3 972.3 0 0 1-148.87 205.01c-5.02 5.35-26.22 27.49-31.7 31.15-28.79 25.41-49.16 45.01-81.03 69.48-195.31 147.44-441.34 210.94-683.605 176.43-207.869-28.18-399.353-128.13-541.336-282.54a1112 1112 0 0 1-67.384-81.12c-133.078-175.49-191.609-396.37-162.899-614.739 24.426-183.183 95.707-352.605 220.448-489.72 30.124-33.112 62.264-66.553 97.897-93.818 1.352-2.149 20.195-17.235 22.962-18.569z"/>
                            <path fill="#ffffff" d="M725.328 436.582c57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201 66.87 187.886 211.769 340.816 390.941 426.096 167.98 79.95 361.95 88.39 540.32 42.84-3.21 8.6-10.68 5.89-14.6 12.27 4.48 4.81 43.07 14.7 45.47 17.85-16.16 7.4-36.63 16.64-53.25 23.07-82.57 28.7-150.36 49.34-236.85 65.04-209.77 39.77-411.607 17.24-605.756-70.06-187.574-84.35-329.22-209.64-438.026-384.42-29.862-47.97-59.795-100.75-79.651-154.25a793 793 0 0 1 31.419-99.384c65.778-166.643 190.093-317.189 356.754-389.449 25.481-11.071 44.604-17.348 70.871-25.825z"/>
                            <path fill="#ffffff" d="M725.328 436.582c57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201-54.316-163.548-61.951-333.038-5.497-495.931 4.205-12.131 10.396-28.067 13.139-40.291z"/>
                            <path fill="#ffffff" d="m516.68 316.015 1.65-1.024c9.154-5.761 20.585-15.303 29.579-21.695a992 992 0 0 1 55.45-35.989 865.7 865.7 0 0 1 225.763-95.649c26.542-7.25 57.965-12.817 82.635-19.96-83.176 84.878-140.661 186.15-186.429 294.884l-1.597.78c-26.267 8.477-45.39 14.754-70.871 25.825l-.067-1.629c5.895-3.277 19.536-6.724 21.661-12.043-6.17-6.092-14.742-12.191-22.919-15.047-7.13-2.49-5.786-7.854-6.703-8.255-8.489-3.706-23.658-2.143-30.531-8.34-6.269-5.651-12.339-1.76-20.418-3.172-10.289-8.211-23.356-20.554-27.579-33.376 1.738-5.508 2.144-5.586-1.371-10.186-4.321-1.928-6.659-1.2-11.532-.846l-1.857.143c-1.345-4.518-2.067-9.235-2.834-13.481-1.394-7.714-16.768-12.013-22.764-16.754-3.278-2.592-2.668-5.919-6.453-9.174l-1.811.523c-1.123 2.217-1.587 3.602-3.374 5.301l-3.279-1.924-2.564 1.781-.534-1.837c2.416-2.582 4.574-2.83 8.164-4.211 1.743-3.084 2.056-6.69 2.656-10.23l.404.956.64-1.073c-1.075-3.296-.202-1.823-3.115-4.298"/>
                        </mask>
                    </defs>

                    <g>
                        <path fill="url(#Gradient4)" d="m516.68 316.015 1.65-1.024c9.154-5.761 20.585-15.303 29.579-21.695a992 992 0 0 1 55.45-35.989 865.7 865.7 0 0 1 225.763-95.649c26.542-7.25 57.965-12.817 82.635-19.96-83.176 84.878-140.661 186.15-186.429 294.884 57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201 66.87 187.886 211.769 340.816 390.941 426.096 167.98 79.95 361.95 88.39 540.32 42.84 6.96-2.22 14.3-3.98 21.36-5.94 33.72-9.38 67.07-21.07 99.71-33.67 35.78-13.81 69.48-31.02 103.48-48.55 21.39-12.08 37.58-22.59 58.23-36.23-3.17 19.04-23.5 63.84-32.07 81.91l-9.69 18.12a972.3 972.3 0 0 1-148.87 205.01c-5.02 5.35-26.22 27.49-31.7 31.15-28.79 25.41-49.16 45.01-81.03 69.48-195.31 147.44-441.34 210.94-683.605 176.43-207.869-28.18-399.353-128.13-541.336-282.54a1112 1112 0 0 1-67.384-81.12c-133.078-175.49-191.609-396.37-162.899-614.739 24.426-183.183 95.707-352.605 220.448-489.72 30.124-33.112 62.264-66.553 97.897-93.818 1.352-2.149 20.195-17.235 22.962-18.569z"/>
                        <path fill="url(#Gradient3)" d="M725.328 436.582c57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201 66.87 187.886 211.769 340.816 390.941 426.096 167.98 79.95 361.95 88.39 540.32 42.84-3.21 8.6-10.68 5.89-14.6 12.27 4.48 4.81 43.07 14.7 45.47 17.85-16.16 7.4-36.63 16.64-53.25 23.07-82.57 28.7-150.36 49.34-236.85 65.04-209.77 39.77-411.607 17.24-605.756-70.06-187.574-84.35-329.22-209.64-438.026-384.42-29.862-47.97-59.795-100.75-79.651-154.25a793 793 0 0 1 31.419-99.384c65.778-166.643 190.093-317.189 356.754-389.449 25.481-11.071 44.604-17.348 70.871-25.825z"/>
                        <path fill="url(#Gradient2)" d="M725.328 436.582c57.172-13.938 80.258-17.868 139.691-17.641 72.748.277 121.115 11.052 187.811 40.963 71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-12.59 2.34-25.94 3.206-38.59 5.557-52.34 9.721-112.424 26.072-159.246 51.97-5.637 2.775-11.942 5.698-17.276 8.873-80.948 43.226-152.405 129.388-188.131 212.975-3.105 7.265-9.41 21.114-11.758 28.201-54.316-163.548-61.951-333.038-5.497-495.931 4.205-12.131 10.396-28.067 13.139-40.291z"/>
                        <path fill="#8837cb" d="M1052.83 459.904c71.62 35.157 137.21 93.145 182.47 158.516 8.98 12.982 21.74 31.585 27.01 46.301-11.11-.138-21.43-1.471-32.07-1.656-33.32-.581-65.97-.736-99.15 2.943-4.54-.654-8.33-.341-12.9-.19l-.58-.932c12.84-6.731 14.98-10.688 12.32-23.978l.05 1.53c-2.03-8.829-13.82-58.505-24.16-58.779l-1.83 2.616c-4.99-3.999-.25-14.796-3.02-21.75q-1.065.945-2.13 1.863c-1.61-4.089-5.7-15.035-7.96-18.324-3.94-5.735-13.39-14.793-16.27-21.219-3.81-8.097-5.49-18.395-9.37-26.362-4.2-8.649-9.5-12.98-12.31-22.895-1.43-5.056-9.02-6.961-7.63-14.938 3.47-2.884 2.4-1.987 7.53-2.746"/>
                        <path fill="url(#Gradient1)" d="m516.68 316.015 1.65-1.024c9.154-5.761 20.585-15.303 29.579-21.695a992 992 0 0 1 55.45-35.989 865.7 865.7 0 0 1 225.763-95.649c26.542-7.25 57.965-12.817 82.635-19.96-83.176 84.878-140.661 186.15-186.429 294.884l-1.597.78c-26.267 8.477-45.39 14.754-70.871 25.825l-.067-1.629c5.895-3.277 19.536-6.724 21.661-12.043-6.17-6.092-14.742-12.191-22.919-15.047-7.13-2.49-5.786-7.854-6.703-8.255-8.489-3.706-23.658-2.143-30.531-8.34-6.269-5.651-12.339-1.76-20.418-3.172-10.289-8.211-23.356-20.554-27.579-33.376 1.738-5.508 2.144-5.586-1.371-10.186-4.321-1.928-6.659-1.2-11.532-.846l-1.857.143c-1.345-4.518-2.067-9.235-2.834-13.481-1.394-7.714-16.768-12.013-22.764-16.754-3.278-2.592-2.668-5.919-6.453-9.174l-1.811.523c-1.123 2.217-1.587 3.602-3.374 5.301l-3.279-1.924-2.564 1.781-.534-1.837c2.416-2.582 4.574-2.83 8.164-4.211 1.743-3.084 2.056-6.69 2.656-10.23l.404.956.64-1.073c-1.075-3.296-.202-1.823-3.115-4.298"/>
                        <path fill="#b758f4" d="M1871.9 1354.36c21.39-12.08 37.58-22.59 58.23-36.23-3.17 19.04-23.5 63.84-32.07 81.91l-9.69 18.12a972.3 972.3 0 0 1-148.87 205.01c-5.02 5.35-26.22 27.49-31.7 31.15-6.53 1.35-14.59 9-18.89 14.1l-2.15-.43c-1.35-4.88 16.91-24.92-3.76-31.08l-7.32-2.16c5.79-8.87-.97-11.76-7.3-16.52-2.56 1.47-4.52 2.72-6.98 4.36-.56-5.14-1.69-9.37-4.74-13.53-3.57-1.65-11.95.28-16.67.9.1-2.31 1-15.08-1.09-16.17-2.38-1.23-9.03-2.25-11.72-1.43-2.67-4.45-3.67-13.78-6.27-18.9-7.04-13.89-15.71-14.39-14.23-31.2-3.26-4.05-5.31-1.52-6.36-2.59-3.69-3.69-9.15-8.51-12.77-12.1-5.34-5.3-11.88-1.85-15.54-6.7 3.6-12.14 48.42-15.89 52.96-25.16 16.62-6.43 37.09-15.67 53.25-23.07-2.4-3.15-40.99-13.04-45.47-17.85 3.92-6.38 11.39-3.67 14.6-12.27 6.96-2.22 14.3-3.98 21.36-5.94 33.72-9.38 67.07-21.07 99.71-33.67 35.78-13.81 69.48-31.02 103.48-48.55"/>
                        <path fill="#8837cb" d="M1647.35 1442.52c6.96-2.22 14.3-3.98 21.36-5.94 33.72-9.38 67.07-21.07 99.71-33.67 35.78-13.81 69.48-31.02 103.48-48.55.25 1.93.77 2.51-.35 3.55-6.05 5.63-15.34 11.5-21.93 16.45-44.47 33.37-92.53 62.49-142.94 85.92-4.02 1.87-24.92 11.43-28.46 12.36-2.4-3.15-40.99-13.04-45.47-17.85 3.92-6.38 11.39-3.67 14.6-12.27"/>
                        <path fill="#b758f4" d="M489.891 338.293c1.352-2.149 20.195-17.235 22.962-18.569-.848 6.492-16.038 17.327-21.798 19.457z"/>
                    </g>

                    {/* Reflejo interior */}
                    <g mask="url(#logo-silhouette)">
                        <g style={{ animation: 'shimmer-glide 3.4s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
                            <rect x="-1000" y="-1000" width="4000" height="4000" fill="url(#shimmerGradient)"/>
                        </g>
                    </g>
                </svg>

                {/* Tipografía Minimalista */}
                <div className="mt-5 text-center flex flex-col items-center">
                    <span className="text-[7.5px] font-semibold tracking-[0.55em] uppercase text-purple-600 dark:text-purple-400 mb-[3px] pl-[0.55em] opacity-85">
                        TECNOLOGÍA
                    </span>
                    <span className="text-[14px] font-semibold tracking-[0.35em] uppercase text-slate-900 dark:text-slate-100 pl-[0.35em]">
                        LYBERATE
                    </span>
                </div>

                {/* Barra de progreso tipo hairline */}
                <div className="w-16 h-[1.5px] bg-slate-100 dark:bg-zinc-800 rounded-full mt-[18px] relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full w-[45%] bg-gradient-to-r from-transparent via-purple-400 to-purple-700 dark:to-purple-500 rounded-full"
                        style={{ animation: 'track-runner 1.6s ease-in-out infinite' }}
                    />
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

        // 1. Actualizar título del documento como fallback si no ha sido establecido
        if (settings.storeName && !document.title) {
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
                <PWAInstallPrompt />
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
