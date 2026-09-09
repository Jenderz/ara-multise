import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ShoppingCart, Users, Megaphone, Settings,
    LogOut, Store, Calculator, UserCog, Box, Wallet, ChevronDown, Check, X,
    ChevronRight, ChevronLeft, BarChart3
} from 'lucide-react';
import { NavButton } from './Shared';

interface AdminSidebarProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    hasPermission: (module: string) => boolean;
    userRole: string | null;
    currentUser: any;
    settings: any;
    orders: any[];
    branches: any[];
    currentBranch: any;
    switchBranch: (branchId: number) => void;
    logout: () => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    activeTab,
    setActiveTab,
    hasPermission,
    userRole,
    currentUser,
    settings,
    orders,
    branches,
    currentBranch,
    switchBranch,
    logout,
    isMobileOpen,
    setIsMobileOpen
}) => {
    const navigate = useNavigate();

    // Estado fijado (persistido en localStorage)
    const [isPinned, setIsPinned] = useState<boolean>(() => {
        const saved = localStorage.getItem('ara_admin_sidebar_pinned');
        return saved !== null ? saved === 'true' : false; // Por defecto colapsado/dinámico
    });

    // Estado hover en pantallas de escritorio
    const [isHovered, setIsHovered] = useState(false);
    const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

    // En pantallas grandes se expande si está fijado o si el cursor está encima
    const isExpanded = isPinned || isHovered;
    const isMultiBranch = settings.planTier !== 'single';

    const togglePin = () => {
        setIsPinned(prev => {
            const next = !prev;
            localStorage.setItem('ara_admin_sidebar_pinned', String(next));
            return next;
        });
    };

    const handleTabClick = (tab: string) => {
        setActiveTab(tab);
        setIsMobileOpen(false);
    };

    return (
        <>
            {/* Backdrop en móviles */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Contenedor del Sidebar */}
            <aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setIsBranchMenuOpen(false);
                }}
                className={`
                    fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-zinc-900 
                    border-r lg:border border-gray-200/80 dark:border-white/10
                    transition-all duration-300 ease-in-out
                    sidebar-safe-top sidebar-safe-bottom
                    shadow-2xl lg:shadow-xl
                    ${isMobileOpen ? 'translate-x-0 w-72 sm:w-80' : '-translate-x-full lg:translate-x-0'}
                    lg:static lg:my-3 lg:ml-3 lg:rounded-3xl
                    ${isExpanded ? 'lg:w-64' : 'lg:w-[74px]'}
                `}
            >
                {/* Cabecera del Sidebar */}
                <div className={`p-4 pb-3 flex items-center justify-between relative border-b border-gray-100 dark:border-white/5 ${!isExpanded ? 'lg:flex-col lg:gap-3 lg:p-3' : ''}`}>
                    <Link
                        to="/"
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex items-center gap-3 group cursor-pointer overflow-hidden ${!isExpanded ? 'lg:justify-center' : ''}`}
                        title={!isExpanded ? settings.storeName : undefined}
                    >
                        {settings.logoUrl ? (
                            <img
                                src={settings.logoUrl}
                                alt="Store Logo"
                                className="h-9 w-9 object-contain shrink-0 rounded-xl transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-9 h-9 bg-ios-blue rounded-xl shrink-0 flex items-center justify-center text-white font-black text-base shadow-md group-hover:shadow-blue-500/30 transition-shadow">
                                {settings.storeName?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                        )}

                        {/* Nombre de la tienda (solo en expandido o en móvil) */}
                        <div className={`flex flex-col text-left overflow-hidden transition-all duration-200 ${!isExpanded ? 'lg:hidden' : 'block'}`}>
                            <h1 className="text-sm font-black text-ios-text dark:text-white truncate max-w-[130px] group-hover:text-ios-blue transition-colors">
                                {settings.storeName}
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${userRole === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold truncate">
                                    {currentUser?.name?.split(' ')[0] || 'Usuario'}
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* Botón toggle de fijar/colapsar para escritorio (inspirado en la imagen de referencia) */}
                    <button
                        type="button"
                        onClick={togglePin}
                        aria-label={isPinned ? "Colapsar menú lateral" : "Fijar menú lateral expandido"}
                        title={isPinned ? "Desfijar (modo dinámico)" : "Fijar menú expandido"}
                        className={`
                            hidden lg:flex items-center justify-center
                            w-7 h-7 rounded-full bg-ios-blue text-white shadow-md shadow-blue-500/25
                            hover:scale-110 active:scale-95 transition-all
                            ${!isExpanded ? 'lg:mt-1' : ''}
                        `}
                    >
                        {isExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                    </button>

                    {/* Botón de cierre visible en móvil */}
                    <button
                        type="button"
                        onClick={() => setIsMobileOpen(false)}
                        aria-label="Cerrar Menú"
                        className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Selector de Sede (BranchSwitcher) */}
                <div className={`px-3 py-2 relative ${!isExpanded ? 'lg:px-2' : ''}`}>
                    <button
                        type="button"
                        onClick={() => isMultiBranch && setIsBranchMenuOpen(!isBranchMenuOpen)}
                        title={!isExpanded ? `Sede Activa: ${currentBranch?.name || 'Sede'}` : undefined}
                        className={`
                            w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 
                            ${isMultiBranch ? 'hover:border-ios-blue/50 cursor-pointer' : 'cursor-default'} 
                            p-2 rounded-xl flex items-center transition-all
                            ${isExpanded ? 'justify-between' : 'lg:justify-center'}
                        `}
                    >
                        <div className={`flex items-center gap-2.5 overflow-hidden ${!isExpanded ? 'lg:justify-center' : ''}`}>
                            <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-ios-blue shrink-0">
                                <Store size={15} />
                            </div>
                            <div className={`text-left min-w-0 ${!isExpanded ? 'lg:hidden' : 'block'}`}>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">
                                    {isMultiBranch ? 'Sede' : 'Tienda'}
                                </p>
                                <p className="font-bold text-xs text-gray-700 dark:text-gray-200 truncate mt-0.5">
                                    {currentBranch?.name || 'Cargando...'}
                                </p>
                            </div>
                        </div>
                        {isMultiBranch && isExpanded && (
                            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
                        )}
                    </button>

                    {/* Menú Desplegable de Sedes */}
                    {isMultiBranch && isBranchMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsBranchMenuOpen(false)}></div>
                            <div className={`
                                absolute top-full mt-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl 
                                border border-gray-100 dark:border-white/10 z-50 overflow-hidden transition-all
                                ${isExpanded ? 'left-3 right-3' : 'left-full ml-2 w-52'}
                            `}>
                                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                                    {branches.map(branch => (
                                        <button
                                            key={branch.id}
                                            type="button"
                                            onClick={() => { switchBranch(branch.id); setIsBranchMenuOpen(false); }}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${currentBranch?.id === branch.id ? 'bg-ios-blue/10 text-ios-blue font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <span className="truncate">{branch.name}</span>
                                            {currentBranch?.id === branch.id && <Check size={13} />}
                                        </button>
                                    ))}
                                </div>
                                {userRole === 'admin' && (
                                    <div className="bg-gray-50 dark:bg-black/20 p-2 text-center border-t border-gray-100 dark:border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => { setActiveTab('settings'); setIsBranchMenuOpen(false); }}
                                            className="text-[10px] font-bold text-ios-blue hover:underline"
                                        >
                                            Gestionar Sedes
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Lista de Navegación */}
                <nav className="flex-1 px-2.5 py-1 space-y-1.5 overflow-y-auto no-scrollbar">
                    {/* PRINCIPAL */}
                    <div className="space-y-1">
                        {isExpanded ? (
                            <p className="px-3 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Principal</p>
                        ) : (
                            <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2 hidden lg:block" />
                        )}
                        {hasPermission('dashboard') && (
                            <NavButton
                                active={activeTab === 'dashboard'}
                                onClick={() => handleTabClick('dashboard')}
                                icon={<LayoutDashboard size={19} />}
                                label="Dashboard"
                                collapsed={!isExpanded}
                            />
                        )}
                        {hasPermission('pos') && (
                            <NavButton
                                active={activeTab === 'pos'}
                                onClick={() => handleTabClick('pos')}
                                icon={<Calculator size={19} />}
                                label="Punto de Venta"
                                collapsed={!isExpanded}
                            />
                        )}
                    </div>

                    {/* CATÁLOGO */}
                    {hasPermission('inventory') && (
                        <div className="space-y-1">
                            {isExpanded ? (
                                <p className="px-3 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Catálogo</p>
                            ) : (
                                <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2 hidden lg:block" />
                            )}
                            <NavButton
                                active={activeTab === 'inventory'}
                                onClick={() => handleTabClick('inventory')}
                                icon={<Box size={19} />}
                                label="Inventario"
                                collapsed={!isExpanded}
                            />
                        </div>
                    )}

                    {/* VENTAS Y FINANZAS */}
                    {(hasPermission('orders') || hasPermission('transactions')) && (
                        <div className="space-y-1">
                            {isExpanded ? (
                                <p className="px-3 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas y Finanzas</p>
                            ) : (
                                <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2 hidden lg:block" />
                            )}
                            {hasPermission('orders') && (
                                <NavButton
                                    active={activeTab === 'orders'}
                                    onClick={() => handleTabClick('orders')}
                                    icon={<ShoppingCart size={19} />}
                                    label="Pedidos"
                                    badge={orders.filter(o => o.status === 'pending').length}
                                    collapsed={!isExpanded}
                                />
                            )}
                            {hasPermission('transactions') && (
                                <NavButton
                                    active={activeTab === 'transactions'}
                                    onClick={() => handleTabClick('transactions')}
                                    icon={<Wallet size={19} />}
                                    label="Transacciones"
                                    collapsed={!isExpanded}
                                />
                            )}
                        </div>
                    )}

                    {/* CRECIMIENTO */}
                    {(hasPermission('customers') || (userRole === 'admin')) && (
                        <div className="space-y-1">
                            {isExpanded ? (
                                <p className="px-3 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Crecimiento</p>
                            ) : (
                                <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2 hidden lg:block" />
                            )}
                            {hasPermission('customers') && (
                                <NavButton
                                    active={activeTab === 'customers'}
                                    onClick={() => handleTabClick('customers')}
                                    icon={<Users size={19} />}
                                    label="Clientes"
                                    collapsed={!isExpanded}
                                />
                            )}
                            {userRole === 'admin' && (
                                <NavButton
                                    active={activeTab === 'marketing'}
                                    onClick={() => handleTabClick('marketing')}
                                    icon={<Megaphone size={19} />}
                                    label="Marketing"
                                    collapsed={!isExpanded}
                                />
                            )}
                        </div>
                    )}

                    {/* SISTEMA */}
                    {(hasPermission('statistics') || userRole === 'admin') && (
                        <div className="space-y-1">
                            {isExpanded ? (
                                <p className="px-3 pt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sistema</p>
                            ) : (
                                <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2 hidden lg:block" />
                            )}
                            {hasPermission('statistics') && (
                                <NavButton
                                    active={activeTab === 'statistics'}
                                    onClick={() => handleTabClick('statistics')}
                                    icon={<BarChart3 size={19} />}
                                    label="Estadísticas"
                                    collapsed={!isExpanded}
                                />
                            )}
                            {userRole === 'admin' && (
                                <NavButton
                                    active={activeTab === 'users'}
                                    onClick={() => handleTabClick('users')}
                                    icon={<UserCog size={19} />}
                                    label="Equipo"
                                    collapsed={!isExpanded}
                                />
                            )}
                            {userRole === 'admin' && (
                                <NavButton
                                    active={activeTab === 'settings'}
                                    onClick={() => handleTabClick('settings')}
                                    icon={<Settings size={19} />}
                                    label="Configuración"
                                    collapsed={!isExpanded}
                                />
                            )}
                        </div>
                    )}
                </nav>

                {/* Pie del Sidebar */}
                <div className={`p-2.5 border-t border-gray-100 dark:border-white/5 space-y-1 pb-safe ${!isExpanded ? 'lg:p-2' : ''}`}>
                    {/* Botón Ver Tienda */}
                    <button
                        type="button"
                        onClick={() => { setIsMobileOpen(false); navigate('/'); }}
                        title={!isExpanded ? "Ver Tienda" : undefined}
                        className={`
                            w-full flex items-center rounded-xl transition-all 
                            text-gray-500 hover:text-ios-blue hover:bg-gray-50 dark:hover:bg-white/5
                            ${isExpanded ? 'gap-3 px-3.5 py-2' : 'lg:justify-center p-2.5'}
                        `}
                    >
                        <Store size={18} className="shrink-0" />
                        {isExpanded && <span className="font-medium text-xs truncate">Ver Tienda</span>}
                    </button>

                    {/* Botón Cerrar Sesión */}
                    <button
                        type="button"
                        onClick={logout}
                        title={!isExpanded ? "Cerrar Sesión" : undefined}
                        className={`
                            w-full flex items-center rounded-xl transition-all 
                            text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10
                            ${isExpanded ? 'gap-3 px-3.5 py-2' : 'lg:justify-center p-2.5'}
                        `}
                    >
                        <LogOut size={18} className="shrink-0" />
                        {isExpanded && <span className="font-medium text-xs truncate">Cerrar Sesión</span>}
                    </button>

                    {/* Versión */}
                    <div className={`pt-1 px-1 flex items-center text-[10px] text-gray-400 ${isExpanded ? 'justify-between' : 'lg:justify-center'}`}>
                        {isExpanded ? (
                            <>
                                <span className="font-bold tracking-wide">ARA</span>
                                <span className="font-mono bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-semibold">
                                    v0.3.0
                                </span>
                            </>
                        ) : (
                            <span className="font-mono text-[9px] bg-gray-100 dark:bg-white/10 text-gray-500 px-1 py-0.5 rounded">
                                v0.3
                            </span>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};
