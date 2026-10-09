"use client";

import { useCallback, useEffect, useState } from "react";
import type { MembershipPlan, PaymentMethod } from "@autodeck/core";
import { MembershipsView, type PlanDraft } from "../../../experience/MembershipsView";
import {
  getMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  setMembershipPlanActive,
  listPendingMemberships,
  confirmMembershipPayment,
  createWalkinMembership,
  findCustomerByPhone,
  createWalkinCustomer,
  normalizePhone,
  type PendingMembershipRow,
} from "../../../lib/membership-service";
import { useAdminAuth } from "../../../lib/auth-context";

const box: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  marginBottom: 12,
};
const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.06)",
  color: "#e6e6e6",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSuccess: React.CSSProperties = { ...btn, border: "1px solid rgba(74,222,128,0.5)", background: "rgba(74,222,128,0.12)", color: "#4ade80" };
const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
  color: "#e6e6e6",
  fontSize: 13,
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
const msgStyle: React.CSSProperties = { fontSize: 12, color: "#9ca3af", marginTop: 4 };

const PAID_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi_manual", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
}

function PendingQueue({ tenantId, plans, onChanged }: { tenantId: string; plans: MembershipPlan[]; onChanged: () => void }) {
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
  }, [refresh]);

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
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f4", marginBottom: 4 }}>Pending payment approvals</h2>
      <p style={msgStyle}>Membership purchases awaiting payment confirmation. Approving one activates it immediately and notifies the customer.</p>
      {loading ? (
        <p style={msgStyle}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={msgStyle}>No pending requests.</p>
      ) : (
        rows.map((r) => (
          <div key={r.membership.id} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f4" }}>{r.planName} - {r.customerName}</p>
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
      {message && <p style={{ ...msgStyle, color: "#a5b4fc", marginTop: 8 }}>{message}</p>}
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
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f4", marginBottom: 4 }}>Walk-in sale</h2>
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
      {message && <p style={{ ...msgStyle, color: "#a5b4fc", marginTop: 8 }}>{message}</p>}
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
        await updateMembershipPlan({ planId: d.planId, name: d.name.trim(), priceInPaise, includedWashes, discountPercent });
        setStatus("Plan saved. Existing members keep the terms they bought.");
      } else {
        await createMembershipPlan({ tier: d.tier, name: d.name.trim(), priceInPaise, includedWashes, discountPercent });
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
    <>
      <MembershipsView plans={plans} loading={loading} error={error} message={status} busy={busy} onSave={(d) => void handleSave(d)} onToggle={(pl) => void handleToggleActive(pl)} />
      {tenantId && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 48px" }}>
          <PendingQueue tenantId={tenantId} plans={plans} onChanged={() => void refresh()} />
          <WalkinSale tenantId={tenantId} plans={plans} onChanged={() => void refresh()} />
        </div>
      )}
    </>
  );
}
