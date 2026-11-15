import{beforeEach,it,expect,vi}from'vitest';
import{createElement}from'react';
import{create,act}from'react-test-renderer';
const h=vi.hoisted(()=>({popup:vi.fn(),redirect:vi.fn(),result:vi.fn(),out:vi.fn(async()=>{}),listener:null as null|((u:unknown)=>void)}));
vi.mock('firebase/auth',()=>({onIdTokenChanged:(_:unknown,cb:(u:unknown)=>void)=>{h.listener=cb;return()=>{}},GoogleAuthProvider:class{setCustomParameters(){}},signInWithPopup:h.popup,signInWithRedirect:h.redirect,getRedirectResult:h.result,signOut:h.out,getMultiFactorResolver:vi.fn(),PhoneAuthProvider:class{},PhoneMultiFactorGenerator:class{},RecaptchaVerifier:class{}}));
vi.mock('./firebase',()=>({auth:{}}));
vi.mock('./mfa',()=>({isMultiFactorRequiredError:()=>false,pickPhoneHint:()=>null}));
import{AdminAuthProvider,useAdminAuth}from'./auth-context';
let state:ReturnType<typeof useAdminAuth>;
function Probe(){state=useAdminAuth();return null}
const memory=new Map<string,string>();
const user={uid:'business',emailVerified:true,getIdToken:async()=> 'verified-token'};
beforeEach(()=>{memory.clear();h.popup.mockReset();h.redirect.mockReset().mockResolvedValue(undefined);h.result.mockReset().mockResolvedValue(null);h.out.mockClear();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)});vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,status:200,json:async()=>url.includes('resolve-claims')?{changed:false}:{claims:{uid:'business',role:'admin',tenantId:'t',studioId:null}}})));});
async function mount(){await act(async()=>{create(createElement(AdminAuthProvider,null,createElement(Probe)));await Promise.resolve()})}
it('desktop uses one same-window redirect, never a popup or a second attempt while leaving',async()=>{await mount();let a:unknown,b:unknown;await act(async()=>{a=state.signIn();b=state.signIn();await a});expect(a).toBe(b);expect(h.redirect).toHaveBeenCalledTimes(1);expect(h.popup).not.toHaveBeenCalled();expect(memory.get('autodeck:google-redirect')).toBe('1');expect(state.loading).toBe(true);await act(async()=>h.listener?.(null));expect(state.loading).toBe(true)});
it('a failed redirect start clears pending marker and permits a real retry',async()=>{await mount();h.redirect.mockRejectedValueOnce(new Error('network'));await act(async()=>{await expect(state.signIn()).rejects.toThrow('network')});expect(memory.has('autodeck:google-redirect')).toBe(false);expect(state.loading).toBe(false);expect(state.error).toContain('Could not open');await act(async()=>{await state.signIn()});expect(h.redirect).toHaveBeenCalledTimes(2);expect(h.popup).not.toHaveBeenCalled()});
it('returning Google user opens admin only after verified server session for same principal',async()=>{memory.set('autodeck:google-redirect','1');h.result.mockResolvedValue({user});await mount();expect(state.claims?.role).toBe('admin');expect(state.user?.uid).toBe('business');expect(state.loading).toBe(false);expect(h.popup).not.toHaveBeenCalled()});
it('returning principal cannot publish another account session',async()=>{memory.set('autodeck:google-redirect','1');h.result.mockResolvedValue({user:{...user,uid:'other'}});await mount();expect(state.claims).toBe(null);expect(state.user).toBe(null);expect(h.out).toHaveBeenCalled();expect(state.loading).toBe(false)});
