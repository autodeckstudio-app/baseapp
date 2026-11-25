import {z} from 'zod';
import {googleCatalogueIdentityVerifier} from './catalogue-google-identity.js';
import {attachedCatalogueRuntimeIdentity,CATALOGUE_CONTROLLER} from './catalogue-runtime-composition.js';
import {PRICE_SOURCE_WRITER} from './price-list-google-sheets.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const intent=z.object({operation:z.enum(['resolve-inspection','resolve-attempt','claim-attempt','resolve-qualification','claim-qualification']),operationId:id}).strict();
interface ResolverStore{resolveQualification:(id:string)=>Promise<unknown>;claimQualification:(id:string)=>Promise<unknown>;resolveInspection:(id:string)=>Promise<unknown>;resolveAttempt:(id:string)=>Promise<unknown>;claimAttempt:(id:string)=>Promise<{claimed:boolean;reviewHash:string}>}
interface Request{method:string;authorization?:string;body:unknown}
/** Private handler factory only, deliberately no production export. The store
 * must resolve its own durable operation/current locks, never caller-shaped
 * plan data. Exact attached controller and writer ID-token checks retain the
 * isolated writer's Sheets-only authority. Missing config fails closed. */
export async function composeDescriptionResolver(config:{audience:string;writerPrincipal:string},store:ResolverStore){
 if(config.writerPrincipal!==PRICE_SOURCE_WRITER)throw Error('Exact isolated source writer required');
 await attachedCatalogueRuntimeIdentity(CATALOGUE_CONTROLLER);
 const verify=googleCatalogueIdentityVerifier({audience:config.audience,controllerPrincipal:PRICE_SOURCE_WRITER});
 return async(req:Request)=>{if(req.method!=='POST')return{status:405,body:{error:'Method unavailable'}};try{
 if(!req.authorization?.startsWith('Bearer ')||req.authorization.length>16384)throw Error('Platform identity required');
 await verify(req.authorization.slice(7),config.audience);const p=intent.parse(req.body);
 const result=await store[p.operation==='resolve-qualification'?'resolveQualification':p.operation==='claim-qualification'?'claimQualification':p.operation==='resolve-inspection'?'resolveInspection':p.operation==='resolve-attempt'?'resolveAttempt':'claimAttempt'](p.operationId);
 return{status:200,body:{operationId:p.operationId,operation:p.operation,result}};
 }catch{return{status:403,body:{error:'Private description operation refused'}}}};
}
