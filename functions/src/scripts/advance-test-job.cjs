const admin=require("firebase-admin");
admin.initializeApp({projectId:"autodeck-studio",serviceAccountId:"autodeck-studio@appspot.gserviceaccount.com"});
(async()=>{
const u=await admin.auth().getUserByEmail("autodeckstudio@gmail.com");
const ct=await admin.auth().createCustomToken(u.uid);
const K="AIzaSyABYNBxwC7rhZhCMlid9xlVJrKrnLPPsRg";
const r=await (await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key="+K,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
const n=+process.argv[3]||1;
for(let i=0;i<n;i++){
const o=await fetch("https://asia-south1-autodeck-studio.cloudfunctions.net/advanceJobStatus",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+r.idToken},body:JSON.stringify({data:{jobId:process.argv[2]}})});
console.log("ADV",i,o.status,(await o.text()).slice(0,200));
await new Promise(s=>setTimeout(s,1500));}
})().catch(e=>console.log("ERR",e.message));
