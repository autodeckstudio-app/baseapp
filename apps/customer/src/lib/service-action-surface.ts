import { Platform, type ViewStyle } from 'react-native';
import { raised, type Mode } from './raised';

/** Quiet glass for service actions. State remains explicit in the label. */
export function serviceActionSurface(mode:Mode,selected=false,pressed=false):ViewStyle{
 const night=mode!=='light';
 return {
  ...raised(mode).primary,
  borderRadius:14,
  borderWidth:1,
  borderColor:night?(selected?'#aeb9c5':'rgba(223,231,240,.34)'):(selected?'#647384':'rgba(113,127,144,.36)'),
  backgroundColor:night?(selected?'#39444f':'#303943'):(selected?'#e4eaf0':'#f4f6f8'),
  ...(Platform.OS==='web'?({
   backgroundImage:night?'linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.015))':'linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.18))',
   boxShadow:pressed?'inset 0 1px 4px rgba(20,30,42,.12)':'inset 0 1px 0 rgba(255,255,255,.5), 0 3px 8px rgba(20,30,42,.07)',
  }as ViewStyle):{}),
  transform:pressed?[{scale:.98}]:[],
 };
}
