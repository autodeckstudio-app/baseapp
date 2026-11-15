import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { onIdTokenChanged, resolveExistingCustomerDocId, resolveMyCustomerDocResolution, type CustomerDocResolution } from "../lib/auth-service";
import { priceCache } from "../lib/price-cache";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated_no_claims"; user: User }
  | {
      status: "ready";
      user: User;
      claims: AutoDeckClaims;
      customerDocId: string | null;
      // Truthful resolution outcome: routes must distinguish "absent"
      // (verifiably no record / claim pending) from "error" (unknown - a
      // transient failure, never render as genuinely empty).
      customerDocResolution: CustomerDocResolution["outcome"];
    };

/**
 * Reads and watches Firebase Auth state + custom claims.
 *
 * Status flow:
 *   loading → unauthenticated (no user)
 *   loading → authenticated_no_claims (signed in, profile not set up yet)
 *   loading → ready (signed in + claims set)
 *
 * After Google sign-in, the app calls setupCustomerProfile + refreshAuthToken,
 * which fires onIdTokenChanged again with updated claims.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // Stale-async guard: a newer auth event (sign-out, account switch, token
    // refresh) supersedes any resolution still in flight.
    let generation = 0;
    const unsubscribe = onIdTokenChanged(async (user) => {
      const gen = ++generation;
      // Drop the old route identity before any asynchronous token/owner lookup.
      priceCache.setScope(null, null);
      setState({ status: "loading" });
      if (!user) {
        priceCache.setScope(null, null);
        setState({ status: "unauthenticated" });
        return;
      }

      // Read custom claims from the ID token result. A transient failure here
      // must still reach a TERMINAL state (never an infinite loading screen);
      // the next token event retries.
      let tokenResult;
      try {
        tokenResult = await user.getIdTokenResult();
      } catch {
        if (gen !== generation) return;
        priceCache.setScope(null, null);
        setState({ status: "unauthenticated" });
        return;
      }
      if (gen !== generation) return; // superseded while reading claims
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
        priceCache.setScope(user.uid, claims.tenantId);
        // Canonical customer record id (staff-first): a claimed walk-in
        // record keeps its staged doc id. Lists must key on this, never uid.
        // Customers resolve through the app's self-serve path (which can
        // create/claim); staff resolve READ-ONLY (an existing verified
        // record only, never a creation). Null is never a reason to create.
        // Resolvers never throw, but keep the terminal guarantee explicit:
        // ready always fires.
        let customerDocId: string | null = null;
        let customerDocResolution: CustomerDocResolution["outcome"] = "error";
        try {
          const r =
            claims.role === "customer"
              ? await resolveMyCustomerDocResolution()
              : await resolveExistingCustomerDocId();
          customerDocResolution = r.outcome;
          customerDocId = r.outcome === "resolved" ? r.customerDocId : null;
        } catch {
          customerDocId = null;
          customerDocResolution = "error";
        }
        if (gen !== generation) return; // superseded while resolving
        setState({ status: "ready", user, claims, customerDocId, customerDocResolution });
      } else {
        // User is signed in but claims not set yet (first sign-in)
        priceCache.setScope(user.uid, null);
        setState({ status: "authenticated_no_claims", user });
      }
    });

    // Unmount invalidates the generation: a resolution still in flight must
    // never setState on an unmounted hook.
    return () => {
      generation += 1;
      unsubscribe();
    };
  }, []);

  return state;
}
