// In-memory AsyncStorage for the live-emulator harness (firebase/auth RN persistence).
const store = new Map<string, string>();
export default {
  getItem: async (k: string) => store.get(k) ?? null,
  setItem: async (k: string, v: string) => void store.set(k, v),
  removeItem: async (k: string) => void store.delete(k),
  clear: async () => store.clear(),
};
