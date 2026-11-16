import{expect,it,vi}from'vitest';
vi.mock('./kit',()=>({useScreenScrollToTop:()=>()=>{}}));
vi.mock('../lib/catalogue-assets',()=>({spotlightProductPhoto:()=>undefined}));
import{productDisplayName}from'./product-display-name';
it.each([
 ['Koch-Chemie','Koch Chemie Ceramic Body Cb0.01','Ceramic Body Cb0.01'],
 ['Koch-Chemie','Koch-Chemie Ceramic Neo C0.03','Ceramic Neo C0.03'],
 ['CarPro','Car Pro CQ.UK 3.0','Car Pro CQ.UK 3.0'],
 ['Fireball','Fireball Nano Coat V3','Nano Coat V3'],
 ['Kovalent','Kovalent Graphene Matrix','Graphene Matrix'],
 ['Standard','Standard PPS','Standard'],
 [null,'Unbranded product','Unbranded product'],
 ['NAR','NARROW film','NARROW film'],
])('display-only name %s / %s', (brand,name,expected)=>expect(productDisplayName({brand,name})).toBe(expected));
