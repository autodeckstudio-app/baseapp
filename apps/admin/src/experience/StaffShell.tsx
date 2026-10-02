"use client";

// Presentational staff shell: glass sidebar on the studio ground. Holds no
// auth state; the (admin) layout decides who may see what and passes it in.
import type { ReactNode } from "react";
import { Ambient } from "./Ambient";
import "./shell.css";

export const STUDIO_LINKS = [
  { href: "/bookings", label: "Bookings" },
  { href: "/jobs", label: "Jobs" },
  { href: "/attendance", label: "Attendance" },
  { href: "/gallery", label: "Gallery" },
] as const;

export const OFFICE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/payments", label: "Payments" },
  { href: "/invoices", label: "Invoices" },
  { href: "/papers", label: "Papers" },
  { href: "/expenses", label: "Expenses" },
  { href: "/daily-close", label: "Daily Close" },
  { href: "/inventory", label: "Inventory" },
  { href: "/reports", label: "Reports" },
  { href: "/memberships", label: "Memberships" },
  { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" },
  { href: "/studio", label: "Studio" },
  { href: "/audit", label: "Audit log" },
  { href: "/stories", label: "Stories" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: "Owner",
  studio: "Studio",
  superadmin: "Platform",
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface StaffShellProps {
  pathname: string;
  office: boolean;
  role: string;
  who: string;
  home: string;
  onSignOut: () => void;
  children?: ReactNode;
}

export function StaffShell({ pathname, office, role, who, home, onSignOut, children }: StaffShellProps) {
  const link = (l: { href: string; label: string }) => (
    <a
      key={l.href}
      href={l.href}
      className="ax-nav-link"
      aria-current={isActive(pathname, l.href) ? "page" : undefined}
    >
      {l.label}
    </a>
  );

  return (
    <div className="ax-shell">
      <Ambient>
        <div className="ax-shell-frame">
          <aside className="ax-side" aria-label="Main navigation">
            <a href={home} className="ax-wordmark">
              Auto<span>Deck</span>
            </a>
            <nav className="ax-nav-group" aria-label="Studio">
              <span className="ax-label">Studio</span>
              {STUDIO_LINKS.map(link)}
            </nav>
            {office && (
              <nav className="ax-nav-group" aria-label="Office">
                <span className="ax-label">Office</span>
                {OFFICE_LINKS.map(link)}
              </nav>
            )}
            <div className="ax-side-foot">
              <div className="ax-who">
                <div>{who}</div>
                <span className="ax-chip ax-chip--accent" style={{ marginTop: "var(--ad-space-hair)" }}>
                  {ROLE_LABEL[role] ?? role}
                </span>
              </div>
              <button type="button" className="ax-button" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </aside>
          <main className="ax-main">{children}</main>
        </div>
      </Ambient>
    </div>
  );
}
