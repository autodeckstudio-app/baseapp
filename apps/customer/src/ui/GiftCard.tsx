// A gift you bought, as a card: the wash, the code, how long it is valid, and the terms. Shown after payment and when a bought gift is opened.
import { useState } from "react";
import { View } from "react-native";
import { formatGiftCode, giftDaysLeft } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { IconAction } from "./IconAction";
import { GiftRestrictions } from "./GiftRestrictions";
import { InfoLine, Kicker, Pane, T } from "./kit";
import { giftMessage, shareGift } from "../lib/gift-share";

export function GiftCard({ code, expiresAt, buyerName, serviceName, now = Date.now() }: { code: string; expiresAt: string; buyerName: string | null; serviceName?:string|undefined; now?: number }) {
  const [note, setNote] = useState<string | null>(null);
  const text = giftMessage({ code, expiresAt, buyerName,serviceName });
  async function share() {
    const r = await shareGift(text);
    setNote(r === "copied" ? "Message copied. Paste it in a chat." : r === "failed" ? "Could not share from here. Copy the code above." : null);
  }
  const days = giftDaysLeft(expiresAt, now);
  const { colors, name } = useExperienceTheme();
  const tileBg = name === "light" ? "#E8EDF4" : "#253447";
  const codeBg = name === "light" ? "#F7F9FB" : "rgba(255,255,255,.04)";
  return (
    <Pane pad="inset" testID="gift-card"><View style={{gap:16}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
        <View style={{width:40,height:40,borderRadius:14,backgroundColor:tileBg,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.borderSubtle}}><NavIcon name="gift" size={20} color={colors.textPrimary} cut={tileBg}/></View>
        <View style={{gap:4}}>
          <Kicker tone="accent">Gift</Kicker>
          <T role="heading">{serviceName??"Foam wash"}, any car</T>
        </View>
      </View>
      <View style={{ flexDirection:"row",alignItems:"center",gap:12,padding:18,borderRadius:18,borderWidth:1,borderStyle:"dashed",borderColor:"rgba(128,128,128,.4)",backgroundColor:codeBg }}>
        <View style={{flex:1,gap:10}}>
          <T role="caption" tone="tertiary">Gift code</T>
          <T role="title">{formatGiftCode(code)}</T>
        </View>
        <IconAction kind="share" label="Share gift" onPress={() => void share()} />
      </View>
      <InfoLine icon="history">{`Use by ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · ${Date.parse(expiresAt) <= now ? "Expired" : `${days} ${days === 1 ? "day" : "days"} left`}`}</InfoLine>
      {note ? <T role="caption" tone="tertiary">{note}</T> : null}
      <GiftRestrictions />
    </View></Pane>
  );
}
