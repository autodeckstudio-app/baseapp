vi.mock('../lib/service-type-images',()=>({serviceTypeImage:()=>({uri:'preview-test'})}));
vi.mock('../lib/brand-logos',()=>({BRAND_LOGOS:{}}));
vi.mock('react-native',async()=>({...await vi.importActual<any>('react-native'),Image:'Image'}));
vi.mock('../lib/catalogue-assets',()=>({catalogueAsset:()=>undefined,hasCataloguePhoto:()=>false,spotlightProductPhoto:()=>undefined,spotlightProductImageCaption:()=>undefined}));
import React from 'react';import{it,expect,vi}from'vitest';import{act,create}from'react-test-renderer';import{Pressable}from'react-native';import{ServiceDetailRich}from'./ServiceDetailRich';
const wash:any={id:'wash-regular',name:'Regular Wash',brand:'Standard',basePrice:60000,estimatedDurationMinutes:45,active:true,description:'Thorough exterior and interior wash\nTwo-bucket hand wash\nWheel and tyre cleaning\nNot a detailing service',careTips:['Wash weekly to keep the paint clear of dust.'],customerMenu:{home:'washing',family:'Exterior'}};
const foam:any={id:'wash-foam',name:'Foam wash',brand:'Standard',basePrice:90000,estimatedDurationMinutes:60,active:true,description:'Foam bath\nThick snow foam',customerMenu:{home:'washing',family:'Exterior'}};

it('renders one rich detail with canonical lines, price beside the name and a quiet action',async()=>{
 let r:any;const open=vi.fn(),toggle=vi.fn();
 await act(async()=>{r=create(<ServiceDetailRich service={wash} siblings={[wash,foam]} priceLabel={s=>s.id==='wash-regular'?'₹600':'₹900'} eligible={true} added={false} onToggle={toggle} onOpen={open} onInspect={()=>{}} onSelect={()=>{}}/>)});
 const text=JSON.stringify(r.toJSON());
 for(const value of ['Regular Wash','₹600','Thorough exterior and interior wash','Two-bucket hand wash','Wheel and tyre cleaning','Compatibility: ','Not a detailing service','Wash weekly to keep the paint clear of dust.'])expect(text).toContain(value);
 const add=r.root.findAllByType(Pressable).find((x:any)=>x.props.accessibilityLabel==='Add Regular Wash');
 await act(async()=>add.props.onPress());expect(toggle).toHaveBeenCalledWith(wash);expect(open).not.toHaveBeenCalled();
 await act(async()=>r.unmount());
});

it('lists same-family options with prices right; selecting an option never books',async()=>{
 let r:any;const open=vi.fn(),select=vi.fn();
 await act(async()=>{r=create(<ServiceDetailRich service={wash} siblings={[wash,foam]} priceLabel={s=>s.id==='wash-regular'?'₹600':'₹900'} eligible={true} added={false} onToggle={()=>{}} onOpen={open} onInspect={()=>{}} onSelect={select}/>)});
 const radios=r.root.findAllByType(Pressable).filter((x:any)=>x.props.accessibilityRole==='radio');
 expect(radios).toHaveLength(2);
 const text=JSON.stringify(r.toJSON());expect(text).toContain('₹900');
 await act(async()=>radios[1].props.onPress());expect(select).toHaveBeenCalledWith(foam);expect(open).not.toHaveBeenCalled();
 await act(async()=>r.unmount());
});

it('quote services discuss requirements and never invent a price',async()=>{
 const quote:any={id:'q',name:'Headlight restoration',priceOnRequest:true,basePrice:0,active:true,description:'Restore clarity\nMachine polish',customerMenu:{home:'detailing',family:'Exterior surfaces'}};
 let r:any;const inspect=vi.fn();
 await act(async()=>{r=create(<ServiceDetailRich service={quote} siblings={[quote]} priceLabel={()=>'₹99,999'} eligible={false} added={false} onOpen={()=>{}} onInspect={inspect} onSelect={()=>{}}/>)});
 const text=JSON.stringify(r.toJSON());
 expect(text).toContain('Quote on request');expect(text).not.toContain('99,999');expect(text).not.toContain('Add to cart');
 const discuss=r.root.findAllByType(Pressable).find((x:any)=>x.props.accessibilityLabel==='Discuss requirements for Headlight restoration');
 await act(async()=>discuss.props.onPress());expect(inspect).toHaveBeenCalledWith(quote);
 await act(async()=>r.unmount());
});
