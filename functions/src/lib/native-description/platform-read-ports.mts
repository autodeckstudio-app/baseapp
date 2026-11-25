interface Auth{googleAccessToken:()=>Promise<string>;githubAccessToken:()=>Promise<string>}
/** Read-only fixed-project platform transport. Tokens are supplied by the
 * operator's existing authorized login, never accepted from a client body,
 * metadata impersonation, alternate principal or a new access grant. */
export function cataloguePlatformReadPorts(auth:Auth,http:typeof fetch=fetch){
 async function json(url:string,kind:'google'|'github',body?:unknown):Promise<any>{const token=await(kind==='google'?auth.googleAccessToken():auth.githubAccessToken());if(!token||/[\r\n]/.test(token))throw Error('Existing authorized account unavailable');const r=await http(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(kind==='github'?{Accept:'application/vnd.github+json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Platform evidence unavailable '+r.status);return r.json()}
 function service(name:string){if(!/^projects\/autodeck-studio\/locations\/asia-south1\/services\/[a-z0-9-]+$/.test(name))throw Error('Fixed catalogue service required');return name}
 return{
  async readMain(){const ref=await json('https://api.github.com/repos/autodeckstudio-app/baseapp/git/ref/heads/main','github'),sha=ref.object?.sha;if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('Exact main source unavailable');const checks=await json('https://api.github.com/repos/autodeckstudio-app/baseapp/commits/'+sha+'/check-runs?per_page=100','github');if(checks.total_count>100)throw Error('Main checks require complete inspection');return{sha,checksPassed:['validate','emulator'].every(name=>checks.check_runs?.some((c:any)=>c.name===name&&c.status==='completed'&&c.conclusion==='success'))}},
  readFunction(name:string){if(!/^[A-Za-z][A-Za-z0-9]+$/.test(name))throw Error('Exact function identifier required');return json('https://cloudfunctions.googleapis.com/v2/projects/autodeck-studio/locations/asia-south1/functions/'+name,'google')},
  readService:async(name:string)=>json('https://run.googleapis.com/v2/'+service(name),'google'),
  readPolicy:async(name:string)=>json('https://run.googleapis.com/v2/'+service(name)+':getIamPolicy','google'),
  async readArchive(value:unknown){const s=value as{bucket?:string;object?:string;generation?:string};if(s?.bucket!=='gcf-v2-sources-24903853329-asia-south1'||typeof s.object!=='string'||!s.object.endsWith('/function-source.zip')||!/^[0-9]+$/.test(s.generation??''))throw Error('Exact versioned function archive required');const token=await auth.googleAccessToken(),r=await http('https://storage.googleapis.com/storage/v1/b/'+s.bucket+'/o/'+encodeURIComponent(s.object)+'?alt=media&generation='+s.generation,{method:'GET',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+token}});if(!r.ok||Number(r.headers.get('content-length'))>64_000_000)throw Error('Complete versioned archive unavailable');const b=new Uint8Array(await r.arrayBuffer());if(!b.length||b.length>64_000_000)throw Error('Complete bounded archive required');return b},
  readOldRequestLogs:(filter:string)=>json('https://logging.googleapis.com/v2/entries:list','google',{resourceNames:['projects/autodeck-studio'],filter,pageSize:1,orderBy:'timestamp desc'}),
  now:()=>new Date(),
 };
}
