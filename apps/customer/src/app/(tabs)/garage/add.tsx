import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Screen, T } from "../../../ui/kit";
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
  { key: "registrationNumber", label: "Registration number", placeholder: "GJ01AB1234", autoCapitalize: "characters" },
  { key: "make", label: "Make", placeholder: "Maruti Suzuki", autoCapitalize: "words" },
  { key: "model", label: "Model", placeholder: "Swift", autoCapitalize: "words" },
  { key: "year", label: "Year", placeholder: "2022", keyboardType: "numeric" },
  { key: "color", label: "Colour", placeholder: "White", autoCapitalize: "words" },
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
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  }

  async function handleAdd() {
    const yearNum = parseInt(form.year, 10);
    if (isNaN(yearNum) || yearNum < 1980) {
      setError("Enter a valid year (e.g. 2020).");
      return;
    }

    setLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to add vehicle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Garage</Kicker><T role="title">Add a car</T></View>}>
        <View style={{ gap: space.line }}>
          {FIELDS.map(({ key, label, placeholder, autoCapitalize = "sentences", keyboardType = "default" }) => (
            <Field
              key={key}
              label={label}
              placeholder={placeholder}
              value={form[key]}
              onChangeText={(v: string) => update(key, v)}
              autoCapitalize={autoCapitalize}
              keyboardType={keyboardType}
            />
          ))}
        </View>

        {error ? <Notice title="Can't add this car" body={error} /> : null}

        <Button label="Add car" busy={loading} onPress={() => void handleAdd()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
