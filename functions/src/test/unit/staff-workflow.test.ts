import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), writes: [] as any[], now: new Date("2026-10-07T05:30:00Z"), role: "studio", studio: "s", tenant: "t" }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "staff" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => {
  const snap = (key: string) => ({ id: key.split("/")[1], exists: h.rows.has(key), data: () => h.rows.get(key) });
  const db: any = { collection: (name: string) => {
    const q: any = { name, filters: [] as any[], doc: (id: string) => ({ key: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }), where: (field: string, op: string, val: any) => { q.filters.push([field,op,val]); return q; }, limit: () => q };
    q.get = async () => ({ docs: [...h.rows].filter(([k,v]) => k.startsWith(name+"/") && q.filters.every(([f,op,val]: any[]) => op === "==" ? v[f] === val : true)).map(([key]) => snap(key)), get empty() { return this.docs.length === 0; } }); return q;
  }, runTransaction: async (fn: any) => {
    const writes: any[] = [];
    const result = await fn({ get: async (r: any) => r.key ? snap(r.key) : r.get(), update: (r: any, value: any) => writes.push([r.key,value]), set: (r: any,value: any) => writes.push([r.key,value]) });
    for (const [key,value] of writes) { h.rows.set(key, {...h.rows.get(key),...value}); h.writes.push([key,value]); } return result;
  } }; return db;
} }));
import { standbyBooking } from "../../functions/job/standbyBooking.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { buildNotification } from "../../lib/notification-events.js";
import { getFirestore } from "firebase-admin/firestore";
const request = (data: any): any => ({data, auth: {uid: "staff", token: {role: h.role, studioId: h.studio, tenantId: h.tenant}}});
const job = (id = "j", extra = {}): any => ({id,tenantId:"t",studioId:"s",bookingId:"b",customerId:"c",vehicleId:"v",serviceId:"svc",bayId:"wash",status:"PENDING_VEHICLE",statusHistory:[],scheduledAt:"2026-10-07T04:30:00Z",scheduledDate:"2026-10-07",estimatedEndAt:"2026-10-07T06:00:00Z",estimatedDurationMinutes:30,createdAt:"2026-10-01T00:00:00Z",paymentStatus:"unpaid",...extra});
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(h.now); h.rows.clear(); h.writes=[]; h.role="studio";h.studio="s";h.tenant="t";
  h.rows.set("jobs/j",job()); h.rows.set("bookings/b",{id:"b",tenantId:"t",studioId:"s",status:"CONFIRMED"});
  h.rows.set("studioConfig/s",{tenantId:"t",timezone:"Asia/Kolkata",operatingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:"09:00",close:"21:00",closed:false})),holidays:[],bays:[{id:"wash",name:"Wash",active:true,bayType:"wash"}]});
  h.rows.set("services/svc",{tenantId:"t",active:true,requiredBayType:"wash"}); h.rows.set("vehicles/v",{make:"QA",model:"Car"});
});
const queue = () => standbyBooking.run(request({jobId:"j",action:"enqueue"}));
const admit = () => standbyBooking.run(request({jobId:"j",action:"admit",bayId:"wash"}));
describe("standby queue", () => {
  it("releases bay without changing booked time or inventing a slot",async()=>{ await queue(); expect(h.rows.get("jobs/j")).toMatchObject({status:"STANDBY",bayId:"",scheduledAt:"2026-10-07T04:30:00Z"}); expect(h.rows.get("bookings/b")).toMatchObject({status:"ACTIVE",bayId:""}); });
  it("retry does not reset arrival order",async()=>{await queue(); const first=h.rows.get("jobs/j").standbyArrivedAt;vi.setSystemTime(new Date(h.now.getTime()+1000));await queue();expect(h.rows.get("jobs/j").standbyArrivedAt).toBe(first);});
  it("denies customer, wrong studio and tenant",async()=>{h.role="customer";await expect(queue()).rejects.toMatchObject({code:"permission-denied"});h.role="studio";h.studio="other";await expect(queue()).rejects.toMatchObject({code:"permission-denied"});h.studio="s";h.tenant="other";await expect(queue()).rejects.toMatchObject({code:"permission-denied"});});
  it("denies future arrival and unapproved quote",async()=>{h.rows.set("jobs/j",job("j",{scheduledAt:"2026-10-08T04:30:00Z"}));await expect(queue()).rejects.toMatchObject({code:"failed-precondition"});h.rows.set("jobs/j",job());h.rows.get("bookings/b").priceOnRequest=true;await expect(queue()).rejects.toMatchObject({code:"failed-precondition"});});
  it("assigns bay at actual time and syncs booking without reschedule charge",async()=>{await queue();await admit();expect(h.rows.get("jobs/j")).toMatchObject({status:"VEHICLE_RECEIVED",bayId:"wash",scheduledAt:h.now.toISOString(),estimatedEndAt:"2026-10-07T06:00:00.000Z"});expect(h.rows.get("bookings/b")).toMatchObject({standbyAdmittedAt:h.now.toISOString(),missedAt:null});});
  it("rejects normal advancement from standby",async()=>{await queue();await expect(advanceJobStatus.run(request({jobId:"j"}))).rejects.toMatchObject({code:"failed-precondition"});});
  it("blocks occupied bay even after its estimate",async()=>{await queue();h.rows.set("jobs/old",job("old",{bookingId:null,status:"IN_PROGRESS",estimatedEndAt:"2026-10-06T06:00:00Z"}));await expect(admit()).rejects.toMatchObject({code:"resource-exhausted"});expect(h.rows.get("jobs/j").status).toBe("STANDBY");});
  it("blocks overlap with upcoming booked reservation",async()=>{await queue();h.rows.set("jobs/next",job("next",{scheduledAt:"2026-10-07T05:40:00Z",estimatedEndAt:"2026-10-07T06:10:00Z"}));await expect(admit()).rejects.toMatchObject({code:"resource-exhausted"});});
  it("enforces arrival order per bay type",async()=>{await queue();h.rows.set("jobs/earlier",job("earlier",{status:"STANDBY",bayId:"",standbyArrivedAt:"2026-10-07T05:00:00Z"}));await expect(admit()).rejects.toMatchObject({code:"failed-precondition"});});
  it("denies admission outside opening hours and incompatible bay",async()=>{await queue();vi.setSystemTime(new Date("2026-10-07T17:00:00Z"));await expect(admit()).rejects.toMatchObject({code:"failed-precondition"});vi.setSystemTime(h.now);await expect(standbyBooking.run(request({jobId:"j",action:"admit",bayId:"bad"}))).rejects.toMatchObject({code:"failed-precondition"});});
});
describe("QC and delivery",()=>{
  it("QC rework returns to progress with history",async()=>{h.rows.set("jobs/j",job("j",{status:"QUALITY_CHECK"}));await advanceJobStatus.run(request({jobId:"j",rework:true}));expect(h.rows.get("jobs/j").status).toBe("IN_PROGRESS");expect(h.rows.get("jobs/j").statusHistory).toHaveLength(1);});
  it("denies rework outside QC",async()=>{await expect(advanceJobStatus.run(request({jobId:"j",rework:true}))).rejects.toMatchObject({code:"failed-precondition"});});
  it.each(["unpaid","partial","refunded"])("blocks delivered with %s payment",async paymentStatus=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus}));await expect(advanceJobStatus.run(request({jobId:"j"}))).rejects.toMatchObject({code:"failed-precondition"});expect(h.writes).toHaveLength(0);});
  it("keeps pending extra approval block even when paid",async()=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));h.rows.set("approvals/a",{jobId:"j",status:"pending"});await expect(advanceJobStatus.run(request({jobId:"j"}))).rejects.toMatchObject({code:"failed-precondition"});});
  it("permits paid delivery and syncs completed booking",async()=>{h.rows.set("jobs/j",job("j",{status:"READY_FOR_DELIVERY",paymentStatus:"paid"}));h.rows.delete("services/svc");await advanceJobStatus.run(request({jobId:"j"}));expect(h.rows.get("bookings/b").status).toBe("COMPLETED");});
});
describe("customer in-app milestones",()=>{
  it.each([["VEHICLE_RECEIVED","vehicle_received"],["QUALITY_CHECK","quality_check"],["DELIVERED","vehicle_delivered"],["IN_PROGRESS","job_started"],["READY_FOR_DELIVERY","job_completed"]])("maps %s to %s",async(status,type)=>{const n=await buildNotification(getFirestore(),{action:"job.status_advanced",entityId:"j",after:{status}} as any);expect(n).toMatchObject({type,userId:"c",entityType:"Booking",entityId:"b"});});
});
