import { Fragment, type ReactNode } from "react";
import { Loading } from "./kit";
import { useAuth } from "../hooks/useAuth";
/** A different signed-in principal, tenant or canonical customer must never reuse the previous account's route state. */
export function CustomerSessionBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const identity =
    auth.status === "ready"
      ? JSON.stringify([
          auth.status,
          auth.user.uid,
          auth.claims.tenantId,
          auth.customerDocId,
        ])
      : auth.status;
  // Keep private routes unmounted while identity resolves, but never leave the
  // returning customer staring at an unexplained blank screen.
  if (auth.status === "loading") return <Loading label="Loading your session" />;
  return <Fragment key={identity}>{children}</Fragment>;
}
