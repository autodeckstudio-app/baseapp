import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), writes: [] as any[], now: new Date("2026-10-07T05:30:00Z"), role: "studio", studio: "s", tenant: "t" }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "staff" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => {
  const snap = (key: string) => ({ id: key.split("/").pop(), exists: h.rows.has(key), data: () => h.rows.get(key) });
  const db: any = { collection: (name: string) => {
    const q: any = { name, filters: [] as any[], doc: (id: string) => ({ key: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }), where: (field: string, op: string, val: any) => { q.filters.push([field,op,val]); return q; }, limit: () => q };
    q.get = async () => ({ docs: [...h.rows].filter(([k,v]) => k.startsWith(name+"/") && q.filters.every(([f,op,val]: any[]) => op === "==" ? v[f] === val : op === "in" ? val.includes(v[f]) : op === ">=" ? v[f]>=val : op === "<=" ? v[f]<=val : false)).map(([key]) => snap(key)), get empty() { return this.docs.length === 0; } }); return q;
  }, runTransaction: async (fn: any) => {
    const writes: any[] = [];
    const result = await fn({ get: async (r: any) => r.key ? snap(r.key) : r.get(), update: (r: any, value: any) => writes.push([r.key,value]), set: (r: any,value: any) => writes.push([r.key,value]) });
    for (const [key,value] of writes) { h.rows.set(key, {...h.rows.get(key),...value}); h.writes.push([key,value]); } return result;
  } }; return db;
} }));
import { standbyBooking } from "../../functions/job/standbyBooking.js";
import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { assignBay } from "../../functions/job/assignBay.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { buildNotification } from "../../lib/notification-events.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { getFirestore } from "firebase-admin/firestore";
const request = (data: any): any => ({data, auth: {uid: "staff", token: {role: h.role, studioId: h.studio, tenantId: h.tenant}}});
// STRICT rejection assertion. NOTE: in this repo's vitest (2.1.9), a RegExp
// nested inside toMatchObject is VACUOUS - it never actually tests the
// string (probed 2026-10-31: toMatchObject({message:/x/}) passes against
// any message). Never use toMatchObject for error messages; catch and
// assert code + message explicitly.
const expectErr = async (p: Promise<unknown>, code: string, message?: RegExp) => {
  let err: any;
  try { await p; } catch (e: any) { err = e; }
  expect(err, "expected the call to reject").toBeTruthy();
  expect(err.code).toBe(code);
  if (message) expect(String(err.message)).toMatch(message);
};
const job = (id = "j", extra = {}): any => ({id,tenantId:"t",studioId:"s",bookingId:"b",customerId:"c",vehicleId:"v",serviceId:"svc",bayId:"wash",status:"PENDING_VEHICLE",statusHistory:[],scheduledAt:"2026-10-07T04:30:00Z",scheduledDate:"2026-10-07",estimatedEndAt:"2026-10-07T06:00:00Z",estimatedDurationMinutes:30,createdAt:"2026-10-01T00:00:00Z",paymentStatus:"unpaid",...extra});
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(h.now); h.rows.clear(); h.writes=[]; h.role="studio";h.studio="s";h.tenant="t";
  h.rows.set("jobs/j",job()); h.rows.set("bookings/b",{id:"b",tenantId:"t",studioId:"s",customerId:"c",status:"CONFIRMED"});
  h.rows.set("studioConfig/s",{tenantId:"t",timezone:"Asia/Kolkata",operatingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:"09:00",close:"21:00",closed:false})),holidays:[],bays:[{id:"wash",name:"Wash",active:true,bayType:"wash"}]});
  h.rows.set("services/svc",{tenantId:"t",active:true,requiredBayType:"wash"}); h.rows.set("vehicles/v",{make:"QA",model:"Car"});
});
const queue = () => standbyBooking.run(request({jobId:"j",action:"enqueue"}));
const admit = () => standbyBooking.run(request({jobId:"j",action:"admit",bayId:"wash"}));
describe("standby queue", () => {
  it("releases bay without changing booked time or inventing a slot",async()=>{ await queue(); expect(h.rows.get("jobs/j")).toMatchObject({status:"STANDBY",bayId:"",scheduledAt:"2026-10-07T04:30:00Z"}); expect(h.rows.get("bookings/b")).toMatchObject({status:"ACTIVE",bayId:""}); });
  it("retry does not reset arrival order",async()=>{await queue(); const first=h.rows.get("jobs/j").standbyArrivedAt;vi.setSystemTime(new Date(h.now.getTime()+1000));await queue();expect(h.rows.get("jobs/j").standbyArrivedAt).toBe(first);});
  it("denies customer, wrong studio and tenant",async()=>{h.role="customer";await expectErr(queue(),"permission-denied");h.role="studio";h.studio="other";await expectErr(queue(),"permission-denied");h.studio="s";h.tenant="other";await expectErr(queue(),"permission-denied");});
  it("denies future arrival and unapproved quote",async()=>{h.rows.set("jobs/j",job("j",{scheduledAt:"2026-10-08T04:30:00Z"}));await expectErr(queue(),"failed-precondition");h.rows.set("jobs/j",job());h.rows.get("bookings/b").priceOnRequest=true;await expectErr(queue(),"failed-precondition");});
  it("assigns bay at actual time and syncs booking without reschedule charge",async()=>{await queue();await admit();expect(h.rows.get("jobs/j")).toMatchObject({status:"VEHICLE_RECEIVED",bayId:"wash",scheduledAt:h.now.toISOString(),estimatedEndAt:"2026-10-07T06:00:00.000Z"});expect(h.rows.get("bookings/b")).toMatchObject({standbyAdmittedAt:h.now.toISOString(),missedAt:null});});
  it("rejects normal advancement from standby",async()=>{await queue();await expectErr(advanceJobStatus.run(request({jobId:"j"})),"failed-precondition");});
  it("blocks occupied bay even after its estimate",async()=>{await queue();h.rows.set("jobs/old",job("old",{bookingId:null,status:"IN_PROGRESS",estimatedEndAt:"2026-10-06T06:00:00Z"}));await expectErr(admit(),"resource-exhausted");expect(h.rows.get("jobs/j").status).toBe("STANDBY");});
  it("blocks overlap with upcoming booked reservation",async()=>{await queue();h.rows.set("jobs/next",job("next",{scheduledAt:"2026-10-07T05:40:00Z",estimatedEndAt:"2026-10-07T06:10:00Z"}));await expectErr(admit(),"resource-exhausted");});
  it("enforces arrival order per bay type",async()=>{await queue();h.rows.set("jobs/earlier",job("earlier",{status:"STANDBY",bayId:"",standbyArrivedAt:"2026-10-07T05:00:00Z"}));await expectErr(admit(),"failed-precondition");});
  it("denies admission outside opening hours and incompatible bay",async()=>{await queue();vi.setSystemTime(new Date("2026-10-07T17:00:00Z"));await expectErr(admit(),"failed-precondition");vi.setSystemTime(h.now);await expectErr(standbyBooking.run(request({jobId:"j",action:"admit",bayId:"bad"})),"failed-precondition");});
});
describe("QC and delivery",()=>{
  it("check-in is blocked while another job holds the bay, naming the holder without closing it",async()=>{h.rows.set("jobs/old",job("old",{bookingId:null,status:"IN_PROGRESS",scheduledDate:"2026-09-01",scheduledAt:"2026-09-01T04:30:00Z",estimatedEndAt:"2026-09-01T06:00:00Z"}));await expectErr(advanceJobStatus.run(request({jobId:"j"})),"failed-precondition",/old/);expect(h.rows.get("jobs/j").status).toBe("PENDING_VEHICLE");expect(h.rows.get("jobs/old").status).toBe("IN_PROGRESS");expect(h.writes).toHaveLength(0);});
  it("check-in succeeds once the holding job is delivered or its reservation window passed",async()=>{h.rows.set("jobs/done",job("done",{bookingId:null,status:"DELIVERED",estimatedEndAt:"2026-10-06T06:00:00Z"}));await advanceJobStatus.run(request({jobId:"j"}));expect(h.rows.get("jobs/j").status).toBe("VEHICLE_RECEIVED");});
  it("check-in ignores standby and cancelled jobs in the same bay",async()=>{h.rows.set("jobs/st",job("st",{bookingId:null,status:"STANDBY",bayId:"wash"}));h.rows.set("jobs/cx",job("cx",{bookingId:null,status:"CANCELLED"}));await advanceJobStatus.run(request({jobId:"j"}));expect(h.rows.get("jobs/j").status).toBe("VEHICLE_RECEIVED");});
  it("on-time check-in is allowed when a later non-overlapping booking shares the bay",async()=>{
    h.rows.set("jobs/later",job("later",{bookingId:null,scheduledAt:"2026-10-07T06:30:00Z",estimatedEndAt:"2026-10-07T07:30:00Z"}));
    await advanceJobStatus.run(request({jobId:"j"}));
    expect(h.rows.get("jobs/j").status).toBe("VEHICLE_RECEIVED");
  });
  it("check-in is refused over an overlapping unexpired pending reservation, naming it",async()=>{
    h.rows.set("jobs/next",job("next",{bookingId:null,scheduledAt:"2026-10-07T05:40:00Z",estimatedEndAt:"2026-10-07T06:40:00Z"}));
    await expectErr(advanceJobStatus.run(request({jobId:"j"})),"failed-precondition",/next/);
    expect(h.rows.get("jobs/j").status).toBe("PENDING_VEHICLE");expect(h.writes).toHaveLength(0);
  });
  it("an expired no-show reservation does not block check-in even when windows overlap",async()=>{
    h.rows.set("jobs/gone",job("gone",{bookingId:null,scheduledAt:"2026-10-07T04:00:00Z",estimatedEndAt:"2026-10-07T05:00:00Z"}));
    await advanceJobStatus.run(request({jobId:"j"}));
    expect(h.rows.get("jobs/j").status).toBe("VEHICLE_RECEIVED");
  });
  it("late check-in within its window is refused when the actual service would collide with a future reservation",async()=>{
    // 05:30 now; stale window 04:30-05:40 would NOT overlap the 06:00
    // reservation, but the car actually occupies the bay 05:30-07:00 (90 min).
    h.rows.set("jobs/j",job("j",{scheduledAt:"2026-10-07T04:30:00Z",estimatedEndAt:"2026-10-07T05:40:00Z",estimatedDurationMinutes:90}));
    h.rows.set("jobs/next",job("next",{bookingId:null,scheduledAt:"2026-10-07T06:00:00Z",estimatedEndAt:"2026-10-07T07:00:00Z"}));
    await expectErr(advanceJobStatus.run(request({jobId:"j"})),"failed-precondition",/next/);
    expect(h.rows.get("jobs/j").status).toBe("PENDING_VEHICLE");expect(h.writes).toHaveLength(0);
  });
  it("check-in without a bay assigned is not blocked",async()=>{h.rows.set("jobs/j",job("j",{bayId:""}));await advanceJobStatus.run(request({jobId:"j"}));expect(h.rows.get("jobs/j").status).toBe("VEHICLE_RECEIVED");});
  it("QC rework returns to progress with history",async()=>{h.rows.set("jobs/j",job("j",{status:"QUALITY_CHECK"}));await advanceJobStatus.run(request({jobId:"j",rework:true}));expect(h.rows.get("jobs/j").status).toBe("IN_PROGRESS");expect(h.rows.get("jobs/j").statusHistory).toHaveLength(1);});
  it("denies rework outside QC",async()=>{await expectErr(advanceJobStatus.run(request({jobId:"j",rework:true})),"failed-precondition");});
  // Each guard test seeds a valid current car + the explicit "none" declaration so the
  // delivery passes the declaration/vehicle gates and reaches the NAMED guard - otherwise
  // the test would fail at the first gate and prove nothing about its own guard.
  const deliverableBase = (extra = {}) => { h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",...extra})); h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"c",deletedAt:null}); };
  it.each(["unpaid","partial","refunded"])("blocks delivered with %s payment",async paymentStatus=>{deliverableBase({paymentStatus});await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[]})),"failed-precondition",/full payment/);expect(h.writes).toHaveLength(0);});
  it("keeps pending extra approval block even when paid",async()=>{deliverableBase({paymentStatus:"paid"});h.rows.set("invoices/i",{jobId:"j",tenantId:"t",status:"issued"});h.rows.set("approvals/a",{jobId:"j",status:"pending"});await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[]})),"failed-precondition",/approval awaiting/);});
  it("blocks delivery of a paid job with no live invoice",async()=>{deliverableBase({paymentStatus:"paid"});await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[]})),"failed-precondition",/no invoice/);});
  it("permits paid delivery and syncs completed booking",async()=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));h.rows.set("invoices/i",{jobId:"j",tenantId:"t",status:"issued"});h.rows.delete("services/svc");h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"c",deletedAt:null});await advanceJobStatus.run(request({jobId:"j",protectionWork:[]}));expect(h.rows.get("bookings/b").status).toBe("COMPLETED");});
  it("delivery without the explicit declaration is refused (an absent field is never a silent none)",async()=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));h.rows.set("invoices/i",{jobId:"j",tenantId:"t",status:"issued"});h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"c",deletedAt:null});await expectErr(advanceJobStatus.run(request({jobId:"j"})),"failed-precondition",/declaration/);expect(h.rows.get("jobs/j").status).toBe("READY_FOR_DELIVERY");});
  it("a declaration on a NON-delivery advance is refused, never silently ignored",async()=>{h.rows.set("jobs/j",job("j",{status:"IN_PROGRESS"}));await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[]})),"failed-precondition",/only accepted when delivering/);});
  it("delivery for a transferred car (current owner is not the job customer) writes no coverage",async()=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));h.rows.set("invoices/i",{jobId:"j",tenantId:"t",status:"issued"});h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"someone-else",deletedAt:null});await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"install",kind:"ppf",coverage:"full_body"}]})),"failed-precondition",/current record does not match/);expect(h.rows.has("vehicles/v/protections/job-j-ev0")).toBe(false);});
  it("a job whose stored id disagrees with its document id fails closed - identity cannot be confirmed",async()=>{h.rows.set("jobs/j",job("j",{id:"forged-other",status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[]})),"failed-precondition",/identity cannot be confirmed/);expect(h.rows.get("jobs/j").status).toBe("READY_FOR_DELIVERY");});
  it("an already-delivered job rejects a resubmitted delivery honestly (no fake success, no double apply)",async()=>{h.rows.set("jobs/j",job("j",{status:"DELIVERED"}));await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"install",kind:"ppf",coverage:"full_body"}]})),"failed-precondition",/already delivered/);expect(h.rows.has("vehicles/v/protections/job-j-ev0")).toBe(false);});

describe("delivery handler WIRING: protection event writes (mock tx applies writes immediately - no rollback/concurrency, so this proves wiring and fail-closed guards, NOT atomicity)",()=>{
  const deliverable = () => {
    h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));
    h.rows.set("invoices/i",{jobId:"j",tenantId:"t",status:"issued"});
    h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"c",deletedAt:null});
  };
  const protRow = (id: string, o: any = {}) => h.rows.set(`vehicles/v/protections/${id}`,{id,tenantId:"t",vehicleId:"v",customerId:"c",kind:"ppf",provider:"Garware",coverage:"full_body",status:"unverified",source:"customer",...o});
  it("install event: delivery writes the record at job-<jobId>-ev0, revision 1, declared provenance, and audits it",async()=>{
    deliverable();
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"install",kind:"ppf",coverage:"full_body",brand:"LLumar",warrantyYears:5}]}));
    expect(h.rows.get("jobs/j").status).toBe("DELIVERED");
    expect(h.rows.get("jobs/j").protectionWork).toEqual([{action:"install",kind:"ppf",coverage:"full_body",brand:"LLumar",warrantyYears:5}]);
    const rec = h.rows.get("vehicles/v/protections/job-j-ev0");
    expect(rec).toMatchObject({kind:"ppf",coverage:"full_body",provider:"LLumar",warrantyYears:5,revision:1,lifecycle:"current",installedByJobId:"j",tenantId:"t",vehicleId:"v",customerId:"c",source:"autodeck",status:"verified",verifiedBy:"staff"});
    expect((writeAuditLog as any).mock.calls.some((c:any[])=>c[1]?.action==="protection.installed"&&c[1]?.entityId==="job-j-ev0"&&c[1]?.after?.jobId==="j")).toBe(true);
  });
  it("replace event: the named record is superseded with a revision bump and the new record installs at revision 1",async()=>{
    deliverable(); protRow("p1",{revision:2});
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"replace",targetProtectionId:"p1",expectedRevision:2,kind:"ppf",coverage:"full_body",brand:"LLumar",warrantyYears:7}]}));
    expect(h.rows.get("vehicles/v/protections/p1")).toMatchObject({lifecycle:"superseded",supersededByJobId:"j",revision:3,customerId:"c",source:"customer"});
    expect(h.rows.get("vehicles/v/protections/job-j-ev0")).toMatchObject({revision:1,installedByJobId:"j",provider:"LLumar"});
    expect((writeAuditLog as any).mock.calls.some((c:any[])=>c[1]?.action==="protection.superseded"&&c[1]?.entityId==="p1"&&c[1]?.after?.revision===3)).toBe(true);
  });
  it("remove event: the named record becomes history with a revision bump; legacy unversioned bases at 0",async()=>{
    deliverable(); protRow("p1");
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"remove",targetProtectionId:"p1",expectedRevision:0}]}));
    expect(h.rows.get("vehicles/v/protections/p1")).toMatchObject({lifecycle:"removed",removedByJobId:"j",revision:1});
    expect(h.rows.has("vehicles/v/protections/job-j-ev0")).toBe(false);
  });
  it("a stale expectedRevision fails closed with no writes anywhere",async()=>{
    deliverable(); protRow("p1",{revision:2});
    await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"remove",targetProtectionId:"p1",expectedRevision:1}]})),"failed-precondition",/has changed since it was reviewed/);
    expect(h.rows.get("jobs/j").status).toBe("READY_FOR_DELIVERY");
    expect(h.rows.get("vehicles/v/protections/p1").lifecycle).toBeUndefined();
  });
  it("a cross-kind or cross-scope replace fails closed (silent coverage loss is never written)",async()=>{
    deliverable(); protRow("p1",{revision:0});
    await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"replace",targetProtectionId:"p1",expectedRevision:0,kind:"ceramic",coverage:"high_impact"}]})),"failed-precondition",/changes the kind or coverage/);
    expect(h.rows.get("vehicles/v/protections/p1").lifecycle).toBeUndefined();
  });
  it("an unknown-scope (legacy no-coverage) record cannot be like-for-like replaced, but CAN be explicitly removed",async()=>{
    deliverable(); protRow("p1",{coverage:null,revision:0});
    await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"replace",targetProtectionId:"p1",expectedRevision:0,kind:"ppf",coverage:"full_body"}]})),"failed-precondition",/scope is unknown/);
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"remove",targetProtectionId:"p1",expectedRevision:0}]}));
    expect(h.rows.get("vehicles/v/protections/p1")).toMatchObject({lifecycle:"removed",removedByJobId:"j"});
  });
  it("a former owner's record on the car is a valid target, and its owner/source survive becoming history",async()=>{
    deliverable(); protRow("p1",{customerId:"former-owner",source:"autodeck",revision:0});
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"remove",targetProtectionId:"p1",expectedRevision:0}]}));
    expect(h.rows.get("vehicles/v/protections/p1")).toMatchObject({lifecycle:"removed",customerId:"former-owner",source:"autodeck"});
  });
  it("explicit none: delivery with [] writes no protection records and stores the declaration",async()=>{
    deliverable(); protRow("p1");
    await advanceJobStatus.run(request({jobId:"j",protectionWork:[]}));
    expect(h.rows.get("jobs/j").status).toBe("DELIVERED");
    expect(h.rows.get("jobs/j").protectionWork).toEqual([]);
    expect(h.rows.get("vehicles/v/protections/p1").lifecycle).toBeUndefined();
  });
  it("a target naming ANOTHER car's record fails closed",async()=>{
    deliverable();
    h.rows.set("vehicles/v2/protections/p9",{id:"p9",tenantId:"t",vehicleId:"v2",customerId:"c",kind:"ppf",coverage:"full_body"});
    await expectErr(advanceJobStatus.run(request({jobId:"j",protectionWork:[{action:"remove",targetProtectionId:"p9",expectedRevision:0}]})),"failed-precondition",/not a protection record on this vehicle/);
  });
});
});
describe("bay occupancy admission (status-based holders)",()=>{
  const walkinFixtures = () => {
    h.rows.delete("jobs/j"); // isolate: default job also sits on bay "wash"
    h.rows.set("customers/c",{id:"c",tenantId:"t",name:"C"});
    h.rows.set("vehicles/v",{id:"v",tenantId:"t",ownerId:"c",make:"QA",model:"Car"});
    h.rows.set("services/svc",{tenantId:"t",active:true,requiredBayType:"wash",basePrice:40000,category:"washing",estimatedDurationMinutes:30,vehicleCategoryPricing:[]});
  };
  const overdueHolder = () => h.rows.set("jobs/old",job("old",{bookingId:null,status:"IN_PROGRESS",scheduledDate:"2026-09-01",scheduledAt:"2026-09-01T04:30:00Z",estimatedEndAt:"2026-09-01T06:00:00Z"}));
  it("walk-in is refused over a >14d overdue active holder, naming the job",async()=>{
    walkinFixtures(); overdueHolder();
    await expectErr(createWalkinJob.run(request({serviceId:"svc",vehicleId:"v",vehicleCategory:"suv",bayId:"wash",customerId:"c",studioId:"s"})),"resource-exhausted",/old/);
    expect(h.writes).toHaveLength(0);
  });
  it("assignBay refuses to move a present job into a bay held by an overdue active job",async()=>{
    overdueHolder();
    h.rows.set("jobs/j",job("j",{bayId:""})); // window 04:30-06:00 covers mocked now 05:30 -> present
    await expectErr(assignBay.run(request({jobId:"j",bayId:"wash"})),"resource-exhausted");
    expect(h.rows.get("jobs/j").bayId).toBe("");
  });
  it("assignBay respects no-show expiry: expired overlapping pending reservation does not block a present move",async()=>{
    h.rows.set("jobs/gone",job("gone",{bookingId:null,scheduledAt:"2026-10-07T04:00:00Z",estimatedEndAt:"2026-10-07T05:00:00Z"}));
    h.rows.set("jobs/j",job("j",{bayId:""})); // window 04:30-06:00 covers mocked now 05:30 -> present
    await assignBay.run(request({jobId:"j",bayId:"wash"}));
    expect(h.rows.get("jobs/j").bayId).toBe("wash");
  });
  it("assignBay refuses a present move whose actual occupancy would collide with a future reservation on the target bay",async()=>{
    h.rows.set("studioConfig/s",{tenantId:"t",timezone:"Asia/Kolkata",operatingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:"09:00",close:"21:00",closed:false})),holidays:[],bays:[{id:"wash",name:"Wash",active:true,bayType:"wash"},{id:"wash2",name:"Wash 2",active:true,bayType:"wash"}]});
    h.rows.set("jobs/j",job("j",{bayId:"",scheduledAt:"2026-10-07T04:30:00Z",estimatedEndAt:"2026-10-07T05:40:00Z",estimatedDurationMinutes:90}));
    h.rows.set("jobs/next",job("next",{bookingId:null,bayId:"wash2",scheduledAt:"2026-10-07T06:00:00Z",estimatedEndAt:"2026-10-07T07:00:00Z"}));
    await expectErr(assignBay.run(request({jobId:"j",bayId:"wash2"})),"resource-exhausted");
    expect(h.rows.get("jobs/j").bayId).toBe("");
  });
  it("pin: future assignment stays allowed over an overdue active holder (scheduling, not admission)",async()=>{
    overdueHolder();
    h.rows.set("jobs/j",job("j",{bayId:"",scheduledDate:"2026-10-08",scheduledAt:"2026-10-08T04:30:00Z",estimatedEndAt:"2026-10-08T06:00:00Z"}));
    await assignBay.run(request({jobId:"j",bayId:"wash"}));
    expect(h.rows.get("jobs/j").bayId).toBe("wash");
  });
});
describe("customer in-app milestones",()=>{
  it.each([["VEHICLE_RECEIVED","vehicle_received"],["QUALITY_CHECK","quality_check"],["DELIVERED","vehicle_delivered"],["IN_PROGRESS","job_started"],["READY_FOR_DELIVERY","job_completed"]])("maps %s to %s",async(status,type)=>{const n=await buildNotification(getFirestore(),{action:"job.status_advanced",entityId:"j",after:{status}} as any);expect(n).toMatchObject({type,userId:"c",entityType:"Booking",entityId:"b"});});
});
