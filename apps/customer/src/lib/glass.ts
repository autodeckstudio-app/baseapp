// Glass surfaces for the customer app: translucent fill, soft gradient, lit
// top edge, backdrop blur on web. One recipe so every page feels the same.
import { Platform, type ViewStyle } from "react-native";

const web = Platform.OS === "web";

/** Panels, cards, rows, search bar. */
export const glassSurface: ViewStyle = {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  ...(web
    ? ({
        backgroundImage: "linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 55%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.03), 0 18px 40px -16px rgba(0,0,0,0.65)",
      } as object)
    : {}),
};

/** Tiny chips and inner tiles sitting on a glass surface. */
export const glassInner: ViewStyle = {
  backgroundColor: "rgba(255,255,255,0.07)",
  ...(web ? ({ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)" } as object) : {}),
};

/** Primary action: translucent glossy orange. */
export const glassOrange: ViewStyle = {
  backgroundColor: "rgba(236,134,56,0.82)",
  borderWidth: 1,
  borderColor: "rgba(255,200,150,0.55)",
  ...(web
    ? ({
        backgroundImage: "linear-gradient(180deg, rgba(255,190,130,0.95) 0%, rgba(236,134,56,0.80) 48%, rgba(200,98,26,0.78) 100%)",
        backdropFilter: "blur(14px) saturate(150%)",
        WebkitBackdropFilter: "blur(14px) saturate(150%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -8px 14px rgba(160,70,10,0.28), 0 10px 24px -8px rgba(236,134,56,0.55)",
      } as object)
    : {}),
};

/** Secondary action: clear glass. */
export const glassQuiet: ViewStyle = {
  backgroundColor: "rgba(255,255,255,0.07)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.20)",
  ...(web
    ? ({
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%)",
        backdropFilter: "blur(14px) saturate(150%)",
        WebkitBackdropFilter: "blur(14px) saturate(150%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px -10px rgba(0,0,0,0.6)",
      } as object)
    : {}),
};
