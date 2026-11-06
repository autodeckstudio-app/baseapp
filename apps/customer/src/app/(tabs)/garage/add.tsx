import { SceneIntro } from "../../../ui/SceneIntro";
import { validAppliedDate, todayStudioDate } from "../../../lib/applied-date";
import { DateField, FileUploader, SelectField } from "../../../ui/inputs";
import { VEHICLE_SIZES } from "../../../lib/vehicle-size";
import { createElement, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { space } from "@autodeck/ui/theme";
import { COLLECTIONS } from "@autodeck/database";
import type { Vehicle, VehicleCategory } from "@autodeck/core";
import { Button, Field, Kicker, Notice, Screen, T } from "../../../ui/kit";
import { ModalCard } from "../../../ui/ModalCard";
import { useAuth } from "../../../hooks/useAuth";
import { db } from "../../../lib/firebase";
import { limitRegistrationInput, REG_RAW_MAX } from "../../../lib/registration-input";
import { createVehicle, restoreVehicle, findVehicleWithPlate, normalizePlate, uploadVehiclePhoto, type VehiclePhotoBody } from "../../../lib/vehicle-service";
import { createMyProtection, isCalendarDate, type MyProtectionKind } from "../../../lib/protection-service";
import { addCarAbandonAllowed, addCarEditsFrozen, createAddCarJournal, journalPending, runAddCarJournal, type AddCarJournal } from "../../../lib/add-car-journal";

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
  { key: "registrationNumber", label: "Registration number", placeholder: "e.g. MH12AB1234", autoCapitalize: "characters" },
  { key: "make", label: "Make", placeholder: "e.g. Maruti Suzuki", autoCapitalize: "words" },
  { key: "model", label: "Model", placeholder: "e.g. Swift", autoCapitalize: "words" },
  { key: "year", label: "Year", placeholder: "e.g. 2022", keyboardType: "numeric" },
  { key: "color", label: "Colour", placeholder: "e.g. White", autoCapitalize: "words" },
];

const GARAGE_ROUTE = "/(tabs)/garage";

type ProtectionEntry = { declared: "" | "yes" | "no"; brand: string; years: string; applied: string; declarationId: string };
function emptyProtection(): ProtectionEntry {
  // Stable per form instance: a retry of the same save reuses this id, so the
  // server dedups instead of duplicating the declaration.
  return { declared: "", brand: "", years: "", applied: "", declarationId: `decl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` };
}
// Unknown-ack copy: the declaration may or may not have landed. Only the
// Resume retry (same declarationId, exact server replay) may claim it cannot
// duplicate; "continue and add later" is a NEW operation and must tell the
// user to check what is already there first.
const PROTECTION_SAVE_UNCONFIRMED = "We could not confirm whether the protection details were saved. Resume to retry the same save - the retry replays the same declaration and cannot duplicate it. If you continue to the car, check its page first and add the details there only if they are missing.";
const PROTECTION_BLOCKS: { kind: MyProtectionKind; label: string; question: string }[] = [
  { kind: "ppf", label: "Paint protection film (PPF)", question: "Does this car have PPF?" },
  { kind: "ceramic", label: "Ceramic coating", question: "Does this car have ceramic coating?" },
];

/** Empty, or a whole-year count 1-50. Years alone never become an expiry. */
function validYears(v: string): boolean {
  if (v.trim() === "") return true;
  const n = Number(v.trim());
  return /^\d+$/.test(v.trim()) && n >= 1 && n <= 50;
}
function validApplied(v: string): boolean {
  const t = v.trim();
  return validAppliedDate(t);
}

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
  const [size, setSize] = useState<VehicleCategory | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [archivedMatch, setArchivedMatch] = useState<{ vehicleId: string; label: string } | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  // Stage journal: frozen at submit time with BOTH stages pending from the
  // outset. Retries run whatever the journal still marks pending - never a
  // re-snapshot of the editable form, and never "photo only if a photo
  // failure was already observed" (a declaration failure used to drop the
  // photo silently because it had not been attempted yet).
  type PendingJournal = AddCarJournal;
  const [journal, setJournal] = useState<PendingJournal | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [photo, setPhoto] = useState<{ blob: VehiclePhotoBody; contentType: string; previewUrl: string } | null>(null);
  const [protection, setProtection] = useState<Record<MyProtectionKind, ProtectionEntry>>(() => ({ ppf: emptyProtection(), ceramic: emptyProtection() }));
  const [protectionError, setProtectionError] = useState<string | null>(null);
  const [protectionFailed, setProtectionFailed] = useState(false);

  // Dev-only visual harness (preview route, ?mockpending=1): seeds the exact
  // pending state - declaration stage failed before the photo attempt - so
  // the Resume/Continue/Start-over UI can be reviewed as real pixels.
  // Never runs outside __DEV__ and never touches the network.
  const params = useLocalSearchParams<{ mockpending?: string }>();
  const mockPending = __DEV__ && params.mockpending === "1";
  useEffect(() => {
    if (!mockPending) return;
    // Seeds the exact pending state (declaration stage failed before the
    // photo attempt) with a coherent submitted snapshot, purely as pixels:
    // the pending actions are rendered disabled below, so nothing in this
    // mode can invoke the real pipeline against the fake car id.
    const blob = new Blob(["x"], { type: "image/png" } as BlobOptions);
    const j = createAddCarJournal(
      [{ kind: "ppf", entry: { brand: "Garware", years: "5", applied: "2024-01-15", declarationId: "decl-mockpending1" } }],
      { blob, contentType: "image/png" },
    );
    setForm({ registrationNumber: "GJ01AB1234", make: "Honda", model: "City", year: "2022", color: "White" });
    setProtection({ ppf: { declared: "yes", brand: "Garware", years: "5", applied: "2024-01-15", declarationId: "decl-mockpending1" }, ceramic: emptyProtection() });
    setPhoto({ blob, contentType: "image/png", previewUrl: URL.createObjectURL(blob) });
    setSavedId("mock-saved-car");
    setJournal(j);
    setProtectionFailed(true);
    setError(PROTECTION_SAVE_UNCONFIRMED);
  }, []);

  /**
   * While a submit is in flight or a journal still has pending stages, the
   * saved target owns the pending work: form, protection and photo edits
   * are frozen (handlers no-op) so an ordinary edit can never drop pending
   * uploads/declarations. The user resolves the pending work explicitly:
   * retry it, continue to the saved car, or discard via the explicit
   * "Start over with a new car" action below.
   */
  function editsFrozen(): boolean {
    return addCarEditsFrozen(loading, journal);
  }

  /**
   * Explicit, user-owned abandon (the "Start over with a new car" action
   * only - never triggered by an ordinary edit, and refused while a write
   * is in flight with unknown outcome). Resets the journal WITH the saved
   * id and failure flags (never a stranded invisible journal), mints fresh
   * declarationIds for the entries still marked yes (the old ids may
   * already be dedup-bound to the saved car - reusing them could attach a
   * declaration to the wrong vehicle), and states truthfully what happens
   * to the unsaved stages. Whatever already committed stays committed.
   */
  function abandonPendingJournal() {
    if (!addCarAbandonAllowed(loading, journal)) return;
    setJournal(null);
    setSavedId(null);
    setPhotoFailed(false);
    setProtectionFailed(false);
    setProtection((prev) => {
      const next = { ...prev };
      for (const { kind } of PROTECTION_BLOCKS) {
        if (next[kind].declared === "yes") next[kind] = { ...next[kind], declarationId: emptyProtection().declarationId };
      }
      return next;
    });
    setError("Your car was saved before this edit. Anything that had not finished saving for it will not resume here - you can add it from that car's page.");
  }

  function updateProtection(kind: MyProtectionKind, field: keyof ProtectionEntry, value: string) {
    if (editsFrozen()) return; // a pending journal owns the saved target; edits resume after it resolves
    setProtectionError(null);
    setProtectionFailed(false);
    setProtection((prev) => ({ ...prev, [kind]: { ...prev[kind], [field]: value } }));
  }

  /** Frozen at submit time: a save in flight always works on the entries the
   * user actually submitted, never a reopened or edited form. */
  function snapshotProtectionEntries(): { kind: MyProtectionKind; entry: ProtectionEntry }[] {
    return PROTECTION_BLOCKS
      .map(({ kind }) => ({ kind, entry: { ...protection[kind] } }))
      .filter(({ entry }) => entry.declared === "yes");
  }
  // Stale-response guard: every submission bumps the sequence and captures the
  // plate it was for; async answers from an older submission or plate are dropped.
  const submitSeq = useRef(0);
  const currentPlate = useRef("");

  function pickPhoto(file: { blob: Blob; type: string } | null) {
    if (editsFrozen()) return;
    if (!file) { setPhoto(null); setError(null); return; } // the uploader's Remove badge sends no file
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
    if (editsFrozen()) return;
    setArchivedMatch(null);
    setSavedId(null);
    setError(null);
    setPhotoFailed(false);
    if (field === "registrationNumber") currentPlate.current = normalizePlate(limitRegistrationInput(value));
    setForm((prev: FormState) => ({ ...prev, [field]: field === "registrationNumber" ? limitRegistrationInput(value) : value }));
  }

  function validate(f: FormState): Partial<Record<keyof FormState, string>> {
    const yearNum = parseInt(f.year, 10);
    const plate = normalizePlate(f.registrationNumber);
    const maxYear = new Date().getFullYear() + 1;
    const fe: Partial<Record<keyof FormState, string>> = {};
    if (!plate) fe.registrationNumber = "Enter your registration number.";
    else if (/[^A-Za-z0-9\s]/.test(f.registrationNumber) || !/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(plate)) fe.registrationNumber = "Enter a valid registration number, e.g. MH12AB1234.";
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

  // Unmount must stop the run too: seq/plate alone still let an unmounted
  // screen dispatch the next write, set state, and navigate.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function isStale(seq: number, plate: string) {
    return !mounted.current || seq !== submitSeq.current || currentPlate.current !== plate;
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

  /**
   * Save the optional self-declared protection entries for a car that already
   * exists. Returns true when there is nothing blocking navigation (no
   * entries, or all saved); false when it showed an error and the caller must
   * stop. Never throws for a failed save - the car itself is already safe.
   */
  function protectionEntriesValid(): boolean {
    const entries = PROTECTION_BLOCKS.map(({ kind }) => protection[kind]);
    if (entries.some((entry) => entry.declared === "yes" && (!validYears(entry.years) || !validApplied(entry.applied)))) {
      setProtectionError("Check the protection details: whole warranty years (1-50) and a valid date, or leave them empty.");
      return false;
    }
    return true;
  }

  /**
   * Run the stages still pending after the car exists, in order: protection
   * declarations first, then the photo. A failed stage stops the run with the
   * stage marked so retry resumes exactly there; already-saved declarations
   * are deduped server-side by their declarationId, so a retry never doubles.
   */
  async function runPendingStages(vehicleId: string, pendingJournal: PendingJournal, seq: number, plate: string): Promise<boolean> {
    // Runner semantics (per-entry progress, staleness gates before and after
    // every write) live in lib/add-car-journal.ts with unit coverage; the
    // messages and failure flags here are the unchanged screen contract.
    const ok = await runAddCarJournal(vehicleId, pendingJournal, {
      saveDeclaration: async (vid, { kind, entry }) => {
        await createMyProtection({
          vehicleId: vid,
          kind,
          declarationId: entry.declarationId,
          ...(entry.brand.trim() !== "" ? { provider: entry.brand.trim() } : {}),
          ...(entry.years.trim() !== "" ? { warrantyYears: Number(entry.years.trim()) } : {}),
          ...(entry.applied.trim() !== "" ? { startDate: entry.applied.trim() } : {}),
        });
      },
      uploadPhoto: async (vid, p) => {
        await uploadVehiclePhoto(vid, p.blob, p.contentType);
      },
      isStale: () => isStale(seq, plate),
      onProtectionFailed: () => {
        // The car is saved; the declarations may or may not have landed - a
        // retry is safe (declarationId dedup), so ask for one honestly.
        setProtectionFailed(true);
        setError(PROTECTION_SAVE_UNCONFIRMED);
      },
      onPhotoFailed: () => {
        // Stay on this screen so the message is actually seen.
        setPhotoFailed(true);
        setError("Your car is saved, but the photo could not be uploaded. Try again, or tap Done to continue without it.");
      },
    });
    // A stale/inactive run publishes nothing: no state writes, no navigation.
    if (isStale(seq, plate)) return false;
    setJournal({ ...pendingJournal });
    // Truthful stage flags: a stage that succeeded on this run no longer
    // shows as failed (a resumed declaration success followed by a photo
    // failure must not leave both flags set).
    if (pendingJournal.entriesDone >= pendingJournal.entries.length) setProtectionFailed(false);
    if (pendingJournal.photoDone) setPhotoFailed(false);
    return ok;
  }

  async function retryPendingStages() {
    if (!savedId || loading || !journal) return;
    const seq = ++submitSeq.current;
    const plate = currentPlate.current;
    setLoading(true);
    setError(null);
    try {
      if (await runPendingStages(savedId, journal, seq, plate)) {
        router.replace(`/(tabs)/garage/${savedId}`);
      }
    } finally {
      if (!isStale(seq, plate)) setLoading(false);
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
    setSizeError(!size);
    if (!size || Object.keys(fe).length > 0 || !protectionEntriesValid()) {
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (auth.status === "ready") {
        const uid = auth.customerDocId;
        if (!uid) { setError("Your profile is still linking. Try again once it is ready."); return; }
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
          setDupOpen(true);
          return;
        }
      }
      const vehicle = await createVehicle({
        registrationNumber: plate,
        make: form.make.trim(),
        model: form.model.trim(),
        year: yearNum,
        color: form.color.trim(),
        category: size,
      });
      if (isStale(seq, plate)) return;
      setSavedId(vehicle.id);
      const j = createAddCarJournal(snapshotProtectionEntries(), photo ? { blob: photo.blob, contentType: photo.contentType } : null);
      setJournal(j);
      if (!(await runPendingStages(vehicle.id, j, seq, plate))) return;
      router.replace(GARAGE_ROUTE);
    } catch (err) {
      if (isStale(seq, plate)) return;
      const code = (err as { code?: string })?.code ?? "";
      const msg = err instanceof Error ? err.message : "";
      console.warn("add car failed", code, msg);
      const duplicateId = (err as { details?: { vehicleId?: string } }).details?.vehicleId;
      if (/already-exists/.test(code) && duplicateId) {
        setSavedId(duplicateId);
        setDupOpen(true);
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
          const verified = await verifyArchivedMatch(details.vehicleId, plate, auth.customerDocId ?? "", auth.claims.tenantId);
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
      const verified = await verifyArchivedMatch(archivedMatch.vehicleId, plate, auth.customerDocId ?? "", auth.claims.tenantId);
      if (isStale(seq, plate)) return;
      if (!verified) {
        setArchivedMatch(null);
        setError("We could not verify the car we have on file. Please try again.");
        return;
      }
      await restoreVehicle(verified.id);
      if (isStale(seq, plate)) return;
      // The restored car is the car this form describes (fresh ownership /
      // tenant / archive / plate check above), so the pending declarations
      // and photo belong to it: run the same journal instead of silently
      // dropping what the user entered before the restore prompt. Their
      // declarationIds were minted by this form session for this submission.
      const j = createAddCarJournal(snapshotProtectionEntries(), photo ? { blob: photo.blob, contentType: photo.contentType } : null);
      setJournal(j);
      setSavedId(verified.id);
      if (!(await runPendingStages(verified.id, j, seq, plate))) return;
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
      <Screen header={<SceneIntro compact eyebrow="Your garage" title="Add a car" detail="Its details, photos and records stay together."/>}>
        {/* Frozen while a save is in flight or a journal has pending stages:
            pointer events blocked for EVERY input path (fields, selects,
            date, photo) and the handlers no-op too, so no path can bypass
            the freeze and strand pending work. */}
        <View style={{ gap: space.line, opacity: editsFrozen() ? 0.6 : 1 }} pointerEvents={editsFrozen() ? "none" : "auto"}>
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
              maxLength={key === "registrationNumber" ? REG_RAW_MAX : key === "year" ? 4 : 50}
            />
          ))}
        </View>

        <View style={{ gap: space.breath }}>
          <Kicker>Size</Kicker>
          <T role="caption" tone="secondary">Saved with your car. Only PPF prices change with car size.</T>
          <SelectField label="Car size" value={size ?? ""} placeholder="Choose size" options={VEHICLE_SIZES} onChange={v=>{setSize(v as VehicleCategory);setSizeError(false);}}/>
          {sizeError?<T role="caption" tone="danger">Choose your car's size.</T>:null}
        </View>

        <View style={{ gap: space.breath }}>
          <Kicker>Existing protection (optional)</Kicker>
          <T role="caption" tone="secondary">If this car already has PPF or ceramic coating, add what you know. It shows as added by you - AutoDeck has not verified it. Warranty years alone do not create an expiry date.</T>
          {PROTECTION_BLOCKS.map(({ kind, label, question }) => (
            <View key={kind} style={{ gap: space.hair }}>
              {/* SelectField renders no visible label on web (native-only);
                  render the question here like DateField's label pattern. */}
              <T role="label" tone="tertiary">{question}</T>
              <SelectField
                label={question}
                value={protection[kind].declared}
                placeholder="Choose"
                options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                onChange={(v: string) => updateProtection(kind, "declared", v)}
              />
              {protection[kind].declared === "yes" ? (
                <>
                  <T role="caption" tone="tertiary">{label} - every detail is optional; add what you know.</T>
                  <Field
                    label="Brand or installer (optional)"
                    placeholder="e.g. Garware, LLumar"
                    value={protection[kind].brand}
                    onChangeText={(v: string) => updateProtection(kind, "brand", v)}
                    maxLength={200}
                  />
                  <Field
                    label="Reported warranty in years (optional)"
                    placeholder="e.g. 5"
                    value={protection[kind].years}
                    onChangeText={(v: string) => updateProtection(kind, "years", v)}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <DateField
                    label="Applied on (optional)"
                    value={protection[kind].applied}
                    onChange={(v: string) => updateProtection(kind, "applied", v)}
                    max={todayStudioDate()}
                  />
                </>
              ) : null}
            </View>
          ))}
          {protectionError ? <T role="caption" tone="danger">{protectionError}</T> : null}
        </View>

        <>
          <View style={{ gap: space.hair }}>
            <Kicker>Photo (optional)</Kicker>
            <FileUploader files={photo && !(photo.blob instanceof Uint8Array)?[{blob:photo.blob,type:photo.contentType}]:[]} nativeEnabled nativeFileCount={photo?1:0} onNativeChange={fs=>{if(editsFrozen())return;const f=fs[0];setPhoto(f?{blob:f.bytes,contentType:f.type,previewUrl:f.previewUri}:null);setError(null);}} onChange={fs=>pickPhoto(fs[0]?{blob:fs[0].blob,type:fs[0].type}:null)}/>
            {photo ? <T role="caption" tone="tertiary">Photo ready - it uploads when the car is added.</T> : null}
          </View>
        </>


        {dupOpen && savedId ? (
          <Modal transparent animationType="fade" visible onRequestClose={() => setDupOpen(false)}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.inset, backgroundColor: "rgba(0,0,0,.5)" }}>
              <View style={{ width: "100%", maxWidth: 380 }}>
                <ModalCard title="This car is already in your garage" body="A car with this registration number is already saved, so it can't be added again.">
                  <Button label="View saved car" onPress={() => { setDupOpen(false); router.replace(`/(tabs)/garage/${savedId}`); }} />
                  <Button label="Close" kind="quiet" onPress={() => setDupOpen(false)} />
                </ModalCard>
              </View>
            </View>
          </Modal>
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

        {error ? <Notice title={photoFailed ? "Photo not uploaded" : protectionFailed ? "Protection save unconfirmed" : "Can't add this car"} body={error} /> : null}

        {savedId && journal && journalPending(journal) ? (
          <View style={{ gap: space.breath }}>
            <T role="caption" tone="tertiary">This save is not finished. Resume it, continue to the saved car and finish there, or start over - editing here stays locked until you choose.</T>
            <Button label="Resume unfinished save" busy={loading} onPress={() => void retryPendingStages()} />
            <Button label="Continue to your car" kind="quiet" onPress={() => router.replace(`/(tabs)/garage/${savedId}`)} />
            <Button label="Start over with a new car" kind="quiet" busy={loading} onPress={() => abandonPendingJournal()} />
          </View>
        ) : savedId && !photoFailed && !protectionFailed ? <Button label="View saved car" onPress={() => router.replace(`/(tabs)/garage/${savedId}`)} /> : photoFailed ? <View style={{ gap: space.breath }}><Button label="Try the photo again" busy={loading} onPress={() => void retryPendingStages()} /><Button label="Done" kind="quiet" onPress={() => router.replace(GARAGE_ROUTE)} /></View> : protectionFailed && savedId ? <View style={{ gap: space.breath }}><Button label="Continue to your car" onPress={() => router.replace(`/(tabs)/garage/${savedId}`)} /><Button label="Try the protection details again" kind="quiet" busy={loading} onPress={() => void retryPendingStages()} /></View> : <Button label="Add car" busy={loading || auth.status !== "ready" || !!archivedMatch} onPress={() => void handleAdd()} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
