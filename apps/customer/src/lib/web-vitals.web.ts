import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

// First-party RUM (no third-party analytics): Core Web Vitals go to our own
// recordWebVital callable as ONE coalesced beacon per flush (at most two
// flushes per page view: an early one ~15s in, and a final one when the page
// is hidden). Best-effort: failures are swallowed. Signed-out sessions are
// queued on-device (max 3, 24h) and sent once signed in - the callable
// requires authentication, so nothing is ever sent unauthenticated.
type MetricName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
type MetricValue = { value: number; rating: string };
type Beacon = {
  app: "customer";
  page: string;
  navigationType?: string;
  metrics: Partial<Record<MetricName, MetricValue>>;
};

const QUEUE_KEY = "ad.vitalsq";
const QUEUE_MAX = 3;
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
const EARLY_FLUSH_MS = 15_000;

let installed = false;

// Dynamic route ids (booking ids, vehicle ids, ...) must never reach storage:
// they would explode cardinality and leak record identifiers. Any long hex/
// numeric/uuid-ish segment collapses to ":id".
function normalizePath(pathname: string): string {
  const norm = pathname
    .split("/")
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8,}$/i.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) ? ":id" : seg))
    .join("/");
  return (norm || "/").slice(0, 200);
}

function readQueue(): (Beacon & { queuedAt: number })[] {
  try {
    const raw = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage?.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as (Beacon & { queuedAt: number })[]) : [];
    return Array.isArray(parsed) ? parsed.filter((b) => Date.now() - b.queuedAt < QUEUE_TTL_MS) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: (Beacon & { queuedAt: number })[]): void {
  try {
    (globalThis as { localStorage?: { setItem(k: string, v: string): void } }).localStorage?.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // storage full/unavailable: telemetry is best-effort
  }
}

export function installWebVitals(): void {
  if (installed) return;
  installed = true;
  const report = httpsCallable(functions, "recordWebVital");
  const win = globalThis as {
    window?: { location?: { pathname?: string }; addEventListener?: (t: string, cb: () => void) => void };
    document?: { addEventListener?: (t: string, cb: () => void) => void; visibilityState?: string };
  };
  const page = normalizePath(win.window?.location?.pathname ?? "/");
  let navigationType: string | undefined;
  const pending: Partial<Record<MetricName, MetricValue>> = {};
  const sent = new Set<MetricName>();

  const deliver = (beacon: Beacon) => {
    if (!auth.currentUser) {
      const q = readQueue();
      q.push({ ...beacon, queuedAt: Date.now() });
      writeQueue(q.slice(-QUEUE_MAX));
      return;
    }
    void report(beacon).catch(() => {
      // Telemetry must never surface to the user or break the app.
    });
  };

  const flush = () => {
    const fresh: Partial<Record<MetricName, MetricValue>> = {};
    for (const [name, m] of Object.entries(pending) as [MetricName, MetricValue][]) {
      if (!sent.has(name)) {
        fresh[name] = m;
        sent.add(name);
      }
    }
    if (Object.keys(fresh).length > 0) {
      const beacon: Beacon = { app: "customer", page, metrics: fresh };
      if (navigationType !== undefined) beacon.navigationType = navigationType;
      deliver(beacon);
    }
    // Anything a signed-out visitor left queued goes out once we are signed in.
    const q = readQueue();
    if (q.length > 0 && auth.currentUser) {
      writeQueue([]);
      for (const { queuedAt: _t, ...beacon } of q) void report(beacon).catch(() => {});
    }
  };

  const collect = (metric: Metric) => {
    navigationType = metric.navigationType;
    pending[metric.name as MetricName] = { value: metric.value, rating: metric.rating };
  };

  // Default reporting (no reportAllChanges): one callback per metric when it
  // finalizes - LCP/CLS/INP settle no later than the page being hidden, so the
  // hide flush carries them; FCP/TTFB land early and ride the 15s flush.
  onCLS(collect);
  onLCP(collect);
  onFCP(collect);
  onINP(collect);
  onTTFB(collect);

  const timer = setTimeout(flush, EARLY_FLUSH_MS);
  win.document?.addEventListener?.("visibilitychange", () => {
    if (win.document?.visibilityState === "hidden") {
      clearTimeout(timer);
      flush();
    }
  });
}
