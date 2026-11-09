import{approvalFacts}from "../lib/approval-facts";
import{FactHighlights}from "./FactHighlights";
import { View } from "react-native";
import type { ApprovalRequest } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { metrics } from "../lib/metrics";
import { Button, Kicker, Pane, T, rupees } from "./kit";
import { STAGES, jobStage } from "./job-stage";

/** The one card a customer reads while the car is in the studio: where it is, when it is ready, and anything waiting on them. */
export function LiveJobCard({ status, slotStarted = false, readyText, approvals, busyId, error, onDecide }: {
  status: string;
  slotStarted?: boolean;
  readyText: string | null;
  approvals: ApprovalRequest[];
  busyId: string | null;
  error: string | null;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
}) {
  const { colors } = useExperienceTheme();
  const stage = jobStage(status, slotStarted);
  if (!stage) return null;
  return (
    <View style={{ gap: metrics.sectionGap }}>
      <Pane pad="inset">
        <View style={{ gap: metrics.innerGap }}>
          <Kicker tone="accent">Studio status</Kicker>
          <T role="heading">{stage.headline}</T>
          <T role="body" tone="secondary">{stage.line}</T>
          <View accessibilityRole="progressbar" accessibilityLabel={`Step ${Math.max(stage.index + 1, 0)} of ${STAGES.length}`} style={{ flexDirection: "row", gap: 6 }}>
            {STAGES.map((s, i) => (
              <View key={s} style={{ flex: 1, height: 6, borderRadius: 4, backgroundColor: i <= stage.index ? colors.textPrimary : "rgba(255,255,255,0.14)" }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STAGES.map((s, i) => (
              <View key={s} style={{flex:1,minWidth:0}}><T role="caption" style={{textAlign:"center"}} tone={i === stage.index ? "primary" : "tertiary"}>{s}</T></View>
            ))}
          </View>
          {readyText && stage.index < 3 ? <T role="bodyStrong">Expected ready {readyText}</T> : null}
        </View>
      </Pane>
      {approvals.map((a) => {const facts=approvalFacts(a);return (
        <Pane key={a.id} pad="inset">
          <View style={{ gap: metrics.innerGap }}>
            <Kicker tone="accent">{facts.label}</Kicker>
            <T role="heading">{a.serviceName}</T>
            {a.reason ? <T role="body" tone="secondary">{a.reason}</T> : null}
            <FactHighlights facts={[{value:rupees(a.priceImpact),label:"Additional work"},...(facts.total!==null?[{value:rupees(facts.total),label:facts.totalLabel!}]:[])]}/>
            {facts.actionable?<View style={{ gap: space.breath }}>
              <Button label={`Approve +${rupees(a.priceImpact)}`} busy={busyId === a.id} onPress={() => onDecide(a.id, "approved")} />
              <Button label="No thanks" kind="quiet" disabled={busyId === a.id} onPress={() => onDecide(a.id, "rejected")} />
            </View>:null}
          </View>
        </Pane>
      )})}
      {error ? <T role="caption" tone="danger">{error}</T> : null}
    </View>
  );
}
