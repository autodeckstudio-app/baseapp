import {getFirestore} from 'firebase-admin/firestore';
import {jobStageCommand} from '@autodeck/core';
import {advanceJobStatus as callable} from '../../functions/job/advanceJobStatus.js';
/** Existing domain fixtures take a fresh operator snapshot before each action.
 * Stale/retry/concurrency contract tests use the raw callable and frozen payloads. */
export const stageFixture={run:async(request:any)=>{
 const snap=await getFirestore().collection('jobs').doc(request.data.jobId).get();
 const j=snap.data();
 return callable.run({...request,data:{...jobStageCommand(j?{status:j['status'],updatedAt:j['updatedAt']??'fixture-missing-version'}:{status:'PENDING_VEHICLE',updatedAt:'fixture-missing'}),...request.data}});
}};

export {stageFixture as advanceJobStatus};
