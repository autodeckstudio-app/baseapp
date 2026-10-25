import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors, spacing, radius, typography, Button } from "@autodeck/ui";
import { ADMIN_REQUEST_NOTE, checkAdminRequest, decisionLabel, requestsForTarget, type AdminRequestDoc, type AdminRequestTarget } from "../lib/admin-approval-rules";
import { requestAdminApproval, listenToAdminRequests } from "../lib/admin-approval";

/** Staff ask the office to decide something about this job. Provisional: shown only while ADMIN_APPROVAL_ENABLED is on. A request records a question and a later decision. It never changes a price, payment or refund. */
export function AdminRequestPanel({ targetType, targetId, tenantId, studioId }: { targetType: AdminRequestTarget; targetId?: string; tenantId?: string; studioId?: string }) {
  const [all, setAll] = useState<AdminRequestDoc[]>([]);
  const [readFailed, setReadFailed] = useState(false);
  useEffect(() => {
    if (!tenantId || !studioId) return undefined;
    return listenToAdminRequests(tenantId, studioId, (r) => { setAll(r); setReadFailed(false); }, () => setReadFailed(true));
  }, [tenantId, studioId]);
  const mine = targetId ? requestsForTarget(all, targetType, targetId) : [];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function send() {
    const input = { targetType, ...(targetId ? { targetId } : {}), reason };
    const bad = checkAdminRequest(input);
    if (bad) { setMsg(bad); return; }
    setBusy(true); setMsg(null);
    try { await requestAdminApproval(input); setSent(true); setReason(""); setMsg("Sent to the office."); }
    catch { setMsg("That did not send. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Ask the office</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{ADMIN_REQUEST_NOTE}</Text>
      {mine.map((r) => { const d = decisionLabel(r); return (
        <View key={r.id} style={{ gap: 2, paddingVertical: spacing.xs }}>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{`${d.title}: ${r.reason}`}</Text>
          {d.detail ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{d.detail}</Text> : null}
        </View>); })}
      {readFailed ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Could not load earlier requests.</Text> : null}
      <TextInput value={reason} onChangeText={(v) => { setReason(v); setSent(false); }} editable={!busy} multiline placeholder="What do you need approved?" placeholderTextColor={colors.textMuted} style={{ ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 64 }} />
      {msg ? <Text accessibilityRole="alert" style={{ ...typography.caption, color: sent ? colors.textMuted : colors.error }}>{msg}</Text> : null}
      <Button label="Send to office" size="md" fullWidth={false} loading={busy} disabled={busy} onPress={() => void send()} />
    </View>
  );
}
