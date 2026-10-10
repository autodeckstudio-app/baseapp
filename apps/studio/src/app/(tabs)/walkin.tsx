import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  listenToJobsByDate,
  getStudioConfig,
  createWalkinJob as createWalkinJobCall,
} from "../../lib/studio-service";
import {
  findCustomersByPhone,
  findCustomersByEmail,
  registerWalkinCustomer,
  getVehiclesForCustomer,
  createVehicleForCustomer,
  previewServicePrice,
} from "../../lib/walkin-service";
import { getActiveServices } from "../../lib/approval-service";
import type { Customer, Vehicle, Service, ServiceJob, StudioConfig, VehicleCategory, PriceBreakdown } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, TextInput, StatusBadge, LoadingState, ErrorState } from "@autodeck/ui";
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

export default function WalkinScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ bayId?: string }>();

  const [actionError,setActionError] = useState<string|null>(null);
  function showActionError(title:string,message:string){setActionError(`${title}: ${message}`);}
  const [feedError,setFeedError] = useState<string|null>(null);
  const [retryTick,setRetryTick] = useState(0);
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", phone: "" });
  const [registering, setRegistering] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

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
    setFeedError(null);
    void getActiveServices().then(setServices).catch(()=>setFeedError("Could not load services. Try again."));
  }, [retryTick]);

  useEffect(() => {
    if (!studioId) return;
    void getStudioConfig(studioId).then(setConfig).catch(()=>setFeedError("Could not load studio bays. Try again."));
  }, [studioId,retryTick]);

  useEffect(() => {
    if (auth.status !== "ready" || !studioId) return undefined;
    return listenToJobsByDate(auth.claims.tenantId, studioId, todayIST(), setJobs, ()=>setFeedError("Could not check bay occupancy. Try again."));
  }, [auth.status, studioId,retryTick]);

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
    if (!auth.status || auth.status !== "ready" || searching || !phone.trim()) return;
    setActionError(null);setSearching(true);
    setSearched(false);
    setJustRegistered(false);
    setCustomer(null);
    setVehicles([]);
    setSelectedVehicleId(null);
    try {
      const term = phone.trim();
      const results = term.includes("@")
        ? await findCustomersByEmail(auth.claims.tenantId, term)
        : await findCustomersByPhone(auth.claims.tenantId, term.startsWith("+91") ? term : `+91${term.replace(/\s/g, "")}`);
      const found = results[0] ?? null;
      setSearched(true);
      setCustomer(found);
      if (found) {
        const custVehicles = await getVehiclesForCustomer(auth.claims.tenantId, found.id);
        setVehicles(custVehicles);
        if (custVehicles.length === 1 && custVehicles[0]) setSelectedVehicleId(custVehicles[0].id);
      }
    } catch (err) {
      showActionError("Search failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleRegister() {
    if(registering) return;
    const email = newCust.email.trim().toLowerCase();
    if (newCust.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showActionError("Missing details", "Enter the customer's name and a valid email.");
      return;
    }
    setActionError(null);setRegistering(true);
    try {
      const { customer: c, created } = await registerWalkinCustomer({ name: newCust.name.trim(), email, ...(newCust.phone.trim() ? { phone: newCust.phone.trim() } : {}) });
      setCustomer(c);
      setJustRegistered(created);
      setShowNew(false);
      if (auth.status === "ready") setVehicles(await getVehiclesForCustomer(auth.claims.tenantId, c.id));
    } catch (err) {
      showActionError("Could not add customer", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleAddVehicle() {
    if (!customer || addingVehicle) return;
    const yearNum = parseInt(newVehicle.year, 10);
    if (!newVehicle.registrationNumber.trim() || !newVehicle.make.trim() || !newVehicle.model.trim() || isNaN(yearNum)) {
      showActionError("Missing details", "Fill in registration, make, model, and year.");
      return;
    }
    setActionError(null);setAddingVehicle(true);
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
      setStep("service");
      setNewVehicle({ registrationNumber: "", make: "", model: "", year: "", color: "" });
    } catch (err) {
      showActionError("Error", err instanceof Error ? err.message : "Failed to add vehicle.");
    } finally {
      setAddingVehicle(false);
    }
  }

  async function handleCreateJob() {
    if (submitting || feedError || !studioId || !customer || !selectedVehicleId || !selectedServiceId || !selectedBayId) return;
    setActionError(null);setSubmitting(true);
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
        showActionError("Bay no longer available", "That bay was just taken. Please choose another bay below.");
      } else {
        showActionError("Couldn't create job", message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(customer && selectedVehicleId && selectedServiceId && selectedBayId && !feedError);

  // Guided flow: one decision per screen, big tap targets, back always available.
  type Step = "customer" | "vehicle" | "service" | "review";
  const STEPS: Step[] = ["customer", "vehicle", "service", "review"];
  const [step, setStep] = useState<Step>("customer");
  const [catFilter, setCatFilter] = useState<string>("all");
  const stepIndex = STEPS.indexOf(step);
  const night = NightPlatform.OS === "web" && nightMaterial;
  const panel = { backgroundColor: colors.surface, ...(night ? nightSurfaceStyle : {}), borderRadius: radius.lg, padding: spacing.md } as const;
  const tapRow = (selected: boolean) => ({
    minHeight: 56,
    justifyContent: "center" as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: selected ? colors.accent : colors.border,
    backgroundColor: selected ? colors.accentMuted : colors.surface,
  });

  const CATEGORY_LABELS: Record<string, string> = {
    washing: "Wash",
    ceramic: "Ceramic",
    coating: "Coating",
    ppf: "PPF",
    tinting: "Tint",
    inspection: "Inspection",
    other: "Other",
  };
  const CATEGORY_ORDER = ["washing", "coating", "ceramic", "ppf", "tinting", "inspection", "other"];
  const categoriesPresent = useMemo(() => {
    const set = new Set(services.map((s) => String(s.category)));
    return CATEGORY_ORDER.filter((c) => set.has(c)).concat([...set].filter((c) => !CATEGORY_ORDER.includes(c)));
  }, [services]);
  const visibleServices = services.filter((s) => catFilter === "all" || String(s.category) === catFilter);

  function goBack() {
    setActionError(null);
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]!);
  }
  function startOver() {
    setStep("customer"); setPhone(""); setSearched(false); setCustomer(null); setVehicles([]);
    setSelectedVehicleId(null); setSelectedServiceId(null); setSelectedBayId(null); setNotes(""); setJustRegistered(false);
  }
  const priceText = (s: Service) => (typeof s.basePrice === "number" ? `from ₹${(s.basePrice / 100).toLocaleString("en-IN")}` : "");

  const titles: Record<Step, string> = {
    customer: "Who's the customer?",
    vehicle: "Which vehicle?",
    service: "What are we doing?",
    review: "Review and start",
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background, ...(night ? nightGroundStyle : {}) }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width: "100%", maxWidth: 640, alignSelf: "center" }}
    >
      {/* progress */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: spacing.md }}>
        {STEPS.map((s, k) => (
          <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k <= stepIndex ? colors.accent : colors.border }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>Walk-in · step {stepIndex + 1} of 4</Text>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>{titles[step]}</Text>
        </View>
        {stepIndex > 0 ? (
          <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={{ minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {customer && step !== "customer" ? (
        <View style={{ ...panel, marginBottom: spacing.md, paddingVertical: spacing.sm }}>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{customer.name}</Text>
          {selectedVehicle && step !== "vehicle" ? (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.registrationNumber}</Text>
          ) : (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{[customer.phone, customer.email].filter(Boolean).join("  |  ")}</Text>
          )}
        </View>
      ) : null}

      {actionError ? <ErrorState title="Check walk-in details" message={actionError} fill={false} /> : null}
      {feedError ? <ErrorState title="Walk-in setup unavailable" message={feedError} fill={false} onRetry={() => setRetryTick((n) => n + 1)} /> : null}

      {step === "customer" && (
        <View style={{ gap: spacing.md }}>
          <View style={panel}>
            <TextInput label="Phone or email" placeholder="98765 43210 or name@gmail.com" keyboardType="email-address" autoCapitalize="none" value={phone} onChangeText={setPhone} />
            <Button label="Find customer" onPress={() => void handleSearch()} loading={searching} />
          </View>
          {searched && !customer && !showNew && (
            <View style={{ ...panel, gap: spacing.sm }}>
              <Text style={{ ...typography.body, color: colors.textPrimary }}>No customer with that number or email yet.</Text>
              <Button label="Add new customer" onPress={() => { setShowNew(true); setNewCust((p) => ({ ...p, ...(phone.includes("@") ? { email: phone.trim() } : { phone: phone.trim() }) })); }} />
            </View>
          )}
          {showNew && (
            <View style={panel}>
              <TextInput label="Name" value={newCust.name} onChangeText={(v) => setNewCust((p) => ({ ...p, name: v }))} />
              <TextInput label="Email (their Google account)" keyboardType="email-address" autoCapitalize="none" value={newCust.email} onChangeText={(v) => setNewCust((p) => ({ ...p, email: v }))} />
              <TextInput label="Phone (optional)" keyboardType="phone-pad" value={newCust.phone} onChangeText={(v) => setNewCust((p) => ({ ...p, phone: v }))} />
              <Button label="Save and continue" loading={registering} onPress={() => void handleRegister()} />
            </View>
          )}
          {customer && (
            <View style={{ ...panel, gap: spacing.sm }}>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{customer.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{[customer.phone, customer.email].filter(Boolean).join("  |  ")}</Text>
              {justRegistered && customer.email ? (
                <Text style={{ ...typography.caption, color: colors.success }}>Added. Tell them to open the AutoDeck app and continue with Google using {customer.email}. They will see this same record.</Text>
              ) : null}
              <Button label="Continue" onPress={() => setStep("vehicle")} />
            </View>
          )}
        </View>
      )}

      {step === "vehicle" && customer && (
        <View style={{ gap: spacing.sm }}>
          {vehicles.map((v) => {
            const selected = selectedVehicleId === v.id;
            return (
              <TouchableOpacity key={v.id} activeOpacity={0.8} onPress={() => { setSelectedVehicleId(v.id); setStep("service"); }} style={tapRow(selected)}>
                <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{v.make} {v.model}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>{v.registrationNumber}{v.color ? ` · ${v.color}` : ""}</Text>
              </TouchableOpacity>
            );
          })}
          {vehicles.length === 0 && !showAddVehicle && (
            <Text style={{ ...typography.body, color: colors.textMuted }}>No vehicles on file yet. Add the one in the bay.</Text>
          )}
          {!showAddVehicle ? (
            <Button label="+ Add a vehicle" variant="secondary" onPress={() => setShowAddVehicle(true)} />
          ) : (
            <View style={panel}>
              <TextInput label="Registration" placeholder="GJ01AB1234" autoCapitalize="characters" value={newVehicle.registrationNumber} onChangeText={(v) => setNewVehicle((p) => ({ ...p, registrationNumber: v }))} />
              <TextInput label="Make" value={newVehicle.make} onChangeText={(v) => setNewVehicle((p) => ({ ...p, make: v }))} />
              <TextInput label="Model" value={newVehicle.model} onChangeText={(v) => setNewVehicle((p) => ({ ...p, model: v }))} />
              <TextInput label="Year" keyboardType="numeric" value={newVehicle.year} onChangeText={(v) => setNewVehicle((p) => ({ ...p, year: v }))} />
              <TextInput label="Color" value={newVehicle.color} onChangeText={(v) => setNewVehicle((p) => ({ ...p, color: v }))} />
              <Button label="Save vehicle" onPress={() => void handleAddVehicle()} loading={addingVehicle} />
            </View>
          )}
        </View>
      )}

      {step === "service" && (
        <View style={{ gap: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xs }}>
            {["all", ...categoriesPresent].map((c) => {
              const on = catFilter === c;
              return (
                <TouchableOpacity key={c} onPress={() => setCatFilter(c)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentMuted : colors.surface }}>
                  <Text style={{ ...typography.bodyMedium, color: on ? colors.accentPressed : colors.textPrimary }}>{c === "all" ? "All" : CATEGORY_LABELS[c] ?? c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {visibleServices.map((s) => {
            const selected = selectedServiceId === s.id;
            return (
              <TouchableOpacity key={s.id} activeOpacity={0.8} onPress={() => { setSelectedServiceId(s.id); setSelectedBayId(null); setStep("review"); }} style={{ ...tapRow(selected), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{s.name}</Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>{CATEGORY_LABELS[String(s.category)] ?? String(s.category)}</Text>
                </View>
                <Text style={{ ...typography.captionMedium, color: colors.textSecondary }}>{priceText(s)}</Text>
              </TouchableOpacity>
            );
          })}
          {visibleServices.length === 0 && <Text style={{ ...typography.body, color: colors.textMuted }}>No services in this group.</Text>}
        </View>
      )}

      {step === "review" && selectedService && (
        <View style={{ gap: spacing.md }}>
          <View style={panel}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{selectedService.name}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm }}>Vehicle type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {VEHICLE_CATEGORIES.map(({ value, label }) => {
                const on = vehicleCategory === value;
                return (
                  <TouchableOpacity key={value} onPress={() => setVehicleCategory(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentMuted : "transparent" }}>
                    <Text style={{ ...typography.caption, color: on ? colors.accentPressed : colors.textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ marginTop: spacing.md }}>
              {priceLoading ? (
                <LoadingState fill={false} />
              ) : priceBreakdown ? (
                <>
                  <Text style={{ ...typography.price, color: colors.textPrimary }}>₹{(priceBreakdown.total / 100).toLocaleString("en-IN")}</Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>incl. {priceBreakdown.taxDescription}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={panel}>
            <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.sm }}>Pick a bay</Text>
            {freeBays.length === 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ ...typography.body, color: colors.error }}>No {selectedService.requiredBayType} bay is free right now.</Text>
                <Button label="Refresh" variant="secondary" onPress={() => setSelectedBayId(null)} />
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {freeBays.map((bay) => {
                  const on = selectedBayId === bay.id;
                  return (
                    <TouchableOpacity key={bay.id} onPress={() => setSelectedBayId(bay.id)} style={{ ...tapRow(on), minWidth: 96, alignItems: "center" }}>
                      <Text style={{ ...typography.bodyMedium, color: on ? colors.accentPressed : colors.textPrimary }}>{bay.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={panel}>
            <TextInput label="Notes (optional)" placeholder="Anything the studio should know" value={notes} onChangeText={setNotes} multiline />
          </View>

          <Button label="Start job" onPress={() => void handleCreateJob()} loading={submitting} disabled={!canSubmit} />
          <Button label="Start over" variant="ghost" onPress={startOver} />
        </View>
      )}
    </ScrollView>
  );
}
