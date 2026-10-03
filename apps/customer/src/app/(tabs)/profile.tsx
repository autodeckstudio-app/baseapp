// You: account, membership, notifications, sign out.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../lib/firebase";
import { LANGS, setLang, useLang } from "../../lib/i18n";
import { signOut } from "../../lib/auth-service";
import { useAuth } from "../../hooks/useAuth";
import { Button, Field, Kicker, Loading, Pane, Row, Screen, T } from "../../ui/kit";

export default function YouScreen() {
  const auth = useAuth();
  const { lang, t } = useLang();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function saveName() {
    if (auth.status !== "ready") return;
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
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">{t("You")}</Kicker><T role="title">{name}</T>{auth.user.email ? <T role="caption" tone="tertiary">{auth.user.email}</T> : null}</View>}>
      {editing ? (
        <View style={{ gap: space.breath }}>
          <Field label="Your name" value={draft} onChangeText={setDraft} autoCapitalize="words" maxLength={100} />
          {saveError ? <T tone="danger">{saveError}</T> : null}
          <View style={{ flexDirection: "row", gap: space.breath }}>
            <Button label={t("Save")} busy={saving} onPress={() => void saveName()} style={{ flex: 1 }} />
            <Button kind="quiet" label={t("Cancel")} onPress={() => setEditing(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button kind="quiet" label={t("Edit name")} onPress={() => { setDraft(name === "AutoDeck member" ? "" : name); setSaveError(null); setEditing(true); }} />
      )}
      <Pane pad="gap">
        <Row title={t("Membership")} detail={t("Plans, washes left, history")} onPress={() => router.push("/(tabs)/membership")} />
        <Row title={t("Notifications")} detail={t("Updates from the studio")} onPress={() => router.push("/(tabs)/notifications")} />
        <Row title={t("Help and contact")} detail={t("Call, WhatsApp, FAQ")} onPress={() => router.push("/(tabs)/help")} last />
      </Pane>
      <View style={{ gap: space.breath }}>
        <Kicker>{t("Language")}</Kicker>
        <View style={{ flexDirection: "row", gap: space.breath }}>
          {LANGS.map((l) => (
            <Button key={l.code} kind={lang === l.code ? "primary" : "quiet"} label={l.label} onPress={() => setLang(l.code)} style={{ flex: 1 }} />
          ))}
        </View>
      </View>
      <Pane pad="gap">
        <Row title="Signed in with Google" detail="AutoDeck never stores a password for you." last />
      </Pane>
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
    </Screen>
  );
}
