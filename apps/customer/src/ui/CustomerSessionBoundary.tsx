import { Fragment, type ReactNode } from "react";
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
  if (auth.status === "loading") return null;
  return <Fragment key={identity}>{children}</Fragment>;
}
