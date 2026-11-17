import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
it('booking car text can shrink and Change car has its own vertical space',()=>{const s=source('../app/(tabs)/book/[serviceId].tsx');expect(s).toContain('minWidth:0,gap:6');expect(s).toContain('alignSelf:"flex-start",minHeight:44,justifyContent:"center"');expect(s).toContain('paddingHorizontal:2,marginTop:4');});
it('FAQ facts share vertical padding and separators',()=>{const s=source('../app/(tabs)/help.tsx');expect(s).toContain('gap:6,paddingVertical:12');expect(s).toContain('index<f.facts.length-1?1:0');});
