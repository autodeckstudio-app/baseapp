"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";
import { canSeeOffice, canVisit, homeFor } from "../../lib/staff-access";
import { Ambient } from "../../experience/Ambient";
import { StaffShell } from "../../experience/StaffShell";
import "../../experience/shell.css";

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

  if (loading) {
    return (
      <div className="ad-shell">
        <Ambient>
          <p className="ad-label" style={{ padding: "var(--ad-space-section)" }} role="status">
            Loading…
          </p>
        </Ambient>
      </div>
    );
  }
  if (!user || !claims || !canVisit(claims.role, pathname)) return null;
  const office = canSeeOffice(claims.role);
  const who = user.displayName || user.email || "Signed in";

  return (
    <StaffShell
      pathname={pathname}
      office={office}
      role={claims.role}
      who={who}
      home={homeFor(claims.role)}
      onSignOut={() => void signOut()}
    >
      {children}
    </StaffShell>
  );
}
