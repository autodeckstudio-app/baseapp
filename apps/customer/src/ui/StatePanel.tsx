import type { ReactNode } from "react";
import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon, type NavIconName } from "./NavIcon";
import { Pane, T } from "./kit";

/** A full, deliberate destination for an empty section, not an error banner. */
export function StatePanel({ icon, title, body, action }: { icon: NavIconName; title: string; body: string; action?: ReactNode }) {
  const { colors, name } = useExperienceTheme();
  return <Pane pad="inset"><View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 10, gap: 18 }}>
    <View style={{ width: 80, height: 80, borderRadius: 28, backgroundColor: name === "light" ? "#E8EDF4" : "#253447", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderSubtle }}><NavIcon name={icon} size={36} color={colors.textPrimary} cut={name === "light" ? "#E8EDF4" : "#253447"} /></View>
    <View style={{ alignItems: "center", gap: 10, maxWidth: 320 }}><T role="heading" style={{ textAlign: "center", fontSize: 23, lineHeight: 29 }}>{title}</T><T tone="secondary" style={{ textAlign: "center", lineHeight: 22 }}>{body}</T></View>
    {action ? <View style={{ alignSelf: "stretch", marginTop: 6 }}>{action}</View> : null}
  </View></Pane>;
}
