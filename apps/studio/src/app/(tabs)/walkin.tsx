import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  listenToJobsByDate,
  getStudioConfig,
  createWalkinJob as createWalkinJobCall,
} from "../../lib/studio-service";
import {
  findCustomersByPhone,
  getVehiclesForCustomer,
  createVehicleForCustomer,
  previewServicePrice,
} from "../../lib/walkin-service";
import { getActiveServices } from "../../lib/approval-service";
import type { Customer, Vehicle, Service, ServiceJob, StudioConfig, VehicleCategory, PriceBreakdown } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, TextInput, StatusBadge, LoadingState } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "luxury", label: "Luxury" },
  { value: "van", label: "Van / MUV" },
  { value: "commercial", label: "Commercial" },
];

const ACTIVE_STATUSES: ServiceJob["status"][] = [
  "PENDING_VEHICLE",
  "VEHICLE_RECEIVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
];

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

export default function WalkinScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ bayId?: string }>();

  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ registrationNumber: "", make: "", model: "", year: "", color: "" });
  const [addingVehicle, setAddingVehicle] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>("hatchback");

  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [selectedBayId, setSelectedBayId] = useState<string | null>(params.bayId ?? null);

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const studioId = auth.status === "ready" ? auth.claims.studioId : null;

  useEffect(() => {
    void getActiveServices().then(setServices);
  }, []);

  useEffect(() => {
    if (!studioId) return;
    void getStudioConfig(studioId).then(setConfig);
  }, [studioId]);

  useEffect(() => {
    if (!studioId) return undefined;
    return listenToJobsByDate(studioId, todayIST(), setJobs, () => undefined);
  }, [studioId]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  useEffect(() => {
    if (selectedVehicle?.category) setVehicleCategory(selectedVehicle.category);
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!selectedServiceId) {
      setPriceBreakdown(null);
      return;
    }
    setPriceLoading(true);
    void previewServicePrice(selectedServiceId, vehicleCategory)
      .then(({ breakdown }) => setPriceBreakdown(breakdown))
      .catch(() => setPriceBreakdown(null))
      .finally(() => setPriceLoading(false));
  }, [selectedServiceId, vehicleCategory]);

  // Bays compatible with the selected service's required type and currently
  // free — the server re-validates this transactionally at submit time
  // regardless, so this is a helpful preview, not the authority.
  const occupiedBayIds = new Set(jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).map((j) => j.bayId));
  const compatibleBays =
    config?.bays.filter((b) => b.active && (!selectedService || b.bayType === selectedService.requiredBayType)) ?? [];
  const freeBays = compatibleBays.filter((b) => !occupiedBayIds.has(b.id));

  async function handleSearch() {
    if (!auth.status || auth.status !== "ready" || !phone.trim()) return;
    setSearching(true);
    setSearched(false);
    setCustomer(null);
    setVehicles([]);
    setSelectedVehicleId(null);
    try {
      const formatted = phone.trim().startsWith("+91") ? phone.trim() : `+91${phone.trim().replace(/\s/g, "")}`;
      const results = await findCustomersByPhone(auth.claims.tenantId, formatted);
      const found = results[0] ?? null;
      setCustomer(found);
      if (found) {
        const custVehicles = await getVehiclesForCustomer(auth.claims.tenantId, found.id);
        setVehicles(custVehicles);
        if (custVehicles.length === 1 && custVehicles[0]) setSelectedVehicleId(custVehicles[0].id);
      }
    } catch (err) {
      Alert.alert("Search failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  async function handleAddVehicle() {
    if (!customer) return;
    const yearNum = parseInt(newVehicle.year, 10);
    if (!newVehicle.registrationNumber.trim() || !newVehicle.make.trim() || !newVehicle.model.trim() || isNaN(yearNum)) {
      Alert.alert("Missing details", "Fill in registration, make, model, and year.");
      return;
    }
    setAddingVehicle(true);
    try {
      const vehicle = await createVehicleForCustomer({
        ownerId: customer.id,
        registrationNumber: newVehicle.registrationNumber.toUpperCase(),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        year: yearNum,
        color: newVehicle.color.trim() || "Unspecified",
      });
      setVehicles((prev) => [...prev, vehicle]);
      setSelectedVehicleId(vehicle.id);
      setShowAddVehicle(false);
      setNewVehicle({ registrationNumber: "", make: "", model: "", year: "", color: "" });
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add vehicle.");
    } finally {
      setAddingVehicle(false);
    }
  }

  async function handleCreateJob() {
    if (!studioId || !customer || !selectedVehicleId || !selectedServiceId || !selectedBayId) return;
    setSubmitting(true);
    try {
      const result = await createWalkinJobCall({
        serviceId: selectedServiceId,
        vehicleId: selectedVehicleId,
        vehicleCategory,
        bayId: selectedBayId,
        customerId: customer.id,
        studioId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      router.replace(`/(tabs)/jobs/${result.job.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create walk-in job.";
      // Race recovery: the bay was taken between preview and submit —
      // clear the stale selection so the studio can immediately pick another.
      if (message.toLowerCase().includes("occupied")) {
        setSelectedBayId(null);
        Alert.alert("Bay no longer available", "That bay was just taken. Please choose another bay below.");
      } else {
        Alert.alert("Couldn't create job", message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(customer && selectedVehicleId && selectedServiceId && selectedBayId);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.lg }}>New Walk-in</Text>

      <Section title="1. Find customer">
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextInput placeholder="98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          </View>
          <Button label="Search" size="md" onPress={() => void handleSearch()} loading={searching} />
        </View>
        {searched && !customer && (
          <View style={{ backgroundColor: colors.warningMuted, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.warning }}>
              No AutoDeck account found for this number. Ask the customer to sign up in the Customer app first, then
              search again — walk-in registration works only for existing accounts.
            </Text>
          </View>
        )}
        {customer && (
          <View style={{ backgroundColor: colors.successMuted, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}>
            <Text style={{ ...typography.bodyMedium, color: colors.success }}>{customer.name}</Text>
            <Text style={{ ...typography.caption, color: colors.success }}>{customer.phone}</Text>
          </View>
        )}
      </Section>

      {customer && (
        <Section title="2. Select vehicle">
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            {vehicles.map((v) => {
              const selected = selectedVehicleId === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setSelectedVehicleId(v.id)}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accentMuted : colors.surface,
                  }}
                >
                  <Text style={{ ...typography.body, color: selected ? colors.accentPressed : colors.textPrimary }}>
                    {v.make} {v.model} · {v.registrationNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {vehicles.length === 0 && (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>No vehicles on file yet.</Text>
            )}
          </View>
          {!showAddVehicle ? (
            <Button label="+ Add Vehicle" variant="ghost" size="md" onPress={() => setShowAddVehicle(true)} />
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
              <TextInput
                label="Registration"
                placeholder="GJ01AB1234"
                autoCapitalize="characters"
                value={newVehicle.registrationNumber}
                onChangeText={(v) => setNewVehicle((p) => ({ ...p, registrationNumber: v }))}
              />
              <TextInput label="Make" value={newVehicle.make} onChangeText={(v) => setNewVehicle((p) => ({ ...p, make: v }))} />
              <TextInput label="Model" value={newVehicle.model} onChangeText={(v) => setNewVehicle((p) => ({ ...p, model: v }))} />
              <TextInput
                label="Year"
                keyboardType="numeric"
                value={newVehicle.year}
                onChangeText={(v) => setNewVehicle((p) => ({ ...p, year: v }))}
              />
              <TextInput label="Color" value={newVehicle.color} onChangeText={(v) => setNewVehicle((p) => ({ ...p, color: v }))} />
              <Button label="Save Vehicle" onPress={() => void handleAddVehicle()} loading={addingVehicle} size="md" />
            </View>
          )}
        </Section>
      )}

      {selectedVehicleId && (
        <Section title="3. Select service">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {services.map((s) => {
              const selected = selectedServiceId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => {
                    setSelectedServiceId(s.id);
                    setSelectedBayId(null);
                  }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accentMuted : colors.surface,
                  }}
                >
                  <Text style={{ ...typography.caption, color: selected ? colors.accentPressed : colors.textPrimary }}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>
      )}

      {selectedServiceId && (
        <Section title="4. Vehicle category">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {VEHICLE_CATEGORIES.map(({ value, label }) => {
              const selected = vehicleCategory === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setVehicleCategory(value)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accentMuted : colors.surface,
                  }}
                >
                  <Text style={{ ...typography.caption, color: selected ? colors.accentPressed : colors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>
      )}

      {selectedServiceId && (
        <Section title="5. Price">
          {priceLoading ? (
            <LoadingState fill={false} />
          ) : priceBreakdown ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
              <Text style={{ ...typography.price, color: colors.textPrimary }}>
                ₹{(priceBreakdown.total / 100).toLocaleString("en-IN")}
              </Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                Server-calculated, incl. {priceBreakdown.taxDescription}
              </Text>
            </View>
          ) : null}
        </Section>
      )}

      {selectedServiceId && (
        <Section title="6. Assign bay">
          {freeBays.length === 0 ? (
            <View style={{ backgroundColor: colors.errorMuted, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ ...typography.caption, color: colors.error, marginBottom: spacing.sm }}>
                No {selectedService?.requiredBayType} bay is free right now.
              </Text>
              <Button
                label="Refresh availability"
                variant="secondary"
                size="md"
                onPress={() => setSelectedBayId(null)}
              />
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {freeBays.map((bay) => {
                const selected = selectedBayId === bay.id;
                return (
                  <TouchableOpacity
                    key={bay.id}
                    onPress={() => setSelectedBayId(bay.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentMuted : colors.surface,
                    }}
                  >
                    <Text style={{ ...typography.captionMedium, color: selected ? colors.accentPressed : colors.textPrimary }}>
                      {bay.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Section>
      )}

      {selectedBayId && (
        <Section title="7. Notes (optional)">
          <TextInput placeholder="Anything the studio should know" value={notes} onChangeText={setNotes} multiline />
        </Section>
      )}

      {canSubmit && (
        <Button label="Create Walk-in Job" onPress={() => void handleCreateJob()} loading={submitting} />
      )}

      {!canSubmit && customer && (
        <StatusBadge label="Complete the steps above to continue" tone="neutral" />
      )}
    </ScrollView>
  );
}
