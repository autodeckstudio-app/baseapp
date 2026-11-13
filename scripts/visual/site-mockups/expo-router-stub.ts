// Harness-local expo-router stub: focus effects run on mount so screens load their fixtures.
import { useEffect } from "react";
export const useRouter = () => ({ back() {}, replace() {}, push() {}, navigate() {} });
export const useSegments = () => [];
export const useFocusEffect = (cb: any) => {
  useEffect(() => {
    const r = cb();
    return typeof r === "function" ? r : undefined;
  }, []);
};
export const Link = ({ children }: any) => children ?? null;
export const __params: { current: Record<string, string | undefined> } = { current: {} };
export const useLocalSearchParams = <T = any,>() => __params.current as T;
