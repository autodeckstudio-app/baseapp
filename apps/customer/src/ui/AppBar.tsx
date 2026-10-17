import { referralCodeFor } from "../lib/referral";
import { buildDrawerItems } from "../lib/drawer-items";
// One header for every tab screen: avatar (opens the side drawer) on the left, the screen name in the middle, the bell on the right.
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";
import { listenToMyNotifications } from "../lib/notification-service";
import { raised } from "../lib/raised";
import { NavIcon } from "./NavIcon";
import { SideDrawer, type DrawerItem } from "./SideDrawer";

export function AppBar({ title, onBack }: { title: string; onBack?: (() => void) | undefined }) {
  const { colors, name } = useExperienceTheme();
  const r = raised(name);
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ready = auth.status === "ready";
  const myCode = ready ? referralCodeFor(auth.user.uid) : null;
  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => setUnread(n.filter((x) => x.readAt === null).length), () => undefined);
  }, [auth.status]);
  const display = ready ? (auth.user.displayName ?? "AutoDeck").trim() || "AutoDeck" : "AutoDeck";
  const initial = display.charAt(0).toUpperCase() || "A";
  const go = (p: string) => () => router.push(p as never);
  const items: DrawerItem[] = buildDrawerItems((path) => router.push(path as never), myCode);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <SideDrawer open={open} onClose={() => setOpen(false)} name={display} initial={initial} items={items} />
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Text style={{ color: colors.textPrimary, fontSize: 26, lineHeight: 28, fontWeight: "600" }}>{"\u2039"}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => setOpen(true)} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
        <Text style={{ color: colors.accentStrong, fontSize: 18, fontWeight: "800" }}>{initial}</Text>
      </Pressable>
      )}
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} onPress={go("/(tabs)/notifications")} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
        <NavIcon name="bell" color={colors.textPrimary} size={22} cut="#18181C" />
        {unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
      </Pressable>
    </View>
  );
}
