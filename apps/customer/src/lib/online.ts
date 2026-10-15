import { useEffect, useState } from "react";
import { Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

/** True while the browser says we have a connection. Native builds report true (the web app is the shipped target). */
export function useOnline(): boolean {
  const [on, setOn] = useState<boolean>(() => (Platform.OS === "web" && g.navigator ? g.navigator.onLine !== false : true));
  useEffect(() => {
    if (Platform.OS !== "web" || !g.addEventListener) return undefined;
    const up = () => setOn(true);
    const down = () => setOn(false);
    g.addEventListener("online", up);
    g.addEventListener("offline", down);
    return () => { g.removeEventListener("online", up); g.removeEventListener("offline", down); };
  }, []);
  return on;
}
