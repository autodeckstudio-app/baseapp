import type { IconName } from "@autodeck/ui/theme";

export type DrawerEntry = { key: string; label: string; sub?: string; icon: IconName; onPress: () => void };

/**
 * The one left menu. Home and every other screen build it here, so the items and
 * their order never differ between pages.
 */
export function buildDrawerItems(go: (path: string) => void, _referralCode: string | null): DrawerEntry[] {
  return [
    { key: "cars", label: "Buy & Sell", sub: "Browse cars or list yours", icon: "car", onPress: () => go("/(tabs)/cars") },
    { key: "membership", label: "Membership", sub: "Washes and perks", icon: "club", onPress: () => go("/(tabs)/membership") },
    { key: "friends-gifts", label: "Friends & gifts", sub: "Bring a friend or gift a wash", icon: "gift", onPress: () => go("/(tabs)/gifts") },
    { key: "notifications", label: "Notifications", icon: "bell", onPress: () => go("/(tabs)/notifications") },
    { key: "help", label: "Help & contact", sub: "Studio, hours and questions", icon: "chat", onPress: () => go("/(tabs)/help") },
  ];
}
