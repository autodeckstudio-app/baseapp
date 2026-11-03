import { it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collection, query, where, or, orderBy, limit, getDocs } from "firebase/firestore";
let env: RulesTestEnvironment;
beforeAll(async()=>{
 env=await initializeTestEnvironment({projectId:process.env["GCLOUD_PROJECT"]!,firestore:{rules:readFileSync(resolve(__dirname,"../../../../firestore.rules"),"utf8"),host:"localhost",port:8099}});
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [id,tenantId,studioId] of [["global",null,null],["own","t","s"],["other","foreign","s2"]])await db.collection("staffAlerts").doc(id as string).set({id,tenantId,studioId,kind:"unmatched_payment_capture",createdAt:new Date().toISOString()});});
});
afterAll(async()=>env.cleanup());
it("actual Admin global-null OR tenant query returns alerts only to superadmin",async()=>{
 const db=env.authenticatedContext("root",{role:"superadmin",tenantId:"t",studioId:null}).firestore();
 const q=query(collection(db as never,"staffAlerts"),or(where("tenantId","==","t"),where("tenantId","==",null)),orderBy("createdAt","desc"),limit(50));
 const s=await assertSucceeds(getDocs(q));expect(s.docs.map(d=>d.id)).toEqual(expect.arrayContaining(["global","own"]));expect(s.docs.every(d=>d.data().tenantId===null||d.data().tenantId==="t")).toBe(true);
});
it.each(["admin","studio","customer"])("%s cannot read global or foreign alert",async role=>{
 const db=env.authenticatedContext(role,{role,tenantId:"t",studioId:"s"}).firestore();
 await assertFails(db.collection("staffAlerts").doc("global").get());await assertFails(db.collection("staffAlerts").doc("other").get());
});
it("existing tenant and studio queries remain isolated",async()=>{
 const admin=env.authenticatedContext("admin",{role:"admin",tenantId:"t",studioId:null}).firestore();
 expect((await assertSucceeds(admin.collection("staffAlerts").where("tenantId","==","t").get())).docs.map(d=>d.id)).toEqual(["own"]);
 const studio=env.authenticatedContext("studio",{role:"studio",tenantId:"t",studioId:"s"}).firestore();
 expect((await assertSucceeds(studio.collection("staffAlerts").where("tenantId","==","t").where("studioId","==","s").get())).docs.map(d=>d.id)).toEqual(["own"]);
 await assertFails(env.authenticatedContext("customer",{role:"customer",tenantId:"t"}).firestore().collection("staffAlerts").where("tenantId","==","t").get());
});

it("newest scoped alert remains visible after more than50 old notices",async()=>{
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(let i=0;i<65;i++)await db.collection("staffAlerts").doc(`old-${i}`).set({id:`old-${i}`,tenantId:"t",studioId:"s",kind:"membership_manual_review",createdAt:`2020-01-01T00:00:${String(i%60).padStart(2,"0")}Z`});await db.collection("staffAlerts").doc("fresh").set({id:"fresh",tenantId:"t",studioId:"s",kind:"membership_manual_review",createdAt:"2099-01-01T00:00:00Z"});});
 const db=env.authenticatedContext("root-new",{role:"superadmin",tenantId:"t",studioId:null}).firestore();
 const s=await assertSucceeds(getDocs(query(collection(db as never,"staffAlerts"),or(where("tenantId","==","t"),where("tenantId","==",null)),orderBy("createdAt","desc"),limit(50))));expect(s.size).toBe(50);expect(s.docs[0]!.id).toBe("fresh");
});
