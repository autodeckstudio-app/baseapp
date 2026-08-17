import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
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

  async function handleArchive() {
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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (!vehicle) {
    return <View style={styles.centered}><Text>Vehicle not found.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.plate}>{vehicle.registrationNumber}</Text>
      <Text style={styles.title}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>

      {editing ? (
        <>
          {(["make", "model", "color"] as const).map((field) => (
            <View key={field} style={styles.field}>
              <Text style={styles.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
              <TextInput
                style={styles.input}
                value={form[field]}
                onChangeText={(v: string) => setForm((p: typeof form) => ({ ...p, [field]: v }))}
                autoCapitalize="words"
              />
            </View>
          ))}
          <View style={styles.field}>
            <Text style={styles.label}>Odometer (km)</Text>
            <TextInput
              style={styles.input}
              value={form.odometer}
              onChangeText={(v: string) => setForm((p: typeof form) => ({ ...p, odometer: v }))}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Color</Text>
            <Text style={styles.detailValue}>{vehicle.color}</Text>
          </View>
          {vehicle.odometer !== null && (
            <View style={styles.detail}>
              <Text style={styles.detailLabel}>Odometer</Text>
              <Text style={styles.detailValue}>{vehicle.odometer?.toLocaleString("en-IN")} km</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={() => setEditing(true)}>
            <Text style={styles.buttonText}>Edit Vehicle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.archiveButton} onPress={handleArchive}>
            <Text style={styles.archiveText}>Remove from Garage</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  plate: { fontSize: 14, letterSpacing: 2, color: "#666", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 24 },
  detail: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  detailLabel: { color: "#666" },
  detailValue: { fontWeight: "500" },
  field: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderBottomWidth: 1, borderBottomColor: "#ddd", fontSize: 17, paddingVertical: 8 },
  button: { backgroundColor: "#1a1a1a", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 24 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelText: { color: "#666", fontSize: 16 },
  archiveButton: { padding: 16, alignItems: "center", marginTop: 8 },
  archiveText: { color: "#c00", fontSize: 16 },
});
