
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { StoreSettings, GeneralConfig, ThemeConfig, HeroConfig, PromoConfig, GiftBannerConfig, SystemConfig, PaymentMethod } from '../types';
import { api } from '../services/api';

const DEFAULT_GENERAL: GeneralConfig = {
    storeName: 'Mi Tienda Virtual',
    logoUrl: 'https://orgemac.com/api/uploads/img_1767849584_a1254615.png',
    appIconUrl: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    whatsappNumber: '',
    aboutUsText: "Somos una tienda comprometida con la calidad.",
    footerDescription: '',
    contactEmail: '',
    contactAddress: '',
    contactGoogleMaps: '',
    socialInstagram: '',
    socialFacebook: '',
    socialTwitter: '',
};

const DEFAULT_THEME: ThemeConfig = {
    primaryColor: '#007AFF',
    navbarColor: 'rgba(255, 255, 255, 0.75)',
    navbarTextColor: '#1C1C1E',
    darkMode: false,
    fontFamily: 'Inter',
};

const DEFAULT_HERO: HeroConfig = {
    homeHeroTitle: "Bienvenido",
    homeHeroSubtitle: "Personaliza este texto.",
    homeHeroImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2000&auto=format&fit=crop",
    homeHeroAlign: 'center',
    homeHeroHeight: 'medium',
    homeHeroOverlayOpacity: 0.3,
    homeHeroGlassEffect: true,
    heroSlides: [],
    homeFeature1Title: '',
    homeFeature1Text: '',
    homeFeature1Icon: 'sparkles',
    homeFeature2Title: '',
    homeFeature2Text: '',
    homeFeature2Icon: 'trending',
    homeFeature3Title: '',
    homeFeature3Text: '',
    homeFeature3Icon: 'leaf',
};

const DEFAULT_PROMO: PromoConfig = {
    homeBannerTitle: '',
    homeBannerText: '',
    homeBannerImage: '',
    homeBannerButtonText: 'Ver Ofertas',
    homeBannerBadgeText: 'Oferta Limitada',
    homeBannerLink: '/shop'
};

const DEFAULT_GIFT: GiftBannerConfig = {
    giftBannerTitle: '',
    giftBannerDescription: '',
    giftBannerImage: '',
    giftBannerButtonText: 'Lo quiero',
    giftBannerWhatsApp: ''
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
    { id: 'cash_usd', name: 'Efectivo Divisa', type: 'fiat', isActive: true },
    { id: 'cash_bs', name: 'Efectivo Bs', type: 'fiat', isActive: true },
    { id: 'pago_movil', name: 'Pago Móvil', type: 'bank', isActive: true },
    { id: 'zelle', name: 'Zelle', type: 'bank', isActive: true },
    { id: 'punto', name: 'Punto de Venta', type: 'bank', isActive: true },
    { id: 'binance', name: 'Binance', type: 'crypto', isActive: true },
];

const DEFAULT_SYSTEM: SystemConfig = {
    seoTitle: 'Tienda Virtual | E-commerce Profesional',
    seoDescription: 'Bienvenido a nuestra tienda online.',
    enableAbandonedCart: true,
    enableOrderUpdates: true,
    priceDisplayMode: 'both',
    currencyRateMode: 'bcv',
    adminPassword: '',
    sellerPassword: '',
    masterPassword: '',
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    users: [],
    logs: [],
    planTier: 'multi' // DEFAULT: Multi-Sede activo. Cambiar a 'single' para limitar.
};

const DEFAULT_SETTINGS: StoreSettings = {
    ...DEFAULT_GENERAL,
    ...DEFAULT_THEME,
    ...DEFAULT_HERO,
    ...DEFAULT_PROMO,
    ...DEFAULT_GIFT,
    ...DEFAULT_SYSTEM
};

const hashPassword = async (text: string): Promise<string> => {
    if (!text) return '';
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface SettingsContextType {
    settings: StoreSettings;
    setSettings: (s: StoreSettings) => void;
    updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
    exchangeRate: number;
    exchangeRateParalelo: number;
    exchangeRateEuro: number;
    activeExchangeRate: number;
    activeCurrencySymbol: string;
    isOffline: boolean;
    setIsOffline: (status: boolean) => void;
    loading: boolean;
    setLoading: (status: boolean) => void;
    localDarkMode: boolean;
    toggleLocalDarkMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
    const settingsRef = useRef<StoreSettings>(DEFAULT_SETTINGS);

    // Local Dark Mode State
    const [localDarkMode, setLocalDarkMode] = useState<boolean>(() => {
        const stored = localStorage.getItem('lyberate_local_dark_mode');
        // Default to system preference if not set locally
        if (stored === null) return window.matchMedia('(prefers-color-scheme: dark)').matches;
        return stored === 'true';
    });

    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [exchangeRateParalelo, setExchangeRateParalelo] = useState<number>(0);
    const [exchangeRateEuro, setExchangeRateEuro] = useState<number>(0);
    const [isOffline, setIsOffline] = useState(false);
    const [loading, setLoading] = useState(true);

    // Tasa activa según modo seleccionado
    const activeExchangeRate =
        settings.currencyRateMode === 'paralelo' ? exchangeRateParalelo
        : settings.currencyRateMode === 'euro_bcv' ? exchangeRateEuro
        : exchangeRate;

    // Símbolo de moneda activo ($ para dólar, € para euro)
    const activeCurrencySymbol = settings.currencyRateMode === 'euro_bcv' ? '€' : '$';

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const toggleLocalDarkMode = () => {
        const newValue = !localDarkMode;
        setLocalDarkMode(newValue);
        localStorage.setItem('lyberate_local_dark_mode', String(newValue));
    };

    useEffect(() => {
        // ─── PROXY DE SERVIDOR ──────────────────────────────────────────────
        // El cliente llama a /rates.php (tu propio servidor PHP).
        // El servidor hace el caché real: 1000 usuarios = 1 req/hora a APIs externas.
        // El cliente también mantiene su propio caché localStorage (1 hora)
        // para no saturar ni tu propio servidor.
        const CLIENT_TTL_MS = 1 * 60 * 60 * 1000; // 1 hora en cliente

        const isFresh = (tsKey: string): boolean => {
            const ts = localStorage.getItem(tsKey);
            if (!ts) return false;
            return Date.now() - Number(ts) < CLIENT_TTL_MS;
        };

        const saveCache = (bcv: number, binance: number, euro: number) => {
            const now = String(Date.now());
            localStorage.setItem('lyberate_ex_rate',         String(bcv));
            localStorage.setItem('lyberate_ex_rate_p',       String(binance));
            localStorage.setItem('lyberate_ex_rate_eur',     String(euro));
            localStorage.setItem('lyberate_ex_rate_ts',      now);
            localStorage.setItem('lyberate_ex_rate_p_ts',    now);
            localStorage.setItem('lyberate_ex_rate_eur_ts',  now);
        };

        const fetchRates = async () => {
            try {
                // 1. Mostrar caché local inmediatamente (evita mostrar 0)
                const cachedBCV = localStorage.getItem('lyberate_ex_rate');
                const cachedBin = localStorage.getItem('lyberate_ex_rate_p');
                const cachedEur = localStorage.getItem('lyberate_ex_rate_eur');
                if (cachedBCV) setExchangeRate(Number(cachedBCV));
                if (cachedBin) setExchangeRateParalelo(Number(cachedBin));
                if (cachedEur) setExchangeRateEuro(Number(cachedEur));

                // 2. Si el caché local es fresco, no consultar ni el proxy
                if (isFresh('lyberate_ex_rate_ts')) {
                    console.log('[Tasas] Caché local válido (1h). Sin petición de red.');
                    return;
                }

                // 3. Consultar el proxy del servidor (1 req al propio backend)
                console.log('[Tasas] Actualizando desde proxy del servidor...');
                const res = await fetch('/rates.php').catch(() => null);

                if (res && res.ok) {
                    const data = await res.json();
                    const bcv     = data.bcv     ? Number(data.bcv)     : Number(cachedBCV  || 0);
                    const binance = data.binance  ? Number(data.binance) : Number(cachedBin  || 0);
                    const euro    = data.euro     ? Number(data.euro)    : Number(cachedEur  || 0);

                    if (bcv)     setExchangeRate(bcv);
                    if (binance) setExchangeRateParalelo(binance);
                    if (euro)    setExchangeRateEuro(euro);

                    saveCache(bcv, binance, euro);
                    console.log(`[Tasas] BCV: ${bcv} | Binance: ${binance} | Euro: ${euro} | Servidor: ${data._cache?.binance_age_min ?? '?'} min atrás`);
                } else {
                    // Fallback: si el proxy falla, usar caché localStorage
                    console.warn('[Tasas] Proxy no disponible, usando caché offline.');
                }
            } catch (e) { console.error("Error fetching rates", e); }
        };
        fetchRates();
    }, []);




    useEffect(() => {
        // Priority: Global Forced > Local Preference > System (handled in initial state)
        const shouldBeDark = settings.forceGlobalDarkMode || localDarkMode;

        if (shouldBeDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        document.documentElement.style.setProperty('--color-primary', settings.primaryColor);
        document.documentElement.style.setProperty('--color-navbar', settings.navbarColor);
        document.documentElement.style.setProperty('--color-navbar-text', settings.navbarTextColor);

        document.title = settings.seoTitle || settings.storeName;

        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        if (settings.appIconUrl) link.href = settings.appIconUrl;
        else if (settings.logoUrl) link.href = settings.logoUrl;

    }, [settings, localDarkMode]);

    const updateSettings = async (newSettings: Partial<StoreSettings>) => {
        const prev = settingsRef.current;
        const safeSettings = { ...newSettings };

        if (safeSettings.adminPassword && safeSettings.adminPassword.length !== 64) {
            safeSettings.adminPassword = await hashPassword(safeSettings.adminPassword);
        }
        if (safeSettings.sellerPassword && safeSettings.sellerPassword.length !== 64) {
            safeSettings.sellerPassword = await hashPassword(safeSettings.sellerPassword);
        }
        if (safeSettings.masterPassword && safeSettings.masterPassword.length !== 64) {
            safeSettings.masterPassword = await hashPassword(safeSettings.masterPassword);
        }

        const merged = { ...prev, ...safeSettings };

        settingsRef.current = merged;
        setSettings(merged);

        try {
            await api.saveSettings(merged);
            const cacheKey = 'lyberate_api_offline_cache';
            const currentCache = localStorage.getItem(cacheKey);
            if (currentCache) {
                const parsed = JSON.parse(currentCache);
                parsed.settings = merged;
                localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }
        } catch (error) {
            console.error("Failed to save settings", error);
            throw error;
        }
    };

    return (
        <SettingsContext.Provider value={{
            settings, setSettings, updateSettings,
            exchangeRate, exchangeRateParalelo, exchangeRateEuro,
            activeExchangeRate, activeCurrencySymbol,
            isOffline, setIsOffline, loading, setLoading,
            localDarkMode, toggleLocalDarkMode
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error("useSettings must be used within SettingsProvider");
    return context;
};
