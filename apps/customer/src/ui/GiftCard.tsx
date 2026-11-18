// A gift you bought, as a card: the wash, the code, how long it is valid, and the terms. Shown after payment and when a bought gift is opened.
import { useState } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { GIFT_TERMS, formatGiftCode, giftDaysLeft, giftValidityLine } from "@autodeck/core";
import { Button, Kicker, Pane, T } from "./kit";
import { giftMessage, shareGift } from "../lib/gift-share";

export function GiftCard({ code, expiresAt, buyerName, now = Date.now() }: { code: string; expiresAt: string; buyerName: string | null; now?: number }) {
  const [note, setNote] = useState<string | null>(null);
  const text = giftMessage({ code, expiresAt, buyerName });
  async function share() {
    const r = await shareGift(text);
    setNote(r === "copied" ? "Message copied. Paste it in a chat." : r === "failed" ? "Could not share from here. Copy the code above." : null);
  }
  const days = giftDaysLeft(expiresAt, now);
  return (
    <Pane pad="inset" testID="gift-card"><View style={{gap:20}}>
      <Kicker tone="accent">Gift</Kicker>
      <T role="heading">Foam wash, any car</T>
      <View style={{ gap: 10, padding:18,borderRadius:18,borderWidth:1,borderStyle:"dashed",borderColor:"rgba(128,128,128,.4)" }}>
        <T role="caption" tone="tertiary">Gift code</T>
        <T role="title">{formatGiftCode(code)}</T>
      </View>
      <T tone="secondary">{giftValidityLine(expiresAt, now)}</T>
      {days <= 7 ? <T role="caption" tone="tertiary">Only {days} {days === 1 ? "day" : "days"} left.</T> : null}
      <Button icon="share" label="Share gift" onPress={() => void share()} />
      {note ? <T role="caption" tone="tertiary">{note}</T> : null}
      <View style={{ marginTop: space.hair }}><T role="caption" tone="tertiary">{GIFT_TERMS.nonRefundable}</T></View>
    </View></Pane>
  );
}
