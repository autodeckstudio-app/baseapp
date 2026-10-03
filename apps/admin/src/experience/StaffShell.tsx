"use client";

// Presentational staff shell: glass sidebar on the studio ground. Holds no
// auth state; the (admin) layout decides who may see what and passes it in.
import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Ambient } from "./Ambient";
import "./shell.css";

export const STUDIO_LINKS = [
  { href: "/bookings", label: "Bookings" },
  { href: "/jobs", label: "Jobs" },
  { href: "/attendance", label: "Attendance" },
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
  { href: "/cars", label: "Cars for sale" },
] as const;

// Phone bottom bar: five groups. A group lights up for any page inside it and shows its sibling pages as chips.
const GROUPS = [
  { key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard" }], office: true },
  { key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs" }, { href: "/bookings", label: "Bookings" }, { href: "/attendance", label: "Attendance" }], office: false },
  { key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers" }, { href: "/vehicles", label: "Vehicles" }, { href: "/memberships", label: "Memberships" }], office: true },
  { key: "money", label: "Money", icon: "check", links: [{ href: "/payments", label: "Payments" }, { href: "/invoices", label: "Invoices" }, { href: "/expenses", label: "Expenses" }, { href: "/daily-close", label: "Daily Close" }, { href: "/reports", label: "Reports" }], office: true },
] as const;
const MORE_LINKS = [
  { href: "/papers", label: "Papers" }, { href: "/inventory", label: "Inventory" }, { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" }, { href: "/studio", label: "Studio" }, { href: "/stories", label: "Stories" },
  { href: "/cars", label: "Cars for sale" }, { href: "/audit", label: "Audit log" },
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

  const [moreOpen, setMoreOpen] = useState(false);
  const groups = GROUPS.filter((g) => office || !g.office);
  const activeGroup = groups.find((g) => g.links.some((l) => isActive(pathname, l.href)));
  const moreActive = !activeGroup && MORE_LINKS.some((l) => isActive(pathname, l.href));
  const moreLinks = office ? MORE_LINKS : [];

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
          <main className="ax-main">
            {activeGroup && activeGroup.links.length > 1 ? (
              <nav className="ax-chips" aria-label={activeGroup.label}>
                {activeGroup.links.map((l) => (
                  <a key={l.href} href={l.href} className="ax-chip-link" aria-current={isActive(pathname, l.href) ? "page" : undefined}>{l.label}</a>
                ))}
              </nav>
            ) : null}
            {children}
          </main>
          <nav className="ax-tabbar" aria-label="Main">
            {groups.map((g) => (
              <a key={g.key} href={g.links[0]!.href} className="ax-tab" aria-current={activeGroup?.key === g.key ? "page" : undefined}>
                <Icon name={g.icon} size={24} />
                <span>{g.label}</span>
              </a>
            ))}
            <button type="button" className="ax-tab" aria-current={moreActive || moreOpen ? "page" : undefined} onClick={() => setMoreOpen((v) => !v)}>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              <span>More</span>
            </button>
          </nav>
          {moreOpen ? (
            <div className="ax-sheet-back" onClick={() => setMoreOpen(false)}>
              <div className="ax-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
                <div className="ax-sheet-grid">
                  {moreLinks.map((l) => (
                    <a key={l.href} href={l.href} className="ax-sheet-link" aria-current={isActive(pathname, l.href) ? "page" : undefined}>{l.label}</a>
                  ))}
                </div>
                <div className="ax-sheet-foot">
                  <span>{who} · {ROLE_LABEL[role] ?? role}</span>
                  <button type="button" className="ax-button" onClick={onSignOut}>Sign out</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Ambient>
    </div>
  );
}
