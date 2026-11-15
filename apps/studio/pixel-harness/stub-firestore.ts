// Path-aware in-memory Firestore seam: delivers the pixel fixtures per collection.
type Snap = { exists: () => boolean; data: () => unknown; id?: string; metadata: { fromCache: boolean; hasPendingWrites: boolean } };
const g = globalThis as Record<string, unknown>;
function snapFor(path: string): Snap {
  const jobs = (g.__pixelJob ?? null) as { id: string } | null;
  const vehicle = (g.__pixelVehicle ?? null) as { id: string } | null;
  const customer = (g.__pixelCustomer ?? null) as { id: string } | null;
  const service = (g.__pixelService ?? null) as { id: string } | null;
  const meta = { fromCache: false, hasPendingWrites: false };
  const mk = (d: unknown) => ({ exists: () => d != null, data: () => d, id: (d as { id?: string } | null)?.id, metadata: meta });
  if (path.includes("/jobs") || path.startsWith("jobs")) return mk(jobs);
  if (path.includes("vehicles")) return mk(vehicle);
  if (path.includes("customers")) return mk(customer);
  if (path.includes("services")) return mk(service);
  if (path.toLowerCase().includes("config")) return mk({ bays: [{ id: "b1", name: "Bay 1", active: true, bayType: "ppf" }, { id: "b2", name: "Bay 2", active: true, bayType: "general" }] });
  return mk(null);
}
export const doc = (...parts: unknown[]) => ({ path: parts.filter((p) => typeof p === "string").join("/"), __kind: "doc" });
export const collection = (...parts: unknown[]) => ({ path: parts.filter((p) => typeof p === "string").join("/"), __kind: "q" });
export const query = (ref: unknown) => ({ ...(ref as object), __kind: "q" });
function qSnapFor(path: string) {
  const meta = { fromCache: false, hasPendingWrites: false };
  const prot = (g.__pixelProtections ?? []) as unknown[];
  const rows = path.includes("protection") ? prot : [];
  const docs = rows.map((d, i) => ({ exists: () => true, data: () => d, id: (d as { id?: string })?.id ?? `q${i}`, metadata: meta }));
  return { empty: docs.length === 0, docs, forEach: (f: (d: unknown) => void) => docs.forEach(f), size: docs.length, metadata: meta };
}
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const onSnapshot = (ref: unknown, ...args: unknown[]) => {
  const cb = args.find((a) => typeof a === "function") as (s: unknown) => void;
  const r = ref as { path?: string; __kind?: string };
  cb(r.__kind === "doc" ? snapFor(r.path ?? "") : qSnapFor(r.path ?? ""));
  return () => {};
};
export const getDoc = async (ref: unknown) => snapFor((ref as { path: string }).path ?? "");
export const getDocs = async (ref: unknown) => qSnapFor((ref as { path?: string })?.path ?? "");
export const getDocFromServer = async (ref: unknown) => snapFor((ref as { path: string }).path ?? "");
export const setDoc = async () => {};
export const addDoc = async () => ({ id: "stub" });
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const serverTimestamp = () => null;
export const increment = (n: number) => n;
export const arrayUnion = (...v: unknown[]) => v;
export const arrayRemove = (...v: unknown[]) => v;
export class Timestamp { constructor(public seconds: number, public nanoseconds: number) {} static now() { return new Timestamp(0, 0); } static fromMillis(ms: number) { return new Timestamp(ms / 1000, 0); } toMillis() { return this.seconds * 1000; } toDate() { return new Date(this.seconds * 1000); } }
export const initializeFirestore = () => ({});
export const connectFirestoreEmulator = () => {};
export const writeBatch = () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} });
export const runTransaction = async (_db: unknown, fn: (t: unknown) => unknown) => fn({ get: async () => ({ exists: () => false }), set: () => {}, update: () => {}, delete: () => {} });
