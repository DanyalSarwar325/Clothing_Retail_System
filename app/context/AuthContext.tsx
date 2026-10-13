"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

type UserRole = 
  | "admin" 
  | "sewing" 
  | "quality" 
  | "handmade" 
  | "adda_work" 
  | "patching" 
  | "press" 
  | "overlock"
  | "clipping"
  | "packing" 
  | "store";

// Role-based access configuration (duplicated for client-side use)
const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    "/",
    "/generate-barcodes",
    "/purchase-orders",
    "/po-receipts",
    "/reports",
    "/add-user",
    "/print-barcodes",
    "/print-final-stickers",
    "/create-product",
    "/product",
    "/users",
    "/quality",
    "/sewing",
    "/handmade",
    "/adda-work",
    "/patching",
    "/press",
    "/packing",
    "/store",
    "/payments",
    "/job-costing",
    "/raw-materials",
    "/revenue",
    "/outpass",
    "/orders",
    "/admin/shopify-orders",
    "/admin/fulfillment-orders",
    "/invoices",
  ],
  sewing: ["/sewing", "/orders"],
  quality: ["/quality", "/orders"],
  handmade: ["/handmade", "/orders"],
  adda_work: ["/adda-work", "/orders"],
  patching: ["/patching", "/orders"],
  press: ["/press", "/orders"],
  overlock: ["/orders"],
  clipping: ["/orders"],
  packing: ["/packing", "/orders"],
  store: ["/store", "/print-barcodes", "/product", "/orders"],
};

// Default redirect route for each role after login
const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: "/",
  sewing: "/sewing",
  quality: "/quality",
  handmade: "/handmade",
  adda_work: "/adda-work",
  patching: "/patching",
  press: "/press",
  overlock: "/",
  clipping: "/",
  packing: "/packing",
  store: "/store",
};

interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();
      
      if (response.ok && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Redirect logic based on auth state
  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === "/login";
    const isPublicRoute = pathname === "/login" || pathname.startsWith("/api/auth/");
    const isUnauthorizedPage = pathname === "/unauthorized";

    if (!user && !isPublicRoute) {
      router.push("/login");
    } else if (user && isLoginPage) {
      // Only redirect from login page to default route
      router.push(ROLE_DEFAULT_ROUTE[user.role] || "/");
    } else if (user && !isUnauthorizedPage && !isPublicRoute) {
      // Check if user can access current route
      const allowedRoutes = ROLE_ROUTES[user.role] || [];
      const hasAccess = allowedRoutes.some(route => {
        if (route === "/") {
          return pathname === "/";
        }
        return pathname === route || pathname.startsWith(route + "/");
      });
      
      if (!hasAccess) {
        // Redirect to their default route if they can't access current page
        router.push(ROLE_DEFAULT_ROUTE[user.role] || "/");
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      setUser(data.user);
      router.push(data.redirectTo);
      return { success: true };
    } catch {
      return { success: false, error: "An error occurred" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      // Use hard redirect to ensure complete logout
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    
    const allowedRoutes = ROLE_ROUTES[user.role] || [];
    return allowedRoutes.some(route => {
      if (route === "/") {
        return path === "/";
      }
      return path === route || path.startsWith(route + "/");
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
