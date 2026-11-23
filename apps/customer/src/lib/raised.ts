// "Raised" surfaces for the customer app: soft cards that sit on the ground
// with a light and a dark shadow (day), or a deep shadow and a faint rim
// (night). Orange is the only colour fill. One recipe per theme so every page
// matches. Use raised(name) with the name from useExperienceTheme().
import {glacierGround} from "./customer-glacier";
import { Platform, type ViewStyle } from "react-native";
import { lightColors, nightColors, material as baseMaterial, DAY_ATMOSPHERE, materialNightGround as nightGround, reduceWebTransparency } from "@autodeck/ui/theme";

const web = Platform.OS === "web";
export type Mode = "light" | "night" | "dark";
const isNight = (m: Mode) => m !== "light";

export type Raised = {
  card: ViewStyle;
  well: ViewStyle;
  round: ViewStyle;
  roundOn: ViewStyle;
  primary: ViewStyle;
  quiet: ViewStyle;
  dark: ViewStyle;
  sheet: ViewStyle;
  ground: string;
  groundImage: string;
};

export function raised(mode: Mode): Raised {
  const material:typeof baseMaterial=(m,r,s)=>baseMaterial(m,r,{...s,reduce:web&&reduceWebTransparency()});
  const night = isNight(mode);
  const c = night ? nightColors : lightColors;
  const native = (elev: number): ViewStyle => ({ shadowColor: "#000", shadowOpacity: night ? 0.5 : 0.18, shadowRadius: elev * 1.6, shadowOffset: { width: 0, height: elev }, elevation: elev });
  return {
    card: { backgroundColor: c.surface, borderRadius: 27, borderWidth:1, borderColor:c.borderSubtle, ...(web ? {boxShadow:night?"9px 9px 25px #00000032, -5px -5px 18px #ffffff03":"10px 10px 25px #b4c2d347, -9px -9px 24px #ffffffd9"} as ViewStyle : native(3)) },
    well: { backgroundColor: c.surfaceElevated, borderRadius: 20, borderWidth:1, borderColor:c.borderSubtle, ...(web ? {boxShadow:"inset 3px 3px 9px #6c7e9314, inset -3px -3px 9px #ffffff14"} as ViewStyle : native(3)) },
    round: { backgroundColor: material(mode,"control").fallback, borderRadius: 999, borderWidth:1, borderColor:material(mode,"control").edge, ...(web ? material(mode,"control").web as ViewStyle : native(3)) },
    roundOn: { backgroundColor:material(mode,"control").fallback,borderRadius:999,borderWidth:1,borderColor:"rgba(194,84,10,.55)",...(web?material(mode,"control",{selected:true}).web as ViewStyle:native(3)) },
    primary: { backgroundColor: material(mode,"control").fallback, borderRadius: 999, borderWidth:1, borderColor:material(mode,"control").edge, ...(web ? material(mode,"control").web as ViewStyle : native(3)) },
    quiet: { backgroundColor: material(mode,"control").fallback, borderRadius: 999, borderWidth:1, borderColor:material(mode,"control").edge, ...(web ? material(mode,"control").web as ViewStyle : native(3)) },
    dark: { backgroundColor: night ? "#B9A58C" : "#16181C", ...(web ? ({ boxShadow: night ? "0 10px 22px -8px rgba(0,0,0,0.7)" : "0 12px 22px -8px rgba(22,24,28,0.55), inset 0 1px 0 rgba(255,255,255,0.18)" } as object) : native(6)) },
    sheet: { backgroundColor: material(mode,"sheet").fallback, borderRadius: 24, borderWidth:1, borderColor:material(mode,"sheet").edge, ...(web ? material(mode,"sheet").web as ViewStyle : native(3)) },
    ground: c.canvas,
    groundImage: glacierGround(night),
  };
}
