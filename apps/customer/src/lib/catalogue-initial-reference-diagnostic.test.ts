import{afterEach,expect,it,vi}from'vitest';
const h=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('firebase/functions',()=>({httpsCallable:()=>h.call}));
vi.mock('./firebase',()=>({functions:{},auth:{currentUser:{uid:'local-diagnostic'}}}));
vi.mock('./dev-catalogue-loader',()=>({devCatalogue:null}));
vi.mock('../ui/kit',()=>({rupees:()=>''}));
vi.mock('./imagery',()=>({primeVisuals:()=>{}}));
import{getServiceCatalogue,peekCatalogue}from'./catalogue-service';
import{catalogueReferences,setCatalogueReferences}from'./catalogue-references';
import{referenceChoices}from'./services-navigation';
const currentReference={key:'explicit-reviewed-reference',brand:'Reviewed brand',name:'Reviewed film',group:'ppf' as const,note:'Exact approved source',customerMenu:{home:'paint' as const,family:'PPF'}};
afterEach(()=>{setCatalogueReferences(undefined);vi.unstubAllGlobals();h.call.mockReset()});
function cache(value:unknown){vi.stubGlobal('__DEV__',false);const store=new Map([['autodeck.catalogue.v1',JSON.stringify(value)]]);vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});return store}
it.each([[],{services:[]},{services:[],references:[currentReference]},{services:[],references:[]}])('old cache shape %j cannot invent or revive references before a delayed fresh response',async old=>{
 cache(old);setCatalogueReferences(undefined);expect(peekCatalogue()).toEqual([]);expect(referenceChoices([],catalogueReferences())).toEqual([]);
 let resolve!:(v:any)=>void;h.call.mockReturnValueOnce(new Promise(r=>resolve=r));const pending=getServiceCatalogue(undefined,{fresh:true});expect(referenceChoices([],catalogueReferences())).toEqual([]);
 resolve({data:{services:[],references:[]}});await pending;expect(referenceChoices([],catalogueReferences())).toEqual([]);peekCatalogue();expect(referenceChoices([],catalogueReferences())).toEqual([]);
});
it.each([{}, {references:null}, {references:[]}])('missing/null/empty response %j never revives bundled PPS after fetch',async registry=>{
 cache({services:[]});h.call.mockResolvedValueOnce({data:{services:[],...registry}});await getServiceCatalogue(undefined,{fresh:true});expect(referenceChoices([],catalogueReferences())).toEqual([]);
});
it('legitimate explicit fresh references survive cache peeks, while a new session waits for its own response',async()=>{
 cache({services:[],references:[]});h.call.mockResolvedValueOnce({data:{services:[],references:[currentReference]}});await getServiceCatalogue(undefined,{fresh:true});expect(referenceChoices([],catalogueReferences())).toEqual([currentReference]);peekCatalogue();expect(referenceChoices([],catalogueReferences())).toEqual([currentReference]);setCatalogueReferences(undefined);peekCatalogue();expect(referenceChoices([],catalogueReferences())).toEqual([]);
});
