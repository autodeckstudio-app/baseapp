import type {VisitRead} from './visit-read';
import {sharedVisitLabel} from './visit-read';
/** Feed the existing four-step tracker. No per-service Ready may become a
 * collection promise, and unknown work cannot fill the fourth step. */
export function visitProgress(view:Extract<VisitRead,{status:'grouped'}>){
 const active=view.members.filter(m=>m.status!=='CANCELLED');
 const rank=(s:string)=>({PENDING_VEHICLE:0,STANDBY:1,VEHICLE_RECEIVED:1,IN_PROGRESS:2,QUALITY_CHECK:3,READY_FOR_DELIVERY:4,DELIVERED:5}[s]??0);
 const least=active.length?Math.min(...active.map(m=>rank(m.status))):0;
 const status=view.state==='delivered'?'DELIVERED':view.state==='ready'||view.state==='handover_incomplete'?'READY_FOR_DELIVERY':view.state==='cancelled'?'CANCELLED':least>=3?'QUALITY_CHECK':least===2?'IN_PROGRESS':least===1?'VEHICLE_RECEIVED':'PENDING_VEHICLE';
 const history:{status:string;changedAt:string}[]=[];
 for(const step of ['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED']){
  // Only use factual member histories, and only when every active service
  // has reached that milestone. Never borrow one service's ready time.
  if(step==='READY_FOR_DELIVERY'&&!['ready','delivered'].includes(view.state)||step==='DELIVERED'&&view.state!=='delivered')continue;
  const dates=active.map(m=>m.history.filter(h=>h.status===step).map(h=>h.changedAt).sort().at(-1));
  if(active.length&&dates.every((d):d is string=>!!d))history.push({status:step,changedAt:dates.sort().at(-1)!});
 }
 return{status,history,headline:sharedVisitLabel(view.state),line:`${active.length} services · One visit`,services:view.members.map(m=>({id:m.jobId,name:m.lines.map(l=>l.name).join(' + '),status:m.serviceStatus})),finalLabel:view.state==='handover_incomplete'?'Handover incomplete':undefined};
}
/** A job status is not proof its recorded work is complete. Use the reviewed
 * member label, which can hold READY_FOR_DELIVERY at Check work or paused. */
export function visitReviewedServiceStage(view:VisitRead|null|undefined,jobId:string,error=false):string{
 return view?.status==='grouped'?view.members.find(m=>m.jobId===jobId)?.serviceStatus??'Check service':error?'Visit unavailable':'Checking service…';
}
