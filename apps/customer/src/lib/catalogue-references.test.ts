import{afterEach,expect,it}from'vitest';
import{setCatalogueReferences,catalogueReferences}from'./catalogue-references';
import{referenceChoices}from'./services-navigation';
afterEach(()=>setCatalogueReferences(undefined));
it('null omitted admin transport field is normalized before navigation filters references',()=>{setCatalogueReferences(null);expect(catalogueReferences()).toBeUndefined();expect(()=>referenceChoices([],catalogueReferences())).not.toThrow()});
it('explicit empty published registry stays empty, never revives removed brand products',()=>{setCatalogueReferences([]);expect(catalogueReferences()).toEqual([]);expect(referenceChoices([],catalogueReferences())).toEqual([])});
