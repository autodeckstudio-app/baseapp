export const useRouter = () => ({ back() {}, replace() {}, push() {}, navigate() {} });
export const useSegments = () => [];
export const useFocusEffect = () => {};
export const Link = ({ children }: any) => children ?? null;
export const __params: { current: Record<string, string | undefined> } = { current: {} };
export const useLocalSearchParams = <T>() => __params.current as T;
