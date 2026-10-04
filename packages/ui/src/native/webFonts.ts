// Loads the AutoDeck type system on the web build: Montserrat (headings), Inter (body, UI, numbers),
// Noto Sans Gujarati and Devanagari as fallbacks. Native builds bundle fonts with expo-font instead.
import { Platform } from "react-native";

export function installWebFonts(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (globalThis as any).document;
  if (Platform.OS !== "web" || !doc || doc.getElementById("ad-fonts")) return;
  const link = doc.createElement("link");
  link.id = "ad-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Sans+Gujarati:wght@400;500;600&display=swap";
  doc.head.appendChild(link);
  const st = doc.createElement("style");
  st.id = "ad-type";
  st.textContent = "html,body,#root{font-family:Inter,'Noto Sans Gujarati','Noto Sans Devanagari',system-ui,sans-serif;font-feature-settings:'cv11','ss03';-webkit-font-smoothing:antialiased}";
  doc.head.appendChild(st);
}
