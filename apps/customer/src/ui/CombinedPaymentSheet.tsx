import{Modal,Pressable,ScrollView,View}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
import type{CombinedPaymentChoice}from'@autodeck/core';
import{Button,T,rupees}from'./kit';
export type CombinedPaymentSheetProps={visible:boolean;serviceName:string;summary:string;choice:CombinedPaymentChoice;totalPaise:number;payNowPaise:number;balancePaise:number;busy:boolean;onPay:()=>void;onGoBack:()=>void};
/** Presentation only. Caller supplies its checked snapshot verbatim. No rounding or payment policy lives here. */
export function CombinedPaymentSheet(p:CombinedPaymentSheetProps){
 const{colors,name}=useExperienceTheme();
 const back=()=>{if(!p.busy)p.onGoBack()};
 return <Modal visible={p.visible} transparent animationType="fade" onRequestClose={back}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.scrim}}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={{flex:1}}/><ScrollView accessibilityViewIsModal style={{maxHeight:'90%',flexGrow:0}} contentContainerStyle={{alignSelf:'center',width:'100%',maxWidth:640,padding:20,paddingBottom:28,gap:12,borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,borderColor:colors.borderSubtle,backgroundColor:name==='light'?'#FAF9F6':colors.surfaceElevated}}>
 <T role="title">Review payment</T><T role="bodyStrong">{p.serviceName}</T>
 <View>{[["Combined total",p.totalPaise],[p.choice==='advance20'?"Pay now (20%)":"Pay now (full)",p.payNowPaise],["Balance at studio",p.balancePaise]].map(([label,value])=><View key={String(label)} style={{flexDirection:'row',justifyContent:'space-between',gap:12,paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.borderSubtle}}><View style={{flex:1}}><T tone="secondary">{String(label)}</T></View><T role="bodyStrong">{rupees(Number(value))}</T></View>)}</View>
 <T role="caption" tone="secondary">{p.summary} No-show: 20% of discounted service including GST is kept. Unused transport is excluded. Refunds need approval; none is automatic.</T>
 <Button label={`Pay ${rupees(p.payNowPaise)}`} busy={p.busy} disabled={p.busy} onPress={p.onPay}/><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} disabled={p.busy} style={{minHeight:48,alignItems:'center',justifyContent:'center'}}><T tone="secondary">Go back</T></Pressable>
 </ScrollView></View></Modal>;
}
