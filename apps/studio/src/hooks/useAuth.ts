import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import type { AutoDeckClaims } from "@autodeck/auth";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { auth, db, functions } from "../lib/firebase";
import { pickDefaultStudio } from "../lib/default-studio";

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
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ status: "unauthenticated" });
        return;
      }

      let tokenResult = await user.getIdTokenResult();
      if (typeof (tokenResult.claims as Record<string, unknown>)["role"] !== "string") {
        // First Google sign-in: the server resolves the role from the staff
        // roster and sets claims; then refresh the token to receive them.
        try {
          await httpsCallable(functions, "setupCustomerProfile")({});
          tokenResult = await user.getIdTokenResult(true);
        } catch {
          // Falls through to "unauthorized" below.
        }
      }
      const rawClaims = tokenResult.claims as Record<string, unknown>;
      const role = typeof rawClaims["role"] === "string" ? rawClaims["role"] : null;
      const tenantId = typeof rawClaims["tenantId"] === "string" ? rawClaims["tenantId"] : null;

      if (role && STUDIO_APP_ROLES.has(role) && tenantId) {
        const claimStudio = typeof rawClaims["studioId"] === "string" ? rawClaims["studioId"] : null;
        let studioId = claimStudio;
        if (!studioId && role !== "studio") {
          try {
            const snap = await getDocs(query(collection(db, COLLECTIONS.studioConfig()), where("tenantId", "==", tenantId), limit(20)));
            studioId = pickDefaultStudio(null, role, snap.docs.map((d) => ({ id: d.id })));
          } catch {
            studioId = null;
          }
        }
        setState({
          status: "ready",
          user,
          claims: {
            role: role as AutoDeckClaims["role"],
            tenantId,
            studioId,
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
