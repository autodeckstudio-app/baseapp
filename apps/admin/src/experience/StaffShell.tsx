"use client";

// Presentational staff shell: glass sidebar on the studio ground. Holds no
// auth state; the (admin) layout decides who may see what and passes it in.
import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { LOGO_HORIZONTAL_SVG, LOGO_MARK_SVG, logoDataUri } from "@autodeck/ui/theme";
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

// Sidebar and More sheet: sections ordered by daily use. Studio-role staff only see sections with office:false links.
type NavLink = { href: string; label: string; office: boolean };
const SECTIONS: { key: string; label: string; links: NavLink[] }[] = [
  { key: "today", label: "Today", links: [{ href: "/dashboard", label: "Dashboard", office: true }, { href: "/bookings", label: "Bookings", office: false }, { href: "/pickups", label: "Pickup and drop", office: true }, { href: "/jobs", label: "Jobs", office: false }, { href: "/attendance", label: "Attendance", office: false }] },
  { key: "customers", label: "Customers", links: [{ href: "/customers", label: "Customers", office: true }, { href: "/vehicles", label: "Vehicles", office: true }, { href: "/memberships", label: "Memberships", office: true }] },
  { key: "money", label: "Money", links: [{ href: "/payments", label: "Payments", office: true }, { href: "/invoices", label: "Invoices", office: true }, { href: "/expenses", label: "Expenses", office: true }, { href: "/daily-close", label: "Daily Close", office: true }, { href: "/reports", label: "Reports", office: true }] },
  { key: "catalogue", label: "Catalogue", links: [{ href: "/services", label: "Services and pricing", office: true }, { href: "/inventory", label: "Inventory", office: true }, { href: "/stories", label: "Stories", office: true }, { href: "/cars", label: "Cars for sale", office: true }] },
  { key: "admin", label: "Admin", links: [{ href: "/staff", label: "Team", office: true }, { href: "/studio", label: "Studio", office: true }, { href: "/papers", label: "Papers", office: true }, { href: "/audit", label: "Audit log", office: true }] },
];

// Phone bottom bar: five groups. A group lights up for any page inside it and shows its sibling pages as chips.
const GROUPS = [
  { key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard" }], office: true },
  { key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs" }, { href: "/bookings", label: "Bookings" }, { href: "/attendance", label: "Attendance" }], office: false },
  { key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers" }, { href: "/vehicles", label: "Vehicles" }, { href: "/memberships", label: "Memberships" }], office: true },
  { key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments" }, { href: "/invoices", label: "Invoices" }, { href: "/expenses", label: "Expenses" }, { href: "/daily-close", label: "Daily Close" }, { href: "/reports", label: "Reports" }], office: true },
] as const;
const MORE_LINKS = [
  { href: "/papers", label: "Papers" }, { href: "/inventory", label: "Inventory" }, { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" }, { href: "/studio", label: "Studio" }, { href: "/stories", label: "Stories" },
  { href: "/cars", label: "Cars for sale" }, { href: "/pickups", label: "Pickup and drop" }, { href: "/audit", label: "Audit log" },
] as const;

const LINK_ICON: Record<string, string> = { "/services": "services", "/inventory": "tools", "/stories": "star", "/cars": "car", "/pickups": "car", "/staff": "users", "/studio": "pin", "/papers": "shield", "/audit": "search" };

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
  const sections = SECTIONS.map((sec) => ({ ...sec, links: sec.links.filter((l) => office || !l.office) })).filter((sec) => sec.links.length > 0);
  const moreSections = sections.filter((sec) => sec.key === "catalogue" || sec.key === "admin");

  return (
    <div className="ax-shell">
      <Ambient>
        <div className="ax-shell-frame">
          <aside className="ax-side" aria-label="Main navigation">
            <a href={home} className="ax-wordmark">
              <img className="ax-logo-full" src={logoDataUri(LOGO_HORIZONTAL_SVG)} alt="AutoDeck" style={{ display: "block", height: 30, width: "auto" }} />
              <img className="ax-logo-mark" src={logoDataUri(LOGO_MARK_SVG)} alt="AutoDeck" style={{ display: "none", height: 30, width: "auto" }} />
            </a>
            {sections.map((sec) => (
              <nav key={sec.key} className="ax-nav-group" aria-label={sec.label}>
                <span className="ax-label">{sec.label}</span>
                {sec.links.map(link)}
              </nav>
            ))}
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
                {moreSections.map((sec) => (
                  <div key={sec.key}>
                    <p className="ax-label">{sec.label}</p>
                    <div className="ax-sheet-grid">
                      {sec.links.map((l) => (
                        <a key={l.href} href={l.href} className="ax-sheet-link" aria-current={isActive(pathname, l.href) ? "page" : undefined}><Icon name={(LINK_ICON[l.href] ?? "dot") as never} size={18} /><span>{l.label}</span></a>
                      ))}
                    </div>
                  </div>
                ))}
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
