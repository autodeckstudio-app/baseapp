import{Modal,Pressable,View}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
import type{CombinedPaymentChoice}from'@autodeck/core';
import{Button,T,rupees}from'./kit';
import{PaymentSheetFrame}from'./PaymentSheetFrame';
export type CombinedPaymentSheetProps={visible:boolean;serviceName:string;summary:string;choice:CombinedPaymentChoice;totalPaise:number;payNowPaise:number;balancePaise:number;busy:boolean;onPay:()=>void;onGoBack:()=>void};
/** Presentation only. Caller supplies its checked snapshot verbatim. No rounding or payment policy lives here. */
export function CombinedPaymentSheet(p:CombinedPaymentSheetProps){
 const{colors}=useExperienceTheme();
 const back=()=>{if(!p.busy)p.onGoBack()};
 return <Modal visible={p.visible} transparent animationType="fade" onRequestClose={back}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.scrim}}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={{flex:1}}/><PaymentSheetFrame>
 <T role="title">Review payment</T><T role="bodyStrong">{p.serviceName}</T>
 <View>{[["Combined total",p.totalPaise],[p.choice==='advance20'?"Pay now (20%)":"Pay now (full)",p.payNowPaise],["Balance at studio",p.balancePaise]].map(([label,value])=><View key={String(label)} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:16,paddingVertical:14,borderBottomWidth:1,borderBottomColor:colors.borderSubtle}}><View style={{flex:1}}><T tone="secondary">{String(label)}</T></View><T role="bodyStrong">{rupees(Number(value))}</T></View>)}</View>

 <Button style={{alignSelf:'stretch',marginTop:4,marginBottom:0}} label={`Pay ${rupees(p.payNowPaise)}`} busy={p.busy} disabled={p.busy} onPress={p.onPay}/><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} disabled={p.busy} style={{minHeight:48,alignItems:'center',justifyContent:'center'}}><T tone="secondary">Go back</T></Pressable>
 </PaymentSheetFrame></View></Modal>;
}
