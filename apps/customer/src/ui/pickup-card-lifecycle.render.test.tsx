import React from "react";
import { it,expect,vi } from "vitest";
import { act,create } from "react-test-renderer";
const h=vi.hoisted(()=>({callback:null as any,error:null as any}));
vi.mock("../lib/pickup-service",()=>({listenToPickupRequest:(_id:any,callback:any,error:any)=>{h.callback=callback;h.error=error;return()=>{}}}));
import { PickupCard } from "./PickupCard";
const statuses=["REQUESTED","CONFIRMED","DONE","DECLINED"];
it.each(statuses)("pickup %s never implies studio receipt or payment capture",async status=>{
 let r:any;await act(async()=>{r=create(<PickupCard bookingId="sample" combinedPayment/>)});
 await act(async()=>h.callback({id:"pickup",bookingId:"sample",kind:"both",status,address:"Sample address",feePaise:9400}));
 const text=JSON.stringify(r.toJSON());expect(text).not.toContain("Car received");expect(text).not.toContain("Car picked up");expect(text).not.toContain("Car dropped back");expect(text).not.toContain("Nothing is charged online");expect(text).not.toContain('"Paid"');
 if(status!=="DECLINED")expect(text).toContain("Included in your booking total");await act(async()=>r.unmount());
});
it("only actual leg timestamps show completion; route changes and errors clear old pickup",async()=>{
 let r:any;await act(async()=>{r=create(<PickupCard bookingId="first"/>)});const old=h.callback;
 await act(async()=>h.callback({kind:"both",status:"CONFIRMED",address:"OLD-PRIVATE",pickupCompletedAt:"2026-11-13T10:00:00Z"}));
 expect(JSON.stringify(r.toJSON())).toContain("Car picked up");expect(JSON.stringify(r.toJSON())).not.toContain("Car dropped back");
 await act(async()=>r.update(<PickupCard bookingId="next"/>));expect(r.toJSON()).toBeNull();await act(async()=>old({kind:"both",status:"DONE",address:"OLD-LATE"}));expect(r.toJSON()).toBeNull();await act(async()=>h.error(Error("offline")));expect(r.toJSON()).toBeNull();await act(async()=>r.unmount());
});
