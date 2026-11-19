import {colors,isNightPalette} from '@autodeck/ui/tokens';
import {lightColors,nightColors,darkColors} from '@autodeck/ui/theme';
/** Approved customer palette only. Staff applications never import this module. */
export function applyCustomerGlacier(){
 // Day ground is white (Meet, 19 Nov 2026: "white for the daytime ... unified across everywhere"); Night keeps the existing dark palette.
 Object.assign(lightColors,{canvas:'#ffffff',canvasDeep:'#f0f1f3',surface:'#f7f9fb',surfaceElevated:'#ffffff',borderSubtle:'rgba(113,133,155,.12)',borderStrong:'rgba(74,94,116,.27)',textPrimary:'#252c32',textSecondary:'#596979',textTertiary:'#5e6c7b',textOnAccent:'#ffffff',accent:'#EC8638',accentStrong:'#9e531a',accentHaze:'rgba(218,228,240,.8)',ink:'#252c32',onInk:'#ffffff'});
 const night={canvas:'#1c2229',canvasDeep:'#171d24',surface:'#252d37',surfaceElevated:'#303c4b',borderSubtle:'rgba(221,232,244,.08)',borderStrong:'rgba(221,232,244,.24)',textPrimary:'#ecf1f7',textSecondary:'#bdc9d6',textTertiary:'#b6c3d1',textOnAccent:'#ffffff',accent:'#EC8638',accentStrong:'#f4a76c',accentHaze:'rgba(57,75,96,.8)',ink:'#ecf1f7',onInk:'#202831'};
 Object.assign(nightColors,night);Object.assign(darkColors,night);
 const c=isNightPalette?night:lightColors;
 Object.assign(colors,{background:c.canvas,surface:c.surface,surfaceElevated:c.surfaceElevated,surfaceSunken:c.canvasDeep,textPrimary:c.textPrimary,textSecondary:c.textSecondary,textMuted:c.textTertiary,border:c.borderSubtle,borderStrong:c.borderStrong,divider:c.borderSubtle,accent:c.accent,accentPressed:c.accentStrong,accentMuted:c.accentHaze});
}
export const glacierGround=(night:boolean)=>night?'radial-gradient(ellipse at 15% 10%,#252e39 0%,transparent 50%),linear-gradient(135deg,#1c2229,#171d24)':'linear-gradient(135deg,#ffffff,#ffffff)';
