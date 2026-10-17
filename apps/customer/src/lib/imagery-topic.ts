/** Maps a service to an imagery topic. No image imports here so it stays testable. */
export type Svc = { name: string; brand?: string | null; category: string; imageUrl?: string | null };
export function topicOf(s: Svc): string {
  const n = s.name.toLowerCase();
  if (s.category === "pickup" || /pickup|drop/.test(n)) return "pickup";
  if (/alignment|balanc/.test(n)) return "align";
  if (/\bac\b|air con/.test(n)) return "ac";
  if (n.includes("battery")) return "battery";
  if (/repair/.test(n)) return "repair";
  if (/wrap|colour change|color change/.test(n)) return "wrap";
  if (/accessor|styling/.test(n)) return "styling";
  if (/multi-point/.test(n)) return "gInspect";
  if (s.category === "ppf") return "ppf";
  if (s.category === "tinting" || n.includes("tint")) return "tint";
  if (n.includes("headlight")) return "headlight";
  if (n.includes("roof")) return "roof";
  if (n.includes("engine")) return "engine";
  if (/wheel|tyre|tire|rim/.test(n)) return "wheel";
  if (/dry clean|spa|interior|upholstery|leather|fabric/.test(n)) return "interior";
  if (/polish|buff|correction/.test(n)) return "polish";
  if (s.category === "inspection" || /inspect|check/.test(n)) return "inspection";
  if (/glass|window/.test(n)) return "tint";
  if (/teflon|coat/.test(n) || s.category === "ceramic" || s.category === "coating") return "coating";
  if (/wash|foam/.test(n) || s.category === "washing") return "washExt";
  return "care";
}

export const GARAGE_PHOTO_TOPICS = ["gInspect", "align", "ac", "battery", "repair"];
