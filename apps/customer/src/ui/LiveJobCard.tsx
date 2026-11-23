import type React from 'react';
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
export function LiveJobCard({ status, visit, progress, slotStarted = false, readyText, approvals, busyId, error, onDecide }: {
  status: string;
  visit?:React.ReactNode;
  progress?:{headline:string;line:string;services:{id:string;name:string;status:string}[]}|undefined;
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
      {visit ?? <Pane pad="inset">
        <View style={{ gap: metrics.innerGap }}>
          <Kicker tone="accent">Studio status</Kicker>
          <T role="heading">{progress?.headline??stage.headline}</T>
          <T role="body" tone="secondary">{progress?.line??stage.line}</T>
          {status!=="READY_FOR_DELIVERY"||progress?<View accessibilityRole="progressbar" accessibilityLabel={`Step ${Math.max(stage.index + 1, 0)} of ${STAGES.length}`} style={{gap:0}}>
            {STAGES.map((s,i)=><View key={s} style={{flexDirection:"row",gap:16,minHeight:60}}><View style={{width:24,alignItems:"center"}}><View style={{width:22,height:22,borderRadius:12,borderWidth:i<=stage.index?0:1,borderColor:colors.borderSubtle,backgroundColor:i<=stage.index?colors.textPrimary:"transparent",alignItems:"center",justifyContent:"center"}}>{i<=stage.index?<View style={{width:6,height:6,borderRadius:4,backgroundColor:colors.surface}}/>:null}</View>{i<STAGES.length-1?<View style={{width:2,flex:1,backgroundColor:i<stage.index?colors.textPrimary:colors.borderSubtle}}/>:null}</View><View style={{flex:1,minWidth:0,paddingBottom:20}}><T role="bodyStrong" tone={i===stage.index?"primary":"secondary"}>{s}</T>{i===stage.index?<T role="caption" tone="tertiary">Current stage</T>:null}</View></View>)}
          </View>:null}
          {progress?.services.map(s=><View key={s.id} style={{gap:3}}><T role="body">{s.name}</T><T role="caption" tone="secondary">{s.status}</T></View>)}
          {readyText && stage.index < 3 ? <T role="bodyStrong">Expected ready {readyText}</T> : null}
        </View>
      </Pane>}
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
