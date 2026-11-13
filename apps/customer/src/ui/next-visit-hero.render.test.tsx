import React from "react";
import { it, expect, vi } from "vitest";
import { create, act } from "react-test-renderer";
import { Pressable, View } from "react-native";
import { NextVisitHero } from "./NextVisitHero";
it("cancel X is right of status, outside the visit press target, and never opens the visit",async()=>{
 const visit=vi.fn(),cancel=vi.fn();let r:any;
 await act(async()=>{r=create(<NextVisitHero date="2026-11-16" today="2026-11-13" time="11:00" title="Regular Wash" car="Sample Car" status="Pending" onPress={visit} trailingAction={<Pressable accessibilityRole="button" accessibilityLabel="Cancel booking" onPress={cancel}><View/></Pressable>}/>)});
 const x=r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel==="Cancel booking");let parent=x.parent;
 while(parent){expect(parent.type).not.toBe(Pressable);parent=parent.parent;}
 expect(x.parent.props.style.flexDirection).toBe("row");expect(x.parent.props.style.justifyContent).toBe("space-between");
 await act(async()=>x.props.onPress());expect(cancel).toHaveBeenCalledOnce();expect(visit).not.toHaveBeenCalled();
 await act(async()=>r.root.findAllByType(Pressable).find((n:any)=>n.props.accessibilityLabel?.startsWith("Next visit,")).props.onPress());expect(visit).toHaveBeenCalledOnce();await act(async()=>r.unmount());
});
