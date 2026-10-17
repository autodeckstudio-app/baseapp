import { Share } from "react-native";
import type { IconName } from "@autodeck/ui/theme";
import { GIFT_LIVE } from "./gift";
import { referralShareMessage, referralSubtitle } from "./referral";

export type DrawerEntry = { key: string; label: string; sub?: string; icon: IconName; onPress: () => void };

/**
 * The one left menu. Home and every other screen build it here, so the items and
 * their order never differ between pages.
 */
export function buildDrawerItems(go: (path: string) => void, referralCode: string | null): DrawerEntry[] {
  const share = () => void Share.share({ message: referralShareMessage(referralCode) }).catch(() => undefined);
  return [
    { key: "buycar", label: "Buy a car", sub: "Studio and owner listings", icon: "car", onPress: () => go("/(tabs)/cars") },
    { key: "sellcar", label: "Sell your car", sub: "List it with the studio", icon: "car", onPress: () => go("/(tabs)/cars/sell") },
    { key: "membership", label: "Membership", sub: "Washes and perks", icon: "club", onPress: () => go("/(tabs)/membership") },
    { key: "friend", label: "Bring a friend", sub: referralSubtitle(referralCode), icon: "gift", onPress: share },
    ...(GIFT_LIVE ? [{ key: "gifts", label: "Gift a wash", sub: "Use or send a gift", icon: "gift" as const, onPress: () => go("/(tabs)/gifts") }] : []),
    { key: "notifications", label: "Notifications", icon: "bell", onPress: () => go("/(tabs)/notifications") },
    { key: "studio", label: "The studio", sub: "Address, hours, call", icon: "pin", onPress: () => go("/(tabs)/studio") },
    { key: "help", label: "Help and contact", icon: "chat", onPress: () => go("/(tabs)/help") },
  ];
}
