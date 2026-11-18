import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../..');
const require=createRequire(path.join(root,'functions/package.json'));
const {build}=require('esbuild');
const customerRequire=createRequire(path.join(root,'apps/customer/package.json'));
const blurPath=path.join(path.dirname(customerRequire.resolve('expo-blur/package.json')),'build/BlurView.web.js');
await build({entryPoints:[dir+'/entry.tsx'],bundle:true,jsx:'automatic',outfile:'/downloads/ad-customer-theme-preview/'+(process.env.CURRENT==='1'?'current':'proposed')+'.js',nodePaths:[root+'/apps/customer/node_modules'],platform:'browser',format:'iife',define:{global:'globalThis','process.env':'{}',__DEV__:'false','process.env.NODE_ENV':'"production"'},loader:{'.js':'jsx','.ttf':'dataurl','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl'},plugins:[{name:'aliases',setup(b){
b.onResolve({filter:/\/(ServiceProductSelection|ServicesExplorer|ServiceJourney|ProtectionFamilyIntro|service-action-surface)$/},args=>process.env.CURRENT==='1'?{path:'/tmp/ad-clean-publish-preview/apps/customer/src/'+(args.path.includes('service-action-surface')?'lib/':'ui/')+args.path.split('/').at(-1)+(args.path.includes('service-action-surface')?'.ts':'.tsx')}:null);
b.onLoad({filter:/^blur-web$/,namespace:'preview'},()=>({contents:`export {default as BlurView} from ${JSON.stringify(blurPath)}`,resolveDir:root,loader:'js'}));
b.onResolve({filter:/^@autodeck\/ui\/tokens$/},()=>({path:path.join(root,'packages/ui/src/tokens/index.ts')}));
b.onResolve({filter:/^@autodeck\/ui\/native$/},()=>({path:path.join(root,'packages/ui/src/native/index.ts')}));
b.onResolve({filter:/^@autodeck\/ui\/theme$/},()=>({path:path.join(root,'packages/ui/src/theme/index.ts')}));
b.onResolve({filter:/^react-native$/},()=>({path:customerRequire.resolve('react-native-web')}));
b.onResolve({filter:/^expo-blur$/},()=>({path:'blur-web',namespace:'preview'}));
b.onResolve({filter:/^expo-image-picker$/},()=>({path:'image-picker',namespace:'preview'}));
b.onLoad({filter:/^image-picker$/,namespace:'preview'},()=>({contents:'export const launchImageLibraryAsync=()=>{throw new Error("LOCAL PREVIEW ONLY")};export const requestMediaLibraryPermissionsAsync=async()=>({granted:false});',loader:'js'}));
b.onResolve({filter:/^expo-router$/},()=>({path:dir+'/mocks.ts'}));

b.onResolve({filter:/\/(useAuth|notification-service|vehicle-size|catalogue-service)$/},()=>({path:dir+'/mocks.ts'}));
}}]});

import fs from'node:fs';for(const mode of['current','proposed'])fs.writeFileSync('/downloads/ad-customer-theme-preview/'+mode+'.html','<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}body{overflow:hidden}</style><div id="root"></div><script>fetch=()=>Promise.reject(Error("LOCAL ONLY"));XMLHttpRequest=class{constructor(){throw Error("LOCAL ONLY")}};</script><script src="'+mode+'.js"></script>');
