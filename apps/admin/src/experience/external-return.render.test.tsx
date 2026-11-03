import React from "react";
import { it,expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { PaymentsView } from "./OfficeViews";
import { ThemeStyle } from "./ThemeStyle";
import type { Payment } from "@autodeck/core";
it("renders external return separately and removes refund action",()=>{
 const base={id:"preview-payment",customerId:"preview-customer",amount:90000,currency:"INR",status:"completed",method:"razorpay_payment_link",createdAt:"2026-10-18T15:14:55.084Z",externalReturnRecordId:"shared-owner-record"} as Payment;
 const html=renderToStaticMarkup(<PaymentsView payments={[base,{...base,id:"preview-payment-two"}]} names={{"preview-customer":"Preview customer"}} loading={false} error={null} status="" onStatus={()=>{}} search="" onSearch={()=>{}} message={null} refundingId={null} onRefund={()=>{throw Error("must not refund")}} confirmingId={null} onConfirmReceived={()=>{}} onOpenInvoice={()=>{}} today="2026-11-03"/>);
 expect(html).toContain("Returned outside Razorpay (owner reported)");expect(html).toContain("Provider capture and refund amounts are unchanged");expect(html).not.toContain('>Refund</button>');
 writeFileSync("/tmp/external-return-fragment.html",renderToStaticMarkup(<ThemeStyle/>)+html);
});
