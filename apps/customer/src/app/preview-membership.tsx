// Dev-only mock of the membership hub pieces.
import { View } from "react-native";
import { Screen, PageHeader } from "../ui/kit";
import { MembershipCard } from "../ui/MembershipCard";
import { PlanCompare } from "../ui/PlanCompare";
import { compareCols } from "../lib/membership-view";

const m = (o: object) => ({ id: "m", tier: "gold", status: "active", washesTotal: 8, washesUsed: 3, discountPercent: 15, endDate: "2026-10-22", ...o }) as never;
const plans = [["s", "Silver", 360000, 4, 10], ["g", "Gold", 680000, 8, 15], ["p", "Platinum", 1280000, 16, 20]].map(([id, name, price, w, d]) => ({ id, name, priceInPaise: price, includedWashes: w, discountPercent: d, active: true })) as never;
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
