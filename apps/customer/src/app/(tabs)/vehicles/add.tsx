import { useState } from "react";
import { ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, typography, TextInput, Button } from "@autodeck/ui";
import { Text } from "react-native";
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xl }}>Add a Vehicle</Text>

        {FIELDS.map(({ key, label, placeholder, autoCapitalize = "sentences", keyboardType = "default" }) => (
          <TextInput
            key={key}
            label={label}
            placeholder={placeholder}
            value={form[key]}
            onChangeText={(v: string) => update(key, v)}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
          />
        ))}

        <Button label="Add Vehicle" onPress={() => void handleAdd()} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
