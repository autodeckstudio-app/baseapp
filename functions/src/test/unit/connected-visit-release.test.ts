import{afterEach,it,expect,vi}from'vitest';import{assertConnectedVisitRuntime as check}from'../../lib/connected-visit-release.js';
afterEach(()=>vi.unstubAllEnvs());
const env=(project:string,emulator:string,flag='',target='')=>{vi.stubEnv('GCLOUD_PROJECT',project);vi.stubEnv('FUNCTIONS_EMULATOR',emulator);vi.stubEnv('CONNECTED_VISIT_RELEASE',flag);vi.stubEnv('CONNECTED_VISIT_RELEASE_PROJECT',target)};
it('default is denied even when exported in the production entrypoint',()=>{env('autodeck-studio','false');expect(check).toThrow('not active')});
it('exact deliberate non-emulator project activation is required, not a lone flag',()=>{env('autodeck-studio','false','enabled','other');expect(check).toThrow();env('autodeck-studio','false','enabled','autodeck-studio');expect(check).not.toThrow()});
it.each([['autodeck-studio','true'],['autodeck-dev','true'],['demo-test','false'],['','false']])('mixed project/runtime %s %s cannot be released', (p,e)=>{env(p,e,'enabled',p);expect(check).toThrow()});
it('demo emulator preview remains local without activation',()=>{env('demo-test','true');expect(check).not.toThrow()});
