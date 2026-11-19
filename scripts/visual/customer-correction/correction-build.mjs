import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../..');
const require=createRequire(path.join(root,'functions/package.json'));
const {build}=require('esbuild');
const customerRequire=createRequire(path.join(root,'apps/customer/package.json'));
const blurPath=path.join(path.dirname(customerRequire.resolve('expo-blur/package.json')),'build/BlurView.web.js');
await build({entryPoints:[dir+'/correction-entry.tsx'],bundle:true,jsx:'automatic',outfile:dir+'/correction-preview.js',nodePaths:[root+'/apps/customer/node_modules'],platform:'browser',format:'iife',define:{global:'globalThis','process.env':'{}',__DEV__:'false','process.env.NODE_ENV':'"production"'},loader:{'.js':'jsx','.ttf':'dataurl','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl'},plugins:[{name:'aliases',setup(b){
b.onLoad({filter:/^blur-web$/,namespace:'preview'},()=>({contents:`export {default as BlurView} from ${JSON.stringify(blurPath)}`,resolveDir:root,loader:'js'}));
b.onResolve({filter:/^react-native$/},()=>({path:customerRequire.resolve('react-native-web')}));
b.onResolve({filter:/^expo-blur$/},()=>({path:'blur-web',namespace:'preview'}));
b.onResolve({filter:/^expo-image-picker$/},()=>({path:'image-picker',namespace:'preview'}));
b.onLoad({filter:/^image-picker$/,namespace:'preview'},()=>({contents:'export const launchImageLibraryAsync=()=>{throw new Error("LOCAL PREVIEW ONLY")};export const requestMediaLibraryPermissionsAsync=async()=>({granted:false});',loader:'js'}));
b.onResolve({filter:/^expo-router$/},()=>({path:root+'/apps/customer/test/stubs/expo-router.ts'}));
b.onResolve({filter:/^react-native-safe-area-context$/},()=>({path:root+'/apps/customer/test/stubs/safe-area.ts'}));
b.onResolve({filter:/^react-native-is-edge-to-edge$/},()=>({path:'edge',namespace:'preview'}));
b.onLoad({filter:/^edge$/,namespace:'preview'},()=>({contents:'export const isEdgeToEdge=()=>false;export const controlEdgeToEdgeValues=()=>{};',loader:'js'}));

b.onResolve({filter:/^expo\/fetch$/},()=>({path:'expo-fetch',namespace:'preview'}));
b.onLoad({filter:/^expo-fetch$/,namespace:'preview'},()=>({contents:'export const fetch=(...a)=>globalThis.fetch(...a);',loader:'js'}));
b.onResolve({filter:/^expo$/},()=>({path:'expo-root',namespace:'preview'}));
b.onLoad({filter:/^expo-root$/,namespace:'preview'},()=>({contents:'export default {};',loader:'js'}));
b.onResolve({filter:/^expo-video$/},()=>({path:'expo-video',namespace:'preview'}));
b.onLoad({filter:/^expo-video$/,namespace:'preview'},()=>({contents:'export const useVideoPlayer=()=>null;export const VideoView=()=>null;',loader:'js'}));
b.onResolve({filter:/^expo-crypto$/},()=>({path:'expo-crypto',namespace:'preview'}));
b.onLoad({filter:/^expo-crypto$/,namespace:'preview'},()=>({contents:'export const randomUUID=()=>globalThis.crypto.randomUUID();',loader:'js'}));
b.onResolve({filter:/^expo-web-browser$/},()=>({path:'expo-wb',namespace:'preview'}));
b.onLoad({filter:/^expo-wb$/,namespace:'preview'},()=>({contents:'export const openBrowserAsync=async()=>({type:"cancel"});export const maybeCompleteAuthSession=()=>{};export const warmUpAsync=async()=>{};export const coolDownAsync=async()=>{};',loader:'js'}));
b.onResolve({filter:/^expo-status-bar$/},()=>({path:'expo-sb',namespace:'preview'}));
b.onLoad({filter:/^expo-sb$/,namespace:'preview'},()=>({contents:'export const StatusBar=()=>null;',loader:'js'}));

b.onResolve({filter:/^\.\/AppBar$/},()=>({path:root+'/apps/customer/test/stubs/app-bar.tsx'}));
b.onResolve({filter:/^firebase\/(auth|firestore)$/},()=>({path:dir+'/mocks.ts'}));
b.onResolve({filter:/\/(firebase|useAuth|useCustomerHome|vehicle-service|job-service|home-service|catalogue-service|paper-service|dev-garage-loader|i18n|pickup-service|auth-service)$/},()=>({path:dir+'/mocks.ts'}));
}}]});
