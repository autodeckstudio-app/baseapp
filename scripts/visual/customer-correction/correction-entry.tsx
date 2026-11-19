import'../../../apps/customer/src/lib/boot-theme';
import React from 'react';
import{createRoot}from'react-dom/client';
import{isNightPalette}from'../../../packages/ui/src/tokens';
import{glacierGround}from'../../../apps/customer/src/lib/customer-glacier';
import{AutoExperienceThemeProvider as ExperienceThemeProvider}from'../../../packages/ui/src/native/ThemeContext';
import{ServiceProductSelection}from'../../../apps/customer/src/ui/ServiceProductSelection';
import{ServiceDetailRich}from'../../../apps/customer/src/ui/ServiceDetailRich';
import{HomeView}from'../../../apps/customer/src/ui/HomeView';
import{PlanCompare}from'../../../apps/customer/src/ui/PlanCompare';
import{StatePanel}from'../../../apps/customer/src/ui/StatePanel';
import{Button}from'../../../apps/customer/src/ui/kit';
import{RaisedTabBar}from'../../../apps/customer/src/ui/RaisedTabBar';
import{GiftBuy}from'../../../apps/customer/src/ui/GiftBuy';
import{GiftCard}from'../../../apps/customer/src/ui/GiftCard';
import{SelectField}from'../../../apps/customer/src/ui/inputs';
import{Pane,T}from'../../../apps/customer/src/ui/kit';
import{ListRow}from'../../../apps/customer/src/ui/ListRow';
import YouScreen from'../../../apps/customer/src/app/(tabs)/profile';
import carPhoto from'../../../apps/customer/assets/imagery/stock/wash-foam.jpg';
const noop=()=>{};
const q=new URLSearchParams(location.search);
const wash:any={id:'wash-regular',name:'Regular Wash',brand:'Standard',basePrice:60000,estimatedDurationMinutes:45,active:true,description:'Thorough exterior and interior wash\nTwo-bucket hand wash with pH-neutral shampoo\nWheel, tyre and arch cleaning\nInterior vacuum and wipe-down\nNot a detailing service',careTips:['A weekly wash keeps dust from bonding to the paint.','Dry with a microfibre towel to avoid water spots.'],customerMenu:{home:'washing',family:'Exterior'}};

const ceramic:any={id:'cer-c1',name:'Gtechniq C1 Crystal Lacquer',brand:'Gtechniq',category:'ceramic',basePrice:2500000,estimatedDurationMinutes:300,active:true,description:'Entry-level quartz paint coating per brand. Special order.\nStrong gloss and chemical resistance\nHydrophobic, easy-wash surface',customerMenu:{home:'paint',family:'Ceramic'}};
const ceramicB:any={id:'cer-exo',name:'Gtechniq EXO',brand:'Gtechniq',category:'ceramic',basePrice:3000000,estimatedDurationMinutes:300,active:true,description:'Hydrophobic top coat\nWater and dirt repellent finish',customerMenu:{home:'paint',family:'Ceramic'}};
const plans=[
 {id:'starter',name:'Starter',price:90000,washes:2,discount:0,perWash:45000,pickups:0,priority:false,best:false,current:false},
 {id:'silver',name:'Silver',price:170000,washes:4,discount:0,perWash:42500,pickups:1,priority:false,best:false,current:false},
 {id:'gold',name:'Gold',price:240000,washes:6,discount:0,perWash:40000,pickups:2,priority:false,best:true,current:false},
 {id:'platinum',name:'Platinum',price:300000,washes:8,discount:0,perWash:37500,pickups:3,refreshes:1,priority:true,best:false,current:false},
];
const homeProps:any={greeting:'Good morning, Meet',initial:'M',unread:0,
 cars:[{id:'A',title:'Test Car',plate:'GJ 01 AB 1234',category:'Sedan',hasPhoto:true,vehicle:{photoUrl:carPhoto as unknown as string,category:'sedan',updatedAt:'2026-11-19T00:00:00Z'}}],
 services:[],reminders:[],live:null,progress:null,membership:null,
 studio:{address:'Ahmedabad',hours:'Mon to Sat, 10 am to 9 pm. Sun, 10 am to 7 pm',openText:'Closed, opens 10 am',open:false},
 quick:[{key:'call',label:'Call',icon:'call',onPress:noop},{key:'wa',label:'WhatsApp',icon:'whatsapp',onPress:noop},{key:'map',label:'Directions',icon:'directions',onPress:noop}],
 social:[{key:'wac',title:'WhatsApp',sub:'Our channel',icon:'channel',onPress:noop},{key:'ig',title:'Instagram',sub:'@autodeck',icon:'instagram',onPress:noop}],
 onAvatar:noop,onSearch:noop,onBell:noop,onAllServices:noop,onCategory:noop,onService:noop,onCar:noop,onAddCar:noop,onReminders:noop,onBook:noop,onStudio:noop,onMembership:noop,onVisits:noop,onShare:noop};
const shell=(label:string,child:React.ReactNode)=><div style={{maxWidth:430,margin:'0 auto',padding:'18px 14px 40px',background:glacierGround(isNightPalette),minHeight:'100vh'}}><div style={{font:'11px sans-serif',color:'#EC8638',letterSpacing:1.5,marginBottom:12}}>{label}</div>{child}</div>;
const tabBar=<RaisedTabBar state={{index:2,routes:['bookings','catalogue','index','garage','profile'].map(name=>({key:name,name}))}} descriptors={Object.fromEntries(['bookings','catalogue','index','garage','profile'].map(name=>[name,{options:{title:name}}]))} navigation={{navigate:noop,emit:()=>({defaultPrevented:false})}} icons={{index:'home',catalogue:'services',bookings:'bookings',garage:'garage',profile:'profile'}}/>;
const giftService={serviceId:'wash-regular',serviceName:'Regular Wash',amountPaise:60000};
const giftsPreview=<div style={{display:'flex',flexDirection:'column',gap:28}}>
 <Pane pad="inset"><T role="heading">Choose a service to gift</T><SelectField label="Gift service" value="wash-regular" onChange={noop} options={[{value:'',label:'Choose washing or detailing'},{value:'wash-regular',label:'Regular Wash · ₹600'},{value:'wash-foam',label:'Foam wash · ₹900'}]}/></Pane>
 <GiftBuy serviceName="Regular Wash" amountPaise={60000} canPay={true} busy={false} onPay={noop}/>
 <GiftCard code="GWABCDEFGH" expiresAt={new Date(Date.now()+45*86400000).toISOString()} buyerName="Meet" serviceName="Regular Wash"/>
 <StatePanel compact icon="gift" title="No gifts bought yet" body="You can add a code below, or buy a gift when available."/>
</div>;
const THEME_FONT='Inter, system-ui, sans-serif';
const accountPreview=<div style={{display:'flex',flexDirection:'column',gap:18}}>
 <Pane pad="inset"><ListRow icon="chat" title="Your quotes" detail="Review work and prices" onPress={noop}/><ListRow last icon="chat" title="Help & contact" detail="Call or WhatsApp the studio" onPress={noop}/></Pane>
 <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'8px 0'}}>
  <span style={{fontFamily:THEME_FONT,color:'#22252B',fontSize:15,lineHeight:'22px',fontWeight:500,minHeight:44,display:'flex',alignItems:'center'}}>Sign out</span>
  <span style={{fontFamily:THEME_FONT,color:'#6B6F78',fontSize:12,lineHeight:'16px'}}>Delete my account</span>
 </div>
</div>;
const sections=<div style={{display:'flex',flexDirection:'column',gap:56}}>
 <section>{shell('SERVICE DETAIL · LAYOUT PREVIEW WITH SAMPLE CATALOGUE CONTENT · LIVE COPY, PRICES AND SAME-FAMILY OPTIONS RENDER AT RUNTIME',<ServiceDetailRich service={wash} siblings={[wash]} priceLabel={s=>'₹600'} eligible={true} added={false} onToggle={noop} onOpen={noop} onInspect={noop} onSelect={noop}/>)}</section>
 <section>{shell('PAINT DETAIL · EXISTING, FOR REVIEW',<ServiceProductSelection title="Ceramic" services={[ceramic,ceramicB]} priceLabel={s=>s.id==='cer-c1'?'₹25,000':'₹30,000'} onOpen={noop}/>)}</section>
 <section>{shell('VISITS EMPTY',<StatePanel compact icon="bookings" title="Nothing booked" body="Pick a service and a time. The studio confirms it." action={<Button label="Book a service" onPress={noop}/>}/>)}</section>
 <section>{shell('MEMBERSHIP · V17 CARDS · NEWLY APPROVED LADDER AS CANDIDATE DATA · PLATINUM INTERIOR REFRESH SHOWN, ENTITLEMENT BACKEND SEPARATE',<PlanCompare cols={plans} onOpen={noop}/>)}</section>
 <section>{shell('HOME',<HomeView {...homeProps}/>)}</section>
 <section>{shell('TAB BAR',<div style={{position:'relative',height:120}}>{tabBar}</div>)}</section>
 <section>{shell('GIFTS · SERVICE SELECTOR, BUY CARD, CODE CARD, COMPACT EMPTY',giftsPreview)}</section>
 <section>{shell('ACCOUNT · REAL FULL PAGE, AUTH/ROUTER MOCKED, READ-ONLY',<YouScreen/>)}</section>
</div>;
createRoot(document.getElementById('root')!).render(<ExperienceThemeProvider>
 <div style={{font:'12px sans-serif',color:'#EC8638',background:'#18181c',padding:10,textAlign:'center'}}>LOCAL DESIGN PREVIEW · CORRECTION CANDIDATE · SYNTHETIC CONTENT · NO ACCOUNT OR WRITES</div>
 {q.has('paint')?shell('PAINT DETAIL · EXISTING COMPOSITION, FOR REVIEW',<ServiceProductSelection title="Ceramic" services={[ceramic,ceramicB]} priceLabel={s=>s.id==='cer-c1'?'₹25,000':'₹30,000'} onOpen={noop}/>)
 :q.has('detail')?shell('SERVICE DETAIL · NON-PAINT RICH LAYOUT · SAMPLE CATALOGUE CONTENT, LIVE COPY AND OPTIONS RENDER AT RUNTIME',<ServiceDetailRich service={wash} siblings={[wash]} priceLabel={s=>'₹600'} eligible={true} added={false} onToggle={noop} onOpen={noop} onInspect={noop} onSelect={noop}/>)
 :q.has('home')?shell('HOME · SMALLER HERO, LARGER CAR CARD, STUDIO STATUS RIGHT, THEMED SOCIAL TILES',<HomeView {...homeProps}/>)
 :q.has('visits')?shell('VISITS · COMPACT EMPTY CARD, CENTRED ACTION',<StatePanel compact icon="bookings" title="Nothing booked" body="Pick a service and a time. The studio confirms it." action={<Button label="Book a service" onPress={noop}/>}/>)
 :q.has('plans')?shell('MEMBERSHIP · V17 CARDS · NEWLY APPROVED LADDER AS CANDIDATE DATA',<PlanCompare cols={plans} onOpen={noop}/>)
 :q.has('tabs')?shell('TAB BAR · NO HOME LABEL UNDER MONOGRAM',<div style={{position:'relative',height:120}}>{tabBar}</div>)
 :q.has('gifts')?shell('GIFTS · SERVICE SELECTOR, BUY CARD, CODE CARD, COMPACT EMPTY STATE',giftsPreview)
 :q.has('account')?shell('ACCOUNT · REAL FULL PAGE · AUTH AND ROUTER MOCKED, NO WRITES',<YouScreen/>)
 :sections}
</ExperienceThemeProvider>);
