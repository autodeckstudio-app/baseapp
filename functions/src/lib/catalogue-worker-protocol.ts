import type {PublicBatchReadRequest as ReviewedType0} from './catalogue-public-sheet.js';
import type {PublicBatchReadResult as ReviewedType1} from './catalogue-public-sheet.js';
import type {ReviewedPublicChange as ReviewedType2} from './catalogue-public-sheet.js';
import{publicRowHash,PublicServiceRowMissing}from'./catalogue-public-sheet.js';import{z}from'zod';import{catalogueReviewHash}from'./catalogue-draft.js';import type{PublicContentRow}from'./catalogue-public-sheet.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),digest=z.string().regex(/^[a-f0-9]{64}$/);const cell=z.string().max(2000).refine(v=>!/^[=+@]/.test(v.trim()),'Formula-like content refused');
const publicRow=z.object({serviceId:id,name:cell.refine(v=>!!v.trim()),brand:cell.nullable(),description:cell.refine(v=>!!v.trim()),active:z.boolean()}).strict();
export const workerIntentSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('apply-reviewed-public-batch'),tenantId:z.literal('automodz'),publishId:id,entries:z.array(z.object({draftId:id,reviewHash:digest,row:publicRow,expectedRowHash:digest.optional(),expectedTabHash:digest.optional(),destination:z.enum(['Ceramic','Coatings','Garage','Modifications and wraps','Paint Protection','Pickup and drop','Wash and care']).optional()}).strict()).min(1).max(80),intentHash:digest}).strict(),
 z.object({operation:z.literal('read-public-batch'),tenantId:z.literal('automodz'),requests:z.array(z.object({serviceId:id,destination:z.enum(['Ceramic','Coatings','Garage','Modifications and wraps','Paint Protection','Pickup and drop','Wash and care']).optional()}).strict()).min(1).max(80)}).strict(),
 z.object({operation:z.literal('read-public-row'),serviceId:id,tenantId:z.literal('automodz')}).strict(),
 z.object({operation:z.literal('inspect-existing-public-row'),serviceId:id,tenantId:z.literal('automodz')}).strict(),
 z.object({operation:z.literal('inspect-new-public-row'),serviceId:id,tenantId:z.literal('automodz'),destination:z.enum(['Ceramic','Coatings','Garage','Modifications and wraps','Paint Protection','Pickup and drop','Wash and care'])}).strict(),
 z.object({operation:z.literal('append-reviewed-public-rows'),tenantId:z.literal('automodz'),publishId:id,entries:z.array(z.object({draftId:id,reviewHash:digest,row:publicRow}).strict()).min(1).max(8),expectedTabHash:digest,destination:z.enum(['Ceramic','Coatings','Garage','Modifications and wraps','Paint Protection','Pickup and drop','Wash and care']),intentHash:digest}).strict(),
 z.object({operation:z.literal('append-reviewed-public-row'),tenantId:z.literal('automodz'),publishId:id,draftId:id,reviewHash:digest,expectedTabHash:digest,destination:z.enum(['Ceramic','Coatings','Garage','Modifications and wraps','Paint Protection','Pickup and drop','Wash and care']),row:publicRow,intentHash:digest}).strict(),
 z.object({operation:z.literal('write-reviewed-public-row'),tenantId:z.literal('automodz'),publishId:id,draftId:id,reviewHash:digest,expectedRowHash:digest,row:publicRow,intentHash:digest}).strict(),
]);
export interface WorkerAuthContext{verified:boolean;audience:string;principal:string}
interface WorkerPort{readMany?:(requests:ReviewedType0[])=>Promise<ReviewedType1[]>;writeReviewedBatch?:(changes:ReviewedType2[])=>Promise<{serviceId:string;rowHash:string}[]>;writeNewReviewedBatch?:(rows:PublicContentRow[],destination:string,hash:string)=>Promise<{serviceId:string;rowHash:string}[]>;inspectNewRow?:(id:string,destination:string)=>Promise<{serviceId:string;destination:string;expectedTabHash:string}>;writeNewReviewed?:(row:PublicContentRow,destination:string,hash:string)=>Promise<{serviceId:string;rowHash:string}>;read:(id:string)=>Promise<{hash:string;cells:unknown[]}>;writeReviewed:(row:PublicContentRow,expected:string)=>Promise<{serviceId:string;rowHash:string}>}
/** Internal protocol, NOT an HTTP endpoint or proof of Google IAM. A deployed
 * adapter must construct auth from verified platform identity, never request
 * JSON/headers. Named controller authorizes frozen review from its durable DB.
 * Worker has public-book authority only and cannot independently read that DB.
 * No generic Google URL/book/range/structural operation is represented here.
 */
export async function handleCatalogueWorkerIntent(raw:unknown,auth:WorkerAuthContext,config:{audience:string;controllerPrincipal:string},port:WorkerPort){
 if(!auth.verified||auth.audience!==config.audience||auth.principal!==config.controllerPrincipal||!config.audience||!config.controllerPrincipal)throw Error('Verified controller required');
 const intent=workerIntentSchema.parse(raw);
 if(intent.operation==='read-public-batch'){if(!port.readMany)throw Error('Batch read unavailable');return port.readMany(intent.requests);}
 if(intent.operation==='read-public-row'){const found=await port.read(intent.serviceId);if(found.cells.length!==5||found.cells[0]!==intent.serviceId||found.hash!==publicRowHash(found.cells))throw Error('Public row mismatch');return{serviceId:intent.serviceId,rowHash:found.hash,cells:found.cells};}
 if(intent.operation==='inspect-existing-public-row'){try{const found=await port.read(intent.serviceId);if(found.cells.length!==5||found.cells[0]!==intent.serviceId||found.hash!==publicRowHash(found.cells))throw Error('Public row mismatch');return{serviceId:intent.serviceId,present:true as const,rowHash:found.hash,cells:found.cells};}catch(e){if(e instanceof PublicServiceRowMissing&&e.serviceId===intent.serviceId)return{serviceId:intent.serviceId,present:false as const};throw e;}}
 if(intent.operation==='inspect-new-public-row'){if(!port.inspectNewRow)throw Error('New-row inspection unavailable');const found=await port.inspectNewRow(intent.serviceId,intent.destination);if(found.serviceId!==intent.serviceId||found.destination!==intent.destination||!/^[a-f0-9]{64}$/.test(found.expectedTabHash))throw Error('Exact new-row snapshot required');return{serviceId:found.serviceId,destination:found.destination,expectedTabHash:found.expectedTabHash};}
 const{intentHash,...body}=intent;if(catalogueReviewHash(body)!==intentHash)throw Error('Frozen intent digest mismatch');
 if(intent.operation==='apply-reviewed-public-batch'){if(!port.writeReviewedBatch||new Set(intent.entries.map(e=>e.row.serviceId)).size!==intent.entries.length||new Set(intent.entries.map(e=>e.draftId)).size!==intent.entries.length)throw Error('Exact batch writer required');return port.writeReviewedBatch(intent.entries.map(({row,expectedRowHash,expectedTabHash,destination})=>({row,expectedRowHash,expectedTabHash,destination})));}
 if(intent.operation==='append-reviewed-public-rows'){if(!port.writeNewReviewedBatch||new Set(intent.entries.map(e=>e.row.serviceId)).size!==intent.entries.length||new Set(intent.entries.map(e=>e.draftId)).size!==intent.entries.length)throw Error('Exact grouped writer required');return port.writeNewReviewedBatch(intent.entries.map(e=>e.row),intent.destination,intent.expectedTabHash);}
 if(intent.operation==='append-reviewed-public-row'){if(!port.writeNewReviewed)throw Error('New-row writer unavailable');return port.writeNewReviewed(intent.row,intent.destination,intent.expectedTabHash);}
 return port.writeReviewed(intent.row,intent.expectedRowHash);
}
