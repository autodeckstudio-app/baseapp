import { isDateOnly } from "./document-validation";
export function todayStudioDate(): string {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const value=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${value("year")}-${value("month")}-${value("day")}`;
}
export function validAppliedDate(value:string):boolean {const v=value.trim();return v===""||(isDateOnly(v)&&v<=todayStudioDate());}
