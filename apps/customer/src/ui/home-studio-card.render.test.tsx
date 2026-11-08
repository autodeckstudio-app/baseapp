import React from "react";import{it,expect,vi}from"vitest";import{create,act}from"react-test-renderer";import{Pressable}from"react-native";
vi.mock("react-native",async()=>({...await vi.importActual<any>("react-native"),Image:"Image"}));
vi.mock("../lib/imagery",()=>({sceneImagery:{},serviceImagery:{}}));
vi.mock("expo/fetch",()=>({fetch:vi.fn()}));
vi.mock("expo-image-picker",()=>({launchImageLibraryAsync:vi.fn(),requestMediaLibraryPermissionsAsync:vi.fn()}));
vi.mock("./CarsCard",()=>({CarsCard:()=>null}));
vi.mock("./CarThumb",()=>({CarThumb:()=>null}));
import{HomeView}from"./HomeView";
it("home studio card hides only address and preserves status hours directions and contact actions",async()=>{const directions=vi.fn(),studio=vi.fn(),call=vi.fn();let r:any;await act(async()=>{r=create(<HomeView {...{greeting:"Good evening",initial:"F",unread:0,cars:[],services:[],reminders:[],progress:null,live:null,membership:null,studio:{address:"PRIVATE-STUDIO-ADDRESS",hours:"HOURS-KEPT",openText:"OPEN-KEPT"},social:[],quick:[{key:"call",label:"Call",icon:"call",onPress:call},{key:"map",label:"Directions",icon:"directions",onPress:directions}],onAvatar:()=>{},onBell:()=>{},onSearch:()=>{},onAllServices:()=>{},onService:()=>{},onCar:()=>{},onAddCar:()=>{},onBook:()=>{},onMembership:()=>{},onReminders:()=>{},onStudio:studio}as any}/>)});const text=JSON.stringify(r.toJSON());expect(text).not.toContain("PRIVATE-STUDIO-ADDRESS");expect(text).toContain("HOURS-KEPT");expect(text).toContain("OPEN-KEPT");for(const [label,fn]of [["Call",call],["Directions",directions]]as const){await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel===label).props.onPress());expect(fn).toHaveBeenCalledTimes(1)}await act(async()=>r.unmount());});
