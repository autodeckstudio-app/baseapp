import { createElement, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { space } from "@autodeck/ui/theme";
import { COLLECTIONS } from "@autodeck/database";
import type { Vehicle } from "@autodeck/core";
import { Button, Field, Kicker, Notice, Screen, T } from "../../../ui/kit";
import { useAuth } from "../../../hooks/useAuth";
import { db } from "../../../lib/firebase";
import { createVehicle, restoreVehicle, findVehicleWithPlate, normalizePlate, uploadVehiclePhoto } from "../../../lib/vehicle-service";

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
  { key: "registrationNumber", label: "Registration number", placeholder: "e.g. MH 12 AB 1234", autoCapitalize: "characters" },
  { key: "make", label: "Make", placeholder: "e.g. Maruti Suzuki", autoCapitalize: "words" },
  { key: "model", label: "Model", placeholder: "e.g. Swift", autoCapitalize: "words" },
  { key: "year", label: "Year", placeholder: "e.g. 2022", keyboardType: "numeric" },
  { key: "color", label: "Colour", placeholder: "e.g. White", autoCapitalize: "words" },
];

const GARAGE_ROUTE = "/(tabs)/garage";

export default function AddVehicleScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [form, setForm] = useState<FormState>({
    registrationNumber: "",
    make: "",
    model: "",
    year: "",
    color: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [archivedMatch, setArchivedMatch] = useState<{ vehicleId: string; label: string } | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; contentType: string; previewUrl: string } | null>(null);
  // Stale-response guard: every submission bumps the sequence and captures the
  // plate it was for; async answers from an older submission or plate are dropped.
  const submitSeq = useRef(0);
  const currentPlate = useRef("");

  function pickPhoto(file: { blob: Blob; type: string } | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photos work as JPEG, PNG or WebP.");
      return;
    }
    setError(null);
    setPhoto({ blob: file.blob, contentType: file.type, previewUrl: URL.createObjectURL(file.blob) });
  }

  function update(field: keyof FormState, value: string) {
    // Any edit invalidates an earlier lookup: archived-match popup, duplicate
    // error target and saved/restore state all belong to the old values.
    setArchivedMatch(null);
    setSavedId(null);
    setError(null);
    setPhotoFailed(false);
    if (field === "registrationNumber") currentPlate.current = normalizePlate(value);
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  }

  function validate(f: FormState): Partial<Record<keyof FormState, string>> {
    const yearNum = parseInt(f.year, 10);
    const plate = normalizePlate(f.registrationNumber);
    const maxYear = new Date().getFullYear() + 1;
    const fe: Partial<Record<keyof FormState, string>> = {};
    if (!plate) fe.registrationNumber = "Enter your registration number.";
    else if (/[^A-Za-z0-9\s]/.test(f.registrationNumber) || !/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(plate)) fe.registrationNumber = "Enter a valid registration number, e.g. MH 12 AB 1234.";
    if (f.make.trim().length < 2) fe.make = "Enter the car make.";
    if (f.model.trim().length < 1) fe.model = "Enter the car model.";
    if (!/^\d{4}$/.test(f.year.trim()) || yearNum < 1980 || yearNum > maxYear) fe.year = `Enter a 4-digit year between 1980 and ${maxYear}.`;
    if (f.color.trim().length < 2) fe.color = "Enter the car colour.";
    return fe;
  }

  function checkField(key: keyof FormState) {
    const msg = validate(form)[key];
    setFieldErrors((f) => ({ ...f, [key]: msg }));
  }

  function isStale(seq: number, plate: string) {
    return seq !== submitSeq.current || currentPlate.current !== plate;
  }

  /**
   * The restore popup is only offered for a record we re-read and verified:
   * it must be an ARCHIVED vehicle, owned by this customer, in this tenant,
   * with exactly the submitted normalised plate. Make/model/colour/year never
   * trigger it. Returns the verified document, or null when the record does
   * not check out (never offer restore from an unchecked payload).
   */
  async function verifyArchivedMatch(vehicleId: string, plate: string, uid: string, tenantId: string): Promise<Vehicle | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.vehicles(), vehicleId));
      if (!snap.exists()) return null;
      const v = { ...snap.data(), id: snap.id } as Vehicle;
      if (v.ownerId !== uid) return null;
      if (v.tenantId !== tenantId) return null;
      if (!v.deletedAt) return null;
      if (normalizePlate(v.registrationNumber ?? "") !== plate) return null;
      return v;
    } catch {
      return null;
    }
  }

  async function retryPhoto() {
    if (!savedId || !photo) return;
    setLoading(true);
    try {
      await uploadVehiclePhoto(savedId, photo.blob, photo.contentType);
      router.replace(GARAGE_ROUTE);
    } catch {
      setError("The photo still could not be uploaded. Try again, or tap Done to continue without it.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (loading || savedId) return;
    const yearNum = parseInt(form.year, 10);
    const plate = normalizePlate(form.registrationNumber);
    currentPlate.current = plate;
    const seq = ++submitSeq.current;
    const fe = validate(form);
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (auth.status === "ready") {
        const uid = auth.user.uid;
        const tenantId = auth.claims.tenantId;
        const existing = await findVehicleWithPlate(uid, tenantId, plate);
        if (isStale(seq, plate)) return;
        if (existing) {
          if (existing.deletedAt) {
            const verified = await verifyArchivedMatch(existing.id, plate, uid, tenantId);
            if (isStale(seq, plate)) return;
            if (verified) {
              setArchivedMatch({ vehicleId: verified.id, label: `${verified.registrationNumber} - ${verified.make} ${verified.model}` });
            } else {
              setError("We could not verify the car we have on file. Please try again.");
            }
            return;
          }
          setFieldErrors({ registrationNumber: "This car is already in your garage." });
          setSavedId(existing.id);
          return;
        }
      }
      const vehicle = await createVehicle({
        registrationNumber: plate,
        make: form.make.trim(),
        model: form.model.trim(),
        year: yearNum,
        color: form.color.trim(),
      });
      if (isStale(seq, plate)) return;
      setSavedId(vehicle.id);
      if (photo) {
        try {
          await uploadVehiclePhoto(vehicle.id, photo.blob, photo.contentType);
        } catch {
          if (isStale(seq, plate)) return;
          // Stay on this screen so the message is actually seen.
          setPhotoFailed(true);
          setError("Your car is saved, but the photo could not be uploaded. Try again, or tap Done to continue without it.");
          return;
        }
      }
      router.replace(GARAGE_ROUTE);
    } catch (err) {
      if (isStale(seq, plate)) return;
      const code = (err as { code?: string })?.code ?? "";
      const msg = err instanceof Error ? err.message : "";
      console.warn("add car failed", code, msg);
      const duplicateId = (err as { details?: { vehicleId?: string } }).details?.vehicleId;
      if (/already-exists/.test(code) && duplicateId) {
        setSavedId(duplicateId);
        setFieldErrors({ registrationNumber: "This car is already in your garage." });
        return;
      }
      const fieldHint = (err as { details?: { field?: string } }).details?.field;
      if (fieldHint && fieldHint in form && !/archived-match/.test(msg)) {
        setFieldErrors({ [fieldHint]: /already-exists/.test(code) ? "This car is already added." : "Check this field." });
        return;
      }
      const details = (err as { details?: { vehicleId?: string } }).details;
      if (/failed-precondition/.test(code) && /archived-match/.test(msg) && details?.vehicleId) {
        if (auth.status === "ready") {
          const verified = await verifyArchivedMatch(details.vehicleId, plate, auth.user.uid, auth.claims.tenantId);
          if (isStale(seq, plate)) return;
          if (verified) {
            setArchivedMatch({ vehicleId: verified.id, label: `${verified.registrationNumber} - ${verified.make} ${verified.model}` });
            return;
          }
        }
        setError("We could not verify the car we have on file. Please try again.");
        return;
      }
      if (/already-exists/.test(code)) {
        setFieldErrors({ registrationNumber: "This car is already added." });
        return;
      }
      setError(
        /registrationNumber/i.test(msg) ? "Check the registration number, for example GJ01AB1234."
        : /resource-exhausted/.test(code) ? "Too many attempts. Please wait a minute and try again."
        : /unauthenticated|permission|app-check/i.test(code + msg) ? "Your session needs a refresh. Reload the page and try again."
        : /unavailable|network|internal/i.test(code + msg) ? "We could not reach the server. Check your connection and try again."
        : "We could not add this car. Check the details and try again.",
      );
    } finally {
      if (!isStale(seq, plate)) setLoading(false);
    }
  }

  async function handleRestore() {
    if (!archivedMatch || loading || auth.status !== "ready") return;
    const seq = ++submitSeq.current;
    const plate = normalizePlate(form.registrationNumber);
    setLoading(true);
    try {
      // Re-verify immediately before restoring: the record must still be an
      // archived car owned by this customer with this exact plate.
      const verified = await verifyArchivedMatch(archivedMatch.vehicleId, plate, auth.user.uid, auth.claims.tenantId);
      if (isStale(seq, plate)) return;
      if (!verified) {
        setArchivedMatch(null);
        setError("We could not verify the car we have on file. Please try again.");
        return;
      }
      await restoreVehicle(verified.id);
      if (isStale(seq, plate)) return;
      router.replace(GARAGE_ROUTE);
    } catch {
      if (isStale(seq, plate)) return;
      setArchivedMatch(null);
      setError("We could not restore this car. Please try again.");
    } finally {
      if (!isStale(seq, plate)) setLoading(false);
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
              onChangeText={(v: string) => { update(key, v); if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined })); }}
              error={fieldErrors[key]}
              onBlur={() => { if (form[key] !== "") checkField(key); }}
              autoCapitalize={autoCapitalize}
              keyboardType={keyboardType}
              maxLength={key === "registrationNumber" ? 16 : key === "year" ? 4 : 50}
            />
          ))}
        </View>

        {Platform.OS === "web" ? (
          <View style={{ gap: space.hair }}>
            <Kicker>Photo (optional)</Kicker>
            {createElement("input", {
              type: "file",
              accept: "image/jpeg,image/png,image/webp",
              onChange: (e: { target: { files: unknown } }) => {
                const files = e.target.files as { item: (i: number) => { blob?: Blob; type?: string } | null } | null;
                const f = files?.item(0) ?? null;
                pickPhoto(f ? { blob: f as unknown as Blob, type: f.type ?? "" } : null);
              },
            })}
            {photo ? <T role="caption" tone="tertiary">Photo ready - it uploads when the car is added.</T> : null}
          </View>
        ) : null}

        {archivedMatch ? (
          <Notice
            title="We have this car on file"
            body={`Is it the same car${archivedMatch.label ? ` (${archivedMatch.label})` : ""}? If yes, we bring it back with its details. This registration is already saved. Restore it instead of creating another car.`}
            action={
              <View style={{ gap: space.breath }}>
                <Button label="Yes, same car" busy={loading} onPress={() => void handleRestore()} />
                <Button label="Edit registration number" kind="quiet" onPress={() => setArchivedMatch(null)} />
              </View>
            }
          />
        ) : null}

        {error ? <Notice title={photoFailed ? "Photo not uploaded" : "Can't add this car"} body={error} /> : null}

        {savedId && !photoFailed ? <Button label="View saved car" onPress={() => router.replace(`/(tabs)/garage/${savedId}`)} /> : photoFailed ? <View style={{ gap: space.breath }}><Button label="Try the photo again" busy={loading} onPress={() => void retryPhoto()} /><Button label="Done" kind="quiet" onPress={() => router.replace(GARAGE_ROUTE)} /></View> : <Button label="Add car" busy={loading || auth.status !== "ready" || !!archivedMatch} onPress={() => void handleAdd()} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
