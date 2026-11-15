// Signed in with Google but not on the studio roster: ask the admin for access.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { COLLECTIONS } from "@autodeck/database";
import { FIRST_TENANT_ID } from "@autodeck/core";
import type { StaffAccessRequest } from "@autodeck/core";
import { colors, TextInput } from "@autodeck/ui";
import { AuthButton, AuthCard } from "@autodeck/ui/native";
import { auth, db } from "../../lib/firebase";


export default function AccessScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [req, setReq] = useState<StaffAccessRequest | null | undefined>(undefined);
  const [name, setName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, COLLECTIONS.staffAccessRequests(), user.uid),
      (snap) => setReq(snap.exists() ? (snap.data() as StaffAccessRequest) : null),
      () => setReq(null),
    );
  }, [user]);

  // Approved: the admin has set this account's role. Refresh the token so the app lets them in.
  useEffect(() => {
    if (req?.status !== "approved" || !user) return;
    void user.getIdToken(true).then(() => router.replace("/"));
  }, [req?.status, user, router]);

  async function send() {
    if (!user?.email) return;
    const n = name.trim();
    if (n.length < 2) { setProblem("Enter your full name."); return; }
    setBusy(true);
    setProblem(null);
    const now = new Date().toISOString();
    const body: StaffAccessRequest = {
      uid: user.uid, tenantId: req?.tenantId ?? FIRST_TENANT_ID, email: user.email.toLowerCase(), name: n, phone: phone.trim().slice(0, 20),
      status: "pending", createdAt: req?.createdAt ?? now, updatedAt: now, decidedAt: null, decidedBy: null, decisionNote: null,
    };
    try { await setDoc(doc(db, COLLECTIONS.staffAccessRequests(), user.uid), body); }
    catch { setProblem("Could not send your request. Try again."); }
    finally { setBusy(false); }
  }

  const leave = () => void signOut(auth).then(() => router.replace("/(auth)/login"));
  const pending = req?.status === "pending";
  return (
    <AuthCard role="Studio staff" title={pending ? "Request sent" : "Ask for studio access"} copy={pending ? `Your admin will review it. You are signed in as ${user?.email ?? ""}. This page updates by itself when you are approved.` : `You are signed in as ${user?.email ?? ""}, which is not on the studio team yet. Send a request and your admin can approve it.`} error={problem}>
      {req === undefined ? null : pending ? (
        <AuthButton label="Sign out" onPress={leave} />
      ) : (
        <View style={{ gap: 10 }}>
          {req?.status === "rejected" ? <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Your last request was declined{req.decisionNote ? `: ${req.decisionNote}` : "."} You can send a new one.</Text> : null}
          <TextInput placeholder="Full name" value={name} onChangeText={setName} editable={!busy} />
          <TextInput placeholder="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
          <AuthButton label="Send request" onPress={() => void send()} busy={busy} />
          <Text onPress={leave} style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", textDecorationLine: "underline" }}>Sign out</Text>
        </View>
      )}
    </AuthCard>
  );
}
