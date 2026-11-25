import{createHash}from'node:crypto';import{hash,FILE}from'./fingerprint.mjs';
const copy=structuredClone,fail=m=>{throw Error(m)},DERIVED=new Set(['effectiveValue','formattedValue','effectiveFormat','hyperlink']);
const COL=n=>{let r='';for(n++;n;n=Math.floor((n-1)/26))r=String.fromCharCode(65+(n-1)%26)+r;return r};
export function structuralUserState(raw){
 const root=copy(raw);
 for(const s of root.sheets){const cells={},rows={},columns={};
  for(const d of s.data??[]){
   const sr=d.startRow??0,sc=d.startColumn??0;
   for(const[i,r]of(d.rowData??[]).entries())for(const[j,c]of(r.values??[]).entries()){
    const u=Object.fromEntries(Object.entries(c).filter(([k])=>!DERIVED.has(k)));
    if(Object.keys(u).length)cells[COL(sc+j)+(sr+i+1)]=u;
   }
   for(const[i,m]of(d.rowMetadata??[]).entries()){const u=copy(m);if(u.hiddenByUser===false)delete u.hiddenByUser;if(u.hiddenByFilter===false)delete u.hiddenByFilter;if(Object.keys(u).length)rows[sr+i+1]=u}
   for(const[i,m]of(d.columnMetadata??[]).entries()){const u=copy(m);if(u.hiddenByUser===false)delete u.hiddenByUser;if(u.hiddenByFilter===false)delete u.hiddenByFilter;if(Object.keys(u).length)columns[COL(sc+i)]=u}
   if(Object.keys(d).some(k=>!['startRow','startColumn','rowData','rowMetadata','columnMetadata'].includes(k)))fail('Unmodeled grid data field');
  }
  delete s.data;s.userState={cells,rows,columns};
 }
 return root;
}

export function qualifyNativeBindings(snapshot,bindings){
 if(snapshot?.metadataComplete!==true||snapshot.fileId!==FILE||!Array.isArray(bindings)||bindings.length<1||bindings.length>120||new Set(bindings.map(b=>b.serviceId)).size!==bindings.length)fail('Complete source and unique accepted bindings required');
 const slots=new Set();let fixed=0,inspection=0,legacyCoordinateIdentities=0;
 for(const b of bindings){const s=snapshot.sheets.find(sLocal1=>sLocal1.id===b.sheetId&&sLocal1.title===b.tab);if(!s||!Number.isInteger(b.row)||b.row<2||b.row>1000)fail('Binding tab or row changed');
  const slot=b.sheetId+':'+b.row;if(slots.has(slot))fail('Duplicate binding source row');slots.add(slot);
  if(!Array.isArray(b.identityCells))fail('Binding source identity required');
  let labels=b.identityCells.map(c=>c.value);
  if(!labels.length){if(b.policy!=='inspection'||b.tab!=='Modifications & Wraps'||!Array.isArray(b.identityLabels)||b.identityLabels.length!==2)fail('Unmodeled legacy inspection identity');labels=['C','B'].map(col=>{const c=s.cells.find(cLocal2=>cLocal2.a1===col+b.row);if(c?.formula)fail('Legacy identity formula changed');return c?.value??''});if(hash(labels)!==hash(b.identityLabels))fail('Legacy coordinate identity changed');legacyCoordinateIdentities++}
  for(const i of b.identityCells){const c=s.cells.find(cLocal3=>cLocal3.a1===i.cell);if(c?.value!==i.value||c.formula)fail('Binding source identity changed')}
  const identityHash=createHash('sha256').update(JSON.stringify([b.sheetId,b.tab,labels])).digest('hex');if(identityHash!==b.identityHash)fail('Binding identity hash changed');
  if(!(b.sourceRows??[b.row]).includes(b.row)||(b.sourceRows??[]).some(r=>!Number.isInteger(r)||r<2||r>1000))fail('Binding variant rows invalid');
  if(b.policy==='fixed'){const c=s.cells.find(cLocal4=>cLocal4.a1===b.column+b.row),h=s.cells.find(cLocal5=>cLocal5.a1===b.column+b.headerRow);if(h?.value!==b.expectedPriceHeader||h?.formula||c?.formula||typeof c?.value!=='number'||!Number.isFinite(c.value)||c.value<0||c.value>1000000||Math.abs(c.value*100-Math.round(c.value*100))>0.00001||!Number.isSafeInteger(b.acceptedLiveMinor))fail('Binding price/header changed');fixed++}
  else if(b.policy==='inspection'&&b.column===null&&b.acceptedLiveMinor===0){inspection++}
  else fail('Binding price policy changed');
 }
 return{total:bindings.length,fixed,inspection,legacyCoordinateIdentities,hash:hash(bindings)};
}
