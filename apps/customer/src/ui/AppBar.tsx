import { referralShareMessage, referralSubtitle } from "../lib/referral";
// One header for every tab screen: avatar (opens the side drawer) on the left, the screen name in the middle, the bell on the right.
import { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";
import { listenToMyNotifications } from "../lib/notification-service";
import { raised } from "../lib/raised";
import { NavIcon } from "./NavIcon";
import { SideDrawer, type DrawerItem } from "./SideDrawer";

export function AppBar({ title }: { title: string }) {
  const { colors, name } = useExperienceTheme();
  const r = raised(name);
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ready = auth.status === "ready";
  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => setUnread(n.filter((x) => x.readAt === null).length), () => undefined);
  }, [auth.status]);
  const display = ready ? (auth.user.displayName ?? "AutoDeck").trim() || "AutoDeck" : "AutoDeck";
  const initial = display.charAt(0).toUpperCase() || "A";
  const go = (p: string) => () => router.push(p as never);
  const items: DrawerItem[] = [
    { key: "garage", label: "My garage", sub: "Your cars and care map", icon: "garage", onPress: go("/(tabs)/garage") },
    { key: "bookings", label: "Bookings", sub: "Upcoming and past visits", icon: "bookings", onPress: go("/(tabs)/bookings") },
    { key: "services", label: "All services", sub: "Wash, coatings, PPF, garage", icon: "services", onPress: go("/(tabs)/catalogue") },
    { key: "membership", label: "Membership", sub: "Washes and perks", icon: "club", onPress: go("/(tabs)/membership") },
    { key: "friend", label: "Bring a friend", sub: referralSubtitle(), icon: "gift", onPress: () => void Share.share({ message: referralShareMessage() }).catch(() => undefined) },
    { key: "notifications", label: "Notifications", icon: "bell", onPress: go("/(tabs)/notifications") },
    { key: "studio", label: "The studio", sub: "Address, hours, call", icon: "pin", onPress: go("/(tabs)/studio") },
    { key: "help", label: "Help and contact", icon: "chat", onPress: go("/(tabs)/help") },
    { key: "profile", label: "Profile and settings", sub: "Name, appearance, licence", icon: "profile", onPress: go("/(tabs)/profile") },
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <SideDrawer open={open} onClose={() => setOpen(false)} name={display} initial={initial} items={items} />
      <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => setOpen(true)} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
        <Text style={{ color: colors.accentStrong, fontSize: 18, fontWeight: "800" }}>{initial}</Text>
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} onPress={go("/(tabs)/notifications")} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
        <NavIcon name="bell" color={colors.textPrimary} size={22} cut="#18181C" />
        {unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
      </Pressable>
    </View>
  );
}
