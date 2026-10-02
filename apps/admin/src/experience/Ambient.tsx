// The room the app stands in: canvas lit by the ambient field, drifting
// slowly (off under reduced motion). Only ever seen through glass.
import type { ReactNode } from "react";

export function Ambient({ children }: { children?: ReactNode }) {
  return (
    <div className="ax-ambient-root">
      <div className="ax-ambient" aria-hidden="true" />
      <div className="ax-ambient-content">{children}</div>
    </div>
  );
}
