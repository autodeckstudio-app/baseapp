import React from "react";
import {it,expect,vi,beforeEach} from "vitest";
import {create,act,type ReactTestRenderer} from "react-test-renderer";
const h=vi.hoisted(()=>({snapshot:null as null|((s:unknown)=>void),owner:"canonical-profile",key:0,memberOwner:null as any,member:null as null|((s:unknown[])=>void),browser:vi.fn(async()=>({type:"opened"})),unsub:vi.fn(),purchase:vi.fn(async()=>({membershipId:"m",paymentId:"p",paymentUrl:"https://pay.example"}))}));
vi.mock("firebase/functions",()=>({httpsCallable:vi.fn()}));
vi.mock("firebase/firestore",()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>true,data:()=>({id:"plan",name:"Gold",tier:"gold",priceInPaise:90000,includedWashes:3,freePickups:0})}),onSnapshot:(_r:unknown,cb:(s:unknown)=>void)=>{h.snapshot=cb;return h.unsub;}}));
vi.mock("expo-web-browser",()=>({openBrowserAsync:()=>h.browser()}));
vi.mock("../../../lib/firebase",()=>({db:{},functions:{}}));
vi.mock("../../../hooks/useAuth",()=>({useAuth:()=>({status:"ready",customerDocId:h.owner,user:{uid:"auth-different"},claims:{tenantId:"t"}})}));
vi.mock("../../../lib/membership-service",()=>({purchaseMembership:(...args:any[])=>(h.purchase as any)(...args),upgradeMembership:vi.fn(),generateIdempotencyKey:()=>`key-${++h.key}`}));
vi.mock("../../../lib/home-service",()=>({listenToMyMemberships:(_t:unknown,_u:unknown,cb:(s:unknown[])=>void)=>{h.memberOwner=_u;h.member=cb;cb([]);return()=>{};}}));
vi.mock("../../../ui/kit",()=>({Screen:({children}:any)=><section>{children}</section>,Notice:({title,body,action}:any)=><article>{title}{body}{action}</article>,Button:({label,onPress}:any)=><button onClick={onPress}>{label}</button>,Loading:()=>null,Kicker:({children}:any)=><span>{children}</span>,Pane:({children}:any)=><div>{children}</div>,Row:()=>null,T:({children}:any)=><span>{children}</span>,rupees:(n:number)=>String(n)}));
import {__params} from "../../../../test/stubs/expo-router";
import Screen from "./purchase";
beforeEach(()=>{__params.current={planId:"plan"};vi.clearAllMocks();});
it("mounted web membership uses hosted tab, browser-open is not success, server membership listener alone unlocks",async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<Screen/>);});
 expect(h.memberOwner).toBe("canonical-profile");const button=tree.root.findAllByType("button").find(b=>String(b.props.children).includes("Pay online"));expect(button).toBeTruthy();
 let pending:unknown;await act(async()=>{pending=button!.props.onClick();await Promise.resolve();});
 expect(h.browser).toHaveBeenCalledTimes(1);expect(JSON.stringify(tree.toJSON())).not.toContain("Membership active");
 await act(async()=>{h.snapshot?.({exists:()=>true,data:()=>({status:"completed"})});await pending;});
 expect(JSON.stringify(tree.toJSON())).not.toContain("Membership active");
 await act(async()=>{h.member?.([{id:"m",planId:"plan",tier:"gold",status:"active"}]);});expect(JSON.stringify(tree.toJSON())).toContain("Membership active");await act(async()=>tree.unmount());
});

it("mounted purchase singleflight and former plan result cannot open payment or overwrite new plan",async()=>{
 let resolve:any;h.purchase.mockImplementationOnce(()=>new Promise(r=>resolve=r));let tree!:ReactTestRenderer;await act(async()=>{tree=create(<Screen/>)});const pay=()=>tree.root.findAllByType("button").find(b=>String(b.props.children).includes("Pay online"))!;
 await act(async()=>{pay().props.onClick();pay().props.onClick()});expect(h.purchase).toHaveBeenCalledTimes(1);__params.current={planId:"other"};await act(async()=>tree.update(<Screen/>));await act(async()=>resolve({membershipId:"old",paymentId:"p",paymentUrl:"https://pay.example"}));expect(h.browser).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).not.toContain("Payment pending");await act(async()=>tree.unmount());
});

it('actual plan and canonical account changes rotate purchase intent keys while retries keep one key',async()=>{h.owner='canonical-profile';h.purchase.mockResolvedValue({membershipId:'m',paymentId:'p',paymentUrl:'https://pay.example'});let tree!:ReactTestRenderer;await act(async()=>{tree=create(<Screen/>)});const cash=()=>tree.root.findAllByType('button').find(b=>String(b.props.children).includes('Pay at studio'))!;const pay=()=>tree.root.findAllByType('button').find(b=>String(b.props.children).includes('Pay online'))!;
 h.purchase.mockRejectedValueOnce(Error('retry'));await act(async()=>pay().props.onClick());const key=(h.purchase.mock.calls[0]as any)[2];h.purchase.mockRejectedValueOnce(Error('retry'));await act(async()=>pay().props.onClick());expect((h.purchase.mock.calls[1]as any)[2]).toBe(key);__params.current={planId:'other'};await act(async()=>tree.update(<Screen/>));h.purchase.mockRejectedValueOnce(Error('retry'));await act(async()=>pay().props.onClick());const next=(h.purchase.mock.calls[2]as any)[2];expect(next).not.toBe(key);h.owner='other-profile';await act(async()=>tree.update(<Screen/>));h.purchase.mockRejectedValueOnce(Error('retry'));await act(async()=>pay().props.onClick());expect((h.purchase.mock.calls[3]as any)[2]).not.toBe(next);await act(async()=>tree.unmount())});
