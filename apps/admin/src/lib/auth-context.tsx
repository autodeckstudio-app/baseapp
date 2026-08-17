"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { auth } from "./firebase";

interface AdminAuthState {
  user: User | null;
  claims: AutoDeckClaims | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

// Roles permitted to use the admin app. There is no separate "studio admin"
// role in the approved model (docs/19-multitenant-saas-architecture.md) — the
// 'studio' role is operational staff and cannot access business-configuration
// screens, so it is intentionally excluded here.
const ADMIN_APP_ROLES = new Set(["admin", "superadmin"]);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AutoDeckClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setError(null);
      if (!nextUser) {
        setUser(null);
        setClaims(null);
        setLoading(false);
        return;
      }

      const tokenResult = await nextUser.getIdTokenResult();
      const rawClaims = tokenResult.claims as Record<string, unknown>;
      const role = typeof rawClaims["role"] === "string" ? rawClaims["role"] : null;
      const tenantId = typeof rawClaims["tenantId"] === "string" ? rawClaims["tenantId"] : null;

      if (!role || !ADMIN_APP_ROLES.has(role) || !tenantId) {
        setError("This account does not have admin access.");
        await firebaseSignOut(auth);
        setUser(null);
        setClaims(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      setClaims({
        role: role as AutoDeckClaims["role"],
        tenantId,
        studioId: typeof rawClaims["studioId"] === "string" ? rawClaims["studioId"] : null,
      });
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
      throw new Error("sign-in-failed");
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AdminAuthContext.Provider value={{ user, claims, loading, error, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
