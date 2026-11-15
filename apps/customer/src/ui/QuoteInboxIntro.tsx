import {useState} from "react";
import {View,Pressable} from "react-native";
import {Pane,T} from "./kit";
export function QuoteInboxIntro(){const[open,setOpen]=useState(false);return <Pane pad="inset"><View style={{gap:10}}>
 <T role="caption" tone="secondary">Requests and free walk-in inspections do not reserve a slot or bay.</T>
 <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{minHeight:36,justifyContent:'center'}}><T role="caption">{open?'Hide quote guide':'How quotes work'} {open?'−':'+'}</T></Pressable>
 {open?<View style={{gap:8}}><T role="caption" tone="secondary">The studio confirms product availability, work and price.</T><T role="caption" tone="secondary">You approve before service starts. A pending price is awaiting the studio.</T></View>:null}
 </View></Pane>}
