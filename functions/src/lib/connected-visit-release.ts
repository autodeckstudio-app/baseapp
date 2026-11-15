import{HttpsError}from'firebase-functions/v2/https';
/** No activation is committed. An explicit exact-project release setting is
 * required independently of exports. This never enables provider adapters. */
export function assertConnectedVisitRuntime(){
 const project=process.env['GCLOUD_PROJECT']??'',emulator=process.env['FUNCTIONS_EMULATOR']==='true';
 if(emulator&&project.startsWith('demo-'))return;
 if(!emulator&&project&&!project.startsWith('demo-')&&process.env['CONNECTED_VISIT_RELEASE']==='enabled'&&process.env['CONNECTED_VISIT_RELEASE_PROJECT']===project)return;
 throw new HttpsError('failed-precondition','Connected visit release is not active.');
}
