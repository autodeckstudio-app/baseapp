"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";
import { colors, spacing } from "@autodeck/ui/tokens";

// Route protection for all /(admin) screens: role-gated to 'admin' | 'superadmin'.
// There is no 'studio' access here — studio staff operate through the Studio App,
// not the admin business-configuration screens (docs/03-autodeck-feature-map.md).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, claims, loading, signOut } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !claims)) {
      router.replace("/login");
    }
  }, [loading, user, claims, router]);

  if (loading) return <p style={{ padding: spacing.xl }}>Loading…</p>;
  if (!user || !claims) return null;

  return (
    <div>
      <header
        style={{
          padding: `${spacing.md}px ${spacing.xl}px`,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <nav className="nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/studio">Studio</a>
          <a href="/services">Services</a>
          <a href="/memberships">Memberships</a>
          <a href="/vehicles">Vehicles</a>
          <a href="/staff">Staff</a>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <span style={{ fontSize: 13, color: colors.textMuted }}>
            {claims.role} · tenant: {claims.tenantId}
          </span>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <main style={{ padding: spacing.xl }}>{children}</main>
    </div>
  );
}
