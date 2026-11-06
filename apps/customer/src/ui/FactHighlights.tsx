import{View}from'react-native';import{T}from'./kit';
/** Values must come from a record or explicit policy. Missing facts are omitted, not invented. */
export function FactHighlights({facts}:{facts:readonly{value:string;label:string}[]}){return <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{facts.map(f=><View key={f.label} style={{flexGrow:1,flexBasis:140,minWidth:0,padding:14,gap:5,borderRadius:18,borderWidth:1,borderColor:'rgba(128,128,128,0.2)'}}><T role="heading">{f.value}</T><T role="caption" tone="secondary">{f.label}</T></View>)}</View>}
