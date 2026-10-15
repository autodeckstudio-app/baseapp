// You: account, membership, notifications, sign out.
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { getThemePref, setThemePref, type ThemePref } from "@autodeck/ui/theme";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../lib/firebase";
import { useLang } from "../../lib/i18n";
import { cancelAccountDeletion, requestAccountDeletion } from "../../lib/pickup-service";
import { uploadLicensePhoto } from "../../lib/vehicle-service";
import { FileUploader } from "../../ui/inputs";
import { signOut } from "../../lib/auth-service";
import { enablePush, pushAvailable } from "../../lib/push";
import { useAuth } from "../../hooks/useAuth";
import { ProfileHero } from "../../ui/ProfileHero";
import { Button, Field, Kicker, Loading, Notice, PageHeader, Pane, Row, Screen, T } from "../../ui/kit";

export default function YouScreen() {
  const { colors, name: themeName } = useExperienceTheme();
  const auth = useAuth();
  const { lang, t } = useLang();
  const router = useRouter();
  const [actionMessage,setActionMessage] = useState<string|null>(null);
  function showActionMessage(title:string,body:string){setActionMessage(`${title}: ${body}`);}
  const [confirm, setConfirm] = useState(false);
  const [delStep, setDelStep] = useState<"idle" | "ask" | "sent">("idle");
  const [delBusy, setDelBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lic, setLic] = useState<{ blob: Blob; contentType: string } | null>(null);
  const [licBusy, setLicBusy] = useState(false);
  const [licMsg, setLicMsg] = useState<string | null>(null);
  async function saveLicense() {
    if (!lic || licBusy) return;
    setLicBusy(true); setLicMsg(null);
    try { await uploadLicensePhoto(lic.blob, lic.contentType); setLic(null); setLicMsg("Licence saved."); }
    catch (e) { setLicMsg(e instanceof Error ? e.message : "Could not save your licence. Try again."); }
    finally { setLicBusy(false); }
  }
  const [pref, setPref] = useState<ThemePref>(getThemePref());
  const [savedName, setSavedName] = useState<string | null>(null);

  async function saveName() {
    if (auth.status !== "ready" || saving) return;
    const next = draft.trim();
    if (next.length < 2 || next.length > 100) {
      setSaveError("Enter your name, 2 to 100 characters.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.customers(), auth.user.uid), { name: next, updatedAt: new Date().toISOString() });
      await updateProfile(auth.user, { displayName: next });
      setSavedName(next);
      setEditing(false);
    } catch {
      setSaveError("We could not save your name. Try again.");
    } finally {
      setSaving(false);
    }
  }
  if (auth.status !== "ready") return <Loading />;
  const name = savedName ?? auth.user.displayName ?? "AutoDeck member";

  return (
    <Screen appBar="You">
      <PageHeader title="Your account" />
      <ProfileHero
        name={name}
        email={auth.user.email}
        onEdit={() => { setDraft(name === "AutoDeck member" ? "" : name); setSaveError(null); setEditing(true); }}
        tiles={[]}
      />
      <Pane pad="none"><View style={{ paddingHorizontal: 16 }}><Row last title="Help and contact" detail="Call or WhatsApp the studio" onPress={() => router.push("/(tabs)/help")} /></View></Pane>
      {actionMessage?<Notice title="Account update" body={actionMessage}/>:null}
      <View style={{ gap: space.hair }}>
        <Kicker>Appearance</Kicker>
        <View style={{ flexDirection: "row", gap: space.line }}>
          {(["auto", "light", "night"] as const).map((m) => {
            const on = pref === m;
            return (
              <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setThemePref(m); setPref(m); }} style={{ flex: 1, flexBasis: 0, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? "transparent" : "rgba(128,128,128,0.28)", backgroundColor: on ? (themeName === "light" ? "#16181C" : "#F3F1ED") : "transparent" }}>
                <Text style={{ color: on ? (themeName === "light" ? "#F4F1EC" : "#16181C") : colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{m === "auto" ? "Auto" : m === "light" ? "Day" : "Night"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {editing ? (
        <View style={{ gap: space.breath }}>
          <Field label="Your name" value={draft} onChangeText={setDraft} autoCapitalize="words" maxLength={100} />
          {saveError ? <T tone="danger">{saveError}</T> : null}
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button label={t("Save")} busy={saving} onPress={() => void saveName()} style={{ flex: 1 }} />
            <Button kind="quiet" label={t("Cancel")} onPress={() => setEditing(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
      {Platform.OS === "web" ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Driving licence</Kicker>
          <FileUploader files={lic ? [{ blob: lic.blob, type: lic.contentType }] : []} onChange={(fs) => { const f = fs[0]; setLic(f ? { blob: f.blob, contentType: f.type } : null); setLicMsg(null); }} />
          {lic ? <Button label="Save licence photo" busy={licBusy} onPress={() => void saveLicense()} /> : null}
          <T role="caption" tone={licMsg && !licMsg.endsWith("saved.") ? "danger" : "tertiary"}>{licMsg ?? "Add a clear photo of your licence (JPEG, PNG or WebP). Only you and the studio can see it."}</T>
        </View>
      ) : null}
      {/* Language picker hidden until the whole app is translated (LANGS, setLang kept in lib/i18n). */}
      {confirm ? (
        <View style={{ gap: space.breath }}>
          <T tone="secondary">Sign out of AutoDeck on this device?</T>
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button kind="danger" label={t("Sign out")} onPress={() => void signOut()} style={{ flex: 1 }} />
            <Button kind="quiet" label={t("Cancel")} onPress={() => setConfirm(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label={t("Sign out")} onPress={() => setConfirm(true)} />
      )}
      {delStep === "sent" ? (
        <View style={{ gap: space.breath }}>
          <T role="caption" tone="secondary">Your deletion request is in. Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
          <Button kind="quiet" label="Cancel deletion" busy={delBusy} onPress={() => { setDelBusy(true); void cancelAccountDeletion().then(() => setDelStep("idle")).catch(() => showActionMessage("Could not cancel", "The 7 day window may have passed. Contact the studio.")).finally(() => setDelBusy(false)); }} />
        </View>
      ) : delStep === "ask" ? (
        <View style={{ gap: space.breath }}>
          <T tone="secondary">Delete your account? Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button kind="danger" label="Send request" busy={delBusy} style={{ flex: 1 }} onPress={() => { setDelBusy(true); void requestAccountDeletion().then(() => setDelStep("sent")).catch(() => showActionMessage("Could not send", "Try again in a moment.")).finally(() => setDelBusy(false)); }} />
            <Button kind="quiet" label="Cancel" onPress={() => setDelStep("idle")} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 32 }}><Button kind="quiet" label="Delete my account" onPress={() => setDelStep("ask")} /></View>
      )}
    </Screen>
  );
}
