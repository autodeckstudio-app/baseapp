import{View}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
import{T}from'./kit';
/** Display-only summary. Values are formatted by the caller from the reviewed payment snapshot. */
export function PaymentChoiceSummary({payNow,balance}:{payNow:string;balance:string}){
 const{colors}=useExperienceTheme();
 return <View testID="payment-choice-summary" style={{borderTopWidth:1,borderTopColor:colors.borderSubtle,paddingTop:14,gap:10}}>{[{label:'Pay now',value:payNow,strong:true},{label:'Booking balance at studio',value:balance,strong:false}].map(r=><View key={r.label} style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:20}}><T role="caption" tone={r.strong?'primary':'secondary'} style={{flex:1,lineHeight:19}}>{r.label}</T><T role={r.strong?'bodyStrong':'caption'} style={{textAlign:'right',flexShrink:1,lineHeight:19,fontVariant:['tabular-nums']}}>{r.value}</T></View>)}</View>
}
