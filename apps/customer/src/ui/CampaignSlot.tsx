import { Pressable, Text, View } from "react-native";
import { glassPane } from "../lib/glass-pane";
import { hasCampaign, type Campaign } from "../lib/campaign";

/** Compact campaign slot. Renders nothing until real headline and image exist. */
export function CampaignSlot({ campaign }: { campaign: Campaign | null | undefined }) {
  if (!hasCampaign(campaign)) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={campaign.headline} onPress={campaign.onPress} style={{ height: 112, overflow: "hidden", ...glassPane() }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5, ...({ backgroundImage: `url(${campaign.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } as object) }} />
      <View style={{ padding: 16, gap: 4, maxWidth: "70%" }}>
        <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{campaign.cta ?? "From the studio"}</Text>
        <Text numberOfLines={2} style={{ color: "#F4F1EC", fontSize: 17, fontWeight: "800", lineHeight: 22 }}>{campaign.headline}</Text>
        {campaign.body ? <Text numberOfLines={1} style={{ color: "rgba(244,241,236,0.7)", fontSize: 13 }}>{campaign.body}</Text> : null}
      </View>
    </Pressable>
  );
}
