import React, { createContext, useContext, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export interface AdminUser {
  username: string;
  role: 'admin';
  token: string;
  name: string;
}

export interface AmbulanceUser {
  ambulance_id: string;
  callsign: string;
  role: 'ambulance';
  token: string;
}

interface AuthContextType {
  adminUser: AdminUser | null;
  ambulanceUser: AmbulanceUser | null;
  isAdminLoggedIn: boolean;
  isAmbulanceLoggedIn: boolean;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => void;
  loginAmbulance: (ambulanceId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAmbulance: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('hc05_admin_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [ambulanceUser, setAmbulanceUser] = useState<AmbulanceUser | null>(() => {
    try {
      const saved = localStorage.getItem('hc05_amb_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const loginAdmin = async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || 'Invalid admin credentials' };
      }
      const user: AdminUser = {
        username: data.user?.username || username,
        role: 'admin',
        token: data.token,
        name: data.user?.name || 'Administrator',
      };
      setAdminUser(user);
      localStorage.setItem('hc05_admin_session', JSON.stringify(user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection failed' };
    }
  };

  const logoutAdmin = () => {
    setAdminUser(null);
    localStorage.removeItem('hc05_admin_session');
  };

  const loginAmbulance = async (ambulanceId: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/ambulance/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ambulanceId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || 'Invalid vehicle ID or password' };
      }
      const user: AmbulanceUser = {
        ambulance_id: data.ambulance_id || ambulanceId.toUpperCase(),
        callsign: data.callsign || data.ambulance?.callsign || ambulanceId.toUpperCase(),
        role: 'ambulance',
        token: data.token,
      };
      setAmbulanceUser(user);
      localStorage.setItem('hc05_amb_session', JSON.stringify(user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection failed' };
    }
  };

  const logoutAmbulance = () => {
    setAmbulanceUser(null);
    localStorage.removeItem('hc05_amb_session');
  };

  return (
    <AuthContext.Provider
      value={{
        adminUser,
        ambulanceUser,
        isAdminLoggedIn: !!adminUser,
        isAmbulanceLoggedIn: !!ambulanceUser,
        loginAdmin,
        logoutAdmin,
        loginAmbulance,
        logoutAmbulance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
