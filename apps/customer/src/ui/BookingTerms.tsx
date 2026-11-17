import{useState}from'react';
import{CANCEL_SHORT,CANCEL_BIGGER}from'@autodeck/core';
import{Pressable,View}from'react-native';
import{space}from'@autodeck/ui/theme';
import{Row,T}from'./kit';
/** Same booking disclosures behind one compact, accessible link. */
export function BookingTerms({combinedMode,onHelp}:{combinedMode:boolean;onHelp:()=>void}){
 const[showTerms,setShowTerms]=useState(false);
 return <View style={{gap:space.line}}>
  <T role="caption" tone="secondary">Washes and short jobs: free cancellation until {CANCEL_SHORT.freeUntilHours} hours before; applicable late fee Rs {CANCEL_SHORT.feePaise/100}.</T>
  <T role="caption" tone="secondary">Bigger services: free until {CANCEL_BIGGER.freeUntilHours} hours before; applicable late fee {CANCEL_BIGGER.feePercent}% {combinedMode?'of discounted service including GST, excluding unused pickup/drop.':"of the cancelled service's recorded total."}</T>
  <T role="caption" tone="secondary">The cancellation review shows the exact fee. Any refund needs studio approval and processing.</T>
  <Pressable accessibilityRole="button" accessibilityLabel="Booking terms" accessibilityState={{expanded:showTerms}} onPress={()=>setShowTerms(!showTerms)} style={{minHeight:48,justifyContent:'center',alignSelf:'flex-start'}}><T role="caption" tone="secondary" style={{textDecorationLine:'underline'}}>{showTerms?'Hide full terms':'View full terms'}</T></Pressable>
  {showTerms?<View style={{gap:space.line}}>
   <Row title="Changes" detail="Request from your booking. Approval is separate."/>
   <Row title="Cancellation" detail="Review the fee before confirming."/>
   <Row title="Same-visit services" detail="No cancellation fee applies while another booked service in the same visit goes ahead. The review shows the exact service fee."/>
   <Row title="Transport" detail={combinedMode?'Selected pickup/drop is included in this total.':'Pickup/drop is a separate request.'}/>
   <Row title="Timing" detail="The studio confirms transport timing with you."/>
   {combinedMode?<><Row title="Bigger-service late cancel" detail="20% of discounted service including GST."/><Row title="Late cancel window" detail="Free until 24 hours before."/><Row title="Unused pickup/drop" detail="Excluded from that percentage fee."/><Row title="No-show retention" detail="20% of discounted service, including GST."/><Row title="Unused transport" detail="Excluded from no-show retention."/><Row title="Refund remainder" detail="Sent for approval. Not refunded until processed."/></>:null}
   <Pressable accessibilityRole="button" onPress={onHelp}><T role="caption" tone="secondary">Questions before booking? <T role="caption" tone="accent">Open Help & contact.</T></T></Pressable>
  </View>:null}
 </View>;
}
