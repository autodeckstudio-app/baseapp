// Studio: a stylised map of the studio's street with a bottom sheet (reference
// screen 2): address, hours, services to start from, call and directions.
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "../../ui/NavIcon";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { raised } from "../../lib/raised";
import { STUDIO_INFO, formatHours, isOpenNow, type LiveStudioInfo } from "../../lib/studio-info";
import { getStudioInfo } from "../../lib/booking-service";
import { Screen } from "../../ui/kit";


function MapCanvas({ onPress }: { onPress: () => void }) {
  const { name, colors } = useExperienceTheme();
  const night = name !== "light";
  const land = night ? "#16181C" : "#DDE1E6";
  const block = night ? "#1D2025" : "#E9ECEF";
  const road = night ? "#2A2D33" : "#F7F8FA";
  const park = night ? "#18241E" : "#D3E3D8";
  const label = night ? "#7C8088" : "#8A9099";
  const bar = (style: object) => <View style={{ position: "absolute", backgroundColor: road, borderRadius: 6, ...style }} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open the studio in maps" onPress={onPress} style={{ height: 230, borderRadius: 24, overflow: "hidden", backgroundColor: land }}>
      <View style={{ position: "absolute", left: 20, top: 150, width: 120, height: 90, borderRadius: 16, backgroundColor: park }} />
      {[[16, 24, 90, 60], [124, 24, 110, 60], [250, 24, 120, 60], [20, 260, 100, 70], [140, 262, 90, 70], [250, 160, 120, 80]].map(([l, t, w, h], i) => (
        <View key={i} style={{ position: "absolute", left: l!, top: t!, width: w!, height: h!, borderRadius: 12, backgroundColor: block }} />
      ))}
      {bar({ left: 0, right: 0, top: 104, height: 16 })}
      {bar({ left: 0, right: 0, top: 236, height: 12 })}
      {bar({ left: 112, top: 0, bottom: 0, width: 14 })}
      {bar({ left: 240, top: 0, bottom: 0, width: 14 })}
      <Text style={{ position: "absolute", left: 150, top: 108, color: label, fontSize: 10, fontWeight: "600" }}>Old Sharda Mandir Rd</Text>
      <View style={{ position: "absolute", left: 150, top: 150, alignItems: "center", gap: 4 }}>
        <View style={{ width: 54, height: 54, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: night ? "#F3F1ED" : "#16181C", ...(Platform.OS === "web" ? ({ boxShadow: "0 12px 22px rgba(0,0,0,.35)" } as object) : {}) }}>
          <Icon name="garage" color={night ? "#16181C" : "#FFFFFF"} size={26} />
        </View>
        <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surface }}><Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}>AutoDeck</Text></View>
      </View>
    </Pressable>
  );
}

export default function StudioScreen() {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const light = name === "light";
  const [live, setLive] = useState<LiveStudioInfo["operatingHours"] | null>(null);
  useEffect(() => {
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((i) => { if (alive && i.operatingHours?.length) setLive(i.operatingHours); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const hours = live ? formatHours(live) : STUDIO_INFO.hours;
  const open = isOpenNow(live, new Date());
  const pill = (label: string, icon: "call" | "whatsapp" | "directions", url: string, dark: boolean) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 9999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1, ...(dark ? r.dark : r.round) })}>
      <NavIcon name={icon} color={dark ? (light ? "#FFFFFF" : "#16181C") : colors.textPrimary} size={18} cut={light ? "#FFFFFF" : "#18181C"} />
      <Text style={{ color: dark ? (light ? "#FFFFFF" : "#16181C") : colors.textPrimary, fontSize: 14, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen>
      <View style={{ gap: 14, paddingBottom: 20 }}>
        <View style={{ padding: 8, gap: 12, borderRadius: 24, ...r.sheet }}>
          <MapCanvas onPress={() => void Linking.openURL(STUDIO_INFO.mapsUrl)} />
          <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 4 }}>
            {open !== null ? <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>{open ? "OPEN NOW" : "CLOSED NOW"}</Text> : null}
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>AutoDeck Studio</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{STUDIO_INFO.address}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{hours}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {pill("Call", "call", `tel:${STUDIO_INFO.phone}`, true)}
          {pill("WhatsApp", "whatsapp", `https://wa.me/${STUDIO_INFO.whatsapp}`, false)}
          {pill("Directions", "directions", STUDIO_INFO.mapsUrl, false)}
        </View>
      </View>
    </Screen>
  );
}
