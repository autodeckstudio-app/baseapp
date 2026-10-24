// Emulator-only fixture: customer + car + ACTIVE gift with known code. Run from functions/ (needs firebase-admin).
const http=require('http'),crypto=require('crypto');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8081';
const {initializeApp}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
const post=(u,b,au)=>new Promise((r,j)=>{const q=http.request(u,{method:'POST',headers:Object.assign({'content-type':'application/json'},au?{authorization:'Bearer '+au}:{})},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)))});q.on('error',j);q.end(JSON.stringify(b))});
const fn=(n,d,t)=>post('http://127.0.0.1:5001/autodeck-dev/asia-south1/'+n,{data:d},t);
(async()=>{const email='gift.tester@example.com';const tok=JSON.stringify({sub:'dev-'+email,email,email_verified:true,name:'Gift Tester'});
const si=()=>post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-emulator-key',{postBody:'id_token='+encodeURIComponent(tok)+'&providerId=google.com',requestUri:'http://localhost',returnIdpCredential:true,returnSecureToken:true});
let s=await si();s=await si();
const db0=require('firebase-admin/app');db0.initializeApp({projectId:'autodeck-dev'});const db=getFirestore();
const q=await db.collection('vehicles').where('registrationNumber','==','GJ01AB1234').get();const v0=q.docs[0].id;
const sp=(d)=>fn('submitMyPaper',Object.assign({studioId:'studio-ahmedabad',vehicleId:v0},d),s.idToken).then(x=>console.log('paper',JSON.stringify(x).slice(0,80)));
await sp({kind:'RC',reference:'GJ01AB1234',expiresOn:'2037-05-01'});await sp({kind:'INSURANCE',reference:'POL-778899',expiresOn:'2027-03-01'});await sp({kind:'OTHER',title:'Service warranty card',reference:'WC-4412'});
require('fs').writeFileSync('/tmp/v0',v0);console.log('v0',v0);})();
