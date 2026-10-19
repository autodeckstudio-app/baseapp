// Admin navigation: one source for the sidebar, phone bottom bar and Menu sheet.
// Sidebar and More sheet: sections ordered by daily use. Studio-role staff only see sections with office:false links.
export type NavLink = { href: string; label: string; office: boolean };
export const SECTIONS: { group: string; key: string; label: string; icon: string; links: NavLink[] }[] = [
  { group: "Daily", key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard", office: true }, { href: "/jobs", label: "Jobs", office: false }, { href: "/bookings", label: "Bookings", office: false }, { href: "/pickups", label: "Pickup and drop", office: true }, { href: "/attendance", label: "Attendance", office: false }] },
  { group: "Daily", key: "customers", label: "Customers", icon: "users", links: [{ href: "/customers", label: "Customers", office: true }, { href: "/memberships", label: "Memberships", office: true }] },
  { group: "Daily", key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments", office: true }, { href: "/expenses", label: "Expenses", office: true }, { href: "/daily-close", label: "Daily close", office: true }, { href: "/invoices", label: "Invoices", office: true }, { href: "/reports", label: "Reports", office: true }] },
  { group: "Grow", key: "cars", label: "Cars for sale", icon: "car", links: [{ href: "/cars", label: "Cars for sale", office: true }] },
  { group: "Grow", key: "stories", label: "Stories", icon: "star", links: [{ href: "/stories", label: "Stories", office: true }] },
  { group: "Grow", key: "gallery", label: "Gallery", icon: "star", links: [{ href: "/gallery", label: "Gallery", office: false }] },
  { group: "Grow", key: "offers", label: "Offers", icon: "star", links: [{ href: "/offers", label: "Offers", office: true }] },
  { group: "Set up", key: "catalogue", label: "Catalogue", icon: "services", links: [{ href: "/services", label: "Pricing", office: true }, { href: "/inventory", label: "Inventory", office: true }] },
  { group: "Set up", key: "admin", label: "Admin", icon: "profile", links: [{ href: "/staff", label: "Team", office: true }, { href: "/studio", label: "Studio", office: true }, { href: "/papers", label: "Papers", office: true }, { href: "/audit", label: "Audit log", office: true }] },
];

// Phone bottom bar: five groups. A group lights up for any page inside it and shows its sibling pages as chips.
export const GROUPS = [
  { key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard" }], office: true },
  { key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs" }, { href: "/bookings", label: "Bookings" }, { href: "/attendance", label: "Attendance" }], office: false },
  { key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers" }, { href: "/vehicles", label: "Vehicles" }, { href: "/memberships", label: "Memberships" }], office: true },
  { key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments" }, { href: "/expenses", label: "Expenses" }, { href: "/daily-close", label: "Daily close" }, { href: "/invoices", label: "Invoices" }, { href: "/reports", label: "Reports" }], office: true },
] as const;
export const MORE_LINKS = [
  { href: "/papers", label: "Papers" }, { href: "/inventory", label: "Inventory" }, { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" }, { href: "/studio", label: "Studio" }, { href: "/stories", label: "Stories" }, { href: "/gallery", label: "Gallery" }, { href: "/offers", label: "Offers" },
  { href: "/cars", label: "Cars for sale" }, { href: "/pickups", label: "Pickup and drop" }, { href: "/audit", label: "Audit log" },
] as const;

