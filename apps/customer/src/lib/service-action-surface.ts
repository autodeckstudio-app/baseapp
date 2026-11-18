import { Platform, type ViewStyle } from 'react-native';
import { lightColors,nightColors } from '@autodeck/ui/theme';
import { raised, type Mode } from './raised';

/** Quiet glass for service actions. State remains explicit in the label. */
export function serviceActionSurface(mode:Mode,selected=false,pressed=false):ViewStyle{
 const night=mode!=='light',colors=night?nightColors:lightColors;
 return {
  ...raised(mode).primary,
  borderRadius:14,
  borderWidth:1,
  borderColor:selected?colors.accentStrong:raised(mode).primary.borderColor,
  backgroundColor:selected?colors.accentHaze:raised(mode).primary.backgroundColor,
  ...(Platform.OS==='web'?({
   backgroundImage:night?'linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.015))':'linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.18))',
   boxShadow:pressed?'inset 0 1px 4px rgba(20,30,42,.12)':'inset 0 1px 0 rgba(255,255,255,.5), 0 3px 8px rgba(20,30,42,.07)',
  }as ViewStyle):{}),
  transform:pressed?[{scale:.98}]:[],
 };
}
