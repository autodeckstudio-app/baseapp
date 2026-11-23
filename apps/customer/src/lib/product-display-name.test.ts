import{expect,it,vi}from'vitest';
vi.mock('./kit',()=>({useScreenScrollToTop:()=>()=>{}}));
vi.mock('../lib/catalogue-assets',()=>({spotlightProductPhoto:()=>undefined}));
import{productDisplayName}from'./product-display-name';
it.each([
 ['Koch-Chemie','Koch Chemie Ceramic Body Cb0.01','Ceramic Body Cb0.01'],
 ['Koch-Chemie','Koch-Chemie Ceramic Neo C0.03','Ceramic Neo C0.03'],
 ['CarPro','Car Pro CQ.UK 3.0','CQ.UK 3.0'],
 ['Fireball','Fireball Nano Coat V3','Nano Coat V3'],
 ['Kovalent','Kovalent Graphene Matrix','Graphene Matrix'],
 ['Standard','Standard PPS','Standard'],
 [null,'Unbranded product','Unbranded product'],
 ['NAR','NARROW film','NARROW film'],
 ['CarPro','CarProton paint','CarProton paint'],
 ['CarPro','CAR-PRO CQ SiC','CQ SiC'],
 ['3M','3M Crystalline','Crystalline'],
 ['3M','3M','3M'],
])('display-only name %s / %s', (brand,name,expected)=>expect(productDisplayName({brand,name})).toBe(expected));
