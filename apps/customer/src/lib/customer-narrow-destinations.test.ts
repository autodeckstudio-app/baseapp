import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('narrow destination layouts',()=>{
 it('keeps membership history destinations visibly labeled',()=>{
  for(const path of ['../app/(tabs)/membership/index.tsx','../app/(tabs)/membership/usage.tsx']){
   const text=source(path);expect(text).not.toContain('<Button icon="history"');
  }
 });
 it('lets concept tiles become one column on phones',()=>{expect(source('../app/shop.tsx')).toContain('minWidth: 220');});
 it('wraps full budget filters with usable touch targets',()=>{const text=source('../ui/CarsHub.tsx');expect(text).toContain('flexBasis: 110, minHeight: 44');expect(text).toContain('flexWrap: "wrap", gap: 8');});
});
