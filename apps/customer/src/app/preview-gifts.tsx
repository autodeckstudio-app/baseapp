// Dev-only mock of the gift screens with sample data, so the layout can be checked before the server is live.
import { View } from "react-native";
import { Notice, PageHeader, Pane, Row, Screen, T, Button } from "../ui/kit";
import { GiftBuy } from "../ui/GiftBuy";
import { GiftCard } from "../ui/GiftCard";
import { GIFT_TERMS, giftValidityLine } from "@autodeck/core";

const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();
const fresh = new Date(Date.now() + 60 * 86_400_000).toISOString();
export default function PreviewGifts() {
  if (!__DEV__) return null;
  return (
    <Screen header={<PageHeader kicker="Gifts" title="Gift a wash" sub={null} />}>
      <View style={{ gap: 16 }}>
        <Notice title="Preview fixture" body="Sample data only. No real purchase, code or payment." />
        <GiftBuy amountPaise={90000} canPay busy={false} onPay={() => undefined} />
        <GiftCard code="GWABCD2345" expiresAt={fresh} buyerName="Asha Rao" />
        <Notice title="Your gift is ready" body={`${GIFT_TERMS.oneWash} ${giftValidityLine(soon, Date.now())}`} action={<Button label="Book your wash" onPress={() => undefined} />} />
        <Pane pad="gap"><Row title="Gift ending 2345" detail="Not used yet - until 19 Dec 2026 (60 days left)" last /></Pane>
      </View>
    </Screen>
  );
}
