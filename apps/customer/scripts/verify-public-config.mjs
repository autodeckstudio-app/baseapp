// Run on a clean Expo --no-bytecode --no-minify export, never on a raw config dump.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.argv[2];
if(!root)throw Error('Pass export directory');
const expected=JSON.parse(fs.readFileSync('eas.json','utf8')).build.preview.env;
const firebaseKeys={apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',messagingSenderId:'MESSAGING_SENDER_ID',appId:'APP_ID'};
for(const platform of ['android','ios','web']){
 const dir=path.join(root,'_expo/static/js',platform);
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js'));
 const code=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
 const f=code.match(/(?:var|const) firebaseConfig = (\{[\s\S]*?\n  \});/);
 if(!f)throw Error(`${platform}: missing actual Firebase initialization config`);
 const cfg = f[1].replace(/\(0, _authDomain\.resolveAuthDomain\)\(("[^"]+"), globalThis\.location\?\.host\)/, '$1');
 const actual=vm.runInNewContext(`(${cfg})`,Object.create(null),{timeout:1000});
 for(const [key,suffix] of Object.entries(firebaseKeys))if(actual[key]!==expected[`EXPO_PUBLIC_FIREBASE_${suffix}`])throw Error(`${platform}: wrong Firebase ${key}`);
 if(!/initializeApp\)\(firebaseConfig\)|initializeApp\(firebaseConfig\)/.test(code))throw Error(`${platform}: config not bound to initialization`);
 if(platform==='web'){
  if(!code.includes('function resolveAuthDomain(')||!f[1].includes('_authDomain.resolveAuthDomain'))throw Error('web: missing actual auth-domain resolver binding');
 }
 const auth=code.match(/function googleClientIds\(\) \{[\s\S]*?return ids;\n  \}/);
 if(!auth)throw Error(`${platform}: missing actual OAuth function`);
 const ids=vm.runInNewContext(`(${auth[0]})()`,Object.create(null),{timeout:1000});
 for(const [key,suffix] of Object.entries({webClientId:'WEB',androidClientId:'ANDROID',iosClientId:'IOS'}))if(ids[key]!==expected[`EXPO_PUBLIC_GOOGLE_${suffix}_CLIENT_ID`])throw Error(`${platform}: wrong runtime OAuth ${key}`);
 console.log(`${platform}: runtime Firebase initialization6 and OAuth getter3 values verified`);
}
