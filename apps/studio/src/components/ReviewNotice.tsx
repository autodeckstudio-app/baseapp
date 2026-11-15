import {Text,View} from 'react-native';
import {colors,typography} from '@autodeck/ui';
/** A neutral review notice. No success icon or implied confirmation. */
export function ReviewNotice({title,lines,warning=false}:{title:string;lines:readonly string[];warning?:boolean}){
 return <View style={{gap:8,paddingVertical:12}}>
  <Text style={{...typography.bodyMedium,color:warning?colors.error:colors.textPrimary}}>{title}</Text>
  {lines.map(line=><Text key={line} style={{...typography.caption,color:warning?colors.error:colors.textMuted}}>{line}</Text>)}
 </View>;
}
