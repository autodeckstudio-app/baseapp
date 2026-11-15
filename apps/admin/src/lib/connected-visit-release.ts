// Build-time intent and runtime SDK target checks are separate. No release
// activation value is committed. Demo preview remains independently fenced.
const project=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
export const CONNECTED_VISIT_LOCAL=process.env.NEXT_PUBLIC_RETAINED_TRANSPORT_PREVIEW==='true'&&project?.startsWith('demo-')===true&&process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR==='true';
export const CONNECTED_VISIT_RELEASE=process.env.NEXT_PUBLIC_CONNECTED_VISIT_RELEASE==='enabled'&&!!project&&!project.startsWith('demo-')&&process.env.NEXT_PUBLIC_CONNECTED_VISIT_RELEASE_PROJECT===project&&process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR!=='true';
export const CONNECTED_VISIT_ENABLED=CONNECTED_VISIT_LOCAL||CONNECTED_VISIT_RELEASE;
export function assertConnectedVisitTarget(sdk:{auth:any;db:any;functions:any}){
 const{auth,db,functions}=sdk;
 const local=auth.app.options.projectId?.startsWith('demo-')&&/^(localhost|127\.0\.0\.1):[0-9]+$/.test(db._settings?.host??'')&&/^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(functions.emulatorOrigin??'')&&!!auth.emulatorConfig;
 if(CONNECTED_VISIT_LOCAL&&local)return;
 if(CONNECTED_VISIT_RELEASE&&auth.app.options.projectId===project&&db.app===auth.app&&functions.app===auth.app&&!auth.emulatorConfig&&!functions.emulatorOrigin&&db._settings?.host==='firestore.googleapis.com'&&db._settings?.ssl!==false)return;
 throw Error('Connected visit unavailable.');
}
