// "Add to Home Screen" guide for customers using the app in a browser tab.
// iOS Safari has no install prompt, so we show the Share > Add to Home Screen
// steps. Android Chrome gives a native install prompt, which we trigger from
// our own sheet. Hidden when already installed, and once dismissed it stays away.
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import { colors as palette } from "@autodeck/ui/tokens";

const KEY = "autodeck.installPrompt";
type LS = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
type Ev = { preventDefault: () => void };
type BIPEvent = Ev & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone(): boolean {
  const w = globalThis as unknown as { matchMedia?: (q: string) => { matches: boolean }; navigator?: { standalone?: boolean } };
  return !!w.matchMedia?.("(display-mode: standalone)").matches || !!w.navigator?.standalone;
}
function isIos(): boolean {
  const n = (globalThis as unknown as { navigator?: { userAgent?: string; maxTouchPoints?: number; platform?: string } }).navigator;
  const ua = n?.userAgent ?? "";
  return /iPhone|iPad|iPod/.test(ua) || (n?.platform === "MacIntel" && (n?.maxTouchPoints ?? 0) > 1);
}

function Step({ n, icon, text }: { n: number; icon: "share" | "plus" | "check"; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 14, backgroundColor: palette.surfaceSunken }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,154,69,0.16)" }}>
        {icon === "share" ? <ShareGlyph /> : icon === "plus" ? <PlusGlyph /> : <Icon name="check" color="#EC8638" size={20} />}
      </View>
      <Text style={{ flex: 1, color: palette.textPrimary, fontSize: 15, lineHeight: 21 }}><Text style={{ color: "#EC8638", fontWeight: "700" }}>{n}.  </Text>{text}</Text>
    </View>
  );
}
// Small inline glyphs (the iOS share box and a plus-in-square), drawn with views so no assets load.
function ShareGlyph() {
  return (
    <View style={{ width: 18, height: 22, alignItems: "center" }}>
      <View style={{ width: 2, height: 11, backgroundColor: "#EC8638", borderRadius: 1 }} />
      <View style={{ position: "absolute", top: 0, width: 8, height: 8, borderLeftWidth: 2, borderTopWidth: 2, borderColor: "#EC8638", transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", bottom: 0, width: 18, height: 12, borderWidth: 2, borderColor: "#EC8638", borderTopWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
    </View>
  );
}
function PlusGlyph() {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#EC8638", alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: 10, height: 2, backgroundColor: "#EC8638" }} />
      <View style={{ position: "absolute", width: 2, height: 10, backgroundColor: "#EC8638" }} />
    </View>
  );
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ls = (globalThis as unknown as { localStorage?: LS }).localStorage;
    if (isStandalone() || ls?.getItem(KEY)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const w = globalThis as unknown as { addEventListener: (t: string, f: (e: never) => void) => void; removeEventListener: (t: string, f: (e: never) => void) => void };
    const onBip = (e: BIPEvent) => { e.preventDefault(); setEvt(e); timer = setTimeout(() => setMode("android"), 2500); };
    const onInstalled = () => { ls?.setItem(KEY, "installed"); setMode(null); };
    if (isIos()) timer = setTimeout(() => setMode("ios"), 2500);
    else w.addEventListener("beforeinstallprompt", onBip);
    w.addEventListener("appinstalled", onInstalled);
    return () => { if (timer) clearTimeout(timer); w.removeEventListener("beforeinstallprompt", onBip); w.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!mode || (__DEV__ && /noprompt=1/.test((globalThis as { location?: { search?: string } }).location?.search ?? ""))) return null;
  const close = (why: string) => { (globalThis as unknown as { localStorage?: LS }).localStorage?.setItem(KEY, why); setMode(null); };
  const install = async () => {
    if (!evt) return close("dismissed");
    await evt.prompt();
    const r = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
    close(r.outcome === "accepted" ? "installed" : "dismissed");
  };

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, justifyContent: "flex-end" }}>
      <Pressable accessibilityLabel="Close" onPress={() => close("dismissed")} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", padding: 22, paddingBottom: 30, gap: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: palette.surface, ...({ backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" } as object) }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: palette.borderStrong }} />
        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>Get the app</Text>
        <Text style={{ color: palette.textPrimary, fontFamily: "Montserrat, Inter, sans-serif", fontSize: 24, lineHeight: 30, fontWeight: "700" }}>Add AutoDeck to your home screen</Text>
        <Text style={{ color: palette.textSecondary, fontSize: 15, lineHeight: 22 }}>Opens full screen like an app, faster, with one tap from your phone.</Text>
        {mode === "ios" ? (
          <View style={{ gap: 10 }}>
            <Step n={1} icon="share" text="Tap the Share button in Safari's toolbar" />
            <Step n={2} icon="plus" text="Scroll down and tap Add to Home Screen" />
            <Step n={3} icon="check" text="Tap Add. AutoDeck appears on your home screen" />
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => (mode === "android" ? void install() : close("dismissed"))} style={({ pressed }) => ({ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1, ...({ backgroundImage: "linear-gradient(180deg,#F08A45,#E8742A)" } as object) })}>
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>{mode === "android" ? "Install app" : "Got it"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => close("dismissed")} style={{ alignItems: "center", paddingVertical: 6 }}>
          <Text style={{ color: palette.textMuted, fontSize: 14 }}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
