// Assert actual generated manifests, not just Expo config. Run after prebuild.
import fs from 'node:fs';
const root=process.argv[2];
if(!root)throw Error('Pass customer app directory after prebuild');
const android=fs.readFileSync(`${root}/android/app/src/main/AndroidManifest.xml`,'utf8');
const filters=[...android.matchAll(/<intent-filter>[\s\S]*?<\/intent-filter>/g)].map(x=>x[0]);
for(const scheme of ['autodeck','in.autodeck.customer'])if(!filters.some(f=>f.includes('android.intent.action.VIEW')&&f.includes('android.intent.category.BROWSABLE')&&f.includes(`android:scheme="${scheme}"`)))throw Error(`Android missing callback scheme ${scheme}`);
console.log('Android generated VIEW/BROWSABLE filter matches default Google package callback and payment autodeck return');
const ios=fs.readFileSync(`${root}/ios/AutoDeck/Info.plist`,'utf8');
for(const scheme of ['autodeck','in.autodeck.customer','com.googleusercontent.apps.24903853329-tfe3ualcp55o35qa3hupc4ogsu8tr902'])if(!ios.includes(`<string>${scheme}</string>`))throw Error(`iOS missing callback scheme ${scheme}`);
console.log('iOS generated callback schemes preserved');
