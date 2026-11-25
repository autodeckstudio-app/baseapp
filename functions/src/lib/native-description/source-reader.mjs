import {createHash} from 'node:crypto';
export const FILE='15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0';
export const PRINCIPAL='catalogue-price-source-writer@autodeck-studio.iam.gserviceaccount.com';
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const letter=n=>{let out='';for(let v=n+1;v;v=Math.floor((v-1)/26))out=String.fromCharCode(65+(v-1)%26)+out;return out};
/** Read-only candidate, contract-matched to installed SourceAuth injection.
 * No production export, dynamic URL/workbook/principal, fallback identity,
 * token output, retries or write method. Full API payload is retained so an
 * unmodeled field is not silently excluded from the snapshot fingerprint.
 * Content fingerprint is NOT a Google revision or atomic concurrency token.
 */
export function structuralGoogleReader(auth,http){
 if(auth?.principal!==PRINCIPAL||typeof auth.getAccessToken!=='function'||typeof http!=='function')throw Error('Installed isolated source identity required');
 return async function read(){const token=await auth.getAccessToken();if(!token)throw Error('Source identity unavailable');
  const response=await http('https://sheets.googleapis.com/v4/spreadsheets/'+FILE+'?includeGridData=true&commentsViewMode=COMMENTS_VIEW_MODE_INCLUDED',{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token}});
  if(!response.ok)throw Error('Complete structural read unavailable');
  const text=await response.text();if(text.length>64_000_000)throw Error('Structural response exceeds local qualification bound');
  return parseStructuralWorkbook(JSON.parse(text));
 };
}
/** Pure offline parser for a preserved normal-UI GET response. No auth grant. */
export function parseStructuralWorkbook(raw){
  if(raw.spreadsheetId!==FILE||!Array.isArray(raw.sheets)||!raw.sheets.length||raw.sheets.length>30||!raw.properties)throw Error('Complete fixed workbook response required');
  const ids=new Set(),titles=new Set();let count=0;
  const sheets=raw.sheets.map(s=>{const p=s.properties,g=p?.gridProperties;if(!Number.isInteger(p?.sheetId)||p.sheetId<0||typeof p.title!=='string'||ids.has(p.sheetId)||titles.has(p.title)||p.sheetType!=='GRID'||!Number.isInteger(g?.rowCount)||!Number.isInteger(g?.columnCount)||g.rowCount<1||g.columnCount<1||g.rowCount>10000||g.columnCount>1000||!Array.isArray(s.data))throw Error('Exact bounded grid metadata required');ids.add(p.sheetId);titles.add(p.title);
   const cells=[],validations=[],hiddenRows=[],filteredRows=[],hiddenColumns=[],occupied=new Set();
   for(const d of s.data){const sr=d.startRow??0,sc=d.startColumn??0;if(!Number.isInteger(sr)||!Number.isInteger(sc)||sr<0||sc<0||sr>=g.rowCount||sc>=g.columnCount)throw Error('Exact grid offsets required');
    for(const[i,row]of(d.rowData??[]).entries()){if(sr+i>=g.rowCount||!Array.isArray(row.values??[]))throw Error('Grid row exceeds acknowledged metadata');for(const[j,cell]of(row.values??[]).entries()){const r=sr+i,c=sc+j;if(c>=g.columnCount||++count>500000)throw Error('Grid cells exceed acknowledged bounds');if(!cell||typeof cell!=='object'||Array.isArray(cell))throw Error('Exact cell object required');const a1=letter(c)+(r+1);if(occupied.has(a1))throw Error('Overlapping grid data');occupied.add(a1);if(!Object.keys(cell).length)continue;
     const u=cell.userEnteredValue;let value=null,formula=null;if(u!==undefined){const keys=Object.keys(u);if(keys.length!==1||!['numberValue','stringValue','boolValue','formulaValue'].includes(keys[0]))throw Error('Unmodeled entered value');if(keys[0]==='formulaValue')formula=u.formulaValue;else value=u[keys[0]]}
     if(cell.dataValidation)validations.push({startRow:r+1,endRow:r+1,startColumn:c+1,endColumn:c+1,raw:cell.dataValidation});
     // Retain all raw metadata; non-format content is not treated as an empty slot.
     const unmodeledContent=(!u&&cell.effectiveValue&&Object.keys(cell.effectiveValue).length>0)||Object.keys(cell).some(k=>!['userEnteredValue','effectiveValue','formattedValue','userEnteredFormat','effectiveFormat','note','dataValidation'].includes(k));
     cells.push({a1,row:r+1,value,formula,...(cell.note?{note:cell.note}:{}),...(cell.dataValidation?{validation:cell.dataValidation}:{}),...(unmodeledContent?{note:'Non-format metadata requires explicit treatment'}:{}),raw:cell});
    }}
    for(const[j,m]of(d.columnMetadata??[]).entries()){if(sc+j>=g.columnCount)throw Error('Column metadata overflow');if(m.hiddenByUser||m.hiddenByFilter)hiddenColumns.push(letter(sc+j))}
    for(const[i,m]of(d.rowMetadata??[]).entries()){if(sr+i>=g.rowCount)throw Error('Row metadata overflow');if(m.hiddenByUser)hiddenRows.push(sr+i+1);if(m.hiddenByFilter)filteredRows.push(sr+i+1)}
   }
   const range=x=>{if(x.sheetId!==undefined&&x.sheetId!==p.sheetId)throw Error('Range sheet mismatch');const start=x.startRowIndex??0,end=x.endRowIndex??g.rowCount,cs=x.startColumnIndex??0,ce=x.endColumnIndex??g.columnCount;if(![start,end,cs,ce].every(Number.isInteger)||start<0||end<=start||end>g.rowCount||cs<0||ce<=cs||ce>g.columnCount)throw Error('Exact bounded metadata range required');return{startRow:start+1,endRow:end,startColumn:cs+1,endColumn:ce,raw:x}};
   const protectedRanges=(s.protectedRanges??[]).map(x=>{if(x.namedRangeId||x.tableId||!x.range)throw Error('Unmodeled named protection requires separate planning');return{...range(x.range),raw:x}});
   return{id:p.sheetId,title:p.title,cells,merges:(s.merges??[]).map(range),protectedRanges,validations,hiddenRows,filteredRows,hiddenColumns,hidden:p.hidden===true,raw:s};
  });
  const fingerprint=hash(raw);return{fileId:FILE,revision:'snapshot_'+fingerprint,revisionKind:'content-fingerprint-not-google-revision',metadataComplete:true,sourceHash:fingerprint,sheets,raw};
}
