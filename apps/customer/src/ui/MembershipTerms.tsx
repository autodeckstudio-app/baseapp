import {View} from 'react-native';
import {T} from './kit';

/** Reviewable membership facts. These only present the existing plan rules. */
function Term({label,children}:{label:string;children:React.ReactNode}){
 return <View style={{gap:4,paddingVertical:10}}><T role="caption" tone="tertiary">{label}</T><T role="caption" tone="secondary">{children}</T></View>;
}
export function MembershipUpgradeTerms({tier,paysFullPrice}:{tier:string;paysFullPrice:boolean}){
 return <View accessibilityLabel="Upgrade terms" style={{gap:2}}>
  <Term label="Current plan">Your {tier} plan ends when the upgrade is paid.</Term>
  <Term label="Unused benefits">Unused washes and pickups do not carry over.</Term>
  <Term label="Upgrade price">{paysFullPrice?'You have used part of this plan, so the full new price applies.':'Nothing used yet, so you pay only the difference.'}</Term>
  <Term label="New plan">The new plan runs 30 days from the day it starts.</Term>
 </View>;
}
export function MembershipActivationTerms(){
 return <View accessibilityLabel="When benefits start" style={{gap:2}}>
  <T role="caption" tone="secondary">Benefits unlock only after your payment is confirmed.</T>
  <Term label="Online">Activates automatically once payment is verified.</Term>
  <Term label="Pay at studio">The front desk confirms your request.</Term>
 </View>;
}
