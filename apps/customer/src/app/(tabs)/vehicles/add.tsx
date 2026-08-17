import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { createVehicle } from "../../../lib/vehicle-service";

type FormState = {
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
  color: string;
};

type FieldDef = {
  key: keyof FormState;
  label: string;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "numeric";
};

const FIELDS: FieldDef[] = [
  { key: "registrationNumber", label: "Registration Number", placeholder: "GJ01AB1234", autoCapitalize: "characters" },
  { key: "make", label: "Make", placeholder: "Maruti Suzuki", autoCapitalize: "words" },
  { key: "model", label: "Model", placeholder: "Swift", autoCapitalize: "words" },
  { key: "year", label: "Year", placeholder: "2022", keyboardType: "numeric" },
  { key: "color", label: "Color", placeholder: "White", autoCapitalize: "words" },
];

export default function AddVehicleScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    registrationNumber: "",
    make: "",
    model: "",
    year: "",
    color: "",
  });
  const [loading, setLoading] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  }

  async function handleAdd() {
    const yearNum = parseInt(form.year, 10);
    if (isNaN(yearNum) || yearNum < 1980) {
      Alert.alert("Invalid year", "Enter a valid year (e.g. 2020).");
      return;
    }

    setLoading(true);
    try {
      await createVehicle({
        registrationNumber: form.registrationNumber.toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: yearNum,
        color: form.color.trim(),
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add vehicle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Add a Vehicle</Text>

      {FIELDS.map(({ key, label, placeholder, autoCapitalize = "sentences", keyboardType = "default" }) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            value={form[key]}
            onChangeText={(v: string) => update(key, v)}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Add Vehicle</Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24 },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderBottomWidth: 1, borderBottomColor: "#ddd", fontSize: 17, paddingVertical: 8 },
  button: { backgroundColor: "#1a1a1a", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
