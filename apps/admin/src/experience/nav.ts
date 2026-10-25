import { ADMIN_APPROVAL_REVIEW_ENABLED } from "../lib/backend-features";
// Admin navigation: one source for the sidebar, phone bottom bar and Menu sheet.
// Sidebar and More sheet: sections ordered by daily use. Studio-role staff only see sections with office:false links.
export type NavLink = { href: string; label: string; office: boolean };
export const SECTIONS: { group: string; key: string; label: string; icon: string; links: NavLink[] }[] = [
  { group: "Daily", key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard", office: true }] },
  { group: "Daily", key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs", office: false }, { href: "/bookings", label: "Bookings", office: false }, { href: "/pickups", label: "Pickup and drop", office: true }, ...(ADMIN_APPROVAL_REVIEW_ENABLED ? [{ href: "/office-requests", label: "Staff requests", office: true }] : []), { href: "/attendance", label: "Attendance", office: false }] },
  { group: "Daily", key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers", office: true }, { href: "/vehicles", label: "Cars", office: true }, { href: "/papers", label: "Documents", office: true }, { href: "/memberships", label: "Memberships", office: true }] },
  { group: "Daily", key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments", office: true }, { href: "/invoices", label: "Invoices", office: true }, { href: "/expenses", label: "Expenses", office: true }, { href: "/daily-close", label: "Day close", office: true }, { href: "/reports", label: "Reports", office: true }] },
  { group: "Grow", key: "marketing", label: "Marketing", icon: "star", links: [{ href: "/stories", label: "Stories", office: true }, { href: "/offers", label: "Offers", office: true }, { href: "/cars", label: "Cars for sale", office: true }] },
  { group: "Set up", key: "catalogue", label: "Catalogue", icon: "services", links: [{ href: "/services", label: "Pricing", office: true }, { href: "/inventory", label: "Inventory", office: true }] },
  { group: "Set up", key: "admin", label: "Studio and team", icon: "profile", links: [{ href: "/studio", label: "Studio setup", office: true }, { href: "/staff", label: "Team", office: true }, { href: "/audit", label: "Audit log", office: true }] },
];

// Phone bottom bar: four groups plus Menu. A group lights up for any page inside it.
export const GROUPS = [
  { key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard" }], office: true },
  { key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs" }, { href: "/bookings", label: "Bookings" }, { href: "/pickups", label: "Pickup and drop" }, { href: "/attendance", label: "Attendance" }], office: false },
  { key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers" }, { href: "/vehicles", label: "Cars" }, { href: "/papers", label: "Documents" }, { href: "/memberships", label: "Memberships" }], office: true },
  { key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments" }, { href: "/invoices", label: "Invoices" }, { href: "/expenses", label: "Expenses" }, { href: "/daily-close", label: "Day close" }, { href: "/reports", label: "Reports" }], office: true },
] as const;
export const MORE_LINKS = [
  { href: "/papers", label: "Documents" }, { href: "/inventory", label: "Inventory" }, { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" }, { href: "/studio", label: "Studio" }, { href: "/stories", label: "Stories" }, { href: "/offers", label: "Offers" },
  { href: "/cars", label: "Cars for sale" }, { href: "/pickups", label: "Pickup and drop" }, { href: "/audit", label: "Audit log" },
] as const;

