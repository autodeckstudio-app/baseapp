import{createHash}from'node:crypto';
export const FILE='15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0';
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export const hash=x=>createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
export function registryBody(bindings){const body={tenantId:'automodz',schema:1,bindings:structuredClone(bindings)};return{...body,version:'registry_'+hash(body).slice(0,40)}}
