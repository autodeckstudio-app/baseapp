import type {ServiceJob} from './types/job.js';
/** Stable across a lost acknowledgement, but never across a newer job snapshot.
 * The server stores an exact, actor-bound receipt and checks every stage guard. */
export function jobStageCommand(job:Pick<ServiceJob,'status'|'updatedAt'>,rework=false){
 if(!job.updatedAt)throw new Error('Reload the current job before changing its stage.');
 return {expectedStatus:job.status,expectedUpdatedAt:job.updatedAt,operationId:`${job.status}:${job.updatedAt}:${rework?'rework':'forward'}`};
}
