
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Button, Input } from '../components/UIComponents';
import { AdminSidebar } from '../components/admin/AdminSidebar';
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
    Menu, Home, Store, UserCog, Settings, ChevronDown
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
            } else {
                // Al iniciar sesión exitosamente con token de staff, recargar datos inmediatamente
                await refreshStoreData();
            }
        } catch (e) {
            setError('Error de autenticación');
        } finally {
            setIsLoggingIn(false);
        }
    };

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

            {/* Sidebar Dinámico y Colapsable */}
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                hasPermission={hasPermission}
                userRole={userRole}
                currentUser={currentUser}
                settings={settings}
                orders={orders}
                branches={branches}
                currentBranch={currentBranch}
                switchBranch={switchBranch}
                logout={logout}
                isMobileOpen={isSidebarOpen}
                setIsMobileOpen={setIsSidebarOpen}
            />

            <main className="flex-1 overflow-y-auto h-[calc(100dvh-70px)] lg:h-screen p-3 sm:p-4 lg:p-8 w-full bg-ios-bg dark:bg-black pb-28 lg:pb-8 min-w-0 transition-all duration-300">
                {activeTab === 'dashboard' && hasPermission('dashboard') && <DashboardModule orders={orders} products={products} customers={customers} setActiveTab={setActiveTab} />}
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
                {userRole === 'admin' && activeTab === 'marketing' && <MarketingModule coupons={coupons} addCoupon={addCoupon} toggleCoupon={toggleCoupon} deleteCoupon={deleteCoupon} settings={settings} updateSettings={updateSettings} />}
                {userRole === 'admin' && activeTab === 'settings' && <SettingsModule settings={settings} updateSettings={updateSettings} logout={logout} />}
            </main>

            {userRole === 'admin' && activeTab !== 'pos' && <SmartAssistant activeTab={activeTab} />}
        </div>
    );
};
