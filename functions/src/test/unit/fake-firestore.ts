// Minimal in-memory Firestore stand-in for unit tests: equality-only where(), doc get/set/update/delete,
// batch(), runTransaction() (writes applied immediately; reads-before-writes is not enforced).
type Doc = Record<string, unknown>;

export function fakeFirestore(
  seed: Record<string, Record<string, Doc>> = {},
  hooks: { beforeTransaction?: (data: Record<string, Record<string, Doc>>) => void } = {},
) {
  const data: Record<string, Record<string, Doc>> = JSON.parse(JSON.stringify(seed));
  let auto = 0;
  const col = (c: string) => (data[c] ??= {});
  const snap = (c: string, id: string) => {
    const d = col(c)[id];
    return {
      id,
      exists: d !== undefined,
      data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))),
      get: (k: string) => d?.[k],
      ref: docRef(c, id),
    };
  };
  const docRef = (c: string, id: string): any => ({
    id,
    path: `${c}/${id}`,
    get: async () => snap(c, id),
    set: async (v: Doc) => { col(c)[id] = JSON.parse(JSON.stringify(v)); },
    update: async (v: Doc) => {
      if (!col(c)[id]) throw new Error(`no doc ${c}/${id}`);
      Object.assign(col(c)[id]!, JSON.parse(JSON.stringify(v)));
    },
    delete: async () => { delete col(c)[id]; },
  });
  const query = (c: string, filters: Array<[string, unknown]>): any => ({
    where: (f: string, _op: string, v: unknown) => query(c, [...filters, [f, v]]),
    limit: () => query(c, filters),
    get: async () => {
      const docs = Object.keys(col(c))
        .filter((id) => filters.every(([f, v]) => col(c)[id]![f] === v))
        .map((id) => snap(c, id));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });
  const collection = (c: string): any => ({
    doc: (id?: string) => docRef(c, id ?? `auto${++auto}`),
    where: (f: string, op: string, v: unknown) => query(c, []).where(f, op, v),
  });
  const db: any = {
    collection,
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        update: (ref: any, v: Doc) => { ops.push(() => ref.update(v)); },
        commit: async () => { for (const o of ops) await o(); },
      };
    },
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
      hooks.beforeTransaction?.(data); // simulates a write landing after the pre-check, before the tx reads
      return fn({
        get: async (x: any) => x.get(),
        set: (ref: any, v: Doc) => { void ref.set(v); },
        update: (ref: any, v: Doc) => { void ref.update(v); },
        delete: (ref: any) => { void ref.delete(); },
      });
    },
  };
  return { db, data };
}
