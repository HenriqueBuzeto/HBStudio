"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  tenantId: string;
  branchId?: string;
  isPartner: boolean;
  partnerRole?: string;
  permissions: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  hasPermission: () => false,
});

export const AUTH_TOKEN_KEY = "hb_erp_access_token";
export const AUTH_USER_KEY = "hb_erp_user_profile";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Carrega a sessão local se existir
    try {
      const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
      const storedUser = sessionStorage.getItem(AUTH_USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Ignora falhas de parse e limpa sessão corrompida
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    try {
      sessionStorage.setItem(AUTH_TOKEN_KEY, newToken);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    } catch {
      // Falha ao persistir em sessionStorage
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    try {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // Ignora erro
    }
    router.push("/login");
  };

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
