"use client";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useAdminAuth } from "../lib/auth-context";
import { formatPaise } from "../lib/format";
type Method = "cash" | "upi_manual" | "bank_transfer";
type Receipt = { id: string; createdAt: string; method: Method; receivedPaise: number; appliedPaise: number; officeReturnDuePaise: number };
type Obligation = { id: string; status: string; amountPaise: number; kind?: string };
type Review = { cancelled: boolean; receipts: Receipt[]; obligations: Obligation[]; balanceDuePaise: number; officeReturnDuePaise: number };
/** Actual receipt register only. No provider collection, refund or automatic credit. */
export function OfflineReceiptPanel({ jobId }: { jobId: string }) {
 const { user, claims } = useAdminAuth();
 const scope = [jobId, user?.uid, claims?.tenantId, claims?.role].join("|");
 const liveScope = useRef(scope); liveScope.current = scope;
 const generation = useRef(0), lock = useRef(false);
 const key = useRef<{ intent: string; key: string } | null>(null);
 const [resolved, setResolved] = useState("");
 const [review, setReview] = useState<Review | null>(null), [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false), [amount, setAmount] = useState(""), [method, setMethod] = useState<Method>("cash"), [reference, setReference] = useState("");
 const [verified, setVerified] = useState(false), [note, setNote] = useState(""), [returnMethod, setReturnMethod] = useState<Method>("cash");
 const allowed = !!user && ["admin", "superadmin"].includes(claims?.role ?? "");
 const current = review && resolved === scope && allowed ? review : null;
 async function load() {
  const expected = scope, n = generation.current;
  try {
   const result = await httpsCallable<{ jobId: string }, Review>(functions, "getOfflineReceiptReview")({ jobId });
   if (liveScope.current !== expected || generation.current !== n) return;
   setReview(result.data); setResolved(expected); setError(null);
  } catch (e) { if (liveScope.current === expected && generation.current === n) { setReview(null); setResolved(""); setError(e instanceof Error ? e.message : "Could not load receipts."); } }
 }
 useEffect(() => {
  generation.current++; lock.current = false; key.current = null;
  setReview(null); setResolved(""); setError(null); setBusy(false); setAmount(""); setReference(""); setVerified(false); setNote(""); setMethod("cash");
  if (allowed) void load();
  return () => { generation.current++; };
 }, [scope, allowed]);
 async function record() {
  if (!current || current.cancelled || current.balanceDuePaise <= 0 || !verified || lock.current || liveScope.current !== scope) return;
  const receivedPaise = Math.round(Number(amount) * 100);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(receivedPaise) || receivedPaise <= 0) { setError("Enter the amount actually received."); return; }
  const intent = JSON.stringify([scope, receivedPaise, method, reference.trim()]);
  if (key.current && key.current.intent !== intent) { setError("The previous receipt outcome is unresolved. Retry its original amount, method and reference, or check the register before starting a different receipt."); return; }
  if (!key.current) key.current = { intent, key: crypto.randomUUID() };
  const expected = scope, n = generation.current;
  lock.current = true; setBusy(true);
  try {
   await httpsCallable(functions, "recordOfflineReceipt")({ jobId, receiptKey: key.current.key, receivedPaise, method, reference: reference.trim() });
   if (liveScope.current !== expected || generation.current !== n) return;
   key.current = null; setAmount(""); setVerified(false); await load();
  } catch (e) { if (liveScope.current === expected && generation.current === n) setError(e instanceof Error ? e.message : "Receipt outcome unknown. Retry the same receipt, not a second collection."); }
  finally { if (liveScope.current === expected && generation.current === n) { lock.current = false; setBusy(false); } }
 }
 async function returned(receiptId: string) {
  if (!current || lock.current || note.trim().length < 3 || liveScope.current !== scope) return;
  const obligation = current.obligations.find(o => o.id === receiptId && o.status === "due" && o.amountPaise > 0 && o.amountPaise <= current.officeReturnDuePaise);
  if (!obligation) return;
  const expected = scope, n = generation.current;
  lock.current = true; setBusy(true);
  try {
   await httpsCallable(functions, "settleOfflineReturn")({ receiptId, note: note.trim(), method: returnMethod });
   if (liveScope.current !== expected || generation.current !== n) return;
   setNote(""); await load();
  } catch (e) { if (liveScope.current === expected && generation.current === n) setError(e instanceof Error ? e.message : "Could not record return."); }
  finally { if (liveScope.current === expected && generation.current === n) { lock.current = false; setBusy(false); } }
 }
 if (!allowed) return null;
 return <section className="ax-panel">
  <span className="ax-label">Actual offline receipts</span>
  <p className="ax-note">Record verified money only. Part payment leaves a balance. Excess is returned by the office, never as automatic credit or refund.</p>
  {error && <p role="alert">{error}</p>}
  {current ? <>
   {current.cancelled && <p className="ax-note">Visit cancelled. A return remains owed until the office records the actual return.</p>}
   <div className="kv"><span>Balance due</span><span>{formatPaise(current.balanceDuePaise)}</span></div>
   <div className="kv"><span>Total office return due</span><span>{formatPaise(current.officeReturnDuePaise)}</span></div>
   {current.receipts.map(r => <p className="ax-note" key={r.id}>{r.createdAt} - {r.method} - received {formatPaise(r.receivedPaise)}, applied {formatPaise(r.appliedPaise)}, excess {formatPaise(r.officeReturnDuePaise)}</p>)}
   {current.balanceDuePaise > 0 && !current.cancelled && <>
    <label className="ax-form-row">Actual amount received (Rs)<input aria-label="Actual amount received" value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value)} /></label>
    <label className="ax-form-row">Method<select value={method} onChange={e => setMethod(e.target.value as Method)}><option value="cash">Cash</option><option value="upi_manual">UPI verified by office</option><option value="bank_transfer">Bank transfer verified by office</option></select></label>
    <label className="ax-form-row">Reference<input value={reference} onChange={e => setReference(e.target.value)} /></label>
    <label><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> I checked the actual money received.</label>
    <button className="ax-button" disabled={busy || !verified} onClick={() => void record()}>Record actual receipt</button>
   </>}
   {current.officeReturnDuePaise > 0 && <>
    <p className="ax-note">Office only: record a return after the money has actually been handed back. This does not send money.</p>
    <label className="ax-form-row">Actual return method<select value={returnMethod} onChange={e => setReturnMethod(e.target.value as Method)}><option value="cash">Cash</option><option value="upi_manual">UPI</option><option value="bank_transfer">Bank transfer</option></select></label>
    <label className="ax-form-row">Return reference or evidence note<input aria-label="Return evidence note" value={note} onChange={e => setNote(e.target.value)} /></label>
    {current.obligations.filter(o => o.status === "due" && o.amountPaise > 0 && o.amountPaise <= current.officeReturnDuePaise).map(o => <button className="ax-button" disabled={busy || note.trim().length < 3} key={o.id} onClick={() => void returned(o.id)}>{o.kind === "cancellation" ? "Record cancellation return" : "Record excess return"}: {formatPaise(o.amountPaise)}</button>)}
   </>}
  </> : <p>Loading receipt register.</p>}
  <button className="ax-button" disabled={busy} onClick={() => void load()}>Refresh receipts</button>
 </section>;
}
