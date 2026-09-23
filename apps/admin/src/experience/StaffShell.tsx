"use client";

// Presentational staff shell: glass sidebar on the studio ground. Holds no
// auth state; the (admin) layout decides who may see what and passes it in.
import type { ReactNode } from "react";
import { Ambient } from "./Ambient";
import "./shell.css";

export const STUDIO_LINKS = [
  { href: "/bookings", label: "Bookings" },
  { href: "/jobs", label: "Jobs" },
] as const;

export const OFFICE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/payments", label: "Payments" },
  { href: "/invoices", label: "Invoices" },
  { href: "/memberships", label: "Memberships" },
  { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" },
  { href: "/studio", label: "Studio" },
  { href: "/audit", label: "Audit log" },
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
      className="ad-nav-link"
      aria-current={isActive(pathname, l.href) ? "page" : undefined}
    >
      {l.label}
    </a>
  );

  return (
    <div className="ad-shell">
      <Ambient>
        <div className="ad-shell-frame">
          <aside className="ad-side" aria-label="Main navigation">
            <a href={home} className="ad-wordmark">
              Auto<span>Deck</span>
            </a>
            <nav className="ad-nav-group" aria-label="Studio">
              <span className="ad-label">Studio</span>
              {STUDIO_LINKS.map(link)}
            </nav>
            {office && (
              <nav className="ad-nav-group" aria-label="Office">
                <span className="ad-label">Office</span>
                {OFFICE_LINKS.map(link)}
              </nav>
            )}
            <div className="ad-side-foot">
              <div className="ad-who">
                <div>{who}</div>
                <span className="ad-chip ad-chip--accent" style={{ marginTop: "var(--ad-space-hair)" }}>
                  {ROLE_LABEL[role] ?? role}
                </span>
              </div>
              <button type="button" className="ad-button" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </aside>
          <main className="ad-main">{children}</main>
        </div>
      </Ambient>
    </div>
  );
}
