import {Pressable, View} from 'react-native';
import {Button,T} from './kit';
/** The two destinations share a row when room permits; neither disappears at larger text sizes. */
export function GarageActions({onBook,onHistory}:{onBook:()=>void;onHistory:()=>void}){
 return <View testID="garage-actions" style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',columnGap:12,rowGap:4}}>
 <Button label="Book a service" style={{marginTop:0,marginBottom:0,paddingHorizontal:14}} onPress={onBook}/>
 <Pressable accessibilityRole="button" accessibilityLabel="Service history" onPress={onHistory} style={{minHeight:48,justifyContent:'center',paddingHorizontal:2}}><T role="label">Service history →</T></Pressable>
 </View>;
}
