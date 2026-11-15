/** Web stays on Firebase popup; do not load a native module into the browser. */
export async function signInWithNativeGoogle(): Promise<null> {
  throw new Error("Use the web Google sign-in button.");
}
