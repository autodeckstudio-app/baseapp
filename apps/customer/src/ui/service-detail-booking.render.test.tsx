import React from 'react';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('expo-router',()=>({useRouter:()=>({push:h.push,navigate:vi.fn()}),useLocalSearchParams:()=>({}),useFocusEffect:()=>{},useSegments:()=>[]}));
vi.mock('../lib/firebase',()=>({db:{},functions:{}}));
vi.mock('../ui/ServicePhoto',()=>({ServicePhoto:()=>null}));
vi.mock('../lib/catalogue-service',()=>({getServiceCatalogue:async()=>[],calculateServicePrice:vi.fn(),applyBrandWarranty:(s:any)=>s,priceLabel:()=>''}));
vi.mock('../lib/booking-service',()=>({getAvailability:async()=>[],todayIST:()=>''}));
vi.mock('../lib/vehicle-service',()=>({listenToMyVehicles:()=>()=>{}}));
vi.mock('../lib/review-service',()=>({getServiceReviews:async()=>null}));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({})}));
vi.mock('../lib/vehicle-size',()=>({usePricingVehicle:()=>({})}));
import {ServiceDetailView} from '../app/(tabs)/catalogue/[id]';
import {Button} from './kit';
import {ServiceScope} from './ServiceScope';
const base:any={id:'menu-wash-exterior',name:'Sample exterior wash',category:'washing',description:'Standard exterior wash and dry with foam.',active:true,estimatedDurationMinutes:45,careTips:['PRIVATE-SAMPLE-TIP'],brand:null,warrantyLabel:null};
const pb:any={basePrice:50000,scopeAdjustment:0,subtotal:50000,tax:0,total:50000,addOns:[],membershipDiscount:null};
const props:any={id:base.id,service:base,loading:false,loadError:false,reviews:null,pricingVehicle:{vehicle:{id:'fixture-car'},label:'Sample car',category:'hatchback'},selectedCategory:'hatchback',needsCarType:false,priceLoading:false,priceError:null,priceBreakdown:pb,onRetry:()=>{}};
beforeEach(()=>vi.clearAllMocks());
it('priced service shows a visible labelled booking action, duration has no trailing action, local care/contact removed',async()=>{let r:any;await act(async()=>{r=create(<ServiceDetailView {...props}/>)});const button=r.root.findAllByType(Button).find((n:any)=>n.props.label==='Book now');expect(button).toBeTruthy();expect(JSON.stringify(r.toJSON())).toContain('Book now');const text=JSON.stringify(r.toJSON());expect(text).not.toContain('At a glance');expect(text).toContain('Estimated service time');expect(text).toContain('45 mins');expect(text).not.toContain('PRIVATE-SAMPLE-TIP');expect(text).not.toContain('Care tip');expect(text).not.toContain('Questions about this service');await act(async()=>button.props.onPress());expect(h.push).toHaveBeenCalledWith('/(tabs)/book/menu-wash-exterior');await act(async()=>r.unmount())});
it.each([{priceError:'unavailable'},{priceBreakdown:null},{needsCarType:true}])('existing incomplete-price guard does not expose booking action %j',async change=>{let r:any;await act(async()=>{r=create(<ServiceDetailView {...props} {...change}/>)});expect(r.root.findAllByType(Button).some((n:any)=>n.props.label==='Book now')).toBe(false);await act(async()=>r.unmount())});
it('quote action and destination remain unchanged',async()=>{let r:any;await act(async()=>{r=create(<ServiceDetailView {...props} service={{...base,priceOnRequest:true}} priceBreakdown={null}/>)});const b=r.root.findAllByType(Button).find((n:any)=>n.props.label==='Get quote');expect(b).toBeTruthy();await act(async()=>b.props.onPress());expect(h.push).toHaveBeenCalledWith({pathname:'/(tabs)/quote-request',params:{serviceId:base.id}});await act(async()=>r.unmount())});
it('branded product data appears once under the image, not in a second care/confirmation panel',async()=>{const service:any={name:'Kovalent Graphene',category:'ceramic',brand:'Kovalent',description:'Special order.'};let r:any;await act(async()=>{r=create(<ServiceScope service={service} placement="description" showContactAndTip={false} careTip="PRIVATE-SAMPLE-TIP" onAsk={()=>{}}/>)});let text=JSON.stringify(r.toJSON(),(k,v)=>k==='_owner'?undefined:v);expect(text).toContain('WHAT IT IS');expect(text).toContain('Water repellency');expect(text).not.toContain('Special order');expect(text).not.toContain('PRIVATE-SAMPLE-TIP');await act(async()=>r.update(<ServiceScope service={service} placement="details" careTip="PRIVATE-SAMPLE-TIP" onAsk={()=>{}}/>));expect(r.toJSON()).toBeNull();await act(async()=>r.unmount())});

it('loading price keeps the existing disabled action instead of allowing a booking',async()=>{let r:any;await act(async()=>{r=create(<ServiceDetailView {...props} priceLoading priceBreakdown={null}/>)});expect(r.root.findAllByType(Button).find((n:any)=>n.props.label==='Book now').props.disabled).toBe(true);expect(h.push).not.toHaveBeenCalled();await act(async()=>r.unmount())});

it('unique catalogue timing brand and warranty remain inline in the existing price section',async()=>{let r:any;await act(async()=>{r=create(<ServiceDetailView {...props} service={{...base,brand:'Exact brand',warrantyLabel:'Exact listed warranty'}}/>)});const text=JSON.stringify(r.toJSON());for(const fact of ['45 mins','Exact brand','Exact listed warranty'])expect(text).toContain(fact);expect(text).not.toContain('At a glance');await act(async()=>r.unmount())});
