import type { OperatingHours } from './types/studio.js';
/** Pure display clock. Never prices, books or changes a stored timestamp. Invalid zones fail closed. */
export function studioClock(now:Date,timezone:string|null|undefined):{date:string;day:number;minute:number}|null{
 if(!timezone||!Number.isFinite(now.getTime()))return null;
 try{
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value=(key:string)=>p.find(part=>part.type===key)?.value??'';
  const date=`${value('year')}-${value('month')}-${value('day')}`;
  return{date,day:new Date(`${date}T12:00:00Z`).getUTCDay(),minute:Number(value('hour'))*60+Number(value('minute'))};
 }catch{return null;}
}
const minute=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
const clock=(value:string)=>{const h=Number(value.slice(0,2)),m=Number(value.slice(3));return `${h%12||12}${m?`:${String(m).padStart(2,'0')}`:''} ${h<12?'am':'pm'}`;};
const shiftDate=(date:string,days:number)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
/** Studio wall-clock opening status. Same-day hours only, matching the booking engine's grid. */
export function studioOpenStatus(hours:readonly OperatingHours[]|null|undefined,holidays:readonly string[],timezone:string|null|undefined,now:Date=new Date()):{open:boolean;text:string}|null{
 const local=studioClock(now,timezone);
 if(!local||!hours?.length||hours.some(h=>!Number.isInteger(h.dayOfWeek)||h.dayOfWeek<0||h.dayOfWeek>6)||hours.some(h=>!h.closed&&(!Number.isFinite(minute(h.open))||!Number.isFinite(minute(h.close))||minute(h.close)<=minute(h.open))))return null;
 if(new Set(hours.map(h=>h.dayOfWeek)).size!==hours.length)return null;
 const byDay=new Map(hours.map(h=>[h.dayOfWeek,h]));
 const today=byDay.get(local.day as OperatingHours['dayOfWeek']);
 if(today&&!today.closed&&!holidays.includes(local.date)){
  if(local.minute>=minute(today.open)&&local.minute<minute(today.close))return{open:true,text:`Open now, until ${clock(today.close)}`};
  if(local.minute<minute(today.open))return{open:false,text:`Closed, opens ${clock(today.open)}`};
 }
 for(let i=1;i<=7;i++){
  const date=shiftDate(local.date,i),day=(local.day+i)%7;
  const nextHours=byDay.get(day as OperatingHours['dayOfWeek']);
  if(nextHours&&!nextHours.closed&&!holidays.includes(date))return{open:false,text:`Closed, opens ${i===1?'tomorrow':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]} ${clock(nextHours.open)}`};
 }
 return{open:false,text:'Closed'};
}
