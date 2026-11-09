/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), audit: [] as any[], txMutate: null as null | (() => void) }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: any, p: any) => h.audit.push(p) }));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => { if (path.startsWith("customers/") && !h.rows.has(path) && ![...h.rows].some(([k,v])=>k.startsWith("customers/")&&v.authUid===path.split("/").pop())) { const id = path.split("/").pop(); return { exists: true, data: () => ({ authUid: id, tenantId: "t", deletedAt: null }) }; } return { exists: h.rows.has(path), data: () => h.rows.get(path) }; } });
  return { getFirestore: () => ({
    collection: (c: string) => ({
      doc: (id?: string) => docRef(`${c}/${id ?? "newid1"}`),
      where: (field:string, _op:string, value:any) => ({
        limit: () => ({get:async () => ({
          docs: [...h.rows].filter(([key,v]) => key.startsWith(c+'/') && v[field]===value)
            .map(([key,v]) => ({id:key.split('/').pop(),data:()=>v}))
        })})
      })
    }),
    runTransaction: async (fn: any) => {
      let mutated = false;
      const mutateOnce = () => { if (!mutated && h.txMutate) { mutated = true; h.txMutate(); } };
      return fn({
        get: async (r: any) => { mutateOnce(); return r.get(); },
        set: (r: any, d: any) => { h.rows.set(r.path, d); },
        update: (r: any, d: any) => { h.rows.set(r.path, { ...h.rows.get(r.path), ...d }); },
      });
    },
  }) };
});
vi.mock("@autodeck/database", () => ({
  COLLECTIONS: { vehicles: () => "vehicles", customers: () => "customers", auditLog: () => "audit" },
  SUBCOLLECTIONS: { vehicleProtections: (v: string) => `vehicles/${v}/protections` },
}));
import { createMyProtection } from "../../functions/protection/createMyProtection.js";
import { updateMyProtection } from "../../functions/protection/updateMyProtection.js";
const req = (uid: string, data: any, role = "customer", tenantId = "t"): any => ({ data, auth: { uid, token: { role, tenantId } } });
const DECL = "decl-abc12345";
const ownProtection = (id: string, o: any = {}) => ({ id, tenantId: "t", vehicleId: "v1", customerId: "me", kind: "ceramic", provider: "XPEL", warrantyYears: 7, startDate: "2025-01-01", status: "unverified", source: "customer", createdAt: "x", updatedAt: "x", ...o });
beforeEach(() => {
  h.rows.clear(); h.audit.length = 0; h.txMutate = null;
  h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", deletedAt: null });
  h.rows.set("vehicles/v2", { ownerId: "other", tenantId: "t", deletedAt: null });
});
describe("createMyProtection", () => {
  it("creates a source-customer unverified ppf record with no expiry, fields independently optional", async () => {
    const r = await createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL, provider: "Garware", warrantyYears: 5, startDate: "2025-06-01" }));
    const p = (r as any).protection;
    expect(p).toMatchObject({ id: DECL, vehicleId: "v1", customerId: "me", kind: "ppf", provider: "Garware", warrantyYears: 5, startDate: "2025-06-01", expiryDate: null, policyNumber: null, status: "unverified", source: "customer", verifiedBy: null });
    expect(h.audit[0]).toMatchObject({ action: "protection.created", after: { source: "customer" } });
    // declaration with no details at all still persists
    const r2 = await createMyProtection.run(req("me", { vehicleId: "v1", kind: "ceramic", declarationId: "decl-bare-1" }));
    expect((r2 as any).protection).toMatchObject({ kind: "ceramic", provider: null, warrantyYears: null, startDate: null });
  });
  it("a retry with the same declarationId returns the same record and never duplicates", async () => {
    const first = (await createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL, provider: "Garware" })) as any).protection;
    const replay = (await createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL, provider: "Garware" })) as any).protection;
    expect(replay.id).toBe(first.id);
    expect(h.rows.has("vehicles/v1/protections/" + DECL)).toBe(true);
    expect([...h.rows.keys()].filter((k) => k.startsWith("vehicles/v1/protections/"))).toHaveLength(1);
    expect(h.audit).toHaveLength(1); // no second write/audit on replay
    // a different declarationId is a genuinely new record (history kept)
    await createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: "decl-other-2", provider: "XPEL" }));
    expect([...h.rows.keys()].filter((k) => k.startsWith("vehicles/v1/protections/"))).toHaveLength(2);
    // someone else's id or a kind mismatch on the same id is not a replay
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ceramic", declarationId: DECL }))).rejects.toMatchObject({ code: "already-exists" });
  });
  it("rejects legal/financial kinds and any expiry/status/identity-field write", async () => {
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "insurance", declarationId: DECL }))).rejects.toBeTruthy();
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ceramic", declarationId: DECL, expiryDate: "2030-01-01" }))).rejects.toBeTruthy();
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL, status: "verified" }))).rejects.toBeTruthy();
    expect(h.rows.size).toBe(2);
  });
  it("checks vehicle ownership, archive and tenant fresh inside the transaction", async () => {
    // ownership transferred between request and write
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "buyer", tenantId: "t", deletedAt: null });
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL }))).rejects.toMatchObject({ code: "permission-denied" });
    // archived mid-flight
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", deletedAt: "2026-01-01" });
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL }))).rejects.toMatchObject({ code: "failed-precondition" });
    // tenant moved mid-flight
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "other-tenant", deletedAt: null });
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL }))).rejects.toBeTruthy();
    h.txMutate = null;
    await expect(createMyProtection.run(req("me", { vehicleId: "v2", kind: "ppf", declarationId: DECL }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(createMyProtection.run(req("me", { vehicleId: "v1", kind: "ppf", declarationId: DECL }, "admin"))).rejects.toBeTruthy();
  });
});
describe("updateMyProtection", () => {
  it("edits own unverified cosmetic self-declared entry and clears fields with null", async () => {
    h.rows.set("vehicles/v1/protections/c1", ownProtection("c1"));
    await updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c1", provider: "Gtechniq", warrantyYears: null, notes: "roof too" }));
    expect(h.rows.get("vehicles/v1/protections/c1")).toMatchObject({ provider: "Gtechniq", warrantyYears: null, notes: "roof too", startDate: "2025-01-01", kind: "ceramic", status: "unverified" });
    expect(h.audit[0]).toMatchObject({ action: "protection.updated" });
  });
  it("refuses AutoDeck-entered, verified, expired, non-cosmetic and other customers' records, and kind/status/expiry writes", async () => {
    h.rows.set("vehicles/v1/protections/p1", { ...ownProtection("p1"), kind: "insurance", source: undefined, status: "verified" });
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "p1", provider: "x" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.rows.set("vehicles/v1/protections/c2", ownProtection("c2", { status: "verified" }));
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c2", provider: "x" }))).rejects.toMatchObject({ code: "failed-precondition" });
    h.rows.set("vehicles/v1/protections/c4", ownProtection("c4", { status: "expired" }));
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c4", provider: "x" }))).rejects.toMatchObject({ code: "failed-precondition" });
    h.rows.set("vehicles/v1/protections/c5", ownProtection("c5", { kind: "extended_warranty" }));
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c5", provider: "x" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.rows.set("vehicles/v1/protections/c3", ownProtection("c3"));
    await expect(updateMyProtection.run(req("other", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c3", provider: "x" }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c3", kind: "ppf" }))).rejects.toBeTruthy();
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c3", expiryDate: "2030-01-01" }))).rejects.toBeTruthy();
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c3", status: "verified" }))).rejects.toBeTruthy();
    expect(h.rows.get("vehicles/v1/protections/c3").provider).toBe("XPEL");
  });
  it("re-checks vehicle ownership, archive and tenant fresh inside the transaction", async () => {
    h.rows.set("vehicles/v1/protections/c1", ownProtection("c1"));
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "buyer", tenantId: "t", deletedAt: null });
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c1", provider: "x" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", deletedAt: "2026-01-01" });
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c1", provider: "x" }))).rejects.toMatchObject({ code: "failed-precondition" });
    h.txMutate = () => h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "other-tenant", deletedAt: null });
    await expect(updateMyProtection.run(req("me", { expectedRevision: null, legacyBaseUpdatedAt: "x", vehicleId: "v1", protectionId: "c1", provider: "x" }))).rejects.toBeTruthy();
    expect(h.rows.get("vehicles/v1/protections/c1").provider).toBe("XPEL"); // untouched
  });
});

describe('canonical non-UID protection identity',()=>{
 beforeEach(()=>{h.rows.set('customers/staged',{authUid:'login',tenantId:'t',deletedAt:null});h.rows.set('vehicles/v1',{ownerId:'staged',tenantId:'t',deletedAt:null})});
 it('creates with canonical customer id and retains unverified state',async()=>{const out=await createMyProtection.run(req('login',{vehicleId:'v1',kind:'ppf',declarationId:DECL}));expect((out as any).protection).toMatchObject({customerId:'staged',status:'unverified',expiryDate:null})});
 it('does not accept uid owner fallback',async()=>{h.rows.set('vehicles/v1',{ownerId:'login',tenantId:'t',deletedAt:null});await expect(createMyProtection.run(req('login',{vehicleId:'v1',kind:'ppf',declarationId:DECL}))).rejects.toMatchObject({code:'permission-denied'})});
 it('updates canonical record without changing its principal',async()=>{h.rows.set('vehicles/v1/protections/c1',ownProtection('c1',{customerId:'staged'}));await updateMyProtection.run(req('login',{expectedRevision:null,legacyBaseUpdatedAt:'x',vehicleId:'v1',protectionId:'c1',provider:'New brand'}));expect(h.rows.get('vehicles/v1/protections/c1')).toMatchObject({customerId:'staged',provider:'New brand',status:'unverified'})});
 it('does not edit legacy uid-keyed record with different canonical principal',async()=>{h.rows.set('vehicles/v1/protections/c1',ownProtection('c1',{customerId:'login'}));await expect(updateMyProtection.run(req('login',{expectedRevision:null,legacyBaseUpdatedAt:'x',vehicleId:'v1',protectionId:'c1',provider:'New'}))).rejects.toMatchObject({code:'permission-denied'});expect(h.rows.get('vehicles/v1/protections/c1').provider).toBe('XPEL')});
});
