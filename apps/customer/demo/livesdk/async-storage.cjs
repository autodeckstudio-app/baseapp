// In-memory AsyncStorage stand-in for the live-SDK harness (CJS: loaded by
// the firebase auth RN build's native require). Device seam only.
const store = new Map();
const api = {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => void store.set(k, String(v)),
    removeItem: async (k) => void store.delete(k),
    clear: async () => store.clear(),
};
module.exports=api;module.exports.default=api;
