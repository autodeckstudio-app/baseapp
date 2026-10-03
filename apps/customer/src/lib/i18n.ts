// Small language layer: English, Hindi, Gujarati. Strings not listed fall back to English.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "en" | "hi" | "gu";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "gu", label: "ગુજરાતી" },
];

const KEY = "autodeck.lang";
let current: Lang = "en";
const listeners = new Set<() => void>();

void AsyncStorage.getItem(KEY).then((v) => {
  if (v === "hi" || v === "gu" || v === "en") {
    current = v;
    listeners.forEach((l) => l());
  }
}).catch(() => undefined);

export function setLang(l: Lang): void {
  current = l;
  void AsyncStorage.setItem(KEY, l).catch(() => undefined);
  listeners.forEach((fn) => fn());
}

const DICT: Record<string, { hi: string; gu: string }> = {
  "You": { hi: "आप", gu: "તમે" },
  "Membership": { hi: "मेंबरशिप", gu: "મેમ્બરશિપ" },
  "Plans, washes left, history": { hi: "प्लान, बचे हुए वॉश, इतिहास", gu: "પ્લાન, બાકી વોશ, ઇતિહાસ" },
  "Notifications": { hi: "सूचनाएं", gu: "સૂચનાઓ" },
  "Updates from the studio": { hi: "स्टूडियो से अपडेट", gu: "સ્ટુડિયોના અપડેટ" },
  "Help and contact": { hi: "मदद और संपर्क", gu: "મદદ અને સંપર્ક" },
  "Call, WhatsApp, FAQ": { hi: "कॉल, व्हाट्सऐप, सवाल-जवाब", gu: "કૉલ, વોટ્સએપ, પ્રશ્નો" },
  "Edit name": { hi: "नाम बदलें", gu: "નામ બદલો" },
  "Save": { hi: "सेव करें", gu: "સાચવો" },
  "Cancel": { hi: "रद्द करें", gu: "રદ કરો" },
  "Sign out": { hi: "साइन आउट", gu: "સાઇન આઉટ" },
  "Language": { hi: "भाषा", gu: "ભાષા" },
  "Help": { hi: "मदद", gu: "મદદ" },
  "We are here": { hi: "हम यहां हैं", gu: "અમે અહીં છીએ" },
  "Call the studio": { hi: "स्टूडियो को कॉल करें", gu: "સ્ટુડિયોને કૉલ કરો" },
  "Message on WhatsApp": { hi: "व्हाट्सऐप पर संदेश भेजें", gu: "વોટ્સએપ પર મેસેજ કરો" },
  "Questions": { hi: "सवाल", gu: "પ્રશ્નો" },
  "Back": { hi: "वापस", gu: "પાછા" },
  "Studio status": { hi: "स्टूडियो की स्थिति", gu: "સ્ટુડિયોની સ્થિતિ" },
  "Awaiting vehicle drop-off": { hi: "गाड़ी के आने का इंतज़ार", gu: "ગાડી આવવાની રાહ" },
  "Vehicle received": { hi: "गाड़ी मिल गई", gu: "ગાડી મળી ગઈ" },
  "Service in progress": { hi: "सर्विस चल रही है", gu: "સર્વિસ ચાલુ છે" },
  "Quality check": { hi: "क्वालिटी जांच", gu: "ક્વોલિટી ચકાસણી" },
  "Ready for pickup": { hi: "लेने के लिए तैयार", gu: "લેવા માટે તૈયાર" },
  "Delivered": { hi: "डिलीवर हो गई", gu: "ડિલિવર થઈ" },
  "Print or save as PDF": { hi: "प्रिंट करें या PDF सेव करें", gu: "પ્રિન્ટ કરો અથવા PDF સાચવો" },
};

export function translate(text: string, lang: Lang = current): string {
  if (lang === "en") return text;
  return DICT[text]?.[lang] ?? text;
}

export function useLang(): { lang: Lang; t: (s: string) => string } {
  const lang = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current,
    () => "en" as Lang,
  );
  return { lang, t: (s) => translate(s, lang) };
}
