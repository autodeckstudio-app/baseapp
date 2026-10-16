// The one membership card. Used only by the membership hub; Home links here and never repeats it.
import { View } from "react-native";
import type { Membership } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { glassInner } from "../lib/glass";
import { metrics } from "../lib/metrics";
import { cardState, daysLabel, discountLine } from "../lib/membership-view";
import { carryOverLine } from "../lib/membership-rules";
import { Chip, Pane, T } from "./kit";

export function MembershipCard({ membership, today }: { membership: Membership; today: string }) {
  const s = cardState(membership, today);
  const pending = membership.status === "pending";
  const tier = `${membership.tier.charAt(0).toUpperCase()}${membership.tier.slice(1)}`;
  const label = pending ? null : daysLabel(s);
  const rule = carryOverLine();
  return (
    <Pane pad="none" round="hero" fill="cool" tone="premium">
      <View style={{ padding: metrics.cardPad, gap: space.breath }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T role="label" tone="secondary">{tier} membership</T>
          {pending ? <Chip label="Payment pending" /> : label ? <Chip label={label} tone={s.endingSoon || s.ended ? "accent" : "neutral"} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.line }}>
          <T role="display">{pending ? s.total : s.left}</T>
          <T tone="secondary">{pending ? "washes after activation" : `of ${s.total} washes left`}</T>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel={`${s.left} of ${s.total} washes left`} style={{ flexDirection: "row", gap: 6 }}>
          {Array.from({ length: Math.min(s.total, 24) }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 8, borderRadius: 9999, backgroundColor: !pending && i < s.left ? "#EC8638" : glassInner.backgroundColor }} />
          ))}
        </View>
        <T tone="secondary">
          {pending
            ? `${discountLine(membership.discountPercent) ? `${discountLine(membership.discountPercent)}. ` : ""}Benefits unlock once payment is confirmed.`
            : `${s.used} used this cycle${membership.endDate ? ` · valid until ${new Date(membership.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}${discountLine(membership.discountPercent) ? ` · ${discountLine(membership.discountPercent)}` : ""}`}
        </T>
        {!pending && s.noWashes && !s.ended ? <T tone="secondary">All washes used for this cycle.</T> : null}
        {!pending && s.endingSoon && !s.ended ? <T tone="secondary">Your plan is ending. You can join the next plan once it ends.</T> : null}
        {rule ? <T role="caption" tone="tertiary">{rule}</T> : null}
      </View>
    </Pane>
  );
}
