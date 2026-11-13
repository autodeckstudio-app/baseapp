import { Pressable, View } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { raised } from '../lib/raised';
import { NavIcon } from './NavIcon';
import { T } from './kit';
/** Page-aligned full-row actions. Removal confirmation stays with the caller. */
export function GarageDetailActions({onEdit,onRemove}:{onEdit:()=>void;onRemove:()=>void}) {
 const {name,colors}=useExperienceTheme();
 return <View testID="garage-detail-actions" style={{...raised(name).card,overflow:'hidden',width:'100%'}}>{([{label:'Edit vehicle',icon:'edit',press:onEdit,danger:false},{label:'Remove from garage',icon:'delete',press:onRemove,danger:true}] as const).map((a,i)=><Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.press} style={({pressed})=>({minHeight:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:i?1:0,borderTopColor:colors.borderSubtle,opacity:pressed?.65:1})}><NavIcon name={a.icon} size={20} cut={colors.surface} color={a.danger?colors.danger:colors.textPrimary}/><T role="bodyStrong" tone={a.danger?'danger':'primary'}>{a.label}</T></Pressable>)}</View>;
}
