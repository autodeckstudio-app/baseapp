import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../hooks/useAuth";
import { findCustomersByPhone } from "../../../lib/walkin-service";
import { searchCustomersByName, findVehicleByRegistration } from "../../../lib/lookup-service";
import type { Customer, Vehicle } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, SearchInput, ListRow, EmptyState, ErrorState, LoadingState } from "@autodeck/ui";

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
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  async function handleSearch() {
    if (auth.status !== "ready" || !query.trim()) return;
    const tenantId = auth.claims.tenantId;
    setSearching(true);setError(null);
    setSearched(false);
    setCustomers([]);
    setVehicle(null);
    try {
      if (mode === "customer") {
        const trimmed = query.trim();
        const looksLikePhone = /^[\d\s+]+$/.test(trimmed);
        if (looksLikePhone) {
          const formatted = trimmed.startsWith("+91") ? trimmed : `+91${trimmed.replace(/\s/g, "")}`;
          const result = await findCustomersByPhone(tenantId, formatted);
          setCustomers(result);
        } else {
          const result = await searchCustomersByName(tenantId, trimmed);
          setCustomers(result);
        }
      } else {
        const result = await findVehicleByRegistration(tenantId, query.trim());
        setVehicle(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  if (auth.status !== "ready") return <LoadingState />;

  const hasResults = mode === "customer" ? customers.length > 0 : vehicle !== null;

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
                setVehicle(null);
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
        placeholder={mode === "customer" ? "Phone or name" : "Registration number, e.g. GJ01AB1234"}
      />
      <View style={{ height: spacing.sm }} />
      <Button label="Search" onPress={() => void handleSearch()} loading={searching} disabled={!query.trim()} />

      <View style={{ height: spacing.lg }} />

      {error ? <ErrorState title="Search unavailable" message={error} onRetry={()=>void handleSearch()} fill={false}/> : null}
      {searched && !error && !hasResults && (
        <EmptyState
          title="No results"
          message={mode === "customer" ? "No customer matches this phone number or name." : "No vehicle found with that registration number."}
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

      {mode === "vehicle" && vehicle && (
        <View style={{ backgroundColor: colors.surface, ...(NightPlatform.OS === "web" && nightMaterial ? nightSurfaceStyle : {}), borderRadius: radius.lg, paddingHorizontal: spacing.lg }}>
          <ListRow
            label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            value={vehicle.registrationNumber}
            showChevron
            onPress={() => router.push(`/(tabs)/lookup/vehicle/${vehicle.id}`)}
          />
        </View>
      )}
    </ScrollView>
  );
}
