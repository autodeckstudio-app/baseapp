import{useEffect,useMemo,useRef,useState}from'react';
import type{VisitBillRead,VisitRead,VisitReceiptCommand}from'@autodeck/core';
import{useAuth}from'../hooks/useAuth';
import{View,Text,TextInput,Pressable}from'react-native';
import{Button,colors,spacing,radius,isNightPalette}from'@autodeck/ui';
import{randomUUID}from'expo-crypto';
import{reviewVisitReceipt,prepareReceiptBill}from'../lib/visit-receipt-service';
import{createVisitReceiptJournal}from'../lib/visit-receipt-journal';
const formatPaise=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
type Review=Awaited<ReturnType<typeof reviewVisitReceipt>>;
export function VisitReceiptControl({visitId,view,bill,onRecorded}:{visitId:string;view:VisitRead|null;bill:VisitBillRead|null;onRecorded:()=>void}){
 const auth=useAuth(),user=auth.status==='ready'?auth.user:null,claims=auth.status==='ready'?auth.claims:null,allowed=!!user&&!!claims&&['studio','admin','superadmin'].includes(claims.role),scope=allowed?JSON.stringify([user.uid,claims.tenantId,claims.role,claims.studioId,visitId]):null;
 const epoch=useRef({scope,generation:0});if(epoch.current.scope!==scope)epoch.current={scope,generation:epoch.current.generation+1};const identity=scope?scope+'@'+epoch.current.generation:null;
 const current=useRef(identity);current.current=identity;
 const journal=useMemo(()=>scope?createVisitReceiptJournal({uid:user!.uid,tenantId:claims!.tenantId,visitId},()=>current.current===identity):null,[identity]);
 const[state,setState]=useState<{scope:string|null;restored:boolean;pending:VisitReceiptCommand|null;error:string|null}>({scope:null,restored:false,pending:null,error:null});
 const method='cash' as const;const[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[review,setReview]=useState<{view:VisitRead;value:Review}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);const lock=useRef(false);
 useEffect(()=>{let alive=true;current.current=identity;setAmount('');setReference('');setReview(null);setConfirmed(false);setBusy(false);lock.current=false;setState({scope,restored:false,pending:null,error:null});if(journal)journal.restore().then(pending=>{if(alive)setState({scope,restored:true,pending,error:null})}).catch(e=>{if(alive)setState({scope,restored:false,pending:null,error:e instanceof Error?e.message:'Saved receipt unavailable.'})});return()=>{alive=false;if(current.current===identity)current.current=null}},[journal]);
 const active=state.scope===scope&&state.restored,visibleReview=review?.view===view?review.value:null;
 const change=()=>{setReview(null);setConfirmed(false)};
 async function run(action:()=>Promise<void>){if(lock.current||!active||!scope)return;const key=identity;lock.current=true;setBusy(true);setState(s=>({...s,error:null}));try{await action()}catch(e){if(current.current===key)setState(s=>({...s,error:e instanceof Error?e.message:'Receipt not confirmed. Retry saved receipt only.'}))}finally{if(current.current===key){lock.current=false;setBusy(false)}}}
 function receive(){void run(async()=>{if(!view||view.status!=='grouped'||!bill)throw Error('Refresh the current visit bill.');if(!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()))throw Error('Enter rupees with at most two decimal places.');const[whole,fraction='']=amount.trim().split('.'),paise=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(paise)||paise<=0)throw Error('Check the receipt amount.');const value=await reviewVisitReceipt(view,paise);if(current.current===identity){setReview({view,value});setConfirmed(false)}})}
 function submit(){void run(async()=>{if(!journal||!view||!visibleReview||!confirmed||visibleReview.bill.reviewToken!==bill?.reviewToken)throw Error('Review the current receipt first.');const key=identity,operationId=randomUUID(),prepared=await prepareReceiptBill({visitId,reviewToken:visibleReview.bill.reviewToken,operationId,confirmed:true});if(current.current!==key)return;
 const command=await journal.prepare({visitId,billId:prepared.billId,reviewToken:visibleReview.bill.reviewToken,operationId,receivedPaise:visibleReview.allocation.receivedPaise,method,reference:reference.trim(),confirmActualReceipt:true});if(current.current!==key)return;setState(s=>({...s,pending:command}));const outcome=await journal.send();if(current.current===key){setState(s=>({...s,pending:null,error:'rejected' in outcome?'Bill changed · No receipt recorded · Review counted money again':null}));setReview(null);setConfirmed(false);onRecorded();}})}
 function retry(){void run(async()=>{if(!journal)throw Error('Receipt scope unavailable.');const key=identity;const outcome=await journal.send();if(current.current===key){setState(s=>({...s,pending:null,error:'rejected' in outcome?'Bill changed · No receipt recorded · Review counted money again':null}));setReview(null);setConfirmed(false);onRecorded();}})}
 if(!allowed)return null;
 const row=(label:string,value:string)=><View key={label} style={{flexDirection:'row',gap:12,justifyContent:'space-between'}}><Text style={{color:colors.textPrimary,flex:1}}>{label}</Text><Text style={{color:colors.textPrimary,fontWeight:'600'}}>{value}</Text></View>;
 const note=(text:string)=><Text style={{color:colors.textMuted}}>{text}</Text>;
 const inputStyle={color:colors.textPrimary,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,minHeight:44};
 return <View style={{gap:12,padding:spacing.lg,marginBottom:spacing.lg,borderRadius:20,borderWidth:1,borderColor:isNightPalette?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.96)',backgroundColor:isNightPalette?'rgba(55,55,53,0.92)':'rgba(255,255,255,0.8)'}}>
 <Text style={{color:colors.textPrimary,fontWeight:'600'}}>Visit cash receipt</Text>
 {state.scope===scope&&state.error?<Text accessibilityRole="alert" style={{color:colors.error}}>{state.error}</Text>:null}
 {!active?note(state.error?'Receipt recording held':'Checking saved receipt…'):state.pending?<>
 {row('Saved cash receipt',formatPaise(state.pending.receivedPaise))}{note('Do not collect or record again')}
 <Button label="Check saved receipt" variant="secondary" disabled={busy} onPress={retry}/>
 </>:bill?.balancePaise===0?note('Active charges paid · Returns separate'):<>
 <Text style={{color:colors.textMuted}}>Cash counted (₹)</Text>
 <TextInput accessibilityLabel="Cash counted in rupees" style={inputStyle} keyboardType="decimal-pad" value={amount} editable={!busy} onChangeText={value=>{setAmount(value);change()}}/>
 <Text style={{color:colors.textMuted}}>Reference</Text>
 <TextInput accessibilityLabel="Receipt reference" style={inputStyle} value={reference} maxLength={200} editable={!busy} onChangeText={value=>{setReference(value);change()}}/>
 <Button label="Review cash receipt" variant="ghost" disabled={busy||!bill||!view} onPress={receive}/>
 {visibleReview?<>{row('Cash receipt',formatPaise(visibleReview.allocation.receivedPaise))}
 {visibleReview.allocation.entries.map(e=>row(visibleReview.bill.lines.find(l=>l.jobId===e.jobId)?.name??'Service',formatPaise(e.appliedPaise)))}
 {row('Balance after receipt',formatPaise(visibleReview.allocation.balancePaise))}
 <Pressable accessibilityRole="checkbox" accessibilityLabel="Cash actually received and counted" accessibilityState={{checked:confirmed,disabled:busy}} disabled={busy} onPress={()=>setConfirmed(!confirmed)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textPrimary}}>{confirmed?'✓':'○'} Cash actually received · Counted</Text></Pressable>
 <Button label="Record this cash receipt" variant="secondary" disabled={busy||!confirmed} onPress={submit}/>
 </>:null}</>}
 </View>;
}
