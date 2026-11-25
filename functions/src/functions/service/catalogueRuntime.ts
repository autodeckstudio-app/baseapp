import{PRICE_SOURCE_ACTIVE,activePriceSourceMapping}from'../../lib/price-list-activation.js';
import{composePrivatePriceControllers}from'../../lib/price-list-runtime.js';
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { createManagedCatalogueCallables } from "./catalogueManaged.js";
import { composePrivateCatalogueWorker, composePrivateCatalogueController, CATALOGUE_CONTROLLER } from "../../lib/catalogue-runtime-composition.js";
const priceWorkerOrigin=defineString("CATALOGUE_PRICE_WORKER_ORIGIN",{default:"",description:"Exact private source-price worker origin. Inactive until reviewed activation."});
export function priceWorkerConfig(){const origin=priceWorkerOrigin.value(),u=new URL(origin);if(u.protocol!=="https:"||u.origin!==origin||u.username||u.password)throw Error("Exact source worker origin required");return{audience:origin,endpoint:origin+"/"};}
const workerOrigin=defineString("CATALOGUE_WORKER_ORIGIN",{default:"",description:"Exact deployed private catalogue worker HTTPS origin, no slash/path/query. No default or broad-account fallback."});
export function catalogueWorkerConfig(){const origin=workerOrigin.value();const u=new URL(origin);if(u.protocol!=="https:"||u.origin!==origin||u.username||u.password)throw Error("Exact private worker origin required");return{audience:origin,endpoint:origin+"/",controllerPrincipal:CATALOGUE_CONTROLLER};}
export const {getManagedCataloguePublishStatus,reviewManagedCatalogue,publishManagedCatalogue,inspectManagedCatalogueRecovery,reviewManagedCatalogueRecovery,finishManagedCatalogueRecovery}=createManagedCatalogueCallables(async actor=>PRICE_SOURCE_ACTIVE?(await composePrivatePriceControllers(getFirestore(),{projection:catalogueWorkerConfig(),source:priceWorkerConfig()},activePriceSourceMapping(),actor)).catalogue:composePrivateCatalogueController(getFirestore(),catalogueWorkerConfig(),actor));
export const cataloguePublicSheetWorker=onRequest({region:"asia-south1",serviceAccount:"catalogue-public-writer@autodeck-studio.iam.gserviceaccount.com",invoker:[CATALOGUE_CONTROLLER],maxInstances:1,minInstances:0,timeoutSeconds:60},async(req,res)=>{try{const handler=await composePrivateCatalogueWorker(catalogueWorkerConfig());const result=await handler({method:req.method,...(req.get("authorization")?{authorization:req.get("authorization")!}:{}),body:req.body});res.status(result.status).json(result.body);}catch{res.status(503).json({error:"Private catalogue worker unavailable"});}});
