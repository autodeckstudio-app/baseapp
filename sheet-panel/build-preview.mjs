import fs from 'node:fs';
fs.mkdirSync('/downloads/ad-sheet-panel-pilot-preview',{recursive:true});
const html=fs.readFileSync(new URL('./Panel.html',import.meta.url),'utf8');
function localMock(){
 let central={serviceId:'menu-wash-exterior',name:'Regular Wash',basePrice:60000,sourceVersion:'fixture-v1',draftId:null,version:0,editable:true};
 const receipts={},faults=new URLSearchParams(location.search);let blocked=false;
 window.google={script:{run:{withSuccessHandler(ok){return {withFailureHandler(fail){return {
 panelServices(){ok([{id:central.serviceId,name:central.name}]);},
 panelRequest(i){setTimeout(()=>{try{
 if(i.operation==='read'){ok({...central});return;}
 if(i.operation==='status'){ok(receipts[i.operationId]||{state:'not-started'});return;}
 if(faults.has('stale')&&!blocked){central.version++;central.basePrice=70000;central.draftId='sample-shared-draft';blocked=true;}
 if(i.version!==central.version||i.draftId!==central.draftId)throw Error('stale');
 central={...central,basePrice:i.basePrice,version:central.version+1,draftId:'sample-shared-draft'};
 receipts[i.operationId]={state:'saved',view:{...central}};
 if(faults.has('unknown')&&!blocked){blocked=true;throw Error('response lost');}
 ok({...central});
 }catch(e){fail(e);}},50);}
 };}};}}}};
}
const script='<script>('+localMock.toString()+')();</script>';
fs.writeFileSync('/downloads/ad-sheet-panel-pilot-preview/preview.html',html.replace('<script>',script+'<script>'));
