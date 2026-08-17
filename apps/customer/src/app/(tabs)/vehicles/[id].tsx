import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { colors, spacing, typography, TextInput, Button, ListRow, Divider, LoadingState, ErrorState } from "@autodeck/ui";
import { db } from "../../../lib/firebase";
import { updateVehicle, archiveVehicle } from "../../../lib/vehicle-service";

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ make: "", model: "", color: "", odometer: "" });

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, COLLECTIONS.vehicles(), id);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const v = snap.data() as Vehicle;
        setVehicle(v);
        setForm({
          make: v.make,
          model: v.model,
          color: v.color,
          odometer: v.odometer?.toString() ?? "",
        });
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const odometerNum = form.odometer ? parseInt(form.odometer, 10) : null;
      await updateVehicle({
        vehicleId: id,
        ...(form.make.trim() ? { make: form.make.trim() } : {}),
        ...(form.model.trim() ? { model: form.model.trim() } : {}),
        ...(form.color.trim() ? { color: form.color.trim() } : {}),
        ...(odometerNum !== null ? { odometer: odometerNum } : {}),
      });
      setEditing(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    Alert.alert("Remove Vehicle", "Remove this vehicle from your garage?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            await archiveVehicle(id);
            router.back();
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove.");
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (!vehicle) return <ErrorState title="Vehicle not found" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.caption, color: colors.textMuted, letterSpacing: 1 }}>{vehicle.registrationNumber}</Text>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xl }}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>

      {editing ? (
        <View>
          <TextInput label="Make" value={form.make} onChangeText={(v) => setForm((p) => ({ ...p, make: v }))} autoCapitalize="words" />
          <TextInput label="Model" value={form.model} onChangeText={(v) => setForm((p) => ({ ...p, model: v }))} autoCapitalize="words" />
          <TextInput label="Color" value={form.color} onChangeText={(v) => setForm((p) => ({ ...p, color: v }))} autoCapitalize="words" />
          <TextInput
            label="Odometer (km)"
            value={form.odometer}
            onChangeText={(v) => setForm((p) => ({ ...p, odometer: v }))}
            keyboardType="numeric"
          />
          <Button label="Save Changes" onPress={() => void handleSave()} loading={saving} />
          <View style={{ height: spacing.sm }} />
          <Button label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
        </View>
      ) : (
        <View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: spacing.lg }}>
            <ListRow label="Color" value={vehicle.color} />
            {vehicle.odometer !== null && (
              <>
                <Divider />
                <ListRow label="Odometer" value={`${vehicle.odometer?.toLocaleString("en-IN")} km`} />
              </>
            )}
          </View>
          <View style={{ height: spacing.xl }} />
          <Button label="Edit Vehicle" onPress={() => setEditing(true)} variant="secondary" />
          <View style={{ height: spacing.sm }} />
          <Button label="Remove from Garage" onPress={handleArchive} variant="destructive" />
        </View>
      )}
    </ScrollView>
  );
}
