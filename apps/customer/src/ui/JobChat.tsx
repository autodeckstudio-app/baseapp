import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { canMessageJob, cleanJobMessage, JOB_MESSAGE_MAX, type JobMessage } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Field } from "./kit";
import { metrics } from "../lib/metrics";
import { raised } from "../lib/raised";
import { listenToJobMessages, sendJobMessage } from "../lib/job-chat-service";
import { CHAT_LIVE } from "../lib/job-chat";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Text chat with the studio on this visit. Hidden until the server side is live (CHAT_LIVE) and while the chat is closed. */
export function JobChat({ job, tenantId, customerId }: { job: { id: string; status: string; sealedAt?: string | null; updatedAt?: string | null }; tenantId: string; customerId: string }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const [msgs, setMsgs] = useState<JobMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = CHAT_LIVE && canMessageJob(job, Date.now());
  useEffect(() => {
    if (!CHAT_LIVE) return;
    return listenToJobMessages(job.id, tenantId, customerId, setMsgs, () => setError("Messages could not load. Reopen this visit to try again."));
  }, [job.id, tenantId, customerId]);
  if (!CHAT_LIVE) return null;
  if (!open && msgs.length === 0) return null;
  async function send() {
    const c = cleanJobMessage(text);
    if (!c.ok) { setError(c.error); return; }
    setBusy(true); setError(null);
    try { await sendJobMessage(job.id, c.text); setText(""); } catch (e) { setError(e instanceof Error && e.message ? e.message : "The message did not send. Try again."); } finally { setBusy(false); }
  }
  return (
    <View style={{ borderRadius: metrics.cardRadius, padding: metrics.cardPad, gap: 10, ...r.card }}>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Message the studio</Text>
      {msgs.length === 0 ? <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Ask a question about this visit. The studio replies here.</Text> : null}
      {msgs.map((m) => (
        <View key={m.id} style={{ alignSelf: m.sender === "customer" ? "flex-end" : "flex-start", maxWidth: "85%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: m.sender === "customer" ? "rgba(236,134,56,0.16)" : "rgba(127,127,135,0.16)" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{m.sender === "studio" ? `${m.senderName ?? "The studio"}, ` : ""}{clock(m.createdAt)}</Text>
        </View>
      ))}
      {open ? (
        <>
          <Field label="Your message" value={text} onChangeText={setText} placeholder="Type here" multiline maxLength={JOB_MESSAGE_MAX} />
          {error ? <Text style={{ color: "#D6383E", fontSize: 13 }}>{error}</Text> : null}
          <Button label="Send" busy={busy} onPress={() => void send()} />
        </>
      ) : <Text style={{ color: colors.textTertiary, fontSize: 13 }}>This chat is closed. Please call the studio.</Text>}
    </View>
  );
}
