import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Customer, Membership, MembershipPlan, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Button, ErrorState, LoadingState } from "@autodeck/ui";

type PaidMethod = "cash" | "upi_manual" | "bank_transfer";
const PAID_METHODS: { value: PaidMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi_manual", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
];

type PendingRow = {
  membership: Membership;
  payment: Payment | null;
  customerName: string;
  customerPhone: string;
  planName: string;
};

function normalizePhone(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  return `+91${digits.slice(-10)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? "rgba(240,125,40,0.14)" : "transparent",
        color: active ? colors.accent : colors.textMuted,
        fontSize: 13,
        fontWeight: "600",
        overflow: "hidden",
      }}
    >
      {label}
    </Text>
  );
}

export default function MembershipsScreen() {
  const auth = useAuth();
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [methodById, setMethodById] = useState<Record<string, PaidMethod>>({});
  const [refById, setRefById] = useState<Record<string, string>>({});
  // Walk-in sale state
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [saleMethod, setSaleMethod] = useState<PaidMethod>("cash");
  const [saleRef, setSaleRef] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    const [memSnap, planSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.memberships()), where("tenantId", "==", tenantId), where("status", "==", "pending"))),
      getDocs(collection(db, COLLECTIONS.membershipPlans())),
    ]);
    const planList = planSnap.docs.map((d) => d.data() as MembershipPlan).filter((p) => p.tenantId === tenantId);
    setPlans(planList);
    const rows: PendingRow[] = [];
    for (const d of memSnap.docs) {
      const membership = d.data() as Membership;
      const [paySnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.payments()), where("membershipId", "==", membership.id))),
        getDoc(doc(db, COLLECTIONS.customers(), membership.customerId)),
      ]);
      const payments = paySnap.docs.map((p) => p.data() as Payment);
      const payment = payments.find((p) => p.status === "pending" || p.status === "processing") ?? payments[0] ?? null;
      const customer = custSnap.exists() ? (custSnap.data() as Customer) : null;
      const plan = planList.find((p) => p.id === membership.planId);
      rows.push({
        membership,
        payment,
        customerName: customer?.name ?? "Unknown customer",
        customerPhone: customer?.phone ?? "",
        planName: plan?.name ?? membership.tier,
      });
    }
    rows.sort((a, b) => b.membership.createdAt.localeCompare(a.membership.createdAt));
    setPending(rows);
  }, [tenantId]);

  useEffect(() => { void load().catch((e) => { setError(e instanceof Error ? e.message : "Try again."); }); }, [load]);

  async function approve(row: PendingRow) {
    setBusy(true);
    setMessage(null);
    try {
      const fn = httpsCallable<{ membershipId: string; method: PaidMethod; manualReference?: string | undefined }, { ok: boolean }>(functions, "confirmMembershipPayment");
      await fn({
        membershipId: row.membership.id,
        method: methodById[row.membership.id] ?? ((row.payment?.method as PaidMethod) || "cash"),
        manualReference: refById[row.membership.id]?.trim() || undefined,
      });
      setMessage(`${row.planName} membership is now ACTIVE for ${row.customerName}. The customer has been notified.`);
      await load();
    } catch {
      setMessage("Could not confirm the payment.");
    } finally {
      setBusy(false);
    }
  }

  async function lookup() {
    if (!tenantId) return;
    setBusy(true);
    setMessage(null);
    setFound(null);
    setSearched(false);
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.customers()), where("tenantId", "==", tenantId), where("phone", "==", normalizePhone(phone))));
      const c = snap.docs.map((d) => d.data() as Customer).find((x) => !x.deletedAt) ?? null;
      setFound(c);
      setSearched(true);
      if (c && !planId) setPlanId(activePlans()[0]?.id ?? "");
    } catch {
      setMessage("Could not look up the customer.");
    } finally {
      setBusy(false);
    }
  }

  function activePlans(): MembershipPlan[] {
    return plans.filter((p) => p.active);
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
        const reg = httpsCallable<{ name: string; email: string; phone?: string }, { customer: Customer }>(functions, "createWalkinCustomer");
        const result = await reg({ name: newName.trim(), email: newEmail.trim(), phone: normalizePhone(phone) });
        customerId = result.data.customer.id;
      }
      if (!planId) {
        setMessage("Choose a plan.");
        return;
      }
      const fn = httpsCallable<{ customerId: string; planId: string; method: PaidMethod; manualReference?: string | undefined }, { membershipId: string }>(functions, "createWalkinMembership");
      const result = await fn({ customerId, planId, method: saleMethod, manualReference: saleRef.trim() || undefined });
      setMessage(`Walk-in sale complete - membership ${result.data.membershipId} is ACTIVE.`);
      setFound(null);
      setPhone("");
      setSearched(false);
      setNewName("");
      setNewEmail("");
      setSaleRef("");
      await load();
    } catch {
      setMessage("Could not complete the walk-in sale.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState title="Memberships unavailable" message={error} onRetry={() => void load()} />;
  if (!pending) return <LoadingState label="Loading memberships" />;

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, gap: spacing.lg, width: "100%", maxWidth: 640, alignSelf: "center" }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Memberships</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Approve pending purchases and sell plans at the front desk.</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>Pending payment approvals ({pending.length})</Text>
        {pending.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.textMuted }}>No pending requests.</Text>
        ) : (
          pending.map((r) => (
            <View key={r.membership.id} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>{r.planName} - {r.customerName}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                {r.customerPhone} - Requested {fmtDate(r.membership.createdAt)}
                {r.payment ? ` - ${(r.payment.amount / 100).toFixed(2)} INR (${r.payment.method.replace("_", " ")})` : " - no payment record found"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {PAID_METHODS.map((m) => (
                  <Chip
                    key={m.value}
                    label={`Paid via ${m.label}`}
                    active={(methodById[r.membership.id] ?? ((r.payment?.method as PaidMethod) || "cash")) === m.value}
                    onPress={() => setMethodById((prev) => ({ ...prev, [r.membership.id]: m.value }))}
                  />
                ))}
              </View>
              <TextInput
                style={inputStyle}
                placeholder="Reference / note (optional)"
                placeholderTextColor={colors.textMuted}
                value={refById[r.membership.id] ?? ""}
                onChangeText={(t) => setRefById((prev) => ({ ...prev, [r.membership.id]: t }))}
              />
              <Button label={busy ? "Working..." : "Approve - payment received"} onPress={() => void approve(r)} disabled={busy} />
            </View>
          ))
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>Walk-in sale</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Sell a membership at the front desk. It activates immediately once payment is taken.</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <TextInput
            style={inputStyle}
            placeholder="Customer mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => { setPhone(t); setSearched(false); setFound(null); }}
          />
          <Button label="Find customer" onPress={() => void lookup()} disabled={busy || phone.replace(/[^0-9]/g, "").length < 10} variant="secondary" />
          {searched && !found && (
            <>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>No customer with this number. Register them:</Text>
              <TextInput style={inputStyle} placeholder="Name" placeholderTextColor={colors.textMuted} value={newName} onChangeText={setNewName} />
              <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={newEmail} onChangeText={setNewEmail} />
            </>
          )}
          {found && <Text style={{ ...typography.body, color: colors.success }}>Found: {found.name} ({found.phone})</Text>}
          {(found || (searched && !found)) && (
            <>
              <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Plan</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {activePlans().map((p) => (
                  <Chip key={p.id} label={`${p.name} - ${(p.priceInPaise / 100).toFixed(0)} INR`} active={planId === p.id} onPress={() => setPlanId(p.id)} />
                ))}
              </View>
              {activePlans().length === 0 && <Text style={{ ...typography.caption, color: colors.textMuted }}>No active plans. Ask an admin to activate one.</Text>}
              <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Paid via</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {PAID_METHODS.map((m) => (
                  <Chip key={m.value} label={m.label} active={saleMethod === m.value} onPress={() => setSaleMethod(m.value)} />
                ))}
              </View>
              <TextInput style={inputStyle} placeholder="Reference / note (optional)" placeholderTextColor={colors.textMuted} value={saleRef} onChangeText={setSaleRef} />
              <Button label={busy ? "Processing..." : "Sell and activate"} onPress={() => void sell()} disabled={busy || !planId} />
            </>
          )}
        </View>
      </View>

      {message && <Text style={{ ...typography.caption, color: colors.accent }}>{message}</Text>}
    </ScrollView>
  );
}
