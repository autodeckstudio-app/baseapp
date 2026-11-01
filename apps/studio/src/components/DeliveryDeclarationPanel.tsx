import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, spacing, radius, typography, Button } from "@autodeck/ui";
import type { Protection, ProtectionCosmeticKind, ProtectionCoverageScope, ProtectionWorkEvent } from "@autodeck/core";
import {
  buildProtectionWork,
  newInstallDraft,
  newRemoveDraft,
  newReplaceDraft,
  selectTarget,
  targetableRecords,
  type DeclarationDraft,
  type DraftEvent,
} from "../lib/protection-declaration";

const KIND_LABELS: Record<ProtectionCosmeticKind, string> = { ppf: "PPF", ceramic: "Ceramic" };
const SCOPE_LABELS: Record<ProtectionCoverageScope, string> = { full_body: "Full body", full_front: "Full front", high_impact: "High impact" };
/** Staff must be able to tell same-looking records apart: every target chip
 * carries scope, the on-record date, the record's source and its unique ref. */
const recordLabel = (p: Protection) => {
  const kind = p.kind === "ceramic" ? "Ceramic" : p.kind === "ppf" ? "PPF" : "Protection";
  const scope = p.coverage ? (SCOPE_LABELS[p.coverage as ProtectionCoverageScope] ?? p.coverage) : "scope not on record";
  const date = (p.startDate ?? p.createdAt ?? "").slice(0, 10) || "date not on record";
  const source = p.source === "customer" ? "customer entry" : "studio record";
  return `${kind} - ${scope}${p.provider ? ` (${p.provider})` : ""} - ${date} - ${source} - ref ${p.id}`;
};

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ borderWidth: 1, borderColor: selected ? colors.accent : colors.border, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ ...typography.caption, color: selected ? colors.accent : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The protection-work declaration for marking a job delivered: the staff
 * member's explicit statement of the work ACTUALLY performed. Nothing is
 * prefilled from the booked service; kind, scope and every target are chosen
 * explicitly; an absent choice is never a silent "none". Replace is
 * like-for-like (kind/scope come from the chosen record, frozen at
 * selection); replace brand/warranty describe the NEW work and are typed by
 * staff or left null - never inherited from the old record. */
export function DeliveryDeclarationPanel({ protections, disabled = false, onValidChange }: { protections: Protection[]; disabled?: boolean; onValidChange: (events: ProtectionWorkEvent[] | null) => void }) {
  const [draft, setDraft] = useState<DeclarationDraft>({ choice: null });
  useEffect(() => { onValidChange(buildProtectionWork(draft, protections)); }, [draft, protections]);
  const targets = targetableRecords(protections);
  const setEvents = (events: DraftEvent[]) => setDraft({ choice: "work", events });
  const updateEvent = (i: number, ev: DraftEvent) => setDraft({ choice: "work", events: draft.choice === "work" ? draft.events.map((e, j) => (j === i ? ev : e)) : [] });
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Protection work on this visit</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>Record exactly the protection work performed on this visit - this becomes the car's protection history. Choose "none" only if no protection work was done.</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Chip label="No protection work" disabled={disabled} selected={draft.choice === "none"} onPress={() => setDraft({ choice: "none" })} />
        <Chip label="Record work" disabled={disabled} selected={draft.choice === "work"} onPress={() => setDraft({ choice: "work", events: [] })} />
      </View>
      {draft.choice === "work" ? (
        <View style={{ gap: spacing.md }}>
          {draft.events.map((ev, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{ev.action === "install" ? "New install" : ev.action === "replace" ? "Replace (like-for-like)" : "Remove"}</Text>
              {ev.action === "install" ? (
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {(Object.keys(KIND_LABELS) as ProtectionCosmeticKind[]).map((k) => <Chip key={k} label={KIND_LABELS[k]} disabled={disabled} selected={ev.kind === k} onPress={() => updateEvent(i, { ...ev, kind: k })} />)}
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                    {(Object.keys(SCOPE_LABELS) as ProtectionCoverageScope[]).map((c) => <Chip key={c} label={SCOPE_LABELS[c]} disabled={disabled} selected={ev.coverage === c} onPress={() => updateEvent(i, { ...ev, coverage: c })} />)}
                  </View>
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  {targets.length === 0 ? <Text style={{ ...typography.caption, color: colors.error }}>No current protection records on this car to {ev.action}.</Text> : null}
                  {targets.map((p) => (
                    <Chip key={p.id} label={recordLabel(p)} disabled={disabled} selected={ev.targetProtectionId === p.id} onPress={() => updateEvent(i, selectTarget(ev, p))} />
                  ))}
                  {ev.action === "replace" && ev.targetProtectionId ? (
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>Same type and scope as the record above. Brand and warranty below are for the NEW work - leave blank if not known.</Text>
                  ) : null}
                </View>
              )}
              {/* Brand/warranty row wraps at narrow widths (phone): brand
                  takes the full row, warranty drops below - no overflow. */}
              {ev.action !== "remove" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                  <TextInput value={ev.brand} editable={!disabled} onChangeText={(v) => updateEvent(i, { ...ev, brand: v })} placeholder="Brand (optional)" placeholderTextColor={colors.textMuted} style={{ ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xs, flexGrow: 1, flexBasis: 180 }} />
                  <TextInput value={ev.warrantyYears} editable={!disabled} onChangeText={(v) => updateEvent(i, { ...ev, warrantyYears: v })} placeholder="Warranty yrs" placeholderTextColor={colors.textMuted} keyboardType="number-pad" style={{ ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xs, width: 110, flexShrink: 0 }} />
                </View>
              ) : null}
              <Button label="Remove this entry" variant="ghost" fullWidth={false} disabled={disabled} onPress={() => setEvents(draft.choice === "work" ? draft.events.filter((_, j) => j !== i) : [])} />
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button label="Add install" variant="secondary" fullWidth={false} disabled={disabled} onPress={() => setEvents([...draft.events, newInstallDraft()])} />
            <Button label="Add replace" variant="secondary" fullWidth={false} disabled={disabled} onPress={() => setEvents([...draft.events, newReplaceDraft()])} />
            <Button label="Add removal" variant="secondary" fullWidth={false} disabled={disabled} onPress={() => setEvents([...draft.events, newRemoveDraft()])} />
          </View>
          {buildProtectionWork(draft, protections) === null ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Finish each entry to continue - every install needs a type and scope, every replace/removal needs a current record.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
