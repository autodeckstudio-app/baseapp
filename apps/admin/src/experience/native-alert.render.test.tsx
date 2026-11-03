import React from "react";
import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
vi.mock("../lib/auth-context",()=>({useAdminAuth:()=>({claims:null})}));
vi.mock("../lib/staff-alerts-service",()=>({listenToStaffAlerts:()=>()=>{}}));
import { StaffAlertsContent } from "../components/StaffAlertsNotice";
import { ThemeStyle } from "./ThemeStyle";
it("renders real empty and populated admin review alerts, count only",()=>{
 const empty=renderToStaticMarkup(<StaffAlertsContent alerts={[]}/>);expect(empty).toBe("");
 const alerts=[{id:"a",kind:"unmatched_payment_capture",paymentId:"private-id",createdAt:"2026-11-03"},{id:"b",kind:"membership_manual_review",paymentId:"private-id",createdAt:"2026-11-03"}];
 expect(renderToStaticMarkup(<StaffAlertsContent alerts={Array.from({length:50},(_,i)=>({...alerts[0]!,id:String(i)}))}/>)).toContain("newest notices");
 const full=renderToStaticMarkup(<StaffAlertsContent alerts={alerts}/>);expect(full).toContain("Reconcile in Razorpay");expect(full).not.toContain("private-id");
 for(const [name,body] of [["empty",empty],["populated",full],["capped",renderToStaticMarkup(<StaffAlertsContent alerts={Array.from({length:50},(_,i)=>({...alerts[0]!,id:String(i)}))}/>)]])writeFileSync(`/tmp/native-admin-${name}.html`,`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#f5f4f0;font-family:Arial}main{padding:24px;max-width:960px;margin:auto}h1{font-size:24px}.ax-panel{padding:20px;background:white;border:1px solid #ddd;border-radius:16px}.ax-label{font-weight:600;font-size:12px;text-transform:uppercase}p{font-size:15px;line-height:1.55}</style><main><h1>Studio overview</h1>${renderToStaticMarkup(<ThemeStyle/>)}${body}<p>Today's bookings</p><section class="ax-panel">No bookings need attention.</section></main>`);
});
