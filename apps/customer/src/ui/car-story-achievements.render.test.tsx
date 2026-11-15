import React from "react";
import { it, expect, vi } from "vitest";
import { create, act } from "react-test-renderer";
vi.mock("../lib/reduce-motion",()=>({useReduceMotion:()=>true}));
import { CarStoryAchievements } from "./CarStoryAchievements";
it.each([0,1,2,3,5,10,12])("earned milestones and progress use %s real recorded visits only",async(visits)=>{
 let r:any;await act(async()=>{r=create(<CarStoryAchievements story={{visits,since:null,protections:[]}}/>)});
 for(const n of [1,3,5,10]){const earned=visits>=n;expect(r.root.findAll((x:any)=>typeof x.props.accessibilityLabel==='string'&&x.props.accessibilityLabel.endsWith(`${n} completed ${n===1?'visit':'visits'}`)&&x.props.accessibilityLabel.includes(earned?'earned':'not reached')).length).toBeGreaterThan(0)}
 const json=JSON.stringify(r.toJSON());expect(json).not.toContain('First recorded visit');expect(json).not.toMatch(/discount|points|free|reward/i);
 expect(r.root.findAll((x:any)=>x.props.accessibilityRole==='progressbar')[0].props.accessibilityValue.now).toBe(Math.min(visits,10));await act(async()=>r.unmount());
});
it("keeps only the actual sealed first-visit date",async()=>{let r:any;await act(async()=>{r=create(<CarStoryAchievements story={{visits:1,since:'11 Oct 2026',protections:[]}}/>)});expect(JSON.stringify(r.toJSON())).toContain('11 Oct 2026');await act(async()=>r.unmount())});

it.each([[0,"Your story starts here"],[1,"First Spark"],[3,"Care Regular"],[5,"Garage Insider"],[10,"AutoDeck Legend"]])("shows earned title for %s visits",async(visits,title)=>{let r:any;await act(async()=>{r=create(<CarStoryAchievements story={{visits:Number(visits),since:null,protections:[]}}/>)});expect(r.root.findAll((x:any)=>x.props.testID==='car-story-earned-title')[0].props.children).toBe(title);await act(async()=>r.unmount())});

it("milestone titles have no decorative icon or empty badge containers",async()=>{let r:any;await act(async()=>{r=create(<CarStoryAchievements story={{visits:3,since:null,protections:[]}}/>)});const json=JSON.stringify(r.toJSON());expect(json).not.toContain('Svg');expect(json).not.toContain('72');expect(json).toContain('Care Regular');await act(async()=>r.unmount())});
