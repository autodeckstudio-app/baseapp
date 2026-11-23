import{Pressable,Text}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
/** Named action text and a full tap target, without decorative arrows. */
export function ServiceNextAction({label,disabled,onPress}:{label:string;disabled:boolean;onPress:()=>void}){const{colors}=useExperienceTheme();return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({minWidth:48,minHeight:48,maxWidth:120,paddingHorizontal:8,alignItems:'center',justifyContent:'center',opacity:disabled?.64:pressed?.6:1})}><Text style={{color:colors.textPrimary,fontSize:12,lineHeight:17,fontWeight:'600',textAlign:'center'}}>{label}</Text></Pressable>}
