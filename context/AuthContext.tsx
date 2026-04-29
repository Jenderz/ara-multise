
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserAccount, UserRole, ActivityLog } from '../types';
import { api } from '../services/api';
import { useSettings } from './SettingsContext';

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { settings, updateSettings } = useSettings();

    const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
        try {
            const saved = localStorage.getItem('lyberate_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const [userRole, setUserRole] = useState<UserRole>(() => {
        return (localStorage.getItem('lyberate_role') as UserRole) || (currentUser ? currentUser.role : null);
    });

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

    // Auth Logic
    const login = async (username: string, password: string): Promise<boolean> => {
        // LECTURA PREVIA: Obtener usuarios frescos (OPTIMIZADO)
        let users: UserAccount[] = [];
        try {
            const freshSettings = await api.getSettings();
            let rawUsers = freshSettings?.users || settings.users;
            users = ensureArray<UserAccount>(rawUsers);
        } catch (e) {
            users = ensureArray<UserAccount>(settings.users);
        }

        const inputHash = await hashPassword(password);

        // 1. Check Users Array (MODO SEGURO)
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.active);

        if (user) {
            if (user.password === inputHash) return performLogin(user);
            // Legacy migration (si la pass no estaba hasheada)
            if (user.password === password) {
                const updatedUser = { ...user, password: inputHash };
                await updateUser(updatedUser);
                return performLogin(updatedUser);
            }
        }

        return false;
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
        setUserRole(null);
        setCurrentUser(null);
        localStorage.removeItem('lyberate_role');
        localStorage.removeItem('lyberate_user');
    };

    // --- USER MANAGEMENT SEGURO Y OPTIMIZADO ---

    const addUser = async (user: UserAccount) => {
        // 1. LECTURA (OPTIMIZADO)
        const freshSettings = await api.getSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        // 2. PROCESAMIENTO
        if (currentUsers.some((u: UserAccount) => u.username.toLowerCase() === user.username.toLowerCase())) {
            throw new Error(`El usuario "${user.username}" ya existe en la base de datos.`);
        }

        const hashedPassword = await hashPassword(user.password);
        const secureUser = { ...user, password: hashedPassword };

        // 3. ESCRITURA
        await updateSettings({ users: [...currentUsers, secureUser] });
        logActivity('create_user', `Creó usuario: ${user.username}`);
    };

    const updateUser = async (user: UserAccount) => {
        // 1. LECTURA (OPTIMIZADO)
        const freshSettings = await api.getSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        if (currentUsers.length === 0 && settings.users.length > 0) {
            // Si la API devuelve vacío pero tenemos localmente, algo falló en la red momentáneamente
            // Intentamos usar settings.users como fallback de seguridad
            console.warn("Fallo lectura usuarios API, usando local");
        }

        // 2. PROCESAMIENTO
        const existingUser = currentUsers.find((u: UserAccount) => u.id === user.id);
        let secureUser = user;

        if (existingUser && user.password !== existingUser.password) {
            // Solo hasheamos si cambió y no parece un hash ya
            if (user.password.length !== 64) {
                const hashedPassword = await hashPassword(user.password);
                secureUser = { ...user, password: hashedPassword };
            }
        }

        // Si currentUsers está vacío (caso borde), usamos el usuario tal cual
        const newUsers = currentUsers.length > 0
            ? currentUsers.map((u: UserAccount) => u.id === user.id ? secureUser : u)
            : [secureUser];

        // 3. ESCRITURA
        await updateSettings({ users: newUsers });

        if (currentUser && currentUser.id === user.id) {
            setCurrentUser(secureUser);
            localStorage.setItem('lyberate_user', JSON.stringify(secureUser));
        }
        logActivity('create_user', `Actualizó usuario: ${user.username}`);
    };

    const deleteUser = async (id: string) => {
        // 1. LECTURA (OPTIMIZADO)
        const freshSettings = await api.getSettings();
        const rawUsers = freshSettings?.users || settings.users;
        const currentUsers = ensureArray<UserAccount>(rawUsers);

        const userToDelete = currentUsers.find((u: UserAccount) => u.id === id);
        if (!userToDelete) return;

        // 2. PROCESAMIENTO
        const newUsers = currentUsers.filter((u: UserAccount) => u.id !== id);

        if (currentUser) {
            logActivity('delete_product', `Eliminó usuario: ${userToDelete.username}`);
        }

        // 3. ESCRITURA
        await updateSettings({ users: newUsers }); // Ya no enviamos logs aquí
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
