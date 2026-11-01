// Deterministic operation ids for mounted-screen tests (the real module pulls expo-modules-core).
let seq = 0;
export const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
  `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
