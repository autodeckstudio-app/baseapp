import {createHash} from 'node:crypto';
import {workSnapshotSchema} from './work-snapshot-schema.js';
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,value])=>[k,canonical(value)])):v;
/** Staff review binds an exact validated snapshot, not merely the job clock.
 * Object key order may change when Firestore serializes the same document. */
export function visitWorkReview(raw:unknown):{revision:number;hash:string}|null{
 const parsed=workSnapshotSchema.safeParse(raw);if(!parsed.success)return null;
 return{revision:parsed.data.ledger.revision,hash:createHash('sha256').update(JSON.stringify(canonical(parsed.data))).digest('hex')};
}
