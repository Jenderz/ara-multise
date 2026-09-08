
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Button, Input } from '../components/UIComponents';
import { NavButton } from '../components/admin/Shared';
import { DashboardModule } from '../components/admin/DashboardModule';
import { InventoryHub } from '../components/admin/InventoryHub';
import { OrdersModule } from '../components/admin/OrdersModule';
import { CustomersModule } from '../components/admin/CustomersModule';
import { MarketingModule } from '../components/admin/MarketingModule';
import { SettingsModule } from '../components/admin/SettingsModule';
import { StatisticsModule } from '../components/admin/StatisticsModule';
import { UsersModule } from '../components/admin/UsersModule';
import { POSModule } from '../components/admin/POSModule';
import { TransactionsModule } from '../components/admin/TransactionsModule';
import { SEO } from '../components/SEO';
import { SmartAssistant } from '../components/admin/SmartAssistant';

import {
    LayoutDashboard, ShoppingCart, Users, Megaphone, Settings,
    LogOut, Menu, Home, Rocket, BarChart3, Store, Calculator, UserCog, Box, Wallet, ChevronDown, Check, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Admin = () => {
    const {
        userRole, currentUser, login, logout, products, addProduct, deleteProduct, updateProduct,
        orders, updateOrder, customers, settings, updateSettings, coupons, addCoupon, toggleCoupon, deleteCoupon,
        categories, addCategory, updateCategory, deleteCategory, refreshStoreData,
        branches, currentBranch, switchBranch
    } = useStore();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventory' | 'orders' | 'transactions' | 'customers' | 'users' | 'marketing' | 'settings' | 'statistics'>(() => {
        return (localStorage.getItem('lyberate_admin_tab') as any) || 'dashboard';
    });

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Verificar si es multi-sede
    const isMultiBranch = settings.planTier !== 'single';

    // NOTA SEGURIDAD: Se eliminó el refreshStoreData() automático aquí.
    // El fetch inicial ya lo hace StoreContext.initStore() al montar la app.
    // Re-dispararlo aquí causaba una ráfaga de 2-4 peticiones `get_all`
    // simultáneas que saturaba el servidor y bloqueaba la IP del router.
    // Usar el botón "Actualizar" manual si se necesita forzar una recarga.

    const hasPermission = (module: string) => {
        if (userRole === 'admin') return true;
        if (!currentUser) return false;

        const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : ['dashboard', 'pos', 'orders', 'products_view'];

        // LOGICA DE PERMISOS GRANULARES
        if (module === 'inventory') {
            return perms.includes('products_view') || perms.includes('products_manage') || perms.includes('products');
        }

        if (module === 'transactions') return perms.includes('orders');

        return perms.includes(module);
    };

    useEffect(() => {
        if (userRole === 'seller') {
            if (!hasPermission(activeTab)) {
                const defaults = ['dashboard', 'pos', 'orders'];
                const firstAllowed = defaults.find(m => hasPermission(m)) || 'dashboard';
                setActiveTab(firstAllowed as any);
            }
        }
    }, [activeTab, userRole, currentUser]);

    useEffect(() => {
        setIsSidebarOpen(false);
        localStorage.setItem('lyberate_admin_tab', activeTab);
    }, [activeTab]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setError('');
        try {
            const success = await login(username, password);
            if (!success) {
                setError('Credenciales inválidas');
            }
        } catch (e) {
            setError('Error de autenticación');
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Helper para renderizar selector de sedes
    const BranchSwitcher = () => (
        <div className="relative px-4 mb-6">
            <button
                onClick={() => isMultiBranch && setIsBranchMenuOpen(!isBranchMenuOpen)}
                className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 ${isMultiBranch ? 'hover:border-ios-blue/50 cursor-pointer' : 'cursor-default'} p-3 rounded-xl flex items-center justify-between group transition-all`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-ios-blue">
                        <Store size={16} />
                    </div>
                    <div className="text-left min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isMultiBranch ? 'Sede Activa' : 'Tienda'}</p>
                        <p className="font-bold text-sm text-gray-700 dark:text-gray-200 truncate">{currentBranch?.name || 'Cargando...'}</p>
                    </div>
                </div>
                {isMultiBranch && <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isBranchMenuOpen ? 'rotate-180' : ''}`} />}
            </button>

            {/* Menú Desplegable (Solo Multi) */}
            {isMultiBranch && (
                <>
                    <div className={`absolute left-4 right-4 top-full mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden transition-all duration-200 origin-top ${isBranchMenuOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'}`}>
                        <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                            {branches.map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => { switchBranch(branch.id); setIsBranchMenuOpen(false); }}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${currentBranch?.id === branch.id ? 'bg-ios-blue/10 text-ios-blue font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <span>{branch.name}</span>
                                    {currentBranch?.id === branch.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="bg-gray-50 dark:bg-black/20 p-2 text-center border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={() => { setActiveTab('settings'); setIsBranchMenuOpen(false); }}
                                className="text-[10px] font-bold text-ios-blue hover:underline"
                            >
                                Gestionar Sedes
                            </button>
                        </div>
                    </div>
                    {isBranchMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsBranchMenuOpen(false)}></div>}
                </>
            )}
        </div>
    );

    if (!userRole) {
        return (
            <div className="min-h-screen bg-ios-bg dark:bg-black flex flex-col items-center justify-center p-4">
                <SEO title="Acceso Administrativo" description="Inicia sesión para gestionar tu tienda." />
                <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-white/10 animate-fade-in">
                    <div className="text-center mb-8">
                        {settings.logoUrl ? <img src={settings.logoUrl} className="h-16 w-auto mx-auto object-contain mb-4" /> : <div className="w-16 h-16 bg-ios-blue rounded-2xl mx-auto mb-4" />}
                        <h2 className="text-2xl font-bold text-ios-text dark:text-white">Acceso al Sistema</h2>
                        <p className="text-gray-500 text-sm">Gestiona tu tienda online</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <Input type="text" placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} icon={<UserCog size={18} />} />
                        <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Settings size={18} />} />
                        {error && <p className="text-red-500 text-sm text-center font-bold bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">{error}</p>}
                        <Button type="submit" loading={isLoggingIn} className="w-full py-4 text-lg font-bold shadow-lg shadow-ios-blue/30">Ingresar</Button>
                    </form>

                    <div className="mt-8 text-center">
                        <Link to="/" className="text-ios-blue hover:underline text-sm flex items-center justify-center gap-2"><Home size={16} /> Volver a la Tienda</Link>
                    </div>
                </div>
            </div>
        );
    }

    const handleTabClick = (tab: typeof activeTab) => {
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col lg:flex-row relative">
            <SEO title={`Panel ${userRole === 'admin' ? 'Administrador' : 'Vendedor'}`} description="Gestión interna de la tienda." />

            {/* Mobile Header con soporte para Notch / Dynamic Island de iPhone */}
            <div className="lg:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 px-4 header-safe pb-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Abrir Menú"
                        className="p-2.5 -ml-1 text-ios-text dark:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all rounded-xl flex items-center justify-center shadow-sm"
                    >
                        <Menu size={22} />
                    </button>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-ios-text dark:text-white leading-none">Panel {userRole === 'admin' ? 'Admin' : 'Vendedor'}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{currentBranch?.name}</span>
                    </div>
                </div>

                {/* Quick Branch Switcher Mobile (Solo si Multi) */}
                {isMultiBranch && (
                    <div className="relative">
                        <button
                            onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                            className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-all"
                        >
                            <Store size={15} className="text-ios-blue" />
                            <ChevronDown size={14} className="text-gray-500" />
                        </button>
                        {/* Mobile Dropdown */}
                        {isBranchMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsBranchMenuOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden">
                                    {branches.map(branch => (
                                        <button
                                            key={branch.id}
                                            onClick={() => { switchBranch(branch.id); setIsBranchMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-50 dark:border-white/5 last:border-0 ${currentBranch?.id === branch.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}
                                        >
                                            {branch.name}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-white/10 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 sidebar-safe-top sidebar-safe-bottom shadow-2xl lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-6 pb-2 pt-2 lg:pt-6 flex items-center justify-between">
                    <Link to="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 group cursor-pointer">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Store Logo" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
                        ) : (
                            <div className="w-10 h-10 bg-ios-blue rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-blue-500/30 transition-shadow">
                                {settings.storeName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex flex-col text-left">
                            <h1 className="text-base font-bold text-ios-text dark:text-white truncate max-w-[140px] group-hover:text-ios-blue transition-colors">{settings.storeName}</h1>
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className={`w-2 h-2 rounded-full ${userRole === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{currentUser?.name?.split(' ')[0] || 'Usuario'}</p>
                            </div>
                        </div>
                    </Link>

                    {/* Botón de cierre visible en móvil */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        aria-label="Cerrar Menú"
                        className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <BranchSwitcher />

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
                    {/* --- GRUPO 1: PRINCIPAL --- */}
                    <div className="pb-2">
                        <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Principal</p>
                        {hasPermission('dashboard') && <NavButton active={activeTab === 'dashboard'} onClick={() => handleTabClick('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />}
                        {hasPermission('pos') && <NavButton active={activeTab === 'pos'} onClick={() => handleTabClick('pos')} icon={<Calculator size={20} />} label="Punto de Venta" />}
                    </div>

                    {/* --- GRUPO 2: CATÁLOGO --- */}
                    {hasPermission('inventory') && (
                        <div className="pb-2">
                            <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Catálogo</p>
                            <NavButton active={activeTab === 'inventory'} onClick={() => handleTabClick('inventory')} icon={<Box size={20} />} label="Inventario" />
                        </div>
                    )}

                    {/* --- GRUPO 3: VENTAS Y FINANZAS --- */}
                    {(hasPermission('orders') || hasPermission('transactions')) && (
                        <div className="pb-2">
                            <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Ventas y Finanzas</p>
                            {hasPermission('orders') && <NavButton active={activeTab === 'orders'} onClick={() => handleTabClick('orders')} icon={<ShoppingCart size={20} />} label="Pedidos" badge={orders.filter(o => o.status === 'pending').length} />}
                            {hasPermission('transactions') && <NavButton active={activeTab === 'transactions'} onClick={() => handleTabClick('transactions')} icon={<Wallet size={20} />} label="Transacciones" />}
                        </div>
                    )}

                    {/* --- GRUPO 4: CRM Y GROWTH --- */}
                    {(hasPermission('customers') || (userRole === 'admin')) && (
                        <div className="pb-2">
                            <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Crecimiento</p>
                            {hasPermission('customers') && <NavButton active={activeTab === 'customers'} onClick={() => handleTabClick('customers')} icon={<Users size={20} />} label="Clientes" />}
                            {userRole === 'admin' && <NavButton active={activeTab === 'marketing'} onClick={() => handleTabClick('marketing')} icon={<Megaphone size={20} />} label="Marketing" />}
                        </div>
                    )}

                    {/* --- GRUPO 5: ADMINISTRACIÓN --- */}
                    {(hasPermission('statistics') || userRole === 'admin') && (
                        <div className="pb-2">
                            <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Sistema</p>
                            {hasPermission('statistics') && <NavButton active={activeTab === 'statistics'} onClick={() => handleTabClick('statistics')} icon={<BarChart3 size={20} />} label="Estadísticas" />}
                            {userRole === 'admin' && <NavButton active={activeTab === 'users'} onClick={() => handleTabClick('users')} icon={<UserCog size={20} />} label="Equipo" />}
                            {userRole === 'admin' && <NavButton active={activeTab === 'settings'} onClick={() => handleTabClick('settings')} icon={<Settings size={20} />} label="Configuración" />}
                        </div>
                    )}
                </nav>
                <div className="p-4 border-t border-gray-100 dark:border-white/5 space-y-2 pb-safe">
                    <button onClick={() => { setIsSidebarOpen(false); navigate('/'); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-gray-500 hover:text-ios-blue hover:bg-gray-50 dark:hover:bg-white/5">
                        <Store size={20} />
                        <span className="font-medium text-sm">Ver Tienda</span>
                    </button>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                        <LogOut size={20} />
                        <span className="font-medium text-sm">Cerrar Sesión</span>
                    </button>
                    <div className="pt-2 px-2 flex items-center justify-between text-[11px] text-gray-400">
                        <span className="font-bold tracking-wide">ARA</span>
                        <span className="font-mono bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-semibold text-[10px]">v0.3.0</span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto h-[calc(100dvh-70px)] lg:h-screen p-4 lg:p-8 w-full bg-ios-bg dark:bg-black pb-safe">
                {activeTab === 'dashboard' && hasPermission('dashboard') && <DashboardModule orders={orders} products={products} customers={customers} />}
                {activeTab === 'pos' && hasPermission('pos') && <POSModule />}

                {activeTab === 'inventory' && hasPermission('inventory') &&
                    <InventoryHub
                        products={products}
                        categories={categories}
                        addProduct={addProduct}
                        updateProduct={updateProduct}
                        deleteProduct={deleteProduct}
                        addCategory={addCategory}
                        updateCategory={updateCategory}
                        deleteCategory={deleteCategory}
                    />
                }

                {activeTab === 'orders' && hasPermission('orders') && <OrdersModule orders={orders} updateOrder={updateOrder} settings={settings} />}
                {activeTab === 'transactions' && hasPermission('orders') && <TransactionsModule />}
                {activeTab === 'customers' && hasPermission('customers') && <CustomersModule orders={orders} />}
                {activeTab === 'statistics' && hasPermission('statistics') && <StatisticsModule orders={orders} products={products} customers={customers} categories={categories} />}

                {userRole === 'admin' && activeTab === 'users' && <UsersModule />}
                {userRole === 'admin' && activeTab === 'marketing' && <MarketingModule coupons={coupons} addCoupon={addCoupon} toggleCoupon={toggleCoupon} deleteCoupon={deleteCoupon} settings={settings} />}
                {userRole === 'admin' && activeTab === 'settings' && <SettingsModule settings={settings} updateSettings={updateSettings} logout={logout} />}
            </main>

            {userRole === 'admin' && activeTab !== 'pos' && <SmartAssistant activeTab={activeTab} />}
        </div>
    );
};
