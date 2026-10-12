import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform, View, Text, ScrollView, Pressable, useWindowDimensions } from "react-native";
import { floatCard } from "@autodeck/ui/theme";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../hooks/useAuth";
import { registerWalkinCustomer } from "../../../lib/walkin-service";
import { searchCustomersAnyField, searchVehiclesByPlate } from "../../../lib/lookup-service";
import type { Customer, Vehicle } from "@autodeck/core";
import { colors, spacing, typography, Button, TextInput, SearchInput, ErrorState, LoadingState } from "@autodeck/ui";
import { CanvasTitle } from "../../../components/CanvasTitle";

export default function LookupScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", phone: "" });
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const seq = useRef(0);
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  // One box, searches as you type. Customers and cars are looked up together, so staff never choose a mode.
  useEffect(() => {
    const q = query.trim();
    if (!tenantId || q.length < 2) { setCustomers([]); setVehicles([]); setSearched(false); setError(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true); setError(null);
      try {
        const looksLikePlate = /[a-z]/i.test(q) && /\d/.test(q) && !q.includes("@") && !q.includes(" ");
        const [c, v] = await Promise.all([
          searchCustomersAnyField(tenantId, q),
          looksLikePlate || /^[a-z0-9\s-]{3,}$/i.test(q) ? searchVehiclesByPlate(tenantId, q) : Promise.resolve([] as Vehicle[]),
        ]);
        if (mine !== seq.current) return;
        setCustomers(c); setVehicles(v); setSearched(true);
      } catch (err) {
        if (mine === seq.current) setError(err instanceof Error ? err.message : "Please try again.");
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  if (auth.status !== "ready") return <LoadingState />;

  const glass = { backgroundColor: colors.surface, ...(NightPlatform.OS === "web" ? floatCard(nightMaterial) : {}) };
  const none = searched && !error && customers.length === 0 && vehicles.length === 0;
  const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

  const customerRow = (c: Customer) => (
    <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/lookup/customer/${c.id}`)} style={{ ...glass, borderRadius: 28, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(236,134,56,.18)" }}>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>{initials(c.name)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...typography.body, fontWeight: "600", color: colors.textPrimary }}>{c.name}</Text>
        <Text numberOfLines={1} style={{ ...typography.caption, color: colors.textMuted }}>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact on file"}</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
  const vehicleRow = (v: Vehicle) => (
    <Pressable key={v.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/lookup/vehicle/${v.id}`)} style={{ ...glass, borderRadius: 28, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,.94)" }}>
        <Text style={{ color: "#18181C", fontWeight: "700", letterSpacing: 1 }}>{v.registrationNumber}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...typography.body, fontWeight: "600", color: colors.textPrimary }}>{[v.year, v.make, v.model].filter(Boolean).join(" ")}</Text>
        {v.color ? <Text numberOfLines={1} style={{ ...typography.caption, color: colors.textMuted }}>{v.color}</Text> : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 130, flexGrow: 1, width: "100%", maxWidth: 1040, alignSelf: "center", gap: spacing.lg }}>
        <CanvasTitle eyebrow="Customers and cars" title="Lookup" />
        <View style={{ ...glass, borderRadius: 28, padding: spacing.md, gap: spacing.sm }}>
          <SearchInput value={query} onChangeText={setQuery} placeholder="Name, phone, email or number plate" />
          <Text style={{ ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.sm }}>{searching ? "Searching..." : "Results appear as you type. Cars and customers are searched together."}</Text>
        </View>

        {error ? <ErrorState title="Search unavailable" message={error} onRetry={() => setQuery((q) => q + " ")} fill={false} /> : null}

        {none ? (
          <View style={{ ...glass, borderRadius: 28, padding: spacing.xl, alignItems: "center", gap: spacing.sm }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>No match for "{query.trim()}"</Text>
            <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>Check the spelling or try the plate. If they are new, add them below.</Text>
          </View>
        ) : null}

        {customers.length > 0 || vehicles.length > 0 ? (
          <View style={{ flexDirection: wide ? "row" : "column", gap: spacing.lg, alignItems: "flex-start" }}>
            {customers.length > 0 ? (
              <View style={{ flex: 1, width: "100%", gap: spacing.sm }}>
                <Text style={{ ...typography.title, color: colors.textPrimary }}>Customers ({customers.length})</Text>
                {customers.map(customerRow)}
              </View>
            ) : null}
            {vehicles.length > 0 ? (
              <View style={{ flex: 1, width: "100%", gap: spacing.sm }}>
                <Text style={{ ...typography.title, color: colors.textPrimary }}>Cars ({vehicles.length})</Text>
                {vehicles.map(vehicleRow)}
              </View>
            ) : null}
          </View>
        ) : null}

      {(
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          {!showAdd ? (
            <Button label="Add customer" onPress={() => { setShowAdd(true); setAddMsg(null); const q = query.trim(); setNewCust({ name: "", email: q.includes("@") ? q.toLowerCase() : "", phone: /^[\d\s+]+$/.test(q) ? q : "" }); }} />
          ) : (
            <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" ? floatCard(nightMaterial) : {}), borderRadius: 28, padding: spacing.lg, gap: spacing.sm }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>Add customer</Text>
              <TextInput label="Name" value={newCust.name} onChangeText={(v) => setNewCust((p) => ({ ...p, name: v }))} />
              <TextInput label="Email" keyboardType="email-address" autoCapitalize="none" value={newCust.email} onChangeText={(v) => setNewCust((p) => ({ ...p, email: v }))} />
              <TextInput label="Phone (optional)" keyboardType="phone-pad" value={newCust.phone} onChangeText={(v) => setNewCust((p) => ({ ...p, phone: v }))} />
              {addMsg ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{addMsg}</Text> : null}
              <Button
                label="Save customer"
                loading={adding}
                onPress={() => {
                  const email = newCust.email.trim().toLowerCase();
                  if (newCust.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setAddMsg("Enter a name and a valid email."); return; }
                  setAdding(true); setAddMsg(null);
                  registerWalkinCustomer({ name: newCust.name.trim(), email, ...(newCust.phone.trim() ? { phone: newCust.phone.trim() } : {}) })
                    .then(({ customer: c, created }) => { setShowAdd(false); setCustomers([c]); setSearched(true); setQuery(c.name); if (!created) setAddMsg("That email already had an account."); })
                    .catch((err) => setAddMsg(err instanceof Error ? err.message : "Could not add the customer."))
                    .finally(() => setAdding(false));
                }}
              />
              <Button label="Cancel" onPress={() => setShowAdd(false)} />
            </View>
          )}
        </View>
      )}

    </ScrollView>
    </View>
  );
}
