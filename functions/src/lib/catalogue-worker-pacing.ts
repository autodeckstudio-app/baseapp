/**
 * Controller-side pacing for the private catalogue worker. The worker performs
 * 8 Sheets reads per row lookup and ~17 calls per reviewed write, all as one
 * service-account identity, so unpaced bursts exceed the Sheets per-identity
 * per-minute quota and surface as opaque worker 403s. This wrapper spaces sends
 * out and retries only idempotent read/inspect intents. Write intents are
 * never retried: their remote outcome is unknown after a failure, and the
 * existing recovery readback flow owns that case.
 */
type Send=(intent:unknown)=>Promise<unknown>;

export interface CatalogueWorkerPacingOptions{
  minReadIntervalMs?:number;
  minWriteIntervalMs?:number;
  maxReadAttempts?:number;
  sleep?:(ms:number)=>Promise<void>;
  now?:()=>number;
}

const WRITE_OPS=new Set(['write-reviewed-public-row','append-reviewed-public-row','append-reviewed-public-rows','apply-reviewed-public-batch']);

export function paceCatalogueWorkerSend(send:Send,opts:CatalogueWorkerPacingOptions={}):Send{
  const minRead=opts.minReadIntervalMs??9000;
  const minWrite=opts.minWriteIntervalMs??20000;
  const maxReadAttempts=opts.maxReadAttempts??4;
  const sleep=opts.sleep??((ms:number)=>new Promise<void>(r=>setTimeout(r,ms)));
  const now=opts.now??(()=>Date.now());
  let lastAt:number|null=null;
  let lastWrite=false;
  return async(raw:unknown)=>{
    const op=(raw as {operation?:string}|null|undefined)?.operation??'';
    const isWrite=WRITE_OPS.has(op);
    const attempts=isWrite?1:maxReadAttempts;
    let lastError:unknown=null;
    for(let attempt=1;attempt<=attempts;attempt++){
      if(lastAt!==null){
        const floor=lastWrite?minWrite:minRead;
        const wait=floor-(now()-lastAt);
        if(wait>0)await sleep(wait);
      }
      lastAt=now();
      try{
        const result=await send(raw);
        lastWrite=isWrite;
        return result;
      }catch(error){
        lastWrite=isWrite;
        lastError=error;
        if(!isWrite&&attempt<attempts)await sleep(Math.min(15000*attempt,90000));
      }
    }
    throw lastError;
  };
}
