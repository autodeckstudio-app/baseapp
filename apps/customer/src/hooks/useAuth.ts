import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { onAuthStateChanged } from "../lib/auth-service";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated_no_claims"; user: User }
  | { status: "ready"; user: User; claims: AutoDeckClaims };

/**
 * Reads and watches Firebase Auth state + custom claims.
 *
 * Status flow:
 *   loading → unauthenticated (no user)
 *   loading → authenticated_no_claims (signed in, profile not set up yet)
 *   loading → ready (signed in + claims set)
 *
 * After Google sign-in, the app calls setupCustomerProfile + refreshAuthToken,
 * which causes onAuthStateChanged to fire again with updated claims.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        setState({ status: "unauthenticated" });
        return;
      }

      // Read custom claims from the ID token result
      const tokenResult = await user.getIdTokenResult();
      const rawClaims = tokenResult.claims as Record<string, unknown>;

      if (
        typeof rawClaims["role"] === "string" &&
        typeof rawClaims["tenantId"] === "string"
      ) {
        const claims: AutoDeckClaims = {
          role: rawClaims["role"] as AutoDeckClaims["role"],
          tenantId: rawClaims["tenantId"] as string,
          studioId:
            typeof rawClaims["studioId"] === "string"
              ? rawClaims["studioId"]
              : null,
        };
        setState({ status: "ready", user, claims });
      } else {
        // User is signed in but claims not set yet (first sign-in)
        setState({ status: "authenticated_no_claims", user });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}
