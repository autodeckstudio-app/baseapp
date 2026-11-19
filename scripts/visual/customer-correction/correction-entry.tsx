import'../../../apps/customer/src/lib/boot-theme';
import React from 'react';
import{createRoot}from'react-dom/client';
import{isNightPalette}from'../../../packages/ui/src/tokens';
import{glacierGround}from'../../../apps/customer/src/lib/customer-glacier';
import{AutoExperienceThemeProvider as ExperienceThemeProvider}from'../../../packages/ui/src/native/ThemeContext';
import{ServiceProductSelection}from'../../../apps/customer/src/ui/ServiceProductSelection';
import{ServiceDetailRich}from'../../../apps/customer/src/ui/ServiceDetailRich';
import{ServiceJourney}from'../../../apps/customer/src/ui/ServiceJourney';
import{ServicePageHeader}from'../../../apps/customer/src/ui/ServicePageHeader';
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
const shell=(label:string,child:React.ReactNode)=><div style={{maxWidth:430,boxSizing:'border-box',margin:0,padding:'18px 14px 40px',background:glacierGround(isNightPalette),minHeight:'100vh'}}><div style={{font:'11px sans-serif',color:'#EC8638',letterSpacing:1.5,marginBottom:12}}>{label}</div>{child}</div>;
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
// CONCEPT SHEETS · FOR REVIEW ONLY · NOT APPLIED TO THE APP. Day palette from the approved customer theme.
import{NavIcon}from'../../../apps/customer/src/ui/NavIcon';
const C={canvas:'#ffffff',surface:'#f7f9fb',text:'#252c32',muted:'#596979',border:'rgba(113,133,155,.16)',accent:'#EC8638',accentInk:'#9e531a',ink:'#16181C'};
const navItem=(name:string,label:string,color:string,extra:React.CSSProperties={})=><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,...extra}}><NavIcon name={name as never} size={22} color={color} cut={C.surface}/>{label?<span style={{fontFamily:THEME_FONT,fontSize:10,color}}>{label}</span>:null}</div>;
const barWrap=(children:React.ReactNode,extra:React.CSSProperties={})=><div style={{display:'flex',alignItems:'center',justifyContent:'space-around',padding:'12px 10px',borderRadius:28,background:C.surface,border:`1px solid ${C.border}`,boxShadow:'0 10px 25px rgba(22,24,28,.10)',...extra}}>{children}</div>;
const navIdeas=<div style={{display:'flex',flexDirection:'column',gap:34}}>
 <div><div style={{font:'600 12px sans-serif',color:C.muted,marginBottom:8}}>A · CURRENT (reference)</div>{barWrap(<>{navItem('bookings','Visits',C.muted)}{navItem('services','Services',C.muted)}<div style={{width:56,height:56,borderRadius:28,background:C.ink,border:`2px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontFamily:THEME_FONT,fontWeight:700,marginTop:-28}}>AD</div>{navItem('garage','Garage',C.muted)}{navItem('profile','You',C.muted)}</>)}</div>
 <div><div style={{font:'600 12px sans-serif',color:C.muted,marginBottom:8}}>B · FLUSH MONOGRAM, ORANGE DOT MARKS THE ACTIVE TAB</div>{barWrap(<>{navItem('bookings','Visits',C.muted)}{navItem('services','Services',C.muted)}<div style={{width:40,height:40,borderRadius:20,background:C.ink,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontFamily:THEME_FONT,fontWeight:700,fontSize:14}}>AD</div><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><NavIcon name={'garage' as never} size={22} color={C.text} cut={C.surface}/><span style={{fontFamily:THEME_FONT,fontSize:10,color:C.text}}>Garage</span><span style={{width:5,height:5,borderRadius:3,background:C.accent}}/></div>{navItem('profile','You',C.muted)}</>)}</div>
 <div><div style={{font:'600 12px sans-serif',color:C.muted,marginBottom:8}}>C · FLAT BAR, ORANGE TICK, LABELS ON ALL TABS</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-around',padding:'10px 6px 8px',borderTop:`1px solid ${C.border}`,background:C.canvas}}>{[['bookings','Visits'],['services','Services'],['home','Home'],['garage','Garage'],['profile','You']].map((e,i)=>{const on=i===2;return <div key={e[1]} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}><span style={{width:14,height:3,borderRadius:2,background:on?C.accent:'transparent'}}/><NavIcon name={e[0] as never} size={22} color={on?C.accent:C.muted} cut={C.canvas}/><span style={{fontFamily:THEME_FONT,fontSize:10,color:on?C.accent:C.muted}}>{e[1]}</span></div>})}</div></div>
 <div><div style={{font:'600 12px sans-serif',color:C.muted,marginBottom:8}}>D · DARK ISLAND, WHITE ACTIVE DISC, ICONS ONLY</div>{barWrap(<>{navItem('bookings','','rgba(255,255,255,.65)')}{navItem('services','','rgba(255,255,255,.65)')}<div style={{width:44,height:44,borderRadius:22,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}><NavIcon name={'home' as never} size={22} color={C.ink} cut={'#fff'}/></div>{navItem('garage','','rgba(255,255,255,.65)')}{navItem('profile','','rgba(255,255,255,.65)')}</>,{background:C.ink,border:'none'})}</div>
</div>;
const btn=(label:string,s:React.CSSProperties,t:React.CSSProperties)=><div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'13px 26px',borderRadius:24,fontFamily:THEME_FONT,fontSize:13,fontWeight:600,...s}}><span style={t}>{label}</span></div>;
const ctxHead=(title:string)=><div style={{font:'600 12px sans-serif',color:C.muted,marginBottom:8}}>{title}</div>;
const ctxCard=(back:React.ReactNode,actions:React.ReactNode)=><div style={{background:C.canvas,border:`1px solid ${C.border}`,borderRadius:20,overflow:'hidden'}}>
 <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:`1px solid ${C.border}`}}>{back}<span style={{fontFamily:THEME_FONT,fontSize:13,fontWeight:600,color:C.text}}>Regular Wash</span><span style={{marginLeft:'auto',fontFamily:THEME_FONT,fontSize:13,fontWeight:600,color:C.text}}>₹600</span></div>
 <div style={{display:'flex',alignItems:'center',gap:16,padding:'12px 14px',justifyContent:'flex-end'}}>{actions}</div>
</div>;
const chev=(color:string)=><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const buttonIdeas=<div style={{display:'flex',flexDirection:'column',gap:30}}>
 <div>{ctxHead('A · HAIRLINE CHIPS: 32px controls, outline only, back as a small square')}
 {ctxCard(<div style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:10,border:`1px solid ${C.border}`,background:C.canvas}}>{chev(C.text)}</div>,
 <><div style={{display:'inline-flex',alignItems:'center',padding:'7px 14px',borderRadius:10,border:`1px solid ${C.border}`,fontFamily:THEME_FONT,fontSize:12,fontWeight:600,color:C.text}}>Details</div>
 <div style={{display:'inline-flex',alignItems:'center',padding:'7px 14px',borderRadius:10,border:`1px solid ${C.ink}`,background:C.ink,fontFamily:THEME_FONT,fontSize:12,fontWeight:600,color:'#fff'}}>Add to cart</div></>)}
 <div style={{font:'11px sans-serif',color:C.muted,marginTop:6}}>Same control grammar as the service list rows; touch targets stay 44px via padding around the 32px visual.</div></div>
 <div>{ctxHead('B · QUIET TEXT: no pills at all, small text actions in the negative space')}
 {ctxCard(<span style={{fontFamily:THEME_FONT,fontSize:12,fontWeight:500,color:C.muted}}>All services</span>,
 <><span style={{fontFamily:THEME_FONT,fontSize:12,fontWeight:500,color:C.muted}}>Details</span>
 <span style={{fontFamily:THEME_FONT,fontSize:12,fontWeight:700,color:C.text,borderBottom:`1.5px solid ${C.accent}`,paddingBottom:2}}>Add to cart</span></>)}
 <div style={{font:'11px sans-serif',color:C.muted,marginTop:6}}>Back stays the existing text crumb pattern. Primary is marked by weight plus a short orange underline, not a filled button.</div></div>
 <div>{ctxHead('C · TONAL MINI: 30px soft tonal controls, low visual weight')}
 {ctxCard(<div style={{display:'flex',alignItems:'center',justifyContent:'center',width:30,height:30,borderRadius:15,background:C.surface}}>{chev(C.muted)}</div>,
 <><span style={{fontFamily:THEME_FONT,fontSize:12,fontWeight:500,color:C.muted}}>Details</span>
 <div style={{display:'inline-flex',alignItems:'center',padding:'6px 14px',borderRadius:15,background:C.surface,border:`1px solid ${C.border}`,fontFamily:THEME_FONT,fontSize:12,fontWeight:600,color:C.text}}>Add to cart</div></>)}
 <div style={{font:'11px sans-serif',color:C.muted,marginTop:6}}>Tonal surfaces instead of outlines; nothing taller than 30px, no solid fills except the existing ink where a screen already uses it.</div></div>
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
 {q.has('back')?shell('SERVICE PAGE HEADER · COMPACT HAIRLINE BACK CONTROL · REAL SHARED COMPONENT',<ServicePageHeader context="Wash & care · Exterior" title="Regular Wash" crumbs={[{title:'All services',onPress:noop}]}/>)
 :q.has('paint')?shell('PAINT DETAIL · EXISTING COMPOSITION, FOR REVIEW',<ServiceProductSelection title="Ceramic" services={[ceramic,ceramicB]} priceLabel={s=>s.id==='cer-c1'?'₹25,000':'₹30,000'} onOpen={noop}/>)
 :q.has('services')?shell('SERVICES ROOT · ORIGINAL TILE LAYOUT KEPT, HEADING AND TITLES UNIFIED · SAMPLE CATALOGUE CONTENT',<ServiceJourney services={[wash,ceramic,ceramicB] as never} path={{}} query="" onPath={noop} onOpen={noop} onHelp={noop} priceLabel={()=>null} reviewing={false} onReview={noop} onBookSelection={noop}/>)
 :q.has('category')?shell('CATEGORY PAGE · INNER SERVICE LIST · SAMPLE CATALOGUE CONTENT',<ServiceJourney services={[wash,ceramic,ceramicB] as never} path={{home:'washing'} as never} query="" onPath={noop} onOpen={noop} onHelp={noop} priceLabel={()=>null} reviewing={false} onReview={noop} onBookSelection={noop}/>)
 :q.has('detail')?shell('SERVICE DETAIL · NON-PAINT RICH LAYOUT · SAMPLE CATALOGUE CONTENT, LIVE COPY AND OPTIONS RENDER AT RUNTIME',<ServiceDetailRich service={wash} siblings={[wash]} priceLabel={s=>'₹600'} eligible={true} added={false} onToggle={noop} onOpen={noop} onInspect={noop} onSelect={noop}/>)
 :q.has('home')?shell('HOME · SMALLER HERO, LARGER CAR CARD, STUDIO STATUS RIGHT, THEMED SOCIAL TILES',<HomeView {...homeProps}/>)
 :q.has('visits')?shell('VISITS · COMPACT EMPTY CARD, CENTRED ACTION',<StatePanel compact icon="bookings" title="Nothing booked" body="Pick a service and a time. The studio confirms it." action={<Button label="Book a service" onPress={noop}/>}/>)
 :q.has('plans')?shell('MEMBERSHIP · V17 CARDS · NEWLY APPROVED LADDER AS CANDIDATE DATA',<PlanCompare cols={plans} onOpen={noop}/>)
 :q.has('tabs')?shell('TAB BAR · DARK ISLAND, AD MONOGRAM, GLOW ONLY WHEN HOME SELECTED',<div style={{position:'relative',height:120}}>{tabBar}</div>)
 :q.has('gifts')?shell('GIFTS · SERVICE SELECTOR, BUY CARD, CODE CARD, COMPACT EMPTY STATE',giftsPreview)
 :q.has('account')?shell('ACCOUNT · REAL FULL PAGE · AUTH AND ROUTER MOCKED, NO WRITES',<YouScreen/>)
 :q.has('navideas')?shell('NAV IDEAS · CONCEPTS FOR REVIEW · NONE APPLIED',navIdeas)
 :q.has('buttonideas')?shell('COMPACT CONTROL IDEAS · SHOWN IN SCREEN CONTEXT · CONCEPTS FOR REVIEW · NONE APPLIED',buttonIdeas)
 :sections}
</ExperienceThemeProvider>);
