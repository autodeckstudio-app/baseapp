import React from 'react';import{act,create,type ReactTestRenderer}from'react-test-renderer';import{describe,it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({auth:{status:'ready',user:{uid:'auth-one',displayName:'Meet',email:'x@example.test'},customerDocId:'canonical-one',claims:{role:'customer',tenantId:'t'}} as any,upload:vi.fn(),licState:{url:'private://saved',state:'ready',retry:()=>undefined} as any}));
vi.mock('../../ui/SavedLicensePhoto',()=>({SavedLicensePhoto:(p:any)=>React.createElement('SavedLicence',p),SavedLicensePhotoView:(p:any)=>React.createElement('SavedLicence',p),useSavedLicensePhoto:()=>h.licState}));
vi.mock('react-native',()=>({Platform:{OS:'android'},View:(p:any)=>React.createElement('View',p),Pressable:(p:any)=>React.createElement('Pressable',p),Text:(p:any)=>React.createElement('Text',p)}));
vi.mock('../../hooks/useAuth',()=>({useAuth:()=>h.auth}));vi.mock('../../lib/firebase',()=>({db:{}}));
vi.mock('firebase/firestore',()=>({doc:(_db:any,c:string,id:string)=>({c,id}),updateDoc:vi.fn()}));vi.mock('firebase/auth',()=>({updateProfile:vi.fn()}));vi.mock('@autodeck/database',()=>({COLLECTIONS:{customers:()=> 'customers'}}));
vi.mock('../../lib/vehicle-service',()=>({uploadLicensePhoto:(...a:any[])=>h.upload(...a)}));vi.mock('../../lib/auth-service',()=>({signOut:vi.fn()}));vi.mock('../../lib/i18n',()=>({useLang:()=>({lang:'en',t:(x:string)=>x})}));vi.mock('../../lib/pickup-service',()=>({cancelAccountDeletion:vi.fn(),requestAccountDeletion:vi.fn()}));
vi.mock('@autodeck/ui/theme',()=>({space:{breath:8},getThemePref:()=> 'light',setThemePref:vi.fn()}));vi.mock('@autodeck/ui/native',()=>({useExperienceTheme:()=>({name:'light',colors:{}})}));
vi.mock('../../ui/LegalLinks',()=>({LegalLinks:()=>null}));vi.mock('../../ui/NavIcon',()=>({NavIcon:()=>null}));vi.mock('../../ui/ProfileHero',()=>({ProfileHero:(p:any)=>React.createElement('Hero',p)}));vi.mock('../../ui/inputs',()=>({FileUploader:(p:any)=>React.createElement('Uploader',p)}));vi.mock('../../ui/kit',()=>Object.fromEntries(['Pane','Button','Field','Kicker','Loading','Notice','Screen','T'].map(n=>[n,(p:any)=>React.createElement(n,p)])));
import Profile from './profile';
const texts=(r:ReactTestRenderer)=>r.root.findAllByType('Text' as any).map(t=>t.props.children).flat();
const has=(r:ReactTestRenderer,s:string)=>texts(r).includes(s);
const pressLabel=async(r:ReactTestRenderer,label:string)=>{await act(async()=>{r.root.findAll(n=>n.props.label===label&&typeof n.props.onPress==='function')[0]!.props.onPress();});};
describe('profile licence with an upload on file',()=>{
 it('row reads View licence; uploader stays hidden until Replace; Keep current restores',async()=>{
  let r!:ReactTestRenderer;await act(async()=>{r=create(<Profile/>);});
  expect(has(r,'View licence')).toBe(true);expect(has(r,'Add')).toBe(false);
  await act(async()=>{r.root.findAll(n=>n.props.accessibilityLabel==='Driving licence'&&typeof n.props.onPress==='function')[0]!.props.onPress();});
  expect(r.root.findAllByType('SavedLicence' as any)).toHaveLength(1);
  expect(r.root.findAllByType('Uploader' as any)).toHaveLength(0);
  await pressLabel(r,'Replace licence photo');
  expect(r.root.findAllByType('Uploader' as any)).toHaveLength(1);
  await pressLabel(r,'Keep current photo');
  expect(r.root.findAllByType('Uploader' as any)).toHaveLength(0);
  await act(async()=>r.unmount());
 });
 it('no upload on file keeps Add and shows the uploader directly',async()=>{
  h.licState={url:null,state:'missing',retry:()=>undefined};
  let r!:ReactTestRenderer;await act(async()=>{r=create(<Profile/>);});
  expect(has(r,'Add')).toBe(true);expect(has(r,'View licence')).toBe(false);
  await act(async()=>{r.root.findAll(n=>n.props.accessibilityLabel==='Driving licence'&&typeof n.props.onPress==='function')[0]!.props.onPress();});
  expect(r.root.findAllByType('Uploader' as any)).toHaveLength(1);
  await act(async()=>r.unmount());
 });
});
