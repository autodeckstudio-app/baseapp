// Dev-only mock of the membership hub pieces.
import { View } from "react-native";
import { Screen, PageHeader } from "../ui/kit";
import { MembershipCard } from "../ui/MembershipCard";
import { PlanCompare } from "../ui/PlanCompare";
import { compareCols } from "../lib/membership-view";

const m = (o: object) => ({ id: "m", tier: "gold", status: "active", washesTotal: 6, washesUsed: 2, discountPercent: 0, pickupsTotal: 3, pickupsUsed: 1, endDate: "2026-10-22", ...o }) as never;
const plans = [["s0", "Starter", 180000, 2, 0, false], ["s", "Silver", 360000, 4, 1, false], ["g", "Gold", 540000, 6, 3, false], ["p", "Platinum", 900000, 10, 5, true]].map(([id, name, price, w, pk, pr]) => ({ id, name, priceInPaise: price, includedWashes: w, discountPercent: 0, freePickups: pk, prioritySlot: pr, active: true })) as never;
export default function PreviewMembership() {
  if (!__DEV__) return null;
  return (
    <Screen header={<PageHeader kicker="Membership" title="Your membership" sub={null} />}>
      <View style={{ gap: 16 }}>
        <MembershipCard membership={m({})} today="2026-10-16" />
        <MembershipCard membership={m({ status: "pending", endDate: null })} today="2026-10-16" />
        <PlanCompare cols={compareCols(plans, "g")} onOpen={() => undefined} />
      </View>
    </Screen>
  );
}
