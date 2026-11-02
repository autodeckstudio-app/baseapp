import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

// First-party RUM (no third-party analytics): Core Web Vitals go to our own
// recordWebVital callable. Best-effort: failures are swallowed, and signed-out
// sessions are skipped because the callable requires authentication.
let installed = false;

export function installWebVitals(): void {
  if (installed) return;
  installed = true;
  const report = httpsCallable(functions, "recordWebVital");
  const loc = (globalThis as { window?: { location?: { pathname?: string } } }).window?.location;
  const send = (metric: Metric) => {
    if (!auth.currentUser) return;
    void report({
      app: "customer",
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: loc?.pathname ?? "/",
      navigationType: metric.navigationType,
    }).catch(() => {
      // Telemetry must never surface to the user or break the app.
    });
  };
  // reportAllChanges so a final on-hide flush is not the only chance to record.
  onCLS(send, { reportAllChanges: true });
  onLCP(send, { reportAllChanges: true });
  onFCP(send);
  onINP(send);
  onTTFB(send);
}
