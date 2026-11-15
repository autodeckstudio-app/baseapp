// Firestore seam: in-memory vehicle document + no-op listeners. Doc shape mirrors
// what react-native-firestore's onSnapshot delivers (exists(), data(), id).
export const doc = (...parts: string[]) => ({ path: parts.join("/") });
export const onSnapshot = (_ref: unknown, ...args: unknown[]) => {
  // Signature: (ref, options, next, error) - next is the first function arg.
  const cb = args.find((a) => typeof a === "function") as (snap: unknown) => void;
  const vehicle = (globalThis as Record<string, unknown>).__pixelVehicle;
  if (vehicle) cb({ exists: () => true, data: () => vehicle, id: (vehicle as { id: string }).id, metadata: { fromCache: false, hasPendingWrites: false } });
  return () => {};
};
export const getDocFromServer = async () => ({ exists: () => true, data: () => (globalThis as Record<string, unknown>).__pixelVehicle });
