import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
/** Attendance callables use Asia/Kolkata, not the device timezone or mutable studio config. */
export function attendanceDate(now:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(key:string)=>parts.find(p=>p.type===key)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function useStudioDay(){
 const [date,setDate]=useState(()=>attendanceDate());
 useEffect(()=>{
  const update=()=>{if(AppState.currentState==='active'||AppState.currentState===null)setDate(attendanceDate())};
  const timer=setInterval(update,30_000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active')setDate(attendanceDate())});
  update();
  return()=>{clearInterval(timer);sub.remove()};
 },[]);
 return date;
}
