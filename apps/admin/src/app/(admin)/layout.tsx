"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";
import { canSeeOffice, canVisit, homeFor } from "../../lib/staff-access";
import { colors, spacing } from "@autodeck/ui/tokens";

// Route protection for all /(admin) screens. One staff shell, two modes:
//   STUDIO (bookings, job floor): studio staff and admins.
//   OFFICE (money, catalogue, customers, staff, settings): admins only.
// Studio staff who reach an office route are sent back to the floor. This is
// navigation; Firestore rules and the callables/API routes enforce the same
// boundary server-side. See lib/staff-access.ts.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, claims, loading, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (loading) return;
    if (!user || !claims) {
      router.replace("/login");
    } else if (!canVisit(claims.role, pathname)) {
      router.replace(homeFor(claims.role));
    }
  }, [loading, user, claims, pathname, router]);

  if (loading) return <p style={{ padding: spacing.xl }}>Loading…</p>;
  if (!user || !claims || !canVisit(claims.role, pathname)) return null;
  const office = canSeeOffice(claims.role);

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
          {office && <a href="/dashboard">Dashboard</a>}
          <a href="/bookings">Bookings</a>
          <a href="/jobs">Jobs</a>
          {office && (
            <>
          <a href="/customers">Customers</a>
          <a href="/payments">Payments</a>
          <a href="/invoices">Invoices</a>
          <a href="/audit">Audit Log</a>
          <a href="/studio">Studio</a>
          <a href="/services">Services</a>
          <a href="/memberships">Memberships</a>
          <a href="/vehicles">Vehicles</a>
          <a href="/staff">Staff</a>
            </>
          )}
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
