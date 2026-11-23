import {Image,View,Platform} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {T,rupees} from './kit';

/** Photo-led plan presentation, no new entitlements or purchase behavior. */
export function MembershipPlanShowcase({price,washes,pickups,priority,discount}:{price:number;washes:number;pickups:number|undefined;priority:boolean|undefined;discount:number}){
 const {colors}=useExperienceTheme();
 const rows=[{label:'Included washes',value:String(washes),unit:' / month'},...(pickups!==undefined?[{label:'Free pickups',value:String(pickups),unit:' / month'}]:[]),...(priority?[{label:'Priority slot',value:'Included',unit:''}]:[]),...(discount>0?[{label:'Discount',value:`${discount}%`,unit:''}]:[])];
 return <View style={{borderRadius:26,overflow:'hidden',borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface,...(Platform.OS==='web'?{boxShadow:'0 18px 46px rgba(0,0,0,.14)'}:{})}}>
  <View style={{height:190,backgroundColor:'#11151a'}}>
   <Image source={require('../../assets/imagery/membership.jpg')} resizeMode="cover" accessibilityLabel="Promotional car photograph" style={{position:'absolute',width:'100%',height:'100%'}}/>
   <View pointerEvents="none" style={{position:'absolute',inset:0,backgroundColor:'rgba(8,12,17,.12)',...(Platform.OS==='web'?{backgroundImage:'linear-gradient(180deg,rgba(6,10,15,.08) 28%,rgba(6,10,15,.16) 52%,rgba(6,10,15,.96) 100%)'}:{})}}/>
   <View style={{position:'absolute',top:18,left:20,paddingHorizontal:10,paddingVertical:5,borderRadius:8,borderWidth:1,borderColor:'rgba(255,255,255,.22)',backgroundColor:'rgba(15,20,27,.55)'}}><T role="label" style={{color:'#f2e5cc',fontSize:10,letterSpacing:1.7}}>YOUR PLAN</T></View>
   <View style={{position:'absolute',bottom:19,left:20,right:20,flexDirection:'row',alignItems:'baseline'}}><T role="display" style={{color:'#fff',fontSize:34,lineHeight:40,letterSpacing:-1.2}}>{rupees(price)}</T><T role="caption" style={{color:'#d2d8df'}}> / month</T></View>
  </View>
  <View style={{paddingHorizontal:20,paddingBottom:5,backgroundColor:colors.surface}}>
  {rows.map((r,i)=><View key={r.label} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:68,paddingVertical:13,borderBottomWidth:i===rows.length-1?0:1,borderColor:colors.borderSubtle}}>
   <T role="caption" tone="secondary" style={{flex:1}}>{r.label}</T>
   <View style={{flexDirection:'row',alignItems:'baseline'}}><T role="heading" style={{fontSize:r.unit?25:19,lineHeight:30,fontWeight:'500',letterSpacing:-.5}}>{r.value}</T>{r.unit?<T role="caption" tone="secondary">{r.unit}</T>:null}</View>
  </View>)}
  </View>
 </View>;
}
