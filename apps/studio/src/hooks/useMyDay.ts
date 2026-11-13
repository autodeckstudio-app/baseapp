import {useStudioDay} from './useStudioDay';
import{useBreakCheckoutConfirmation}from "./useBreakCheckoutConfirmation";
import { useEffect, useState,useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { AttendanceRecord, Employee } from "@autodeck/core";
import { db, functions } from "../lib/firebase";
import { useAuth } from "./useAuth";
import { dayActions, dayErrorNote, type DayAction } from "../lib/my-day";

const CALL: Record<DayAction, [string, string]> = {
  in: ["checkInAttendance", "Checked in for today."],
  bs: ["startAttendanceBreak", "Break started."],
  be: ["endAttendanceBreak", "Break ended."],
  out: ["checkOutAttendance", "Checked out. See you tomorrow."],
};

const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-");

/** The signed-in staff member's attendance for today, live, with the same four actions the Account page has. */
export function useMyDay() {
  const authState = useAuth();
  const runLock=useRef(false);
  const date=useStudioDay();
  const [me, setMe] = useState<Employee | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState<DayAction | null>(null);
  const [employeeError,setEmployeeError]=useState(false);
  const [attendanceError,setAttendanceError]=useState(false);
  const [readAttempt,setReadAttempt]=useState(0);
  const [note, setNote] = useState<string | null>(null);
  const uid = authState.status === "ready" ? authState.user.uid : null;
  const tenantId = authState.status === "ready" ? authState.claims.tenantId : null;
  const owner=uid&&tenantId?`${tenantId}:${uid}`:null;
  const ownerRef=useRef(owner);ownerRef.current=owner;
  const scope=`${owner}:${date}`;
  const scopeRef=useRef(scope);
  const [employeeSource,setEmployeeSource]=useState<string|null>(null);
  const [attendanceSource,setAttendanceSource]=useState<string|null>(null);
  useEffect(()=>{
    setMe(null);setMeLoaded(false);setEmployeeSource(null);setToday(null);setAttendanceSource(null);setNote(null);setEmployeeError(false);setBusy(null);runLock.current=false;
    if(!uid||!tenantId)return;
    let active=true;
    const stop=onSnapshot(query(collection(db,COLLECTIONS.employees()),where("tenantId","==",tenantId),where("authUid","==",uid)),snap=>{
      if(!active||ownerRef.current!==owner)return;
      setEmployeeError(false);setMe((snap.docs[0]?.data() as Employee|undefined)??null);setMeLoaded(true);setEmployeeSource(owner);
    },()=>{if(active&&ownerRef.current===owner){setMe(null);setMeLoaded(false);setEmployeeSource(owner);setEmployeeError(true)}});
    return()=>{active=false;stop()};
  },[owner,readAttempt]);
  const currentMe=employeeSource===owner?me:null;
  const attendanceScope=`${scope}:${currentMe?.id??""}`;
  scopeRef.current=attendanceScope;
  const checkoutConfirmation=useBreakCheckoutConfirmation(attendanceScope);
  useEffect(()=>{
    setToday(null);setAttendanceSource(null);setNote(null);setAttendanceError(false);setBusy(null);runLock.current=false;
    if(!currentMe||!tenantId||!owner)return;
    let active=true;
    const employeeId=currentMe.id;
    const stop=onSnapshot(doc(db,COLLECTIONS.attendance(),`${tenantId}__${employeeId}__${date}`),snap=>{
      if(active&&scopeRef.current===attendanceScope){setAttendanceError(false);setToday(snap.exists()?(snap.data() as AttendanceRecord):null);setAttendanceSource(attendanceScope)}
    },()=>{if(active&&scopeRef.current===attendanceScope){setToday(null);setAttendanceSource(null);setAttendanceError(true)}});
    return()=>{active=false;stop()};
  },[currentMe?.id,owner,date,readAttempt]);
  const currentToday=attendanceSource===attendanceScope?today:null;
  const attendanceReady=!!currentMe&&attendanceSource===attendanceScope;
  const onBreak = !!currentToday?.breaks?.some((b) => !b.endedAt);
  const state = !currentToday?.checkInAt ? "Not checked in yet" : currentToday.checkOutAt ? `Checked out ${hhmm(currentToday.checkOutAt)} · ${Math.floor(currentToday.workedMinutes / 60)}h ${currentToday.workedMinutes % 60}m worked` : onBreak ? `On break · in since ${hhmm(currentToday.checkInAt)}` : `Working · in since ${hhmm(currentToday.checkInAt)}`;
  async function run(a: DayAction) {
    if (!attendanceReady||!owner||busy||runLock.current) return;
    const actionScope=attendanceScope;
    runLock.current=true;
    setBusy(a); setNote(null);
    try { if(a==="out"&&onBreak&&!await checkoutConfirmation.confirm())return;if(scopeRef.current!==actionScope)return;await httpsCallable(functions, CALL[a][0])(a==="out"&&onBreak?{endOpenBreak:true}:{}); if(scopeRef.current===actionScope)setNote(CALL[a][1]); }
    catch (e) { if(scopeRef.current===actionScope)setNote(dayErrorNote(e)); }
    finally { if(scopeRef.current===actionScope){runLock.current=false;setBusy(null);} }
  }
  return { readError:employeeError||attendanceError,retry:()=>setReadAttempt(n=>n+1),confirmDialog:checkoutConfirmation.dialog,ready: attendanceReady, noProfile: employeeSource===owner && meLoaded && !currentMe, state, onBreak, actions: attendanceReady?dayActions(currentToday):{in:false,bs:false,be:false,out:false}, busy, note:employeeError?"Staff details could not load. Tap Retry your day to check again.":attendanceError?"Today's attendance could not load. Tap Retry your day to check again.":note, run };
}
