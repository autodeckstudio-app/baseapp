import{useState}from'react';
import{CANCEL_SHORT,CANCEL_BIGGER}from'@autodeck/core';
import{Modal,Pressable,ScrollView,View}from'react-native';
import{Icon,useExperienceTheme}from'@autodeck/ui/native';
import{space}from'@autodeck/ui/theme';
import{Row,T}from'./kit';
/** Same booking disclosures behind one compact, accessible link. */
export function BookingTerms({combinedMode,onHelp}:{combinedMode:boolean;onHelp:()=>void}){
 const[showTerms,setShowTerms]=useState(false);const{colors}=useExperienceTheme();
 return <View style={{gap:space.line}}>
  <View style={{gap:2}}><T role="caption" tone="secondary">Washes and short jobs:</T><T role="caption" tone="secondary">Free cancellation until {CANCEL_SHORT.freeUntilHours} hours before;</T><T role="caption" tone="secondary">Applicable late fee Rs {CANCEL_SHORT.feePaise/100}.</T></View>
  <View style={{gap:2}}><T role="caption" tone="secondary">Bigger services: free until {CANCEL_BIGGER.freeUntilHours} hours before;</T><T role="caption" tone="secondary">Applicable late fee {CANCEL_BIGGER.feePercent}% {combinedMode?'of discounted service including GST,':"of the cancelled service's recorded total."}</T>{combinedMode?<T role="caption" tone="secondary">Excluding unused pickup/drop.</T>:null}</View>
  <View style={{gap:2}}><T role="caption" tone="secondary">The cancellation review shows the exact fee.</T><T role="caption" tone="secondary">Any refund needs studio approval and processing.</T></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Booking terms" accessibilityState={{expanded:showTerms}} onPress={()=>setShowTerms(!showTerms)} style={{minHeight:48,justifyContent:'center',alignSelf:'flex-start'}}><T role="caption" tone="secondary" style={{textDecorationLine:'underline'}}>View full terms</T></Pressable>
  <Modal visible={showTerms} transparent animationType="fade" onRequestClose={()=>setShowTerms(false)}><View style={{flex:1,backgroundColor:colors.scrim,justifyContent:'center',padding:20}}><View accessibilityViewIsModal style={{width:'100%',maxWidth:560,maxHeight:'85%',alignSelf:'center',backgroundColor:colors.surfaceElevated,borderRadius:24,overflow:'hidden'}}><View style={{paddingLeft:20,paddingRight:8,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:12}}><T role="heading" style={{flex:1}}>Booking terms</T><Pressable accessibilityRole="button" accessibilityLabel="Close booking terms" onPress={()=>setShowTerms(false)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="close" size={20} color={colors.textPrimary}/></Pressable></View><ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:24,gap:space.line}}>
   <Row title="Changes" detail="Request from your booking. Approval is separate."/>
   <Row title="Cancellation" detail="Review the fee before confirming."/>
   <Row title="Same-visit services" detail={<View style={{gap:2}}><T role="caption" tone="tertiary">No cancellation fee applies while another booked service</T><T role="caption" tone="tertiary">in the same visit goes ahead.</T><T role="caption" tone="tertiary">The review shows the exact service fee.</T></View>}/>
   <Row title="Transport" detail={combinedMode?'Selected pickup/drop is included in this total.':'Pickup/drop is a separate request.'}/>
   <Row title="Timing" detail="The studio confirms transport timing with you."/>
   {combinedMode?<><Row title="Bigger-service late cancel" detail="20% of discounted service including GST."/><Row title="Late cancel window" detail="Free until 24 hours before."/><Row title="Unused pickup/drop" detail="Excluded from that percentage fee."/><Row title="No-show retention" detail="20% of discounted service, including GST."/><Row title="Unused transport" detail="Excluded from no-show retention."/><Row title="Refund remainder" detail="Sent for approval. Not refunded until processed."/></>:null}
   <Pressable accessibilityRole="button" onPress={()=>{setShowTerms(false);onHelp()}}><T role="caption" tone="secondary">Questions before booking? <T role="caption" tone="accent">Open Help & contact.</T></T></Pressable>
  </ScrollView></View></View></Modal>
 </View>;
}
