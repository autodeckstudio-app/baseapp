import{BRAND_ENQUIRIES}from'./brand-enquiries';
import{afterEach,expect,it}from'vitest';
import{setCatalogueReferences,catalogueReferences}from'./catalogue-references';
import{referenceChoices}from'./services-navigation';
afterEach(()=>setCatalogueReferences(undefined));
it('null omitted admin transport field is normalized before navigation filters references',()=>{setCatalogueReferences(null);expect(catalogueReferences()).toBeUndefined();expect(()=>referenceChoices([],catalogueReferences())).not.toThrow()});
it('explicit empty published registry stays empty, never revives removed brand products',()=>{setCatalogueReferences([]);expect(catalogueReferences()).toEqual([]);expect(referenceChoices([],catalogueReferences())).toEqual([])});

it('exact published new-key enquiry survives a legacy bundled allowlist and disappears only when explicitly removed',()=>{const row={key:'reviewed-new-film',brand:'Reviewed brand',name:'Reviewed film',group:'ppf' as const,note:'Exact source record',customerMenu:{home:'paint' as const,family:'PPF'}};expect(referenceChoices([],[row])).toEqual([row]);setCatalogueReferences([row]);expect(BRAND_ENQUIRIES).toEqual([row]);setCatalogueReferences([]);expect(BRAND_ENQUIRIES).toEqual([]);expect(referenceChoices([],[])).toEqual([]);setCatalogueReferences(undefined)});
