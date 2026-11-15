import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function guardCatalogue(mapping,snapshot,enquiries){
 const allow=(row,keys)=>{if(Object.keys(row).some(key=>!keys.includes(key)))throw Error('Unexpected public field');};
 for(const row of snapshot.services)allow(row,['id','name','brand','category','description','priceOnRequest','coverageLevel']);
 for(const row of enquiries)allow(row,['key','brand','name','group','note','source','surface','level']);
 const ids=new Set(snapshot.services.map(x=>x.id));const asks=new Set(enquiries.map(x=>x.key));const seen=new Set();
 if(ids.size!==snapshot.services.length||asks.size!==enquiries.length)throw Error('Duplicate public identity');
 if(mapping.schemaVersion!==undefined&&mapping.schemaVersion!==1)throw Error('Unsupported source schema');
 for(const row of mapping.rows){
  if(!row.key||seen.has(row.key))throw Error('Duplicate/missing source row');seen.add(row.key);
  if(row.serviceId&&!ids.has(row.serviceId))throw Error(`Unresolved service ${row.key}`);
  if(row.enquiryKey&&!asks.has(row.enquiryKey))throw Error(`Unresolved enquiry ${row.key}`);
  if(row.status==='unmapped')throw Error(`Unmapped source ${row.key}`);
 }
 for(const enquiry of enquiries)if(!mapping.rows.some(row=>row.enquiryKey===enquiry.key))throw Error(`Enquiry lacks source mapping ${enquiry.key}`);
 return {sourceRows:seen.size,services:ids.size,enquiries:asks.size,mode:'checked-local-source-not-live-sync'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
 console.log(guardCatalogue(read('docs/catalogue-source-mapping.json'),read('packages/core/src/public-service-catalogue.json'),read('packages/core/src/brand-enquiries.json')));
}
