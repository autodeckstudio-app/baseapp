import { Platform, type ViewStyle } from 'react-native';
// Platform kept for future native/web divergence; current tonal chip is identical on both.
import { lightColors,nightColors } from '@autodeck/ui/theme';
import { raised, type Mode } from './raised';

/** Compact hairline chip for service actions (19 Nov user pick of compact-control concept A). State remains explicit in the label. */
export function serviceActionSurface(mode:Mode,selected=false,pressed=false):ViewStyle{
 const night=mode!=='light',colors=night?nightColors:lightColors;
 return {
  borderRadius:9999,
  borderWidth:1,
  borderColor:selected?colors.accentStrong:colors.borderSubtle,
  backgroundColor:selected?colors.accentHaze:'transparent',
  transform:pressed?[{scale:.98}]:[],
 };
}
