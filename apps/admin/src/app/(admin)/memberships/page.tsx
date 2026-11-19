"use client";

import { useCallback, useEffect, useState, useRef, Fragment } from "react";
import type { Customer, Membership, MembershipPlan, MembershipRefreshUsage, PaymentMethod } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useLabels } from "../../../lib/use-labels";
import { formatDate, formatPaise } from "../../../lib/format";
import { StatusBadge } from "../../../components/StatusBadge";
import { MembershipsView, type PlanDraft } from "../../../experience/MembershipsView";
import {
  getMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  setMembershipPlanActive,
  listPendingMemberships,
  listenToTenantMemberships,
  confirmMembershipPayment,
  createWalkinMembership,
  findCustomerByPhone,
  createWalkinCustomer,
  normalizePhone,
  getMembershipUsage,
  restoreMembershipRefresh,
  type PendingMembershipRow,
} from "../../../lib/membership-service";
import {GiftVerification} from '../../../experience/GiftVerification';
import {verifyEnteredGift} from '../../../lib/gift-verification-service';
import { useAdminAuth } from "../../../lib/auth-context";

const box: React.CSSProperties = {
  border: "1px solid var(--ad-border-subtle)",
  borderRadius: 16,
  background: "transparent",
  padding: 16,
  marginBottom: 12,
};
const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--ad-border-subtle)",
  background: "transparent",
  color: "var(--ad-text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSuccess: React.CSSProperties = { ...btn, border: "1px solid #1F7A4D", background: "rgba(31,122,77,0.10)", color: "#1F7A4D" };
const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--ad-border-subtle)",
  background: "transparent",
  color: "var(--ad-text-primary)",
  fontSize: 13,
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ad-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
const msgStyle: React.CSSProperties = { fontSize: 13, color: "var(--ad-text-secondary)", margin: "4px 0 0" };

const PAID_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi_manual", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
}

function PendingQueue({ tenantId, plans, onChanged, tick }: { tenantId: string; plans: MembershipPlan[]; onChanged: () => void; tick: string }) {
  const [rows, setRows] = useState<PendingMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [methodById, setMethodById] = useState<Record<string, PaymentMethod>>({});
  const [refById, setRefById] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPendingMemberships(tenantId));
    } catch {
      setMessage("Could not load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  async function confirm(row: PendingMembershipRow) {
    setBusyId(row.membership.id);
    setMessage(null);
    try {
      await confirmMembershipPayment({
        membershipId: row.membership.id,
        method: (methodById[row.membership.id] ?? "cash") as "cash" | "upi_manual" | "bank_transfer",
        manualReference: refById[row.membership.id]?.trim() || undefined,
      });
      setMessage(`${row.planName} membership is now ACTIVE for ${row.customerName}.`);
      await refresh();
      onChanged();
    } catch {
      setMessage("Could not confirm the payment.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="ax-panel ax-mem-sec">
      <h2 className="ax-mem-h">Pending payment approvals</h2>
      <p style={msgStyle}>Purchases awaiting payment confirmation. Approving activates it immediately and notifies the customer.</p>
      {loading ? (
        <p style={msgStyle}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={msgStyle}>No pending requests.</p>
      ) : (
        rows.map((r) => (
          <div key={r.membership.id} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ad-text-primary)" }}>{r.planName} - {r.customerName}</p>
                <p style={msgStyle}>
                  {r.customerPhone} - Requested {fmtDate(r.membership.createdAt)}
                  {r.payment ? ` - ${(r.payment.amount / 100).toFixed(2)} INR (${r.payment.method.replace("_", " ")})` : " - no payment record found"}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 240 }}>
                <select
                  style={{ ...input, cursor: "pointer" }}
                  value={methodById[r.membership.id] ?? r.payment?.method ?? "cash"}
                  onChange={(e) => setMethodById((m) => ({ ...m, [r.membership.id]: e.target.value as PaymentMethod }))}
                >
                  {PAID_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>Paid via {m.label}</option>
                  ))}
                </select>
                <input
                  style={input}
                  placeholder="Reference / note (optional)"
                  value={refById[r.membership.id] ?? ""}
                  onChange={(e) => setRefById((m) => ({ ...m, [r.membership.id]: e.target.value }))}
                />
                <button style={btnSuccess} disabled={busyId === r.membership.id} onClick={() => void confirm(r)}>
                  {busyId === r.membership.id ? "Confirming..." : "Approve - payment received"}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
      {message && <p style={{ ...msgStyle, color: "var(--ad-accent-strong)", marginTop: 8 }}>{message}</p>}
      {plans.length === 0 && <p style={msgStyle}>Create at least one plan to accept walk-in sales.</p>}
    </section>
  );
}

function WalkinSale({ tenantId, plans, onChanged }: { tenantId: string; plans: MembershipPlan[]; onChanged: () => void }) {
  const activePlans = plans.filter((p) => p.active);
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function lookup() {
    setBusy(true);
    setMessage(null);
    setFound(null);
    setSearched(false);
    try {
      const c = await findCustomerByPhone(tenantId, normalizePhone(phone));
      setFound(c ? { id: c.id, name: c.name, phone: c.phone } : null);
      setSearched(true);
      if (c) setPlanId((prev) => prev || activePlans[0]?.id || "");
    } catch {
      setMessage("Could not look up the customer.");
    } finally {
      setBusy(false);
    }
  }

  async function sell() {
    setBusy(true);
    setMessage(null);
    try {
      let customerId = found?.id;
      if (!customerId) {
        if (!newName.trim() || !newEmail.trim()) {
          setMessage("Enter the new customer's name and email to register them first.");
          return;
        }
        const created = await createWalkinCustomer({ name: newName.trim(), email: newEmail.trim(), phone: normalizePhone(phone) });
        customerId = created.customer.id;
      }
      if (!planId) {
        setMessage("Choose a plan.");
        return;
      }
      const result = await createWalkinMembership({ customerId, planId, method: method as "cash" | "upi_manual" | "bank_transfer", manualReference: reference.trim() || undefined });
      setMessage(`Walk-in sale complete - membership ${result.membershipId} is ACTIVE.`);
      setFound(null);
      setPhone("");
      setSearched(false);
      setNewName("");
      setNewEmail("");
      setReference("");
      onChanged();
    } catch {
      setMessage("Could not complete the walk-in sale.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ax-panel ax-mem-sec">
      <h2 className="ax-mem-h">Walk-in sale</h2>
      <p style={msgStyle}>Sell a membership at the front desk. It activates immediately once payment is taken.</p>
      <div style={{ ...box, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={input} placeholder="Customer mobile number" value={phone} onChange={(e) => { setPhone(e.target.value); setSearched(false); setFound(null); }} />
          <button style={btn} disabled={busy || phone.replace(/[^0-9]/g, "").length < 10} onClick={() => void lookup()}>Find</button>
        </div>
        {searched && !found && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={msgStyle}>No customer with this number. Register them:</p>
            <input style={input} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input style={input} placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
        )}
        {(found || (searched && !found)) && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {found && <p style={{ fontSize: 13, color: "#4ade80" }}>Found: {found.name} ({found.phone})</p>}
            <div>
              <p style={labelStyle}>Plan</p>
              <select style={{ ...input, cursor: "pointer" }} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Choose a plan</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - {(p.priceInPaise / 100).toFixed(0)} INR</option>
                ))}
              </select>
            </div>
            <div>
              <p style={labelStyle}>Paid via</p>
              <select style={{ ...input, cursor: "pointer" }} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <input style={input} placeholder="Reference / note (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <button style={btnSuccess} disabled={busy} onClick={() => void sell()}>{busy ? "Processing..." : "Sell and activate"}</button>
          </div>
        )}
      </div>
      {message && <p style={{ ...msgStyle, color: "var(--ad-accent-strong)", marginTop: 8 }}>{message}</p>}
    </section>
  );
}

export function RefreshUsagePanel({ membershipId }: { membershipId: string }) {
  const { claims } = useAdminAuth();
  const scope = [membershipId, claims?.tenantId, claims?.role].join("|");
  const generation = useRef({ scope, epoch: 0 });
  if (generation.current.scope !== scope) generation.current = { scope, epoch: generation.current.epoch + 1 };
  const epoch = generation.current.epoch;
  const busy = useRef<number | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => () => { generation.current = { scope: "unmounted", epoch: generation.current.epoch + 1 }; }, []);
  const [rowsState, setRows] = useState<{ epoch: number; rows: MembershipRefreshUsage[] } | null>(null);
  const rows = rowsState?.epoch === epoch ? rowsState.rows : null;
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setRows(null); setMessage(null); setBusyId(null);
    getMembershipUsage(membershipId)
      .then((r) => { if (live && generation.current.epoch === epoch) setRows({ epoch, rows: r.refreshUsage ?? [] }); })
      .catch(() => { if (live && generation.current.epoch === epoch) setMessage("Could not load refresh records."); });
    return () => { live = false; };
  }, [scope, retry]);

  async function restore(row: MembershipRefreshUsage) {
    if (generation.current.epoch !== epoch || busy.current === epoch || row.restoredAt) return;
    const reason = window.prompt("Reason for restoring this interior refresh?");
    if (!reason || !reason.trim()) return;
    if (generation.current.epoch !== epoch) return;
    busy.current = epoch;
    setBusyId(row.id);
    setMessage(null);
    try {
      await restoreMembershipRefresh({ membershipId, refreshUsageId: row.id, reason: reason.trim() });
      if (generation.current.epoch !== epoch) return;
      setRows((prev) => prev?.epoch === epoch ? { epoch, rows: prev.rows.map((r) => r.id === row.id ? { ...r, restoredAt: new Date().toISOString(), restoredBy: "admin" } : r) } : prev);
      setMessage("Refresh credit restored.");
    } catch {
      if (generation.current.epoch === epoch) setMessage("Could not restore the refresh.");
    } finally {
      if (busy.current === epoch) busy.current = null;
      if (generation.current.epoch === epoch) setBusyId(null);
    }
  }

  if (message && !rows) return <div><p style={msgStyle}>{message}</p><button style={btn} onClick={() => { if (generation.current.epoch === epoch) setRetry((n) => n + 1); }}>Retry refresh records</button></div>;
  if (!rows) return <p style={msgStyle}>Loading refresh records...</p>;
  if (rows.length === 0) return <p style={msgStyle}>No interior refreshes recorded yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--ad-text-primary)" }}>{fmtDate(r.usedAt)} - job {r.jobId.slice(0, 8)}</span>
          {r.restoredAt ? (
            <span style={{ fontSize: 12, color: "var(--ad-text-secondary)" }}>restored {fmtDate(r.restoredAt)}</span>
          ) : (
            <button style={btn} disabled={busyId === r.id} onClick={() => void restore(r)}>{busyId === r.id ? "Restoring..." : "Restore credit"}</button>
          )}
        </div>
      ))}
      {message && <p style={msgStyle}>{message}</p>}
    </div>
  );
}

export function MembersPanel({ members, plans }: { members: Membership[]; plans: MembershipPlan[] }) {
  const names = useLabels(COLLECTIONS.customers(), members.map((m) => m.customerId), (d) => (d as Customer).name || (d as Customer).phone || "Customer");
  const planName = Object.fromEntries(plans.map((p) => [p.id, p.name]));
  const priceOf = Object.fromEntries(plans.map((p) => [p.id, p.priceInPaise]));
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const active = members.filter((m) => m.status === "active");
  const expiring = active.filter((m) => m.endDate && m.endDate.slice(0, 10) <= soon && m.endDate.slice(0, 10) >= today);
  const pending = members.filter((m) => m.status === "pending");
  const washesLeft = active.reduce((n, m) => n + Math.max(0, m.washesTotal - m.washesUsed), 0);
  const revenue = active.reduce((n, m) => n + (priceOf[m.planId] ?? 0), 0);
  const [filter, setFilter] = useState<string>("all");
  const [refreshOpenId, setRefreshOpenId] = useState<string | null>(null);
  const statuses = Array.from(new Set(members.map((m) => m.status)));
  const shown = filter === "all" ? members : members.filter((m) => m.status === filter);
  const sorted = [...shown].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || (a.endDate ?? "").localeCompare(b.endDate ?? ""));
  const kpi = (v: string | number, l: string) => <div><span className="ax-kpi-v">{v}</span><span className="ax-label">{l}</span></div>;
  return (
    <section className="ax-panel ax-mem-sec">
      <h2 className="ax-mem-h">Members</h2>
      <p style={msgStyle}>Live list of every membership sold. Updates as customers buy and use washes.</p>
      <div className="ax-kpis" style={{ margin: "12px 0" }}>
        {kpi(active.length, "Active")}{kpi(pending.length, "Awaiting payment")}{kpi(expiring.length, "Ending in 7 days")}{kpi(washesLeft, "Washes owed")}{kpi(formatPaise(revenue), "Active plan value")}
      </div>
      {statuses.length > 1 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 10px" }}>
          {["all", ...statuses].map((st) => <button key={st} type="button" className={`ax-button${filter === st ? " ax-button--primary" : ""}`} onClick={() => setFilter(st)}>{st === "all" ? "All" : st.charAt(0).toUpperCase() + st.slice(1)}</button>)}
        </div>
      ) : null}
      {sorted.length === 0 ? <p style={msgStyle}>{members.length === 0 ? "No memberships sold yet." : "No memberships with this status."}</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Washes</th><th>Interior refresh</th><th>Ends</th></tr></thead>
            <tbody>
              {sorted.map((m) => (
                <Fragment key={m.id}>
                <tr>
                  <td><a href={`/customers/${m.customerId}`} style={{ color: "var(--ad-accent-strong)" }}>{names[m.customerId] ?? "..."}</a></td>
                  <td>{planName[m.planId] ?? m.tier}</td>
                  <td><StatusBadge label={m.status} /></td>
                  <td>{m.washesUsed} of {m.washesTotal}</td>
                  <td>
                    {(m.refreshesTotal ?? 0) > 0 ? (
                      <button type="button" style={{ ...btn, padding: "4px 10px" }} onClick={() => setRefreshOpenId(refreshOpenId === m.id ? null : m.id)}>
                        {(m.refreshesUsed ?? 0)} of {m.refreshesTotal}{refreshOpenId === m.id ? " - hide" : " - review"}
                      </button>
                    ) : "-"}
                  </td>
                  <td>{m.endDate ? formatDate(m.endDate) : "Not started"}</td>
                </tr>
                {refreshOpenId === m.id && (
                  <tr><td colSpan={6}><RefreshUsagePanel membershipId={m.id} /></td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { claims } = useAdminAuth();
  const tenantId = claims?.tenantId ?? null;
  const [memberState, setMemberState] = useState<{ tenantId: string; rows: Membership[] } | null>(null);
  const members = memberState?.tenantId === tenantId ? memberState.rows : [];
  useEffect(() => {
    if (!tenantId) return undefined;
    let alive = true;
    const stop = listenToTenantMemberships(tenantId, (rows) => { if (alive) setMemberState({ tenantId, rows }); }, () => { if (alive) setMemberState(null); });
    return () => { alive = false; stop(); };
  }, [tenantId]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getMembershipPlans();
      setPlans(list);
    } catch {
      setError("Couldn't load plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSave(d: PlanDraft) {
    setBusy(true);
    setError(null);
    setStatus(null);
    const priceInPaise = Math.round(Number(d.priceInRupees) * 100);
    const includedWashes = Number(d.includedWashes);
    const discountPercent = Number(d.discountPercent);
    try {
      if (d.planId) {
        // Send the pickup/refresh fields only when they changed, so a price edit never depends on them.
        const was = plans.find((x) => x.id === d.planId);
        const extra: { freePickups?: number; prioritySlot?: boolean; includedInteriorRefreshes?: number } = {};
        if (Number(d.freePickups) !== (was?.freePickups ?? 0)) extra.freePickups = Number(d.freePickups);
        if (d.prioritySlot !== !!was?.prioritySlot) extra.prioritySlot = d.prioritySlot;
        if (Number(d.includedInteriorRefreshes) !== (was?.includedInteriorRefreshes ?? 0)) extra.includedInteriorRefreshes = Number(d.includedInteriorRefreshes);
        await updateMembershipPlan({ planId: d.planId, name: d.name.trim(), priceInPaise, includedWashes, discountPercent, ...extra });
        setStatus("Plan saved. Existing members keep the terms they bought.");
      } else {
        await createMembershipPlan({ tier: d.tier, name: d.name.trim(), priceInPaise, includedWashes, discountPercent, freePickups: Number(d.freePickups), prioritySlot: d.prioritySlot, includedInteriorRefreshes: Number(d.includedInteriorRefreshes) });
        setStatus(`${d.name.trim()} is on sale.`);
      }
      await refresh();
    } catch {
      setError("Couldn't save the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(plan: MembershipPlan) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await setMembershipPlanActive(plan.id, !plan.active);
      setStatus(plan.active ? `${plan.name} is paused. Existing members are not affected.` : `${plan.name} is on sale again.`);
      await refresh();
    } catch {
      setError("Couldn't change the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MembershipsView plans={plans} loading={loading} error={error} message={status} busy={busy} onSave={(d) => void handleSave(d)} onToggle={(pl) => void handleToggleActive(pl)}>
      {tenantId && (
        <>
          <PendingQueue tenantId={tenantId} plans={plans} onChanged={() => void refresh()} tick={members.map((m) => `${m.id}:${m.status}`).join("|")} />
          <MembersPanel members={members} plans={plans} />
          <GiftVerification lookup={verifyEnteredGift} />
          <WalkinSale tenantId={tenantId} plans={plans} onChanged={() => void refresh()} />
        </>
      )}
    </MembershipsView>
  );
}
