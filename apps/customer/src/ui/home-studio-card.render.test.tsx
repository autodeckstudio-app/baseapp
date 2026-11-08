import React from "react";import{it,expect,vi}from"vitest";import{create,act}from"react-test-renderer";import{Pressable}from"react-native";
vi.mock("react-native",async()=>({...await vi.importActual<any>("react-native"),Image:"Image"}));
vi.mock("../lib/imagery",()=>({sceneImagery:{},serviceImagery:{}}));
vi.mock("expo/fetch",()=>({fetch:vi.fn()}));
vi.mock("expo-image-picker",()=>({launchImageLibraryAsync:vi.fn(),requestMediaLibraryPermissionsAsync:vi.fn()}));
vi.mock("./CarsCard",()=>({CarsCard:()=>null}));
vi.mock("./CarThumb",()=>({CarThumb:()=>null}));
const motion=vi.hoisted(()=>({reduced:false}));
vi.mock("../lib/reduce-motion",()=>({useReduceMotion:()=>motion.reduced}));
import{HomeView}from"./HomeView";
it("home studio card hides only address and preserves status hours directions and contact actions",async()=>{const directions=vi.fn(),studio=vi.fn(),call=vi.fn();let r:any;await act(async()=>{r=create(<HomeView {...{greeting:"Good evening",initial:"F",unread:0,cars:[],services:[],reminders:[],progress:null,live:null,membership:null,studio:{address:"PRIVATE-STUDIO-ADDRESS",hours:"HOURS-KEPT",openText:"OPEN-KEPT"},social:[],quick:[{key:"call",label:"Call",icon:"call",onPress:call},{key:"map",label:"Directions",icon:"directions",onPress:directions}],onAvatar:()=>{},onBell:()=>{},onSearch:()=>{},onAllServices:()=>{},onService:()=>{},onCar:()=>{},onAddCar:()=>{},onBook:()=>{},onMembership:()=>{},onReminders:()=>{},onStudio:studio}as any}/>)});const text=JSON.stringify(r.toJSON());expect(text).not.toContain("PRIVATE-STUDIO-ADDRESS");expect(text).toContain("HOURS-KEPT");expect(text).toContain("OPEN-KEPT");for(const [label,fn]of [["Call",call],["Directions",directions]]as const){await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel===label).props.onPress());expect(fn).toHaveBeenCalledTimes(1)}await act(async()=>r.unmount());});

it.each([false,true])("contact tiles retain every callback, 44px targets and reduced-motion press behavior (%s)",async(reduced)=>{
 motion.reduced=reduced;
 const callbacks=Array.from({length:5},()=>vi.fn());let r:any;const props={greeting:"Good evening",initial:"F",unread:0,cars:[],services:[],reminders:[],progress:null,live:null,membership:null,studio:{address:"HIDDEN",hours:"Hours",openText:"Open"},quick:[{key:"call",label:"Call",icon:"call",onPress:callbacks[0]},{key:"wa",label:"WhatsApp",icon:"whatsapp",onPress:callbacks[1]},{key:"map",label:"Directions",icon:"directions",onPress:callbacks[2]}],social:[{key:"wac",title:"WhatsApp",sub:"Our channel",icon:"channel",onPress:callbacks[3]},{key:"ig",title:"Instagram",sub:"@autodeck.studio",icon:"instagram",onPress:callbacks[4]}],onAvatar:()=>{},onBell:()=>{},onSearch:()=>{},onAllServices:()=>{},onService:()=>{},onCar:()=>{},onAddCar:()=>{},onBook:()=>{},onMembership:()=>{},onReminders:()=>{}};
 await act(async()=>{r=create(<HomeView {...props as any}/>)});
 for(const [i,label]of ["Call","WhatsApp","Directions","WhatsApp, Our channel","Instagram, @autodeck.studio"].entries()){
 const button=r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel===label);expect(button).toBeTruthy();const style=button.props.style({pressed:true});expect(style.minHeight).toBeGreaterThanOrEqual(44);expect(style.transform).toEqual(reduced?[]:[{scale:i<3?0.96:0.97}]);await act(async()=>button.props.onPress());expect(callbacks[i]).toHaveBeenCalledTimes(1);
 }await act(async()=>r.unmount());
});
