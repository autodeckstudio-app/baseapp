"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";

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

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!user || !claims) return null;

  return (
    <div>
      <header style={{ padding: "12px 24px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <nav className="nav">
          <a href="/studio">Studio</a>
          <a href="/services">Services</a>
          <a href="/staff">Staff</a>
        </nav>
        <div>
          <span style={{ marginRight: 12, fontSize: 13, color: "#555" }}>
            {claims.role} · tenant: {claims.tenantId}
          </span>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
