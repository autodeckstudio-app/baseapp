import {View} from 'react-native';
import {Pane,T} from './kit';
import {useExperienceTheme} from '@autodeck/ui/native';
import {NavIcon,type NavIconName} from './NavIcon';

/** Reviewable membership facts. These only present the existing plan rules. */
function Term({label,children}:{label:string;children:React.ReactNode}){
 return <View style={{gap:4,paddingVertical:10}}><T role="caption" tone="tertiary">{label}</T><T role="caption" tone="secondary">{children}</T></View>;
}
export function MembershipUpgradeTerms({tier,paysFullPrice}:{tier:string;paysFullPrice:boolean}){
 return <View accessibilityLabel="Upgrade terms" style={{gap:2}}>
  <Term label="Current plan">Your {tier} plan ends when the upgrade is paid.</Term>
  <Term label="Unused benefits">Unused washes and pickups do not carry over.</Term>
  <Term label="Upgrade price">{paysFullPrice?'You have used part of this plan, so the full new price applies.':'Nothing used yet, so you pay only the difference.'}</Term>
  <Term label="New plan">Starts after payment is confirmed. Last-valid date is start date plus 30 calendar days. Valid through that date; expires at midnight IST as the next day begins.</Term>
 </View>;
}
function MembershipPoint({icon,children}:{icon:NavIconName;children:React.ReactNode}){
 const {colors}=useExperienceTheme();
 return <View style={{flexDirection:"row",alignItems:"flex-start",gap:10}}><View style={{paddingTop:1}}><NavIcon name={icon} size={18} color={colors.textSecondary} cut={colors.surface}/></View><T role="caption" tone="secondary" style={{flex:1,minWidth:0}}>{children}</T></View>;
}
export function MembershipActivationTerms({rollover,discounted=false}:{rollover?:string|null;discounted?:boolean}={}){
 return <Pane pad="inset"><View accessibilityLabel="When benefits start" style={{gap:14}}>
  <T role="heading">Before you pay</T>
  {rollover?<MembershipPoint icon="history">{rollover}</MembershipPoint>:null}
  {discounted?<MembershipPoint icon="club">Your discount applies to non-wash services at booking.</MembershipPoint>:null}
  <MembershipPoint icon="check">Benefits start after payment is confirmed.</MembershipPoint>
  <MembershipPoint icon="ceramic">Online: payment is verified automatically.</MembershipPoint>
  <MembershipPoint icon="pin">At studio: pay the front desk for confirmation.</MembershipPoint>
 </View></Pane>;
}
