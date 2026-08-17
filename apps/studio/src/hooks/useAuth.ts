import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { auth } from "../lib/firebase";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; user: User } // signed in but not studio/admin/superadmin
  | { status: "ready"; user: User; claims: AutoDeckClaims };

const STUDIO_APP_ROLES = new Set(["studio", "admin", "superadmin"]);

/**
 * Reads and watches Firebase Auth state + custom claims for the studio app.
 * Mirrors apps/customer/src/hooks/useAuth.ts — studio staff sign in with
 * email/password (not phone OTP), so there is no "no claims yet" setup step;
 * claims are always set by the time an account can sign in (addStaffMember).
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: "unauthenticated" });
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      const rawClaims = tokenResult.claims as Record<string, unknown>;
      const role = typeof rawClaims["role"] === "string" ? rawClaims["role"] : null;
      const tenantId = typeof rawClaims["tenantId"] === "string" ? rawClaims["tenantId"] : null;

      if (role && STUDIO_APP_ROLES.has(role) && tenantId) {
        setState({
          status: "ready",
          user,
          claims: {
            role: role as AutoDeckClaims["role"],
            tenantId,
            studioId: typeof rawClaims["studioId"] === "string" ? rawClaims["studioId"] : null,
          },
        });
      } else {
        // Signed in but not a studio-app role (e.g. a customer account, or a
        // deactivated staff member whose claims haven't been revoked yet).
        setState({ status: "unauthorized", user });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}
