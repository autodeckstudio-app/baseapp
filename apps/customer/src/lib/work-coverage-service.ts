import{httpsCallable}from'firebase/functions';
import{parseJobWorkCoverage,type JobWorkCoverage}from'@autodeck/core';
export type{JobWorkCoverage}from'@autodeck/core';
import{functions}from'./firebase';
// Private candidate. Server callables are deliberately unexported/unactivated.
export async function getJobWorkCoverage(jobId:string,mode:'self'|'staff'):Promise<JobWorkCoverage>{
 const name=mode==='self'?'getMyJobWorkCoverage':'getStaffJobWorkCoverage';
 const {data}=await httpsCallable<{jobId:string},JobWorkCoverage>(functions,name,{timeout:15000})({jobId});
 return parseJobWorkCoverage(data,jobId,mode==='self');
}
