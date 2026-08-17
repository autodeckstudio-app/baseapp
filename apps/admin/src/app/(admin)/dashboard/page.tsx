"use client";

import Link from "next/link";
import { useAdminAuth } from "../../../lib/auth-context";
import { colors, spacing, radius } from "@autodeck/ui/tokens";

const SECTIONS = [
  { href: "/studio", label: "Studio Settings", description: "Operating hours, holidays, bays and resources." },
  { href: "/services", label: "Service Catalogue", description: "Services, pricing, and vehicle category rules." },
  { href: "/memberships", label: "Membership Plans", description: "Tiers, pricing, included washes, and discounts." },
  { href: "/staff", label: "Staff", description: "Studio and admin accounts, roles, and access." },
];

export default function DashboardPage() {
  const { claims } = useAdminAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>
        {claims?.role} · tenant: {claims?.tenantId}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: spacing.lg, marginTop: spacing.xl }}>
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "block",
              padding: spacing.lg,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              textDecoration: "none",
              color: colors.textPrimary,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: spacing.xs }}>{s.label}</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>{s.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
