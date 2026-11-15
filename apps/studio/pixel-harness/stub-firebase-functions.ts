// Pixel seam: callable functions. getStudioConfig returns a fixture bay map so
// the bay row resolves; everything else is a no-op success.
export const getFunctions = () => ({});
export const httpsCallable = (_f: unknown, name?: string) => async () => {
  if (name === "getStudioConfig") return { data: { bays: [{ id: "b1", name: "Bay 1", active: true, bayType: "ppf" }, { id: "b2", name: "Bay 2", active: true, bayType: "general" }] } };
  return { data: {} };
};
export const connectFunctionsEmulator = () => {};
