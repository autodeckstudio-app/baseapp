/** Per-instance conservative read pacing for the isolated source identity.
 * Worker concurrency/maxInstances are both1. Reads are spaced1.1s, writes are
 * never retried. A cold restart does not preserve quota history, so Google429
 * still fails closed and remains an operational check, not a free quota grant.
 */
export function pacePriceSourceHttp(http:typeof fetch=fetch,options:{now?:()=>number;sleep?:(ms:number)=>Promise<void>}={}):typeof fetch{let lastRead:number|null=null;const now=options.now??Date.now,sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));return async(input,init)=>{if((init?.method??'GET')==='GET'){if(lastRead!==null){const wait=1100-(now()-lastRead);if(wait>0)await sleep(wait);}lastRead=now();}return http(input,init);};}
