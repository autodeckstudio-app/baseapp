import { View, Text } from "react-native";
import type { PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Divider } from "./Divider.js";
import { formatPaise } from "../format.js";

export interface PriceBreakdownProps {
  breakdown: PriceBreakdownData;
  /** Line label for the base price row, e.g. the service name. */
  baseLabel?: string;
}

/** Renders an immutable price snapshot — always from a server-computed
 * PriceBreakdown, never recalculated on the client. */
export function PriceBreakdown({ breakdown: pb, baseLabel = "Base price" }: PriceBreakdownProps) {
  return (
    <View>
      <Row label={baseLabel} value={formatPaise(pb.basePrice)} />
      {pb.scopeAdjustment > 0 && <Row label="Vehicle category adjustment" value={`+${formatPaise(pb.scopeAdjustment)}`} />}
      {pb.addOns.map((addOn) => (
        <Row key={addOn.id} label={addOn.name} value={formatPaise(addOn.price)} />
      ))}
      {pb.membershipDiscount !== null && pb.membershipDiscount > 0 && (
        <Row label="Membership discount" value={`-${formatPaise(pb.membershipDiscount)}`} />
      )}
      <Row label={pb.taxDescription} value={formatPaise(pb.tax)} />
      <Divider spacingY="sm" />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>Total</Text>
        <Text style={{ ...typography.priceSmall, color: colors.textPrimary }}>{formatPaise(pb.total)}</Text>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xxs + 2 }}>
      <Text style={{ ...typography.body, color: colors.textSecondary, flexShrink: 1 }}>{label}</Text>
      <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}
