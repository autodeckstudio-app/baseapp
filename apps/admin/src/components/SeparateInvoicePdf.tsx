"use client";
import{useAdminAuth}from'../lib/auth-context';import{useSeparateInvoicePdf}from'../lib/use-separate-invoice-pdf';
export function SeparateInvoicePdf({jobId,kind}:{jobId:string;kind:'retained'|'cancellation'}){const{user,claims}=useAdminAuth(),scope=user&&claims&&['admin','superadmin'].includes(claims.role)?JSON.stringify([user.uid,claims.tenantId,claims.role]):null,p=useSeparateInvoicePdf(jobId,kind,scope);return<div><button className="ax-button" disabled={p.disabled} onClick={()=>void p.press()}>{p.label}</button>{p.error?<div className="ax-note">{p.error}</div>:null}</div>}
