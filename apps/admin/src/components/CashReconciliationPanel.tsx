"use client";
import{useEffect,useRef,useState}from'react';import{httpsCallable}from'firebase/functions';
import{functions}from'../lib/firebase';import{useAdminAuth}from'../lib/auth-context';import{formatPaise}from'../lib/format';
type Fact={id:string;state:'held'|'review'|'settled';receivedPaise:number;receivedAt:string;collectedBy:string;reason:string};
type Review={fact:Fact|null;balanceDuePaise?:number;officeReturnDuePaise?:number};
/** Separates the fact of cash received from provider closure and allocation. */
export function CashReconciliationPanel({jobId,paymentId}:{jobId:string;paymentId:string}){
 const{user,claims}=useAdminAuth();const scope=[jobId,paymentId,user?.uid,claims?.tenantId,claims?.studioId,claims?.role].join('|');
 const live=useRef(scope);live.current=scope;const generation=useRef(0),lock=useRef(false);
 const intent=useRef<{payload:string;key:string}|null>(null);
 const[review,setReview]=useState<{scope:string;data:Review}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const[amount,setAmount]=useState(''),[receivedAt,setReceivedAt]=useState(''),[collector,setCollector]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[closeConfirmed,setCloseConfirmed]=useState(false);
 const allowed=!!user&&['admin','superadmin'].includes(claims?.role??'');
 const current=allowed&&review?.scope===scope?review.data:null;
 async function load(){const s=scope,g=generation.current;try{const result=await httpsCallable<{jobId:string},Review>(functions,'getCashReconciliationReview')({jobId});if(live.current===s&&generation.current===g){setReview({scope:s,data:result.data});setError('')}}catch(e){if(live.current===s&&generation.current===g){setReview(null);setError(e instanceof Error?e.message:'Could not load cash review.')}}}
 useEffect(()=>{generation.current++;lock.current=false;intent.current=null;setReview(null);setError('');setBusy(false);setAmount('');setReceivedAt('');setCollector('');setReason('');setConfirmed(false);setCloseConfirmed(false);if(allowed)void load();return()=>{generation.current++}},[scope,allowed]);
 async function act(kind:'hold'|'reconcile'){
  if(!current||lock.current||!allowed||live.current!==scope)return;
  let payload:any;
  if(kind==='hold'){
   const paise=Math.round(Number(amount)*100),when=Date.parse(receivedAt);
   if(!confirmed||!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())||!Number.isSafeInteger(paise)||paise<=0||!Number.isFinite(when)||!collector.trim()||!reason.trim()){setError('Enter actual cash amount, receipt date/time, collector and reason, then confirm the cash was received.');return}
   payload={jobId,paymentId,receivedPaise:paise,receivedAt:new Date(when).toISOString(),collectedBy:collector.trim(),reason:reason.trim()};
   const body=JSON.stringify(payload);
   if(intent.current&&intent.current.payload!==body){setError('Previous receipt outcome is unresolved. Retry the same details or refresh review before another entry.');return}
   if(!intent.current)intent.current={payload:body,key:crypto.randomUUID()};payload.receiptKey=intent.current.key;
  }else{if(!current.fact||current.fact.state==='settled'||!closeConfirmed)return;payload={reconciliationId:current.fact.id,confirmCloseUnpaidLink:true}}
  const s=scope,g=generation.current;lock.current=true;setBusy(true);setError('');
  try{await httpsCallable(functions,kind==='hold'?'recordCashAlreadyReceived':'reconcileCashAlreadyReceived')(payload);if(live.current!==s||generation.current!==g)return;intent.current=null;setConfirmed(false);setCloseConfirmed(false);await load()}
  catch(e){if(live.current===s&&generation.current===g)setError(e instanceof Error?e.message:'Outcome unknown. Refresh review; do not collect again.')}
  finally{if(live.current===s&&generation.current===g){lock.current=false;setBusy(false)}}
 }
 if(!allowed)return null;
 return<section className="ax-panel ax-cash-reconciliation">
 <div className="ax-cash-heading"><div><span className="ax-label">Cash received</span><h3>{current?.fact?'Receipt review':'Record a receipt'}</h3></div><button className="ax-cash-refresh" aria-label="Refresh cash review" disabled={busy} onClick={()=>void load()}>Refresh</button></div>
 {error?<p role="alert">{error}</p>:null}
 {current?current.fact?<>
 <div className="ax-cash-amount">{formatPaise(current.fact.receivedPaise)}</div>
 <div role="status" className={'ax-cash-status '+(current.fact.state==='settled'?'is-settled':'')}>{current.fact.state==='settled'?'Cash allocated':current.fact.state==='review'?'Cash held - office review needed':'Cash held - not allocated'}</div>
 <details className="ax-cash-details"><summary>Receipt details</summary><dl><dt>Received</dt><dd>{current.fact.receivedAt}</dd><dt>Collector</dt><dd>{current.fact.collectedBy}</dd><dt>Evidence</dt><dd>{current.fact.reason}</dd></dl></details>
 {current.fact.state==='settled'?<><div className="kv"><span>Balance due</span><strong>{formatPaise(current.balanceDuePaise??0)}</strong></div>{(current.officeReturnDuePaise??0)>0?<div className="kv"><span>Return due</span><strong>{formatPaise(current.officeReturnDuePaise??0)}</strong></div>:null}<p className="ax-note">No automatic refund or credit.</p></>:<>
 <p className="ax-cash-warning">Do not collect again.</p>
 <label className="ax-cash-confirm"><input type="checkbox" checked={closeConfirmed} disabled={busy} onChange={e=>setCloseConfirmed(e.target.checked)}/> Check and close the unpaid online link, then allocate this cash.</label>
 <button className="ax-button" disabled={busy||!closeConfirmed} onClick={()=>void act('reconcile')}>Check online attempt</button>
 <details className="ax-cash-details"><summary>How the check works</summary><ul><li>Paid, partial or uncertain payments stay in review.</li><li>A later online capture stays recorded for office review.</li><li>Cash allocation does not release delivery or cancel service.</li></ul></details>
 </>}
 </>:<>
 <p className="ax-cash-warning">Already collected? Do not collect again.</p>
 <div className="ax-form-section"><label className="ax-form-row">Amount received (Rs)<input aria-label="Actual cash amount" value={amount} inputMode="decimal" disabled={busy} onChange={e=>setAmount(e.target.value)}/></label><label className="ax-form-row">Received at · local time<input aria-label="Cash received at" type="datetime-local" value={receivedAt} disabled={busy} onChange={e=>setReceivedAt(e.target.value)}/></label><label className="ax-form-row">Collector<input aria-label="Cash collector" maxLength={128} value={collector} disabled={busy} onChange={e=>setCollector(e.target.value)}/></label><label className="ax-form-row">Evidence note<input aria-label="Cash reason" maxLength={200} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label><label className="ax-cash-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> I verified the actual cash received.</label><button className="ax-button" disabled={busy||!confirmed} onClick={()=>void act('hold')}>Record cash fact</button></div><p className="ax-note">Saved for review, not marked paid.</p>
 </>:<p>Cash review unavailable until loaded.</p>}
 </section>;
}
