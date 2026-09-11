
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserAccount, UserRole, ActivityLog } from '../types';
import { api } from '../services/api';
import { useSettings } from './SettingsContext';

// FIX SEGURIDAD: Cache de módulo para api.getSettings()
// Evita que addUser/updateUser/deleteUser hagan una petición GET cada una.
// TTL: 30 segundos (suficiente para operaciones CRUD rápidas).
let _settingsCache: { data: any; ts: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 30_000;

const getCachedSettings = async () => {
    if (_settingsCache && Date.now() - _settingsCache.ts < SETTINGS_CACHE_TTL_MS) {
        return _settingsCache.data;
    }
    const data = await api.getSettings();
    _settingsCache = { data, ts: Date.now() };
    return data;
};

// Invalidar cache al guardar settings (para que el siguiente CRUD lea datos frescos)
const invalidateSettingsCache = () => { _settingsCache = null; };

// Helper de Hashing
const hashPassword = async (text: string): Promise<string> => {
    if (!text) return '';
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface AuthContextType {
    userRole: UserRole;
    currentUser: UserAccount | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    addUser: (user: UserAccount) => Promise<void>;
    updateUser: (user: UserAccount) => Promise<void>;
    deleteUser: (id: string) => void;
    logActivity: (action: ActivityLog['action'], details: string, userOverride?: UserAccount) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper para validar si el token de sesión JWT ha expirado
const isTokenExpired = (token: string | null): boolean => {
    if (!token) return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const payload = JSON.parse(jsonPayload);
        if (!payload.exp) return false;
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
};

const clearAuthStorage = () => {
    localStorage.removeItem('lyberate_auth_token');
    localStorage.removeItem('lyberate_user');
    localStorage.removeItem('lyberate_role');
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings, updateSettings } = useSettings();

    const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
        try {
            const token = localStorage.getItem('lyberate_auth_token');
            if (!token || isTokenExpired(token)) {
                clearAuthStorage();
                return null;
            }
            const saved = localStorage.getItem('lyberate_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            clearAuthStorage();
            return null;
        }
    });

    const [userRole, setUserRole] = useState<UserRole>(() => {
        const token = localStorage.getItem('lyberate_auth_token');
        if (!token || isTokenExpired(token)) {
            clearAuthStorage();
            return null;
        }
        return (localStorage.getItem('lyberate_role') as UserRole) || (currentUser ? currentUser.role : null);
    });

    useEffect(() => {
        const handleUnauthorized = () => {
            clearAuthStorage();
            setUserRole(null);
            setCurrentUser(null);
        };
        window.addEventListener('lyberate:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('lyberate:unauthorized', handleUnauthorized);
    }, []);

    // Helper Universal para asegurar Arrays (Usuarios y Logs)
    const ensureArray = <T,>(input: any): T[] => {
        if (!input) return [];
        if (Array.isArray(input)) return input;

        // Manejo de JSON stringificado (doble encoding PHP)
        if (typeof input === 'string') {
            try {
                const parsed = JSON.parse(input);
                if (Array.isArray(parsed)) return parsed;
                if (typeof parsed === 'object') return Object.values(parsed);
            } catch (e) { return []; }
        }

        // Si viene como objeto indexado (PHP issues), lo convertimos
        if (typeof input === 'object') return Object.values(input);
        return [];
    };

    // Logging System BLINDADO y OPTIMIZADO (SQL BACKEND)
    const logActivity = async (action: ActivityLog['action'], details: string, userOverride?: UserAccount) => {
        const activeUser = userOverride || currentUser;

        // Definir identidad (Usuario o Sistema)
        const userId = activeUser ? activeUser.id : 'system';
        const userName = activeUser ? activeUser.name : 'Sistema';
        const userRole = activeUser ? activeUser.role : 'system';

        // Fire and Forget (Async)
        api.logActivity(userId, userName, userRole || 'system', action, details).catch(err => {
            console.error("Fallo al registrar log", err);
        });
    };

    // Auth Logic - Autenticación Segura en Backend
    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const res = await api.login(username, password);
            if (res && res.status === 'success' && res.user) {
                if (res.token) {
                    localStorage.setItem('lyberate_auth_token', res.token);
                }
                return performLogin(res.user);
            }
            return false;
        } catch (e: any) {
            console.error("Login error:", e);
            return false;
        }
    };

    const performLogin = (user: UserAccount) => {
        setUserRole(user.role);
        setCurrentUser(user);
        localStorage.setItem('lyberate_role', user.role);
        localStorage.setItem('lyberate_user', JSON.stringify(user));

        // CORRECCIÓN CLAVE: Pasar el objeto 'user' directamente.
        // Esto evita que el log use 'null' (el estado anterior) o 'System'.
        logActivity('login', 'Inicio de sesión exitoso', user);
        return true;
    };

    const logout = () => {
        logActivity('login', 'Cierre de sesión');
        clearAuthStorage();
        setUserRole(null);
        setCurrentUser(null);
    };

    // --- USER MANAGEMENT SEGURO Y OPTIMIZADO ---

    const addUser = async (user: UserAccount) => {
        // 1. LECTURA (con cache anti-rafága)
        const freshSettings = await getCachedSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        // 2. PROCESAMIENTO
        if (currentUsers.some((u: UserAccount) => u.username.toLowerCase() === user.username.toLowerCase())) {
            throw new Error(`El usuario "${user.username}" ya existe en la base de datos.`);
        }

        const hashedPassword = await hashPassword(user.password);
        const secureUser = { ...user, password: hashedPassword };

        // 3. ESCRITURA + invalidar cache
        invalidateSettingsCache();
        await updateSettings({ users: [...currentUsers, secureUser] });
        logActivity('create_user', `Creó usuario: ${user.username}`);
    };

    const updateUser = async (user: UserAccount) => {
        // 1. LECTURA (con cache anti-rafága)
        const freshSettings = await getCachedSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        if (currentUsers.length === 0 && settings.users.length > 0) {
            console.warn("Fallo lectura usuarios API, usando local");
        }

        // 2. PROCESAMIENTO
        const existingUser = currentUsers.find((u: UserAccount) => u.id === user.id);
        let secureUser = user;

        if (existingUser && user.password !== existingUser.password) {
            if (user.password.length !== 64) {
                const hashedPassword = await hashPassword(user.password);
                secureUser = { ...user, password: hashedPassword };
            }
        }

        const newUsers = currentUsers.length > 0
            ? currentUsers.map((u: UserAccount) => u.id === user.id ? secureUser : u)
            : [secureUser];

        // 3. ESCRITURA + invalidar cache
        invalidateSettingsCache();
        await updateSettings({ users: newUsers });

        if (currentUser && currentUser.id === user.id) {
            setCurrentUser(secureUser);
            localStorage.setItem('lyberate_user', JSON.stringify(secureUser));
        }
        logActivity('create_user', `Actualizó usuario: ${user.username}`);
    };

    const deleteUser = async (id: string) => {
        // 1. LECTURA (con cache anti-rafága)
        const freshSettings = await getCachedSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        const userToDelete = currentUsers.find((u: UserAccount) => u.id === id);
        if (!userToDelete) return;

        // 2. PROCESAMIENTO
        const newUsers = currentUsers.filter((u: UserAccount) => u.id !== id);

        if (currentUser) {
            logActivity('create_user', `Eliminó usuario: ${userToDelete.username}`);
        }

        // 3. ESCRITURA + invalidar cache
        invalidateSettingsCache();
        await updateSettings({ users: newUsers });
    };

    return (
        <AuthContext.Provider value={{
            userRole, currentUser, login, logout,
            addUser, updateUser, deleteUser,
            logActivity
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
