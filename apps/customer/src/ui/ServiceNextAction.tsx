import{Pressable}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
import{NavIcon}from'./NavIcon';
/** Visible arrow only, with a named booking/quote action and full tap target. */
export function ServiceNextAction({label,disabled,onPress}:{label:string;disabled:boolean;onPress:()=>void}){const{name,colors}=useExperienceTheme();return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({width:48,height:48,alignItems:'center',justifyContent:'center',opacity:disabled?.64:pressed?.6:1})}><NavIcon name="proceed" color={colors.textPrimary} size={24} cut={name==='light'?'#FFFFFF':'#252C35'}/></Pressable>}
