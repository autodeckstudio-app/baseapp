import type { AuditLog } from "@autodeck/core";
export interface AuditTarget { label: string; href: string | null }
const verbs: Record<string, string> = { created: "created", submitted: "submitted", reviewed: "reviewed", updated: "updated", cancelled: "cancelled", confirmed: "confirmed", quoted: "prepared a quote for", quote_approved: "approved the quote for", status_advanced: "advanced the job for", sealed: "completed quality checks for", recorded: "recorded a payment for", generated: "generated", paid: "marked paid", issued: "issued", archived: "archived", restored: "restored", deleted: "deleted", role_changed: "changed the role of", missed: "marked missed", purchased: "purchased", activated: "activated", expired: "marked expired" };
export function auditVerb(entry: AuditLog): string {
  if (entry.action === "paper.reviewed") return entry.after?.status === "REJECTED" ? "rejected" : entry.after?.status === "VERIFIED" ? "verified" : "sent for manual review";
  const part = entry.action.includes(".") ? entry.action.split(".").slice(1).join(" ") : entry.action.toLowerCase();
  return verbs[part] ?? part.replaceAll("_", " ");
}
export function auditTarget(entry: AuditLog, labels: Record<string, string> = {}): AuditTarget {
  const data = { ...(entry.before ?? {}), ...(entry.after ?? {}), ...(entry.metadata ?? {}) };
  const str = (key: string) => typeof data[key] === "string" ? String(data[key]) : "";
  const type = entry.entityType.toLowerCase().replaceAll("_", "");
  const label = labels[`${type}:${entry.entityId}`] || entry.targetLabel || str("registrationNumber") || str("invoiceNumber") || str("name") || str("reference") || `${entry.entityType} ${entry.entityId.slice(0, 8)}`;
  const routes: Record<string, string> = { customer: "/customers/", booking: "/bookings/", invoice: "/invoices/", job: "/jobs/", servicejob: "/jobs/" };
  const href = routes[type] ? `${routes[type]}${encodeURIComponent(entry.entityId)}` : type === "vehicle" ? `/vehicles?search=${encodeURIComponent(label)}` : type === "paper" ? `/papers?paper=${encodeURIComponent(entry.entityId)}&status=${encodeURIComponent(String(entry.after?.status || "PENDING"))}` : type === "payment" ? `/payments?search=${encodeURIComponent(label)}` : null;
  return { label, href };
}
export function auditActor(entry: AuditLog, names: Record<string, string>): string {
  return names[entry.performedBy] || entry.performedByName || (entry.performedBy === "system" || entry.metadata?.automatic ? "AutoDeck" : `Account ${entry.performedBy.slice(0, 8)}`);
}
