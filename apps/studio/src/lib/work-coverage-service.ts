// Private read adapter only. Not mounted or activated in a production route.
import{httpsCallable}from'firebase/functions';import{parseJobWorkCoverage,type JobWorkCoverage}from'@autodeck/core';import{functions}from'./firebase';
export async function getStaffJobWorkCoverage(jobId:string):Promise<JobWorkCoverage>{const{data}=await httpsCallable<{jobId:string},JobWorkCoverage>(functions,'getStaffJobWorkCoverage',{timeout:15000})({jobId});return parseJobWorkCoverage(data,jobId,false)}
