import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../hooks/useAuth";
import { registerWalkinCustomer } from "../../../lib/walkin-service";
import { searchCustomersAnyField, searchVehiclesByPlate } from "../../../lib/lookup-service";
import type { Customer, Vehicle } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, TextInput, SearchInput, ListRow, EmptyState, ErrorState, LoadingState } from "@autodeck/ui";

type SearchMode = "customer" | "vehicle";

export default function LookupScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("customer");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [searched, setSearched] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", phone: "" });
  const [addMsg, setAddMsg] = useState<string | null>(null);

  async function handleSearch() {
    if (auth.status !== "ready" || !query.trim()) return;
    const tenantId = auth.claims.tenantId;
    setSearching(true);setError(null);
    setSearched(false);
    setCustomers([]);
    setVehicles([]);
    try {
      if (mode === "customer") {
        setCustomers(await searchCustomersAnyField(tenantId, query));
      } else {
        setVehicles(await searchVehiclesByPlate(tenantId, query));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  if (auth.status !== "ready") return <LoadingState />;

  const hasResults = mode === "customer" ? customers.length > 0 : vehicles.length > 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, flexGrow: 1 }}>

      <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.xxs, marginBottom: spacing.md }}>
        {(["customer", "vehicle"] as SearchMode[]).map((m) => {
          const selected = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setMode(m);setError(null);
                setQuery("");
                setSearched(false);
                setCustomers([]);
                setVehicles([]);
              }}
              style={{
                flex: 1,
                minHeight:44,justifyContent:"center",paddingVertical: spacing.sm,
                borderRadius: radius.sm,
                alignItems: "center",
                backgroundColor: selected ? colors.surface : "transparent",
              }}
            >
              <Text style={{ ...typography.captionMedium, color: selected ? colors.textPrimary : colors.textMuted }}>
                {m === "customer" ? "Customer" : "Vehicle"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder={mode === "customer" ? "Phone, email, name or plate" : "Number plate, e.g. GJ01AB1234"}
      />
      <View style={{ height: spacing.sm }} />
      <Button label="Search" onPress={() => void handleSearch()} loading={searching} disabled={!query.trim()} />

      <View style={{ height: spacing.lg }} />

      {error ? <ErrorState title="Search unavailable" message={error} onRetry={()=>void handleSearch()} fill={false}/> : null}
      {searched && !error && !hasResults && (
        <EmptyState
          title="No results"
          message={mode === "customer" ? "No customer matches that phone, email, name or plate." : "No car found with that number plate."}
          fill={false}
        />
      )}

      {mode === "customer" && customers.length > 0 && (
        <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}), borderRadius: radius.lg, paddingHorizontal: spacing.lg }}>
          {customers.map((c, i) => (
            <View key={c.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.divider }} />}
              <ListRow
                label={c.name}
                value={c.phone}
                showChevron
                onPress={() => router.push(`/(tabs)/lookup/customer/${c.id}`)}
              />
            </View>
          ))}
        </View>
      )}

      {mode === "vehicle" && vehicles.length > 0 && (
        <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}), borderRadius: radius.lg, paddingHorizontal: spacing.lg }}>
          {vehicles.map((vehicle, i) => (
            <View key={vehicle.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.divider }} />}
              <ListRow
                label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                value={vehicle.registrationNumber}
                showChevron
                onPress={() => router.push(`/(tabs)/lookup/vehicle/${vehicle.id}`)}
              />
            </View>
          ))}
        </View>
      )}

      {mode === "customer" && (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {!showAdd ? (
            <Button label="Add customer" onPress={() => { setShowAdd(true); setAddMsg(null); const q = query.trim(); setNewCust({ name: "", email: q.includes("@") ? q.toLowerCase() : "", phone: /^[\d\s+]+$/.test(q) ? q : "" }); }} />
          ) : (
            <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}), borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
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
  );
}
