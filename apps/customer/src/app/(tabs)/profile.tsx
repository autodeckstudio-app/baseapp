// You: account, membership, notifications, sign out.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../lib/firebase";
import { useLang } from "../../lib/i18n";
import { cancelAccountDeletion, requestAccountDeletion } from "../../lib/pickup-service";
import { signOut } from "../../lib/auth-service";
import { enablePush, pushAvailable } from "../../lib/push";
import { useAuth } from "../../hooks/useAuth";
import { ProfileHero } from "../../ui/ProfileHero";
import { Button, Field, Kicker, Loading, Notice, Pane, Row, Screen, T } from "../../ui/kit";

export default function YouScreen() {
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
    <Screen>
      <ProfileHero
        name={name}
        email={auth.user.email}
        onEdit={() => { setDraft(name === "AutoDeck member" ? "" : name); setSaveError(null); setEditing(true); }}
        tiles={[
          { icon: "club", label: t("Membership"), onPress: () => router.push("/(tabs)/membership") },
          { icon: "bell", label: t("Notifications"), onPress: () => router.push("/(tabs)/notifications") },
          { icon: "garage", label: "My cars", onPress: () => router.push("/(tabs)/garage") },
          { icon: "users", label: t("Help and contact"), onPress: () => router.push("/(tabs)/help") },
        ]}
      />
      {actionMessage?<Notice title="Account update" body={actionMessage}/>:null}
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
        <Button kind="quiet" label="Delete my account" onPress={() => setDelStep("ask")} />
      )}
    </Screen>
  );
}
