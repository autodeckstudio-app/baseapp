import{createHash}from'node:crypto';import{hash}from'./fingerprint.mjs';import{requiredCatalogueGuardTargets}from'./maintenance-plan.mjs';
interface Target{name:string;sourceSha256:string;serviceAccount:string;invokers:string[];environmentHash:string;timeoutSeconds:number;maxConcurrency:number;memory:string;cpu:string;oldRevision:string}
interface Manifest{mainCommit:string;runtimeDigest:string;targets:Target[];sourceHash:string;registryHash:string;carryReviewHash:string;mappingVersion:string;drainStartedAt:string;maxOldRequestSeconds:number}
interface Ports{readMain:()=>Promise<{sha:string;checksPassed:boolean}>;readFunction:(name:string)=>Promise<any>;readService:(name:string)=>Promise<any>;readPolicy:(name:string)=>Promise<any>;readArchive:(source:unknown)=>Promise<Uint8Array>;readOldRequestLogs:(filter:string)=>Promise<{entries?:unknown[];nextPageToken?:string}>;now:()=>Date}
/** Operator-only read adapter. Fixed approved manifest is generated from main
 * build and preflight, never accepted over the Admin callable. Each pass reads
 * actual artifacts, serving traffic, configuration, IAM and old-revision logs.
 * No platform mutation, credential switching or identity impersonation. */
export function catalogueDeploymentVerifier(manifest:Manifest,ports:Ports){
 const names=[...requiredCatalogueGuardTargets,'cataloguePriceSourceWorker','catalogueDescriptionResolver','catalogueDescriptionSourceWorker'];
 if(!/^[a-f0-9]{40}$/.test(manifest.mainCommit)||manifest.targets.length!==names.length||new Set(manifest.targets.map(t=>t.name)).size!==names.length||names.some(n=>!manifest.targets.some(t=>t.name===n))||manifest.targets.some(t=>!t.oldRevision||!/^[a-f0-9]{64}$/.test(t.sourceSha256)||!/^[a-f0-9]{64}$/.test(t.environmentHash)||!t.serviceAccount||!t.invokers.length)||manifest.maxOldRequestSeconds<540||!Number.isFinite(Date.parse(manifest.drainStartedAt)))throw Error('Exact main artifact and rollback preflight manifest required');
 return async()=>{
  const main=await ports.readMain();if(main.sha!==manifest.mainCommit||main.checksPassed!==true)throw Error('Exact validated main source required');
  const now=ports.now();if(now.getTime()-Date.parse(manifest.drainStartedAt)<manifest.maxOldRequestSeconds*1000)throw Error('Old request timeout not elapsed');
  const verified:Record<string,string>={};
  for(const target of manifest.targets){
   const f=await ports.readFunction(target.name),s=f.serviceConfig;
   if(f.state!=='ACTIVE'||f.buildConfig?.entryPoint!==target.name||!f.buildConfig?.source?.storageSource||s?.serviceAccountEmail!==target.serviceAccount||s.timeoutSeconds!==target.timeoutSeconds||s.maxInstanceRequestConcurrency!==target.maxConcurrency||s.availableMemory!==target.memory||s.availableCpu!==target.cpu||hash(s.environmentVariables)!==target.environmentHash||!s.allTrafficOnLatestRevision||!s.revision||s.revision===target.oldRevision||Date.parse(f.updateTime)>Date.parse(manifest.drainStartedAt))throw Error('Function artifact/configuration mismatch: '+target.name);
   const archive=await ports.readArchive(f.buildConfig.source.storageSource);if(createHash('sha256').update(archive).digest('hex')!==target.sourceSha256)throw Error('Serving archive differs from validated main: '+target.name);
   const run=await ports.readService(s.service),traffic=run.trafficStatuses;
   if(run.reconciling||run.latestReadyRevision?.split('/').pop()!==s.revision||!Array.isArray(traffic)||traffic.length!==1||traffic[0].percent!==100||traffic[0].revision?.split('/').pop()!==s.revision)throw Error('Serving traffic not exclusively verified revision: '+target.name);
   const policy=await ports.readPolicy(s.service),bindings=policy.bindings??[],invokers=bindings.filter((b:any)=>b.role==='roles/run.invoker');if(invokers.length!==1||invokers[0].condition||hash([...invokers[0].members].sort())!==hash([...target.invokers].sort()))throw Error('Exact invoker IAM mismatch: '+target.name);
   const logs=await ports.readOldRequestLogs('resource.type="cloud_run_revision" AND resource.labels.service_name="'+s.service.split('/').pop()+'" AND resource.labels.revision_name="'+target.oldRevision+'" AND logName="projects/autodeck-studio/logs/run.googleapis.com%2Frequests" AND timestamp>="'+manifest.drainStartedAt+'"');
   if(logs.nextPageToken||(logs.entries?.length??0)>0)throw Error('Old revision request observed or logs incomplete: '+target.name);
   verified[target.name]=hash({archive:target.sourceSha256,revision:s.revision,service:s.service,principal:s.serviceAccountEmail,environmentHash:target.environmentHash,invokers:target.invokers});
  }
  return{mainCommit:manifest.mainCommit,runtimeDigest:manifest.runtimeDigest,allTargetsDigest:hash(verified),guardDigests:Object.fromEntries(requiredCatalogueGuardTargets.map(n=>[n,verified[n]!])),drainStartedAt:manifest.drainStartedAt,observedAt:now.toISOString(),maxOldRequestSeconds:manifest.maxOldRequestSeconds,sourceHash:manifest.sourceHash,registryHash:manifest.registryHash,carryReviewHash:manifest.carryReviewHash,mappingVersion:manifest.mappingVersion};
 };
}
