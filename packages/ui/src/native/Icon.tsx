import { Image } from "react-native";
import { iconDataUri, type IconName } from "../theme/icons.js";

export function Icon({ name, color, size = 24, filled = false }: { name: IconName; color: string; size?: number; filled?: boolean }) {
  return <Image accessibilityElementsHidden source={{ uri: iconDataUri(name, color, size, filled) }} style={{ width: size, height: size }} />;
}
