// Pixel seam: a signed-in studio operator whose claims match the fixture job scope.
const user = {
  uid: "u1",
  getIdTokenResult: async () => ({ claims: { role: "studio", tenantId: "t", studioId: "s1" } }),
  getIdToken: async () => "pixel-token",
};
export const getAuth = () => ({ currentUser: user });
export const initializeAuth = () => ({ currentUser: user });
export const getReactNativePersistence = () => ({});
export const onAuthStateChanged = (_a: unknown, cb?: (u: unknown) => void) => { if (cb) cb(user); return () => {}; };
export const onIdTokenChanged = (_a: unknown, cb?: (u: unknown) => void) => { if (cb) cb(user); return () => {}; };
export const signInWithCustomToken = async () => {};
export const signOut = async () => {};
export const connectAuthEmulator = () => {};
export const getIdTokenResult = async () => ({ claims: { role: "studio", tenantId: "t", studioId: "s1" } });
