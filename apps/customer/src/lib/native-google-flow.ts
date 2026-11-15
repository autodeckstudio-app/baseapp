/** Native SDK boundary: no Firebase session until a successful non-empty ID token. */
export interface NativeGoogleSdk {
  configure(options: { webClientId: string; iosClientId?: string; offlineAccess: boolean; autoSelectOnSignIn: boolean }): void;
  checkPlayServices(): Promise<unknown>;
  presentExplicitSignIn(): Promise<{ type: string; data: { idToken: string } | null }>;
}
export async function runNativeGoogleSignIn<T>(sdk: NativeGoogleSdk, ids: { webClientId?: string; iosClientId?: string }, platform: string, exchange: (token: string) => Promise<T>): Promise<T | null> {
  if (!ids.webClientId || (platform === "ios" && !ids.iosClientId)) throw new Error("Google sign-in is not configured for this build.");
  sdk.configure({ webClientId: ids.webClientId, ...(platform === "ios" ? { iosClientId: ids.iosClientId } : {}), offlineAccess: false, autoSelectOnSignIn: false });
  await sdk.checkPlayServices();
  const result = await sdk.presentExplicitSignIn();
  if (result.type === "cancelled") return null;
  if (result.type !== "success" || !result.data?.idToken?.trim()) throw new Error("Google did not return a sign-in token. Please try again.");
  return exchange(result.data.idToken);
}
