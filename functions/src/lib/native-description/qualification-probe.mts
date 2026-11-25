import{hash}from'./fingerprint.mjs';
interface Resolver{resolveQualification:(id:string)=>Promise<any>;claimQualification:(id:string)=>Promise<any>}
/** Actual writer-to-controller route, deliberately separate from the writer.
 * No access-token acquisition, batchUpdate, saved description plan or write
 * adapter is reachable from this function. Replay must be refused. */
export async function runDescriptionQualificationProbe(id:string,resolver:Resolver,read:()=>Promise<any>){
 if(!/^qualification_[a-f0-9]{32}$/.test(id))throw Error('Exact qualification identifier required');
 const q=await resolver.resolveQualification(id);
 if(q?.kind!=='description-no-effect-qualification-v1'||q.id!==id||q.sourceEffectsAllowed!==false||Object.keys(q).sort().join('|')!=='id|kind|mappingVersion|registryHash|runtimeDigest|sourceEffectsAllowed|sourceHash')throw Error('Exact no-effect qualification required');
 const before=await read();if(before.sourceHash!==q.sourceHash||before.raw.commentsViewMode!=='COMMENTS_VIEW_MODE_INCLUDED'||before.raw.comments?.length)throw Error('Exact structural preimage required');
 const first=await resolver.claimQualification(id),replay=await resolver.claimQualification(id);
 if(first?.id!==id||first.claimed!==true||first.sourceEffectsAllowed!==false||replay?.id!==id||replay.claimed!==false||replay.sourceEffectsAllowed!==false)throw Error('One-time qualification claim and replay refusal required');
 const after=await read();if(after.sourceHash!==before.sourceHash)throw Error('Source changed during no-effect qualification');
 const body={id,kind:q.kind,sourceHash:after.sourceHash,runtimeDigest:q.runtimeDigest,mappingVersion:q.mappingVersion,registryHash:q.registryHash,oneTimeClaimVerified:true,replayRefused:true,sourceEffects:0};return{...body,protocolHash:hash(body)};
}
