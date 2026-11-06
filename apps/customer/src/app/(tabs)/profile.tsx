import { SavedLicensePhoto } from "../../ui/SavedLicensePhoto";
// You: account, membership, notifications, sign out.
import { LegalLinks } from "../../ui/LegalLinks";
import { useState, useEffect, useRef } from "react";
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
import { uploadLicensePhoto, type VehiclePhotoBody } from "../../lib/vehicle-service";
import { FileUploader } from "../../ui/inputs";
import { signOut } from "../../lib/auth-service";
import { useAuth } from "../../hooks/useAuth";
import { ProfileHero } from "../../ui/ProfileHero";
import { NavIcon } from "../../ui/NavIcon";
import { glassPane } from "../../lib/glass-pane";
import { metrics } from "../../lib/metrics";
import { Button, Field, Kicker, Loading, Notice, Screen, T } from "../../ui/kit";

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
  const [lic, setLic] = useState<{ blob: VehiclePhotoBody; contentType: string } | null>(null);
  const [licBusy, setLicBusy] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [licRefresh,setLicRefresh]=useState(0);
  const [licMsg, setLicMsg] = useState<string | null>(null);
  const scopeKey=JSON.stringify([auth.status,auth.status==='ready'?auth.user.uid:null,auth.status==='ready'?auth.customerDocId:null,auth.status==='ready'?auth.claims.tenantId:null]);const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;const generation=useRef(0),saveLock=useRef(false);
  useEffect(()=>{generation.current++;saveLock.current=false;setEditing(false);setDraft('');setSaving(false);setSaveError(null);setLic(null);setLicBusy(false);setLicOpen(false);setLicMsg(null);setSavedName(null);setConfirm(false);setDelStep('idle');setDelBusy(false);setActionMessage(null);return()=>{generation.current++}},[scopeKey]);
  async function saveLicense() {
    if (!lic || licBusy||saveLock.current) return;
    const scope=scopeKey,gen=generation.current;const current=()=>scopeRef.current===scope&&generation.current===gen;saveLock.current=true;
    setLicBusy(true); setLicMsg(null);
    try { await uploadLicensePhoto(lic.blob, lic.contentType); if(!current())return;setLic(null); setLicRefresh(n=>n+1); setLicMsg("Licence saved."); }
    catch (e) { if(current())setLicMsg(e instanceof Error ? e.message : "Could not save your licence. Try again."); }
    finally { if(current()){saveLock.current=false;setLicBusy(false);} }
  }
  const [pref, setPref] = useState<ThemePref>(getThemePref());
  const [savedName, setSavedName] = useState<string | null>(null);

  async function saveName() {
    if (auth.status !== "ready" || saving||saveLock.current) return;
    if (!auth.customerDocId) { setSaveError("Your profile is still linking. Try again once it is ready."); return; }
    const next = draft.trim();
    if (next.length < 2 || next.length > 100) {
      setSaveError("Enter your name, 2 to 100 characters.");
      return;
    }
    const scope=scopeKey,gen=generation.current;const current=()=>scopeRef.current===scope&&generation.current===gen;saveLock.current=true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.customers(), auth.customerDocId), { name: next, updatedAt: new Date().toISOString() });
      if(!current())return;await updateProfile(auth.user, { displayName: next });
      if(!current())return;
      setSavedName(next);
      setEditing(false);
    } catch {
      if(current())setSaveError("We could not save your name. Try again.");
    } finally {
      if(current()){saveLock.current=false;setSaving(false);}
    }
  }
  async function changeDeletion(cancel:boolean){if(saveLock.current)return;const scope=scopeKey,gen=generation.current;const current=()=>scopeRef.current===scope&&generation.current===gen;saveLock.current=true;setDelBusy(true);try{if(cancel)await cancelAccountDeletion();else await requestAccountDeletion();if(current())setDelStep(cancel?'idle':'sent')}catch{if(current())showActionMessage(cancel?'Could not cancel':'Request not confirmed',cancel?'The 7 day window may have passed. Contact the studio.':'Check your account status before trying again.')}finally{if(current()){saveLock.current=false;setDelBusy(false)}}}
  if (auth.status !== "ready") return <Loading />;
  const name = savedName ?? auth.user.displayName ?? "AutoDeck member";

  const light = themeName === "light";
  return (
    <Screen appBar="You">
      <ProfileHero
        name={name}
        photoUrl={auth.user.photoURL ?? auth.user.providerData?.find(p=>p.providerId==='google.com')?.photoURL ?? null}
        email={auth.user.email}
        onEdit={() => { setDraft(name === "AutoDeck member" ? "" : name); setSaveError(null); setEditing(true); }}
      />
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
      {actionMessage ? <Notice title="Account update" body={actionMessage} /> : null}
      <View style={{ ...glassPane(light), paddingHorizontal: 16 }}>
        <>
            <ListRow icon="search" title="Driving licence" detail="Private photo for the studio" action={licOpen ? "Close" : "Add"} onPress={() => setLicOpen(!licOpen)} />
            {licOpen ? (
              <View style={{ gap: space.breath, paddingBottom: 14 }}>
                {auth.customerDocId?<SavedLicensePhoto customerId={auth.customerDocId} scope={scopeKey} refresh={licRefresh}/>:<T role="caption">Customer profile could not be verified. Your licence has not been changed.</T>}
                <FileUploader label="Choose or replace licence photo" files={lic && !(lic.blob instanceof Uint8Array) ? [{ blob: lic.blob, type: lic.contentType }] : []} nativeEnabled nativeFileCount={lic?1:0} onNativeChange={fs=>{const f=fs[0];setLic(f?{blob:f.bytes,contentType:f.type}:null);setLicMsg(null);}} onChange={(fs) => { const f = fs[0]; setLic(f ? { blob: f.blob, contentType: f.type } : null); setLicMsg(null); }} />
                {lic ? <Button label="Save licence photo" busy={licBusy} onPress={() => void saveLicense()} /> : null}
                {licMsg ? <T role="caption" tone={licMsg.startsWith("Licence saved.") ? "tertiary" : "danger"}>{licMsg}</T> : null}
              </View>
            ) : null}
        </>
        <ListRow last icon="chat" title="Help & contact" detail="Call or WhatsApp the studio" onPress={() => router.push("/(tabs)/help")} />
      </View>
      <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: space.breath }}>
        <Kicker>Appearance</Kicker>
        <View style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: 9999, backgroundColor: "rgba(128,128,128,0.12)" }}>
          {(["auto", "light", "night"] as const).map((m) => {
            const on = pref === m;
            return (
              <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setThemePref(m); setPref(m); }} style={{ flex: 1, flexBasis: 0, height: 40, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: on ? (light ? "#16181C" : "#F3F1ED") : "transparent" }}>
                <Text style={{ color: on ? (light ? "#F4F1EC" : "#16181C") : colors.textSecondary, fontSize: 14, fontWeight: "700" }}>{m === "auto" ? "Auto" : m === "light" ? "Day" : "Night"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: space.breath }}>
        {confirm ? (
          <View style={{ gap: space.breath }}>
            <T tone="secondary">Sign out of AutoDeck on this device?</T>
            <View style={{ flexDirection: "row", gap: space.breath }}>
              <Button kind="danger" label={t("Sign out")} onPress={() => void signOut()} style={{ flex: 1 }} />
              <Button kind="quiet" label={t("Cancel")} onPress={() => setConfirm(false)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : delStep === "sent" ? (
          <View style={{ gap: space.breath }}>
            <T role="caption" tone="secondary">Your deletion request is in. Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
            <Button kind="quiet" label="Cancel deletion" busy={delBusy} onPress={() => void changeDeletion(true)} />
          </View>
        ) : delStep === "ask" ? (
          <View style={{ gap: space.breath }}>
            <T tone="secondary">Delete your account? Your personal data is removed after 30 days. Invoices and warranty records are kept for 8 years with your name and phone removed. You can cancel within 7 days.</T>
            <View style={{ flexDirection: "row", gap: space.breath }}>
              <Button kind="danger" label="Send request" busy={delBusy} style={{ flex: 1 }} onPress={() => void changeDeletion(false)} />
              <Button kind="quiet" label="Cancel" onPress={() => setDelStep("idle")} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 }}>
            <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{t("Sign out")}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDelStep("ask")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>Delete my account</Text></Pressable>
          </View>
        )}
      </View>
      <LegalLinks />
    </Screen>
  );
}

function ListRow({ icon, title, detail, action, onPress, last }: { icon: "search" | "chat"; title: string; detail: string; action?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useExperienceTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.8 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(128,128,128,0.16)" })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(128,128,128,0.12)", alignItems: "center", justifyContent: "center" }}><NavIcon name={icon} color={colors.textPrimary} size={20} cut="#18181C" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11 }}>{detail}</Text>
      </View>
      {action ? <View style={{ borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(128,128,128,0.14)" }}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{action}</Text></View> : null}
    </Pressable>
  );
}
