import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('broad website categories lead to catalogue categories, never one bookable service',()=>{
 const expected={'paint-protection-film':'cat=ppf','ceramic-coating':'cat=coatings&p=ceramic','detailing':'cat=wash','washing':'cat=wash','garage':'cat=garage','modifications':'cat=mods'};
 for(const [slug,q]of Object.entries(expected)){
  const h=read('dist/services/'+slug+'/index.html');
  assert(h.includes('data-app-category-link="https://app.autodeck.in/catalogue?'+q+'"'));
  assert(!/data-app-category-link="[^"]*\/book\//.test(h));
 }
 const js=read('src/scripts/redesign.ts');
 assert(js.includes("link.href=categoryLink||'https://app.autodeck.in/'"));
 assert(js.includes('Continue to the matching service category'));
 assert(!js.includes('Your choice is not automatically passed'));
});
